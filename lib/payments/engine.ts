/**
 * Payments ledger (Jobber "payment records"). DB functions take a postgres.js client
 * or transaction so callers can wrap them in sql.begin and tests can roll back.
 * Money in pence. A payment is allocated to one or more invoices; a deposit is taken
 * on a quote and allocated later to the invoice of that quote's job.
 */
import { parseGbpToPence } from "../funnel/money";
import { isUuid } from "../funnel/validation";
import { settleInvoice } from "../invoices/status";
import { isPaymentMethod, paymentDetailsText } from "./constants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type PaymentResult = {
  ok: boolean;
  id?: string;
  message?: string;
  errors?: Record<string, string>;
};

export type PaymentInput = {
  clientId: string;
  kind: "payment" | "deposit";
  method: string;
  /** YYYY-MM-DD */
  paidOn: string;
  reference: string;
  details: string;
  /** Required for a deposit. */
  quoteId?: string;
  /** Deposit amount in pounds. Payments take their amount from the allocations. */
  amount?: string;
  allocations: { invoiceId: string; amount: string }[];
};

export type ParsedPayment = {
  amount: number;
  allocations: { invoiceId: string; amount: number }[];
};

export function validatePaymentInput(input: PaymentInput): {
  errors: Record<string, string>;
  parsed: ParsedPayment;
} {
  const errors: Record<string, string> = {};
  if (!isUuid(input.clientId)) errors.clientId = "Select a client";
  if (input.kind !== "payment" && input.kind !== "deposit") errors.kind = "Invalid payment type";
  if (!isPaymentMethod(input.method)) errors.method = "Choose a payment method";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paidOn) || Number.isNaN(Date.parse(input.paidOn))) {
    errors.paidOn = "Invalid transaction date";
  }

  const allocations: ParsedPayment["allocations"] = [];
  for (const [i, a] of input.allocations.entries()) {
    if (!a.amount.trim()) continue;
    const pence = parseGbpToPence(a.amount);
    if (!isUuid(a.invoiceId)) errors[`allocations.${i}`] = "Invalid invoice";
    else if (pence == null) errors[`allocations.${i}`] = "Invalid amount";
    else if (pence > 0) allocations.push({ invoiceId: a.invoiceId, amount: pence });
  }

  let amount = allocations.reduce((s, a) => s + a.amount, 0);
  if (input.kind === "deposit") {
    if (!input.quoteId || !isUuid(input.quoteId)) errors.quoteId = "Choose the quote for this deposit";
    const pence = parseGbpToPence(input.amount ?? "");
    if (pence == null || pence <= 0) errors.amount = "Enter the deposit amount";
    else amount = pence;
  } else if (!allocations.length) {
    errors.allocations = "Enter a payment amount for at least one invoice";
  }
  return { errors, parsed: { amount, allocations } };
}

/** Recomputes balance and status of one invoice from its allocations. */
export async function recalcInvoice(db: Db, invoiceId: string): Promise<void> {
  const rows = await db`
    select i.id, i.company_id, i.status, i.total, i.bad_debt_amount, i.closed_at, i.sent_at,
           coalesce((select sum(a.amount) from payment_allocations a
                     where a.invoice_id = i.id), 0)::int as paid,
           (select max(p.paid_on) from payment_allocations a
              join payments p on p.id = a.payment_id
            where a.invoice_id = i.id) as last_paid_on
    from invoices i where i.id = ${invoiceId}
    limit 1
  `;
  const inv = rows[0];
  if (!inv) return;
  const next = settleInvoice({
    status: inv.status,
    total: inv.total,
    paid: inv.paid,
    badDebt: inv.bad_debt_amount,
    closedManually: Boolean(inv.closed_at),
    everSent: Boolean(inv.sent_at),
  });
  const becamePaid = next.status === "paid" && inv.status !== "paid";
  const leftPaid = inv.status === "paid" && next.status !== "paid";
  await db`
    update invoices set
      balance = ${next.balance},
      status = ${next.status},
      paid_at = case
        when ${becamePaid} then coalesce(${inv.last_paid_on}::timestamptz, now())
        when ${leftPaid} then null
        else paid_at end,
      updated_at = now()
    where id = ${invoiceId}
  `;
  if (becamePaid) {
    await db`
      update schedule_reminders set status = 'done', updated_at = now()
      where invoice_id = ${invoiceId} and status = 'scheduled'
    `;
  }
  if (leftPaid) {
    await db`
      update schedule_reminders set status = 'scheduled', updated_at = now()
      where invoice_id = ${invoiceId} and status = 'done'
    `;
  }
}

/** Open balance an invoice can still take, ignoring the given payment's own allocation. */
async function openBalance(db: Db, invoiceId: string, exceptPaymentId?: string): Promise<number> {
  const rows = await db`
    select i.total - i.bad_debt_amount
           - coalesce((select sum(a.amount) from payment_allocations a
                       where a.invoice_id = i.id
                         and (${exceptPaymentId ?? null}::uuid is null
                              or a.payment_id <> ${exceptPaymentId ?? null}::uuid)), 0) as open
    from invoices i where i.id = ${invoiceId}
  `;
  return Math.max(0, Number(rows[0]?.open ?? 0));
}

export async function recordPayment(
  db: Db,
  companyId: string,
  input: PaymentInput,
): Promise<PaymentResult> {
  const { errors, parsed } = validatePaymentInput(input);
  if (Object.keys(errors).length) return { ok: false, errors };

  const client = await db`
    select id from clients where id = ${input.clientId} and company_id = ${companyId}
  `;
  if (!client[0]) return { ok: false, errors: { clientId: "Client not found" } };

  const labels: string[] = [];
  let quoteId: string | null = null;
  if (input.kind === "deposit") {
    const q = await db`
      select id, number from quotes
      where id = ${input.quoteId} and client_id = ${input.clientId} and company_id = ${companyId}
    `;
    if (!q[0]) return { ok: false, errors: { quoteId: "Quote not found for this client" } };
    quoteId = q[0].id;
    labels.push(`Quote ${q[0].number}`);
  }

  for (const a of parsed.allocations) {
    const inv = await db`
      select id, number, status from invoices
      where id = ${a.invoiceId} and client_id = ${input.clientId} and company_id = ${companyId}
      for update
    `;
    if (!inv[0]) return { ok: false, message: "Invoice not found for this client." };
    if (inv[0].status === "cancelled" || inv[0].status === "bad_debt") {
      return { ok: false, message: `Invoice ${inv[0].number} is closed and cannot take payments.` };
    }
    const open = await openBalance(db, a.invoiceId);
    if (a.amount > open) {
      return { ok: false, message: `The amount for invoice ${inv[0].number} is more than its balance.` };
    }
    labels.push(`Invoice ${inv[0].number}`);
  }

  const details = input.details.trim() || paymentDetailsText(labels);
  const rows = await db`
    insert into payments
      (company_id, client_id, kind, method, amount, paid_on, reference, details, quote_id)
    values
      (${companyId}, ${input.clientId}, ${input.kind}, ${input.method}, ${parsed.amount},
       ${input.paidOn}, ${input.reference.trim()}, ${details}, ${quoteId})
    returning id
  `;
  const paymentId = rows[0].id;
  for (const a of parsed.allocations) {
    await db`
      insert into payment_allocations (payment_id, invoice_id, amount)
      values (${paymentId}, ${a.invoiceId}, ${a.amount})
    `;
    await recalcInvoice(db, a.invoiceId);
  }
  // A deposit taken after the invoice exists goes straight onto that invoice.
  if (quoteId && !parsed.allocations.length) {
    const inv = await db`
      select i.id from invoices i
      join jobs j on j.id = i.job_id
      where j.quote_id = ${quoteId} and i.status not in ('cancelled', 'bad_debt')
      order by i.created_at limit 1
    `;
    if (inv[0]) await applyDepositsToInvoice(db, inv[0].id);
  }
  await db`
    insert into activity_log (company_id, actor, action, entity, entity_id, summary)
    values (${companyId}, 'admin', ${input.kind === "deposit" ? "deposit.recorded" : "payment.recorded"},
            'payment', ${paymentId}, ${details})
  `;
  return { ok: true, id: paymentId };
}

/**
 * Allocates the unallocated part of every deposit on the invoice's quote
 * (via invoice.quote_id or its job's quote) to the invoice, up to its open balance.
 */
export async function applyDepositsToInvoice(db: Db, invoiceId: string): Promise<void> {
  const inv = await db`
    select i.id, i.client_id, coalesce(i.quote_id, j.quote_id) as quote_id
    from invoices i left join jobs j on j.id = i.job_id
    where i.id = ${invoiceId}
  `;
  const quoteId = inv[0]?.quote_id;
  if (!quoteId) return;
  const deposits = await db`
    select p.id, p.amount - coalesce((select sum(a.amount) from payment_allocations a
                                      where a.payment_id = p.id), 0) as free
    from payments p
    where p.quote_id = ${quoteId} and p.kind = 'deposit' and p.client_id = ${inv[0].client_id}
    order by p.paid_on, p.created_at
  `;
  for (const d of deposits) {
    const free = Number(d.free);
    if (free <= 0) continue;
    const open = await openBalance(db, invoiceId);
    if (open <= 0) break;
    const amount = Math.min(free, open);
    await db`
      insert into payment_allocations (payment_id, invoice_id, amount)
      values (${d.id}, ${invoiceId}, ${amount})
      on conflict (payment_id, invoice_id)
      do update set amount = payment_allocations.amount + excluded.amount
    `;
  }
  await recalcInvoice(db, invoiceId);
}

export async function updatePaymentDetails(
  db: Db,
  companyId: string,
  paymentId: string,
  input: { method: string; paidOn: string; reference: string; details: string },
): Promise<PaymentResult> {
  const errors: Record<string, string> = {};
  if (!isPaymentMethod(input.method)) errors.method = "Choose a payment method";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paidOn)) errors.paidOn = "Invalid transaction date";
  if (Object.keys(errors).length) return { ok: false, errors };
  const rows = await db`
    update payments set
      method = ${input.method},
      paid_on = ${input.paidOn},
      reference = ${input.reference.trim()},
      details = ${input.details.trim()},
      updated_at = now()
    where id = ${paymentId} and company_id = ${companyId}
    returning id
  `;
  if (!rows[0]) return { ok: false, message: "Payment not found" };
  return { ok: true, id: paymentId };
}

export async function deletePayment(
  db: Db,
  companyId: string,
  paymentId: string,
): Promise<PaymentResult & { invoiceIds?: string[] }> {
  const rows = await db`
    select id, amount, kind from payments where id = ${paymentId} and company_id = ${companyId}
  `;
  if (!rows[0]) return { ok: false, message: "Payment not found" };
  const allocs = await db`select invoice_id from payment_allocations where payment_id = ${paymentId}`;
  await db`delete from payments where id = ${paymentId}`;
  const invoiceIds = allocs.map((a: { invoice_id: string }) => a.invoice_id);
  for (const id of invoiceIds) await recalcInvoice(db, id);
  await db`
    insert into activity_log (company_id, actor, action, entity, entity_id, summary)
    values (${companyId}, 'admin', 'payment.deleted', 'payment', ${paymentId},
            ${`${rows[0].kind === "deposit" ? "Deposit" : "Payment"} of ${rows[0].amount} pence deleted`})
  `;
  return { ok: true, id: paymentId, invoiceIds };
}
