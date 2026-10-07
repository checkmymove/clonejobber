import "server-only";
import { sql } from "@/lib/db";
import { toDateInput } from "@/lib/format";
import { formatGBP } from "@/lib/format";
import { formatClock12, formatDaySlash } from "./dates";
import type { ScheduleItem, ScheduleLine, ScheduleSettings, ScheduleStatus } from "./types";

function asDay(value: string | Date | null | undefined): string | null {
  const key = toDateInput(value);
  return key || null;
}

function asLondonDay(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return asDay(value);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function place(address: string, postcode = ""): string {
  const street = address.trim();
  const code = postcode.trim();
  if (street && code && !street.toLowerCase().includes(code.toLowerCase())) {
    return `${street}, ${code}`;
  }
  return street || code;
}

function slash(value: string | Date | null | undefined): string {
  const day = asDay(value) || asLondonDay(value);
  return day ? formatDaySlash(day) : "";
}

function asStatus(value: string): ScheduleStatus {
  if (value === "done" || value === "cancelled") return value;
  return "scheduled";
}

type VisitRow = {
  id: string;
  visit_date: string | Date | null;
  start_time: string;
  end_time: string;
  anytime: boolean;
  later: boolean;
  assignee: string;
  instructions: string;
  status: string;
  confirmed_by_client: boolean;
  visit_title: string;
  job_id: string;
  job_number: string;
  job_title: string;
  job_total: number;
  pickup_address: string;
  delivery_address: string;
  client_id: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  company_name: string;
};

type TaskRow = {
  id: string;
  title: string;
  notes: string;
  task_date: string | Date | null;
  start_time: string;
  end_time: string;
  anytime: boolean;
  later: boolean;
  assignee: string;
  status: string;
  client_id: string | null;
  client_name: string | null;
  company_name: string;
};

type EventRow = {
  id: string;
  title: string;
  notes: string;
  event_date: string | Date | null;
  start_time: string;
  end_time: string;
  anytime: boolean;
  later: boolean;
  status: string;
  company_name: string;
};

type ReminderRow = {
  id: string;
  kind: "quote" | "invoice";
  title: string;
  reminder_date: string | Date;
  status: string;
  quote_id: string | null;
  invoice_id: string | null;
  document_number: string;
  document_status: string;
  document_total: number;
  quote_sent_at: string | Date | null;
  invoice_sent_at: string | Date | null;
  due_on: string | Date | null;
  client_id: string | null;
  client_name: string;
  pickup_address: string;
  pickup_postcode: string;
  delivery_address: string;
  delivery_postcode: string;
  job_id: string | null;
  job_pickup: string;
  job_delivery: string;
  company_name: string;
};

type AppointmentRow = {
  id: string;
  title: string;
  kind: string;
  starts_at: string;
  ends_at: string | null;
  notes: string;
  status: string;
  client_id: string;
  client_name: string;
  request_id: string | null;
  request_number: string | null;
  pickup_address: string;
  pickup_postcode: string;
  delivery_address: string;
  delivery_postcode: string;
  company_name: string;
};

type LineRow = { owner_id: string; name: string; quantity: number; total: number };

function quoteReminderSummary(row: ReminderRow): string {
  const sent = asLondonDay(row.quote_sent_at);
  const sentLabel = sent ? formatDaySlash(sent) : "";
  if (sentLabel && !row.job_id) {
    return `Quote was sent on ${sentLabel} but no job has been generated yet`;
  }
  if (sentLabel && row.job_id) {
    return `Quote was sent on ${sentLabel} and a job has been generated`;
  }
  if (row.document_status === "approved") return `Quote ${row.document_number} is approved`;
  return `Quote ${row.document_number} is ${row.document_status || "open"}`;
}

function invoiceReminderSummary(row: ReminderRow): string {
  const due = slash(row.due_on);
  const sent = asLondonDay(row.invoice_sent_at);
  const sentLabel = sent ? formatDaySlash(sent) : "";
  const money = row.document_total ? ` Outstanding ${formatGBP(row.document_total)}.` : "";
  if (row.document_status === "overdue" && due) {
    return `Invoice ${row.document_number} was due on ${due}.${money}`;
  }
  if (sentLabel && due) return `Invoice ${row.document_number} was sent on ${sentLabel} and is due on ${due}.${money}`;
  if (due) return `Invoice ${row.document_number} is due on ${due}.${money}`;
  return `Invoice reminder for ${row.document_number}.${money}`;
}

async function linesFor(ids: string[], kind: "quote" | "job" | "invoice"): Promise<Map<string, ScheduleLine[]>> {
  const map = new Map<string, ScheduleLine[]>();
  if (!ids.length) return map;
  const rows =
    kind === "quote"
      ? await sql<LineRow[]>`
          select quote_id as owner_id, name, quantity::float as quantity, total
          from quote_line_items where quote_id = any(${ids}::uuid[]) order by sort
        `
      : kind === "job"
        ? await sql<LineRow[]>`
            select job_id as owner_id, name, quantity::float as quantity, total
            from job_line_items where job_id = any(${ids}::uuid[]) order by sort
          `
        : await sql<LineRow[]>`
            select invoice_id as owner_id, name, quantity::float as quantity, total
            from invoice_line_items where invoice_id = any(${ids}::uuid[]) order by sort
          `;
  for (const row of rows) {
    const list = map.get(row.owner_id) ?? [];
    list.push({ name: row.name, quantity: row.quantity, total: row.total });
    map.set(row.owner_id, list);
  }
  return map;
}

function visitLabel(row: VisitRow): string {
  const clock = row.anytime || !row.start_time ? "" : `${formatClock12(row.start_time)} `;
  const name = row.client_name.trim() || "Client";
  const work = (row.visit_title || row.job_title || "Removal Service").trim();
  return `${clock}${name} – ${work}`.trim();
}

function appointmentClock(startsAt: string): { date: string; start: string; end: string } {
  const start = new Date(startsAt);
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(start);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(start);
  return { date, start: time, end: "" };
}

export type ScheduleBundle = {
  items: ScheduleItem[];
  unscheduled: ScheduleItem[];
  assignees: string[];
};

export async function getScheduleBundle(
  companySlug: string,
  from: string,
  to: string,
): Promise<ScheduleBundle> {
  const [visits, tasks, events, reminders, appointments] = await Promise.all([
    sql<VisitRow[]>`
      select v.id, v.visit_date, v.start_time, v.end_time, v.anytime, v.later,
             v.assignee, v.instructions, v.status, v.confirmed_by_client,
             v.title as visit_title, j.id as job_id, j.number as job_number,
             j.title as job_title, j.total as job_total,
             j.pickup_address, j.delivery_address,
             c.id as client_id,
             trim(c.first_name || ' ' || c.last_name) as client_name,
             coalesce(c.email, '') as client_email,
             coalesce(nullif(c.phone_mobile, ''), c.phone, '') as client_phone,
             co.name as company_name
      from job_visits v
      join jobs j on j.id = v.job_id
      join clients c on c.id = j.client_id
      join companies co on co.id = j.company_id
      where co.slug = ${companySlug}
        and j.status <> 'cancelled'
        and v.status <> 'cancelled'
        and (
          v.later = true
          or v.visit_date is null
          or (v.visit_date >= ${from}::date and v.visit_date <= ${to}::date)
        )
    `,
    sql<TaskRow[]>`
      select t.id, t.title, t.notes, t.task_date, t.start_time, t.end_time,
             t.anytime, t.later, t.assignee, t.status, t.client_id,
             case when c.id is null then null
                  else trim(c.first_name || ' ' || c.last_name) end as client_name,
             co.name as company_name
      from schedule_tasks t
      join companies co on co.id = t.company_id
      left join clients c on c.id = t.client_id
      where co.slug = ${companySlug}
        and t.status <> 'cancelled'
        and (
          t.later = true
          or t.task_date is null
          or (t.task_date >= ${from}::date and t.task_date <= ${to}::date)
        )
    `,
    sql<EventRow[]>`
      select e.id, e.title, e.notes, e.event_date, e.start_time, e.end_time,
             e.anytime, e.later, e.status, co.name as company_name
      from schedule_events e
      join companies co on co.id = e.company_id
      where co.slug = ${companySlug}
        and e.status <> 'cancelled'
        and (
          e.later = true
          or e.event_date is null
          or (e.event_date >= ${from}::date and e.event_date <= ${to}::date)
        )
    `,
    sql<ReminderRow[]>`
      select r.id, r.kind, r.title, r.reminder_date, r.status, r.quote_id, r.invoice_id,
             coalesce(q.number, i.number, '') as document_number,
             coalesce(q.status, i.status, '') as document_status,
             coalesce(q.total, i.total, 0) as document_total,
             q.sent_at as quote_sent_at, i.sent_at as invoice_sent_at, i.due_on,
             coalesce(qc.id, ic.id) as client_id,
             trim(coalesce(qc.first_name, ic.first_name, '') || ' ' ||
                  coalesce(qc.last_name, ic.last_name, '')) as client_name,
             coalesce(pl.address, '') as pickup_address,
             coalesce(pl.postcode, '') as pickup_postcode,
             coalesce(dl.address, '') as delivery_address,
             coalesce(dl.postcode, '') as delivery_postcode,
             (select j.id from jobs j where j.quote_id = q.id limit 1) as job_id,
             coalesce(ij.pickup_address, '') as job_pickup,
             coalesce(ij.delivery_address, '') as job_delivery,
             co.name as company_name
      from schedule_reminders r
      join companies co on co.id = r.company_id
      left join quotes q on q.id = r.quote_id
      left join invoices i on i.id = r.invoice_id
      left join clients qc on qc.id = q.client_id
      left join clients ic on ic.id = i.client_id
      left join requests qr on qr.id = q.request_id
      left join request_locations pl on pl.request_id = qr.id and pl.kind = 'pickup'
      left join request_locations dl on dl.request_id = qr.id and dl.kind = 'delivery'
      left join jobs ij on ij.id = i.job_id
      where co.slug = ${companySlug}
        and r.status <> 'cancelled'
        and r.reminder_date >= ${from}::date
        and r.reminder_date <= ${to}::date
    `,
    sql<AppointmentRow[]>`
      select a.id, a.title, a.kind, a.starts_at, a.ends_at, a.notes, a.status,
             a.client_id, a.request_id, r.number as request_number,
             trim(c.first_name || ' ' || c.last_name) as client_name,
             coalesce(pl.address, '') as pickup_address,
             coalesce(pl.postcode, '') as pickup_postcode,
             coalesce(dl.address, '') as delivery_address,
             coalesce(dl.postcode, '') as delivery_postcode,
             co.name as company_name
      from appointments a
      join companies co on co.id = a.company_id
      join clients c on c.id = a.client_id
      left join requests r on r.id = a.request_id
      left join request_locations pl on pl.request_id = r.id and pl.kind = 'pickup'
      left join request_locations dl on dl.request_id = r.id and dl.kind = 'delivery'
      where co.slug = ${companySlug}
        and a.status <> 'cancelled'
        and (a.starts_at at time zone 'Europe/London')::date >= ${from}::date
        and (a.starts_at at time zone 'Europe/London')::date <= ${to}::date
    `,
  ]);

  const [quoteLines, jobLines, invoiceLines] = await Promise.all([
    linesFor(reminders.map((row) => row.quote_id).filter((id): id is string => Boolean(id)), "quote"),
    linesFor(visits.map((row) => row.job_id), "job"),
    linesFor(reminders.map((row) => row.invoice_id).filter((id): id is string => Boolean(id)), "invoice"),
  ]);

  const items: ScheduleItem[] = [];

  for (const row of visits) {
    const date = asDay(row.visit_date);
    const unscheduled = row.later || !date;
    const lines = jobLines.get(row.job_id) ?? [];
    items.push({
      id: row.id,
      kind: "visit",
      title: visitLabel(row),
      date: unscheduled ? null : date,
      start: row.start_time,
      end: row.end_time,
      anytime: row.anytime || (!row.start_time && !unscheduled),
      unscheduled,
      status: asStatus(row.status),
      confirmed: row.confirmed_by_client,
      assignee: row.assignee,
      href: `/servicos/${row.job_id}`,
      editHref: `/servicos/${row.job_id}/editar`,
      clientName: row.client_name,
      clientId: row.client_id,
      clientEmail: row.client_email,
      clientPhone: row.client_phone,
      jobNumber: row.job_number,
      jobId: row.job_id,
      quoteId: null,
      invoiceId: null,
      address: row.pickup_address,
      deliveryAddress: row.delivery_address,
      notes: row.instructions,
      detailLabel: `${row.client_name} - ${row.job_number}`,
      summary: row.confirmed_by_client
        ? `${row.job_title || "Visit"} · confirmed by client`
        : row.job_title || row.instructions || "",
      teamLabel: row.assignee.trim() || row.company_name,
      lines,
      linesTotal: lines.reduce((sum, line) => sum + line.total, 0) || row.job_total,
    });
  }

  for (const row of tasks) {
    const date = asDay(row.task_date);
    const unscheduled = row.later || !date;
    items.push({
      id: row.id,
      kind: "task",
      title: row.title,
      date: unscheduled ? null : date,
      start: row.start_time,
      end: row.end_time,
      anytime: row.anytime,
      unscheduled,
      status: asStatus(row.status),
      confirmed: false,
      assignee: row.assignee,
      href: "/agenda",
      editHref: null,
      clientName: row.client_name ?? "",
      clientId: row.client_id,
      clientEmail: "",
      clientPhone: "",
      jobNumber: null,
      jobId: null,
      quoteId: null,
      invoiceId: null,
      address: "",
      deliveryAddress: "",
      notes: row.notes,
      detailLabel: row.client_name ? `${row.client_name} - ${row.title}` : row.title,
      summary: row.notes,
      teamLabel: row.assignee.trim() || row.company_name,
      lines: [],
      linesTotal: 0,
    });
  }

  for (const row of events) {
    const date = asDay(row.event_date);
    const unscheduled = row.later || !date;
    items.push({
      id: row.id,
      kind: "event",
      title: row.title,
      date: unscheduled ? null : date,
      start: row.start_time,
      end: row.end_time,
      anytime: row.anytime,
      unscheduled,
      status: asStatus(row.status),
      confirmed: false,
      assignee: "",
      href: "/agenda",
      editHref: null,
      clientName: "",
      clientId: null,
      clientEmail: "",
      clientPhone: "",
      jobNumber: null,
      jobId: null,
      quoteId: null,
      invoiceId: null,
      address: "",
      deliveryAddress: "",
      notes: row.notes,
      detailLabel: row.title,
      summary: row.notes,
      teamLabel: row.company_name,
      lines: [],
      linesTotal: 0,
    });
  }

  for (const row of reminders) {
    const isQuote = row.kind === "quote";
    const href = isQuote ? `/cotacoes/${row.quote_id}` : `/faturas/${row.invoice_id}`;
    const lines = isQuote
      ? (row.quote_id ? quoteLines.get(row.quote_id) ?? [] : [])
      : (row.invoice_id ? invoiceLines.get(row.invoice_id) ?? [] : []);
    const pickup = place(row.pickup_address, row.pickup_postcode) || row.job_pickup;
    const delivery = place(row.delivery_address, row.delivery_postcode) || row.job_delivery;
    items.push({
      id: row.id,
      kind: isQuote ? "quote_reminder" : "invoice_reminder",
      title: row.title,
      date: asDay(row.reminder_date),
      start: "",
      end: "",
      anytime: true,
      unscheduled: false,
      status: asStatus(row.status),
      confirmed: false,
      assignee: "",
      href,
      editHref: isQuote ? `/cotacoes/${row.quote_id}/editar` : `/faturas/${row.invoice_id}/editar`,
      clientName: row.client_name,
      clientId: row.client_id,
      clientEmail: "",
      clientPhone: "",
      jobNumber: null,
      jobId: row.job_id,
      quoteId: row.quote_id,
      invoiceId: row.invoice_id,
      address: pickup,
      deliveryAddress: delivery,
      notes: "",
      detailLabel: isQuote
        ? `${row.client_name} - Quote ${row.document_number}`
        : `${row.client_name} - Invoice ${row.document_number}`,
      summary: isQuote ? quoteReminderSummary(row) : invoiceReminderSummary(row),
      teamLabel: row.company_name,
      lines,
      linesTotal: lines.reduce((sum, line) => sum + line.total, 0) || row.document_total,
    });
  }

  for (const row of appointments) {
    const clock = appointmentClock(row.starts_at);
    const href = row.request_id ? `/solicitacoes/${row.request_id}` : `/clientes/${row.client_id}`;
    items.push({
      id: row.id,
      kind: "request",
      title: `${clock.start ? `${formatClock12(clock.start)} ` : ""}${row.title}`.trim(),
      date: clock.date,
      start: clock.start,
      end: "",
      anytime: false,
      unscheduled: false,
      status: asStatus(row.status),
      confirmed: false,
      assignee: "",
      href,
      editHref: row.request_id ? `/solicitacoes/${row.request_id}/editar` : null,
      clientName: row.client_name,
      clientId: row.client_id,
      clientEmail: "",
      clientPhone: "",
      jobNumber: null,
      jobId: null,
      quoteId: null,
      invoiceId: null,
      address: place(row.pickup_address, row.pickup_postcode),
      deliveryAddress: place(row.delivery_address, row.delivery_postcode),
      notes: row.notes,
      detailLabel: row.request_number
        ? `${row.client_name} - ${row.request_number}`
        : row.client_name,
      summary: row.notes || row.title,
      teamLabel: row.company_name,
      lines: [],
      linesTotal: 0,
    });
  }

  const unscheduled = items.filter((item) => item.unscheduled);
  const scheduled = items.filter((item) => !item.unscheduled);
  const assignees = [...new Set(items.map((item) => item.assignee.trim()).filter(Boolean))].sort();
  return { items: scheduled, unscheduled, assignees };
}

export async function getScheduleSettings(companySlug: string): Promise<ScheduleSettings> {
  const rows = await sql<{ hide_weekends: boolean; day_orientation: string }[]>`
    select s.hide_weekends, s.day_orientation
    from schedule_settings s
    join companies co on co.id = s.company_id
    where co.slug = ${companySlug}
    limit 1
  `;
  const row = rows[0];
  return {
    hideWeekends: Boolean(row?.hide_weekends),
    dayOrientation: row?.day_orientation === "horizontal" ? "horizontal" : "vertical",
  };
}
