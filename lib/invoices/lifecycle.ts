/**
 * Invoice "More" actions from Jobber: Close invoice (without payment / bad debt),
 * Re-open, Void and Delete. Payments themselves live in lib/payments/engine.ts.
 */
import { recalcInvoice } from "../payments/engine";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type LifecycleResult = { ok: boolean; id?: string; message?: string };

async function load(db: Db, companyId: string, invoiceId: string) {
  const rows = await db`
    select id, number, status, balance, total, sent_at,
           (select count(*) from payment_allocations a where a.invoice_id = invoices.id)::int
             as payment_count
    from invoices
    where id = ${invoiceId} and company_id = ${companyId}
    limit 1
    for update
  `;
  return rows[0] as
    | {
        id: string;
        number: string;
        status: string;
        balance: number;
        total: number;
        sent_at: string | null;
        payment_count: number;
      }
    | undefined;
}

async function log(db: Db, companyId: string, invoiceId: string, action: string, summary: string) {
  await db`
    insert into activity_log (company_id, actor, action, entity, entity_id, summary)
    values (${companyId}, 'admin', ${action}, 'invoice', ${invoiceId}, ${summary})
  `;
}

async function closeReminder(db: Db, invoiceId: string, status: "done" | "cancelled") {
  await db`
    update schedule_reminders set status = ${status}, updated_at = now()
    where invoice_id = ${invoiceId} and status = 'scheduled'
  `;
}

/** Close invoice → "Without recording a payment": status Paid even if a balance remains. */
export async function closeInvoiceWithoutPayment(
  db: Db,
  companyId: string,
  invoiceId: string,
): Promise<LifecycleResult> {
  const inv = await load(db, companyId, invoiceId);
  if (!inv) return { ok: false, message: "Invoice not found" };
  if (!["draft", "sent", "overdue"].includes(inv.status)) {
    return { ok: false, message: "Only an open invoice can be closed." };
  }
  await db`
    update invoices set status = 'paid', closed_at = now(), paid_at = now(),
      sent_at = coalesce(sent_at, now()), updated_at = now()
    where id = ${invoiceId}
  `;
  await closeReminder(db, invoiceId, "done");
  await log(db, companyId, invoiceId, "invoice.closed", `Invoice ${inv.number} closed without payment`);
  return { ok: true, id: invoiceId };
}

/** Close invoice → "Bad debt": the remaining balance is written off. */
export async function markInvoiceBadDebt(
  db: Db,
  companyId: string,
  invoiceId: string,
): Promise<LifecycleResult> {
  const inv = await load(db, companyId, invoiceId);
  if (!inv) return { ok: false, message: "Invoice not found" };
  if (!["sent", "overdue"].includes(inv.status)) {
    return { ok: false, message: "Only a sent invoice with a balance can become bad debt." };
  }
  if (inv.balance <= 0) return { ok: false, message: "This invoice has no balance to write off." };
  await db`
    update invoices set status = 'bad_debt', bad_debt_amount = ${inv.balance}, balance = 0,
      closed_at = now(), updated_at = now()
    where id = ${invoiceId}
  `;
  await closeReminder(db, invoiceId, "cancelled");
  await log(db, companyId, invoiceId, "invoice.bad_debt", `Invoice ${inv.number} marked as bad debt`);
  return { ok: true, id: invoiceId };
}

/** Re-open a paid, closed or bad-debt invoice. The balance comes back from the payments. */
export async function reopenInvoice(
  db: Db,
  companyId: string,
  invoiceId: string,
): Promise<LifecycleResult> {
  const inv = await load(db, companyId, invoiceId);
  if (!inv) return { ok: false, message: "Invoice not found" };
  if (!["paid", "bad_debt"].includes(inv.status)) {
    return { ok: false, message: "Only a paid or bad-debt invoice can be re-opened." };
  }
  await db`
    update invoices set
      status = case when sent_at is null then 'draft' else 'sent' end,
      closed_at = null, paid_at = null, bad_debt_amount = 0, updated_at = now()
    where id = ${invoiceId}
  `;
  await recalcInvoice(db, invoiceId);
  await db`
    update schedule_reminders set status = 'scheduled', updated_at = now()
    where invoice_id = ${invoiceId} and status in ('done', 'cancelled')
      and exists (select 1 from invoices i where i.id = ${invoiceId} and i.status in ('sent', 'overdue'))
  `;
  await log(db, companyId, invoiceId, "invoice.reopened", `Invoice ${inv.number} re-opened`);
  return { ok: true, id: invoiceId };
}

/** Void: kept for records, cannot be edited, sent or paid. Not allowed once paid in part. */
export async function voidInvoice(
  db: Db,
  companyId: string,
  invoiceId: string,
): Promise<LifecycleResult> {
  const inv = await load(db, companyId, invoiceId);
  if (!inv) return { ok: false, message: "Invoice not found" };
  if (inv.status === "cancelled") return { ok: true, id: invoiceId };
  if (inv.payment_count > 0) {
    return { ok: false, message: "Delete the payments on this invoice before voiding it." };
  }
  await db`
    update invoices set status = 'cancelled', voided_at = now(), balance = 0, updated_at = now()
    where id = ${invoiceId}
  `;
  await closeReminder(db, invoiceId, "cancelled");
  await log(db, companyId, invoiceId, "invoice.voided", `Invoice ${inv.number} voided`);
  return { ok: true, id: invoiceId };
}

export async function deleteInvoice(
  db: Db,
  companyId: string,
  invoiceId: string,
): Promise<LifecycleResult> {
  const inv = await load(db, companyId, invoiceId);
  if (!inv) return { ok: false, message: "Invoice not found" };
  if (inv.payment_count > 0) {
    return { ok: false, message: "Delete the payments on this invoice before deleting it." };
  }
  await db`delete from invoices where id = ${invoiceId}`;
  await log(db, companyId, invoiceId, "invoice.deleted", `Invoice ${inv.number} deleted`);
  return { ok: true, id: invoiceId };
}
