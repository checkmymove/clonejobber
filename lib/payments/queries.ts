import "server-only";
import { sql } from "@/lib/db";
import { toDateInput, todayLondonInput } from "@/lib/format";

export interface PaymentRow {
  id: string;
  kind: string;
  method: string;
  status: string;
  amount: number;
  paid_on: string;
  reference: string;
  client_id: string;
  client_name: string;
  quote_id: string | null;
  quote_number: string | null;
  invoices: { id: string; number: string }[];
}

export interface PaymentDetail extends PaymentRow {
  details: string;
  receipt_sent_at: string | null;
  created_at: string;
  client_email: string;
  client_phone: string;
  client_address: string;
  allocations: {
    invoice_id: string;
    number: string;
    amount: number;
    total: number;
    balance: number;
    status: string;
  }[];
}

export type PaymentFilters = {
  q?: string;
  method?: string;
  kind?: string;
  /** "30d" | "month" | "last_month" | "year" | "" */
  range?: string;
};

export function rangeBounds(range: string | undefined, today = todayLondonInput()): [string, string] | null {
  const [y, m] = today.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  switch (range) {
    case "30d": {
      const d = new Date(`${today}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() - 29);
      return [d.toISOString().slice(0, 10), today];
    }
    case "month":
      return [`${y}-${pad(m)}-01`, `${y}-${pad(m)}-${pad(lastDay(y, m))}`];
    case "last_month": {
      const yy = m === 1 ? y - 1 : y;
      const mm = m === 1 ? 12 : m - 1;
      return [`${yy}-${pad(mm)}-01`, `${yy}-${pad(mm)}-${pad(lastDay(yy, mm))}`];
    }
    case "year":
      return [`${y}-01-01`, `${y}-12-31`];
    default:
      return null;
  }
}

export async function listPayments(companyId: string, f: PaymentFilters = {}): Promise<PaymentRow[]> {
  const q = (f.q ?? "").trim();
  const like = `%${q}%`;
  const bounds = rangeBounds(f.range);
  const rows = await sql<PaymentRow[]>`
    select p.id, p.kind, p.method, p.status, p.amount, p.paid_on, p.reference,
           p.client_id, trim(c.first_name || ' ' || c.last_name) as client_name,
           p.quote_id, q.number as quote_number,
           coalesce((
             select json_agg(json_build_object('id', i.id, 'number', i.number) order by i.number)
             from payment_allocations a join invoices i on i.id = a.invoice_id
             where a.payment_id = p.id
           ), '[]'::json) as invoices
    from payments p
    join clients c on c.id = p.client_id
    left join quotes q on q.id = p.quote_id
    where p.company_id = ${companyId}
      and (${f.method ?? ""} = '' or p.method = ${f.method ?? ""})
      and (${f.kind ?? ""} = '' or p.kind = ${f.kind ?? ""})
      and (${bounds === null} or p.paid_on between ${bounds?.[0] ?? null}::date and ${bounds?.[1] ?? null}::date)
      and (${q === ""}
        or c.first_name ilike ${like}
        or c.last_name ilike ${like}
        or p.reference ilike ${like}
        or p.details ilike ${like}
        or q.number ilike ${like}
        or exists (select 1 from payment_allocations a join invoices i on i.id = a.invoice_id
                   where a.payment_id = p.id and i.number ilike ${like}))
    order by p.paid_on desc, p.created_at desc
  `;
  return rows.map((r) => ({ ...r, paid_on: toDateInput(r.paid_on) }));
}

export async function getPaymentDetail(id: string): Promise<PaymentDetail | null> {
  const rows = await sql<PaymentDetail[]>`
    select p.id, p.kind, p.method, p.status, p.amount, p.paid_on, p.reference, p.details,
           p.receipt_sent_at, p.created_at,
           p.client_id, trim(c.first_name || ' ' || c.last_name) as client_name,
           c.email as client_email, c.phone as client_phone,
           p.quote_id, q.number as quote_number,
           '[]'::json as invoices
    from payments p
    join clients c on c.id = p.client_id
    left join quotes q on q.id = p.quote_id
    where p.id = ${id}
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  const [allocations, address] = await Promise.all([
    sql<PaymentDetail["allocations"]>`
      select a.invoice_id, i.number, a.amount, i.total, i.balance, i.status
      from payment_allocations a join invoices i on i.id = a.invoice_id
      where a.payment_id = ${id}
      order by i.number
    `,
    sql<{ line: string }[]>`
      select concat_ws(', ', nullif(address_line, ''), nullif(city, ''), nullif(postcode, '')) as line
      from client_addresses where client_id = ${row.client_id}
      order by is_billing desc, is_primary desc, created_at
      limit 1
    `,
  ]);
  return {
    ...row,
    paid_on: toDateInput(row.paid_on),
    client_address: address[0]?.line ?? "",
    allocations,
    invoices: allocations.map((a) => ({ id: a.invoice_id, number: a.number })),
  };
}

export interface OutstandingInvoice {
  id: string;
  number: string;
  status: string;
  due_on: string;
  total: number;
  balance: number;
  subject: string;
}

/** Invoices that can take a payment: draft, sent or past due with a balance. */
export async function listOutstandingInvoices(clientId: string): Promise<OutstandingInvoice[]> {
  const rows = await sql<OutstandingInvoice[]>`
    select id, number, status, due_on, total, balance, subject
    from invoices
    where client_id = ${clientId}
      and status in ('draft', 'sent', 'overdue')
      and balance > 0
    order by due_on, number
  `;
  return rows.map((r) => ({ ...r, due_on: toDateInput(r.due_on) }));
}

export interface DepositQuote {
  id: string;
  number: string;
  title: string;
  total: number;
  required: number;
  collected: number;
}

/** Quotes that can take a deposit (not declined or expired). */
export async function listDepositQuotes(clientId: string): Promise<DepositQuote[]> {
  return sql<DepositQuote[]>`
    select q.id, q.number, q.title, q.total, q.deposit as required,
           coalesce((select sum(p.amount) from payments p
                     where p.quote_id = q.id and p.kind = 'deposit'), 0)::int as collected
    from quotes q
    where q.client_id = ${clientId}
      and q.status not in ('rejected', 'expired')
      and q.archived_at is null
    order by q.created_at desc
  `;
}

export interface QuoteDepositSummary {
  required: number;
  collected: number;
  deposits: { id: string; amount: number; paid_on: string; method: string }[];
}

export async function getQuoteDeposits(quoteId: string): Promise<QuoteDepositSummary> {
  const [quote, deposits] = await Promise.all([
    sql<{ deposit: number }[]>`select deposit from quotes where id = ${quoteId}`,
    sql<QuoteDepositSummary["deposits"]>`
      select id, amount, paid_on, method from payments
      where quote_id = ${quoteId} and kind = 'deposit'
      order by paid_on, created_at
    `,
  ]);
  return {
    required: quote[0]?.deposit ?? 0,
    collected: deposits.reduce((s, d) => s + d.amount, 0),
    deposits: deposits.map((d) => ({ ...d, paid_on: toDateInput(d.paid_on) })),
  };
}

export interface InvoicePaymentLine {
  payment_id: string;
  kind: string;
  method: string;
  amount: number;
  paid_on: string;
}

export async function listInvoicePayments(invoiceId: string): Promise<InvoicePaymentLine[]> {
  const rows = await sql<InvoicePaymentLine[]>`
    select p.id as payment_id, p.kind, p.method, a.amount, p.paid_on
    from payment_allocations a join payments p on p.id = a.payment_id
    where a.invoice_id = ${invoiceId}
    order by p.paid_on, p.created_at
  `;
  return rows.map((r) => ({ ...r, paid_on: toDateInput(r.paid_on) }));
}

export interface PaymentMetrics {
  collected30: number;
  collectedPrev30: number;
  count30: number;
  avgDaysToPaid: number | null;
  avgDaysToPaidPrev: number | null;
  paidOnTimeRate: number | null;
  paidOnTimeRatePrev: number | null;
}

export async function getPaymentMetrics(companyId: string): Promise<PaymentMetrics> {
  const rows = await sql<
    {
      collected30: number;
      collected_prev30: number;
      count30: number;
      avg_days: number | null;
      avg_days_prev: number | null;
      on_time: number | null;
      on_time_prev: number | null;
    }[]
  >`
    with today as (select (timezone('Europe/London', now()))::date as d)
    select
      coalesce(sum(p.amount) filter (where p.paid_on > t.d - 30), 0)::int as collected30,
      coalesce(sum(p.amount) filter (where p.paid_on <= t.d - 30 and p.paid_on > t.d - 60), 0)::int
        as collected_prev30,
      (count(*) filter (where p.paid_on > t.d - 30))::int as count30,
      (select avg((timezone('Europe/London', i.paid_at))::date - i.issued_on)::float
         from invoices i where i.company_id = ${companyId} and i.status = 'paid'
           and i.closed_at is null and i.paid_at is not null
           and (timezone('Europe/London', i.paid_at))::date > t.d - 30) as avg_days,
      (select avg((timezone('Europe/London', i.paid_at))::date - i.issued_on)::float
         from invoices i where i.company_id = ${companyId} and i.status = 'paid'
           and i.closed_at is null and i.paid_at is not null
           and (timezone('Europe/London', i.paid_at))::date <= t.d - 30
           and (timezone('Europe/London', i.paid_at))::date > t.d - 60) as avg_days_prev,
      (select avg(case when (timezone('Europe/London', i.paid_at))::date <= i.due_on then 1.0 else 0.0 end)::float
         from invoices i where i.company_id = ${companyId} and i.status = 'paid'
           and i.closed_at is null and i.paid_at is not null
           and (timezone('Europe/London', i.paid_at))::date > t.d - 60) as on_time,
      (select avg(case when (timezone('Europe/London', i.paid_at))::date <= i.due_on then 1.0 else 0.0 end)::float
         from invoices i where i.company_id = ${companyId} and i.status = 'paid'
           and i.closed_at is null and i.paid_at is not null
           and (timezone('Europe/London', i.paid_at))::date <= t.d - 60
           and (timezone('Europe/London', i.paid_at))::date > t.d - 120) as on_time_prev
    from today t
    left join payments p on p.company_id = ${companyId}
    group by t.d
  `;
  const r = rows[0];
  return {
    collected30: r?.collected30 ?? 0,
    collectedPrev30: r?.collected_prev30 ?? 0,
    count30: r?.count30 ?? 0,
    avgDaysToPaid: r?.avg_days ?? null,
    avgDaysToPaidPrev: r?.avg_days_prev ?? null,
    paidOnTimeRate: r?.on_time ?? null,
    paidOnTimeRatePrev: r?.on_time_prev ?? null,
  };
}
