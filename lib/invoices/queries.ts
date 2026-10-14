import "server-only";
import { sql } from "@/lib/db";
import { penceToInput, toDateInput, todayLondonInput } from "@/lib/format";
import { deriveInvoiceStatus, type InvoiceListStatus } from "@/lib/invoices/status";
import type { ParsedLine } from "@/lib/funnel/money";
import { getJobDetail } from "@/lib/jobs/queries";

export interface InvoiceRow {
  id: string;
  number: string;
  status: string;
  list_status: InvoiceListStatus;
  subject: string;
  total: number;
  balance: number;
  due_on: string;
  issued_on: string;
  client_id: string;
  client_name: string;
  job_number: string | null;
  sent_at: string | null;
  paid_at: string | null;
  closed_at: string | null;
  created_at: string;
}

export interface InvoiceDetail extends InvoiceRow {
  job_id: string | null;
  quote_id: string | null;
  quote_number: string | null;
  linked_request_id: string | null;
  message: string;
  notes: string;
  payment_terms: string;
  subtotal: number;
  discount: number;
  tax: number;
  bad_debt_amount: number;
  voided_at: string | null;
  client_email: string;
  client_phone: string;
  client_address: string;
  paid: number;
  lines: ParsedLine[];
}

type RawInvoice = Omit<InvoiceRow, "list_status">;

function withStatus<T extends RawInvoice>(row: T, today: string): T & { list_status: InvoiceListStatus } {
  const due_on = toDateInput(row.due_on);
  const issued_on = toDateInput(row.issued_on);
  return { ...row, due_on, issued_on, list_status: deriveInvoiceStatus(row.status, due_on, today) };
}

export async function listInvoices(companySlug: string, q = ""): Promise<InvoiceRow[]> {
  const like = `%${q.trim()}%`;
  const rows = await sql<RawInvoice[]>`
    select i.id, i.number, i.status, i.subject, i.total,
           i.balance, i.due_on, i.issued_on, i.client_id,
           i.sent_at, i.paid_at, i.closed_at, i.created_at,
           trim(c.first_name || ' ' || c.last_name) as client_name,
           j.number as job_number
    from invoices i
    join companies co on co.id = i.company_id
    join clients c on c.id = i.client_id
    left join jobs j on j.id = i.job_id
    where co.slug = ${companySlug}
      and (${q.trim() === ""}
        or i.number ilike ${like}
        or i.subject ilike ${like}
        or c.first_name ilike ${like}
        or c.last_name ilike ${like})
    order by i.created_at desc
  `;
  const today = todayLondonInput();
  return rows.map((r) => withStatus(r, today));
}

export async function getInvoiceDetail(id: string): Promise<InvoiceDetail | null> {
  const rows = await sql<Omit<InvoiceDetail, "lines" | "list_status">[]>`
    select i.id, i.number, i.status,
           i.subject, i.total, i.balance, i.due_on, i.issued_on, i.client_id,
           i.job_id, i.quote_id, i.message, i.notes, i.payment_terms, i.subtotal,
           i.discount, i.tax, i.bad_debt_amount, i.voided_at, i.closed_at,
           i.sent_at, i.paid_at, i.created_at,
           trim(c.first_name || ' ' || c.last_name) as client_name,
           c.email as client_email, c.phone as client_phone,
           coalesce((select concat_ws(', ', nullif(a.address_line, ''), nullif(a.city, ''), nullif(a.postcode, ''))
                     from client_addresses a where a.client_id = c.id
                     order by a.is_billing desc, a.is_primary desc, a.created_at limit 1), '') as client_address,
           j.number as job_number,
           q.number as quote_number,
           coalesce(j.request_id, q.request_id, jq.request_id) as linked_request_id,
           coalesce((select sum(a.amount) from payment_allocations a
                     where a.invoice_id = i.id), 0)::int as paid
    from invoices i
    join clients c on c.id = i.client_id
    left join jobs j on j.id = i.job_id
    left join quotes q on q.id = i.quote_id
    left join quotes jq on jq.id = j.quote_id
    where i.id = ${id}
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  const lines = await sql<ParsedLine[]>`
    select name, description, quantity::float as quantity,
           unit_price as "unitPrice", total
    from invoice_line_items where invoice_id = ${id} order by sort
  `;
  return { ...withStatus(row, todayLondonInput()), lines };
}

export interface InvoiceKpis {
  overview: Record<"past_due" | "awaiting_payment" | "draft", { count: number; balance: number }>;
  issuedCount: number;
  issuedTotal: number;
  issuedTrend: number | null;
  averageInvoice: number;
  averageTrend: number | null;
  avgDaysToPaid: number | null;
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}

function trend(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

/** Jobber invoice KPIs: issued = sent/issued in the last 30 days excluding today. */
export function invoiceKpis(rows: InvoiceRow[], today = todayLondonInput()): InvoiceKpis {
  const overview: InvoiceKpis["overview"] = {
    past_due: { count: 0, balance: 0 },
    awaiting_payment: { count: 0, balance: 0 },
    draft: { count: 0, balance: 0 },
  };
  for (const r of rows) {
    if (r.list_status in overview) {
      const key = r.list_status as keyof typeof overview;
      overview[key].count += 1;
      overview[key].balance += r.balance;
    }
  }
  const issued = rows.filter((r) => r.status !== "draft" && r.status !== "cancelled");
  const inWindow = (r: InvoiceRow, from: number, to: number) => {
    const age = daysBetween(r.issued_on, today);
    return age >= from && age <= to;
  };
  const current = issued.filter((r) => inWindow(r, 1, 30));
  const previous = issued.filter((r) => inWindow(r, 31, 60));
  const sum = (list: InvoiceRow[]) => list.reduce((s, r) => s + r.total, 0);
  const avg = (list: InvoiceRow[]) => (list.length ? Math.round(sum(list) / list.length) : 0);
  const paidRecently = rows.filter(
    (r) => r.status === "paid" && !r.closed_at && r.paid_at && daysBetween(toDateInput(r.paid_at), today) <= 7,
  );
  return {
    overview,
    issuedCount: current.length,
    issuedTotal: sum(current),
    issuedTrend: trend(current.length, previous.length),
    averageInvoice: avg(current),
    averageTrend: trend(avg(current), avg(previous)),
    avgDaysToPaid: paidRecently.length
      ? paidRecently.reduce((s, r) => s + Math.max(0, daysBetween(r.issued_on, toDateInput(r.paid_at))), 0) /
        paidRecently.length
      : null,
  };
}

export async function getInvoiceIdForJob(jobId: string): Promise<string | null> {
  const rows = await sql<{ id: string }[]>`
    select id from invoices where job_id = ${jobId} limit 1
  `;
  return rows[0]?.id ?? null;
}

export type InvoicePrefill = {
  jobId: string;
  quoteId?: string;
  clientId: string;
  subject: string;
  message: string;
  notes: string;
  discount: string;
  tax: string;
  lines: { name: string; qty: string; price: string; description: string }[];
};

export async function getInvoicePrefillFromJob(jobId: string): Promise<InvoicePrefill | null> {
  const job = await getJobDetail(jobId);
  if (!job) return null;
  return {
    jobId: job.id,
    quoteId: job.quote_id ?? undefined,
    clientId: job.client_id,
    subject: job.title || `Invoice from ${job.number}`,
    message:
      "Thank you for your business. Please contact us with any questions regarding this invoice.",
    notes: job.notes,
    discount: penceToInput(job.discount),
    tax: penceToInput(job.tax),
    lines: job.lines.map((line) => ({
      name: line.name,
      description: line.description,
      qty: String(line.quantity),
      price: penceToInput(line.unitPrice),
    })),
  };
}
