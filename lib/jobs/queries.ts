import "server-only";
import { sql } from "@/lib/db";
import { penceToInput, toDateInput, todayLondonInput } from "@/lib/format";
import type { ParsedLine } from "@/lib/funnel/money";
import { getQuoteDetail, type QuoteDetail } from "@/lib/quotes/queries";
import {
  deriveJobStatus,
  nextVisitDate,
  type JobListStatus,
  type JobStatusVisit,
} from "@/lib/jobs/status";

export interface JobRow {
  id: string;
  number: string;
  status: string;
  title: string;
  total: number;
  scheduled_date: string | null;
  window_start: string;
  window_end: string;
  anytime: boolean;
  pickup_address: string;
  delivery_address: string;
  client_id: string;
  client_name: string;
  quote_number: string | null;
  remind_invoice: boolean;
  invoice_count: number;
  closed_at: string | null;
  created_at: string;
  visits: JobStatusVisit[];
  list_status: JobListStatus;
  next_visit: string | null;
}

export interface JobVisit {
  id: string;
  title: string;
  visit_date: string | null;
  start_time: string;
  end_time: string;
  anytime: boolean;
  later: boolean;
  assignee: string;
  instructions: string;
  status: string;
  completed_at: string | null;
  confirmed_by_client: boolean;
}

export interface JobInvoiceRow {
  id: string;
  number: string;
  status: string;
  due_on: string | null;
  subject: string;
  total: number;
  balance: number;
}

export interface JobDetail extends Omit<JobRow, "visits"> {
  quote_id: string | null;
  request_id: string | null;
  linked_request_id: string | null;
  request_number: string | null;
  request_submitted_at: string | null;
  instructions: string;
  notes: string;
  subtotal: number;
  discount: number;
  tax: number;
  quote_deposit: number;
  client_email: string;
  client_phone: string;
  client_address: string;
  lines: ParsedLine[];
  visits: JobVisit[];
  invoices: JobInvoiceRow[];
}

/** postgres.js returns `date` columns as Date objects; the UI expects YYYY-MM-DD. */
function asDateString(value: string | Date | null | undefined): string | null {
  const key = toDateInput(value);
  return key || null;
}

type JobListRaw = Omit<JobRow, "list_status" | "next_visit">;

export async function listJobs(companySlug: string, q = ""): Promise<JobRow[]> {
  const like = `%${q.trim()}%`;
  const rows = await sql<JobListRaw[]>`
    select j.id, j.number, j.status, j.title, j.total, j.scheduled_date,
           j.window_start, j.window_end, j.anytime,
           coalesce(nullif(j.pickup_address, ''),
             (select concat_ws(', ', nullif(a.address_line, ''), nullif(a.city, ''), nullif(a.postcode, ''))
              from client_addresses a where a.client_id = j.client_id
              order by a.is_primary desc, a.created_at limit 1), '') as pickup_address,
           j.delivery_address, j.client_id, j.remind_invoice, j.closed_at, j.created_at,
           trim(c.first_name || ' ' || c.last_name) as client_name,
           q.number as quote_number,
           (select count(*) from invoices i
             where i.job_id = j.id and i.status <> 'cancelled')::int as invoice_count,
           coalesce((
             select json_agg(json_build_object(
               'date', v.visit_date, 'later', v.later, 'status', v.status))
             from job_visits v where v.job_id = j.id
           ), '[]'::json) as visits
    from jobs j
    join companies co on co.id = j.company_id
    join clients c on c.id = j.client_id
    left join quotes q on q.id = j.quote_id
    where co.slug = ${companySlug}
      and (${q.trim() === ""}
        or j.number ilike ${like}
        or j.title ilike ${like}
        or j.pickup_address ilike ${like}
        or j.delivery_address ilike ${like}
        or c.first_name ilike ${like}
        or c.last_name ilike ${like})
    order by coalesce(j.scheduled_date, '9999-12-31'::date), j.created_at desc
  `;
  const today = todayLondonInput();
  return rows.map((row) => {
    const visits = row.visits.map((v) => ({ ...v, date: v.date ? String(v.date).slice(0, 10) : null }));
    return {
      ...row,
      scheduled_date: asDateString(row.scheduled_date),
      visits,
      list_status: deriveJobStatus(
        { status: row.status, remindInvoice: row.remind_invoice, invoiceCount: row.invoice_count },
        visits,
        today,
      ),
      next_visit: nextVisitDate(visits, today) ?? asDateString(row.scheduled_date),
    };
  });
}

export async function getJobDetail(id: string): Promise<JobDetail | null> {
  const rows = await sql<Omit<JobDetail, "lines" | "visits" | "invoices" | "list_status" | "next_visit">[]>`
    select j.id, j.number, j.status, j.title, j.total, j.scheduled_date,
           j.window_start, j.window_end, j.anytime, j.pickup_address,
           j.delivery_address, j.client_id, j.quote_id, j.request_id,
           j.instructions, j.notes, j.remind_invoice, j.subtotal, j.discount, j.tax,
           j.created_at, j.closed_at,
           coalesce(j.request_id, q.request_id) as linked_request_id,
           r.number as request_number, r.submitted_at as request_submitted_at,
           trim(c.first_name || ' ' || c.last_name) as client_name,
           c.email as client_email, c.phone as client_phone,
           coalesce((select concat_ws(', ', nullif(a.address_line, ''), nullif(a.city, ''), nullif(a.postcode, ''))
                     from client_addresses a where a.client_id = c.id
                     order by a.is_primary desc, a.created_at limit 1), '') as client_address,
           q.number as quote_number, coalesce(q.deposit, 0) as quote_deposit,
           (select count(*) from invoices i
             where i.job_id = j.id and i.status <> 'cancelled')::int as invoice_count
    from jobs j
    join clients c on c.id = j.client_id
    left join quotes q on q.id = j.quote_id
    left join requests r on r.id = coalesce(j.request_id, q.request_id)
    where j.id = ${id}
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  const [lines, visits, invoices] = await Promise.all([
    sql<ParsedLine[]>`
      select name, description, quantity::float as quantity,
             unit_price as "unitPrice", total
      from job_line_items where job_id = ${id} order by sort
    `,
    sql<JobVisit[]>`
      select id, title, visit_date, start_time, end_time, anytime, later,
             assignee, instructions, status, completed_at, confirmed_by_client
      from job_visits where job_id = ${id} order by visit_date nulls last, sort
    `,
    sql<JobInvoiceRow[]>`
      select id, number, status, due_on, subject, total, balance
      from invoices where job_id = ${id} order by created_at
    `,
  ]);
  const today = todayLondonInput();
  const normalised = visits.map((visit) => ({
    ...visit,
    visit_date: asDateString(visit.visit_date),
  }));
  const statusVisits = normalised.map((v) => ({ date: v.visit_date, later: v.later, status: v.status }));
  return {
    ...row,
    scheduled_date: asDateString(row.scheduled_date),
    lines,
    visits: normalised,
    invoices: invoices.map((i) => ({ ...i, due_on: asDateString(i.due_on) })),
    list_status: deriveJobStatus(
      { status: row.status, remindInvoice: row.remind_invoice, invoiceCount: row.invoice_count },
      statusVisits,
      today,
    ),
    next_visit: nextVisitDate(statusVisits, today),
  };
}

export interface JobKpis {
  recentVisits: number;
  recentRevenue: number;
  prevRecentVisits: number;
  scheduledVisits: number;
  scheduledRevenue: number;
}

/**
 * Recent visits: visits in the past 30 days including today. Visits scheduled: next 30
 * days excluding today. The amount totals the jobs of those visits, once per job.
 */
export async function getJobKpis(companySlug: string): Promise<JobKpis> {
  const rows = await sql<
    { recent: number; recent_rev: number; prev: number; next: number; next_rev: number }[]
  >`
    with t as (select (timezone('Europe/London', now()))::date as d),
    v as (
      select jv.visit_date, j.id as job_id, j.total
      from job_visits jv
      join jobs j on j.id = jv.job_id
      join companies co on co.id = j.company_id
      where co.slug = ${companySlug} and j.status <> 'cancelled'
        and jv.status <> 'cancelled' and jv.visit_date is not null and not jv.later
    )
    select
      (select count(*) from v, t where v.visit_date > t.d - 30 and v.visit_date <= t.d)::int as recent,
      coalesce((select sum(total) from (select distinct job_id, total from v, t
                where v.visit_date > t.d - 30 and v.visit_date <= t.d) x), 0)::int as recent_rev,
      (select count(*) from v, t where v.visit_date > t.d - 60 and v.visit_date <= t.d - 30)::int as prev,
      (select count(*) from v, t where v.visit_date > t.d and v.visit_date <= t.d + 30)::int as next,
      coalesce((select sum(total) from (select distinct job_id, total from v, t
                where v.visit_date > t.d and v.visit_date <= t.d + 30) x), 0)::int as next_rev
  `;
  const r = rows[0];
  return {
    recentVisits: r?.recent ?? 0,
    recentRevenue: r?.recent_rev ?? 0,
    prevRecentVisits: r?.prev ?? 0,
    scheduledVisits: r?.next ?? 0,
    scheduledRevenue: r?.next_rev ?? 0,
  };
}

export type JobVisitDraft = {
  id: string;
  title: string;
  date: string;
  later: boolean;
  start: string;
  end: string;
  anytime: boolean;
  assignee: string;
  instructions: string;
};

export type JobPrefill = {
  quoteId: string;
  requestId?: string;
  clientId: string;
  title: string;
  notes: string;
  discount: string;
  tax: string;
  visits: JobVisitDraft[];
  lines: { name: string; qty: string; price: string; description: string }[];
};

export async function getJobIdForQuote(quoteId: string): Promise<string | null> {
  const rows = await sql<{ id: string }[]>`
    select id from jobs where quote_id = ${quoteId} limit 1
  `;
  return rows[0]?.id ?? null;
}

function parseMoveTimeToInput(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const match = t.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return "";
  let hour = Number(match[1]);
  const minutes = match[2];
  const period = match[3]?.toUpperCase();
  if (period === "PM" && hour < 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;
  if (hour < 0 || hour > 23) return "";
  return `${String(hour).padStart(2, "0")}:${minutes}`;
}

function visitInstructionsFromQuote(q: QuoteDetail): string {
  const blocks: string[] = [];
  if (q.collection) {
    blocks.push(
      `Collection: ${q.collection.address}\nFloor: ${q.collection.floor} · Lift: ${q.collection.lift} · Parking: ${q.collection.parking} · Bedrooms: ${q.collection.bedrooms}`,
    );
  }
  if (q.delivery) {
    blocks.push(
      `Delivery: ${q.delivery.address}\nFloor: ${q.delivery.floor} · Lift: ${q.delivery.lift} · Parking: ${q.delivery.parking} · Bedrooms: ${q.delivery.bedrooms}`,
    );
  }
  if (q.packing) {
    blocks.push(`Packing services: ${q.packing.service}\nPacking materials: ${q.packing.materials}`);
  }
  if (q.inventory.trim()) blocks.push(q.inventory.trim());
  return blocks.join("\n\n");
}

export async function getJobPrefillFromQuote(quoteId: string): Promise<JobPrefill | null> {
  const q = await getQuoteDetail(quoteId);
  if (!q) return null;
  const moveDate = toDateInput(q.valid_until);
  const start = parseMoveTimeToInput(q.move_time);
  return {
    quoteId: q.id,
    requestId: q.request_id ?? undefined,
    clientId: q.client_id,
    title: q.title,
    notes: q.notes,
    discount: penceToInput(q.discount),
    tax: penceToInput(q.tax),
    visits: [
      {
        id: "visit-1",
        title: "",
        date: moveDate || new Date().toISOString().slice(0, 10),
        later: !moveDate,
        start,
        end: "",
        anytime: false,
        assignee: "",
        instructions: visitInstructionsFromQuote(q),
      },
    ],
    lines: q.lines.map((line) => ({
      name: line.name,
      description: line.description,
      qty: String(line.quantity),
      price: penceToInput(line.unitPrice),
    })),
  };
}
