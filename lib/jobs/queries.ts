import "server-only";
import { sql } from "@/lib/db";
import { toDateInput } from "@/lib/format";
import type { ParsedLine } from "@/lib/funnel/money";

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
