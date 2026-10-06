import "server-only";
import { sql } from "@/lib/db";
import { penceToInput, toDateInput } from "@/lib/format";
import type { ParsedLine } from "@/lib/funnel/money";
import { getQuoteDetail, type QuoteDetail } from "@/lib/quotes/queries";

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
}

export interface JobDetail extends JobRow {
  quote_id: string | null;
  request_id: string | null;
  instructions: string;
  notes: string;
  remind_invoice: boolean;
  subtotal: number;
  created_at: string;
  lines: ParsedLine[];
  visits: JobVisit[];
}

/** postgres.js returns `date` columns as Date objects; the UI expects YYYY-MM-DD. */
function asDateString(value: string | Date | null | undefined): string | null {
  const key = toDateInput(value);
  return key || null;
}

export async function listJobs(companySlug: string, q = ""): Promise<JobRow[]> {
  const like = `%${q.trim()}%`;
  const rows = await sql<JobRow[]>`
    select j.id, j.number, j.status, j.title, j.total, j.scheduled_date,
           j.window_start, j.window_end, j.anytime, j.pickup_address,
           j.delivery_address, j.client_id,
           trim(c.first_name || ' ' || c.last_name) as client_name,
           q.number as quote_number
    from jobs j
    join companies co on co.id = j.company_id
    join clients c on c.id = j.client_id
    left join quotes q on q.id = j.quote_id
    where co.slug = ${companySlug}
      and (${q.trim() === ""}
        or j.number ilike ${like}
        or j.title ilike ${like}
        or j.pickup_address ilike ${like}
        or c.first_name ilike ${like}
        or c.last_name ilike ${like})
    order by coalesce(j.scheduled_date, '9999-12-31'::date), j.created_at desc
  `;
  return rows.map((row) => ({
    ...row,
    scheduled_date: asDateString(row.scheduled_date),
  }));
}

export async function getJobDetail(id: string): Promise<JobDetail | null> {
  const rows = await sql<JobDetail[]>`
    select j.id, j.number, j.status, j.title, j.total, j.scheduled_date,
           j.window_start, j.window_end, j.anytime, j.pickup_address,
           j.delivery_address, j.client_id, j.quote_id, j.request_id,
           j.instructions, j.notes, j.remind_invoice, j.subtotal, j.created_at,
           trim(c.first_name || ' ' || c.last_name) as client_name,
           q.number as quote_number
    from jobs j
    join clients c on c.id = j.client_id
    left join quotes q on q.id = j.quote_id
    where j.id = ${id}
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  const [lines, visits] = await Promise.all([
    sql<ParsedLine[]>`
      select name, description, quantity::float as quantity,
             unit_price as "unitPrice", total
      from job_line_items where job_id = ${id} order by sort
    `,
    sql<JobVisit[]>`
      select id, title, visit_date, start_time, end_time, anytime, later,
             assignee, instructions, status
      from job_visits where job_id = ${id} order by sort
    `,
  ]);
  return {
    ...row,
    scheduled_date: asDateString(row.scheduled_date),
    lines,
    visits: visits.map((visit) => ({
      ...visit,
      visit_date: asDateString(visit.visit_date),
    })),
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
