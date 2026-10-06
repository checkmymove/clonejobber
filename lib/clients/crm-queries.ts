import "server-only";
import { sql } from "@/lib/db";

export interface CrmClient {
  id: string;
  title: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  client_type: string;
  status: string;
  email: string;
  phone: string;
  phone_mobile: string;
  payment_terms: string;
  payment_terms_custom: string | null;
  ask_for_review: boolean;
  marketing_email: boolean;
  marketing_sms: boolean;
  lead_source: string | null;
  created_at: string;
}

export interface Property {
  id: string;
  label: string;
  address_line: string;
  street_2: string;
  city: string;
  county: string;
  postcode: string;
  country: string;
  tax_rate: string | null;
  instructions: string;
  is_primary: boolean;
  is_billing: boolean;
  latitude: number | null;
  longitude: number | null;
}

export interface Contact {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  is_primary: boolean;
  notes: string;
}

export interface WorkItem {
  id: string;
  kind: "request" | "quote" | "job" | "invoice";
  ref: string;
  date: string;
  status: string;
  statusLabel: string;
  detail: string;
}

export interface Communication {
  id: string;
  channel: string;
  direction: string;
  subject: string;
  body: string;
  status: string;
  request_id: string | null;
  sent_at: string | null;
  opened_at: string | null;
  created_at: string;
}

export interface ClientFile {
  id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  source: "request" | "manual";
  source_id: string | null;
  created_at: string;
  url: string;
}

export interface Note {
  id: string;
  author: string;
  content: string;
  created_at: string;
}

export interface Appointment {
  id: string;
  title: string;
  kind: string;
  starts_at: string;
  ends_at: string | null;
  notes: string;
  status: string;
  request_id: string | null;
  request_number: string | null;
}

export function mapLink(a: { address_line: string; city: string; postcode: string }): string {
  const q = encodeURIComponent(
    [a.address_line, a.city, a.postcode].filter(Boolean).join(", "),
  );
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export async function getCrmClient(id: string): Promise<CrmClient | null> {
  const rows = await sql<CrmClient[]>`
    select c.id, c.title, c.first_name, c.last_name, c.company_name,
           c.client_type, c.status, c.email, c.phone, c.phone_mobile,
           c.payment_terms, c.payment_terms_custom, c.ask_for_review,
           c.marketing_email_consent as marketing_email,
           c.marketing_sms_consent as marketing_sms,
           ls.name as lead_source, c.created_at
    from clients c
    left join lead_sources ls on ls.id = c.lead_source_id
    where c.id = ${id} limit 1
  `;
  return rows[0] ?? null;
}

export async function getProperties(clientId: string): Promise<Property[]> {
  return sql<Property[]>`
    select id, label, address_line, street_2, city, county, postcode,
           country, tax_rate, instructions,
           is_primary, is_billing, latitude, longitude
    from client_addresses where client_id = ${clientId}
    order by is_primary desc, created_at
  `;
}

export async function getContacts(clientId: string): Promise<Contact[]> {
  return sql<Contact[]>`
    select id, name, role, phone, email, is_primary, notes
    from client_contacts where client_id = ${clientId}
    order by is_primary desc, created_at
  `;
}

const SCOPE: Record<
  WorkItem["kind"],
  { active: string[]; archived: string[] }
> = {
  request: { active: ["new", "review", "quoted"], archived: ["archived"] },
  quote: { active: ["draft", "sent", "changes_requested", "approved"], archived: ["rejected", "expired"] },
  job: { active: ["scheduled", "in_progress"], archived: ["done", "cancelled"] },
  invoice: { active: ["draft", "sent", "overdue"], archived: ["paid", "cancelled"] },
};

function inScope(
  kind: WorkItem["kind"],
  status: string,
  scope: "active" | "archived" | "all",
) {
  if (scope === "all") return true;
  return SCOPE[kind][scope].includes(status);
}

export async function getWorkOverview(
  clientId: string,
  types: ("request" | "quote" | "job" | "invoice")[],
  scope: "active" | "archived" | "all",
): Promise<{ items: WorkItem[]; pendingModules: string[] }> {
  const items: WorkItem[] = [];

  if (types.includes("request")) {
    const rows = await sql<{ id: string; number: string; status: string; submitted_at: string; pickup: string | null }[]>`
      select r.id, r.number, r.status, r.submitted_at, pl.address as pickup
      from requests r
      left join request_locations pl on pl.request_id = r.id and pl.kind = 'pickup'
      where r.client_id = ${clientId}
      order by r.submitted_at desc
    `;
    const labels: Record<string, string> = {
      new: "New",
      review: "Pending review",
      quoted: "Quoted",
      archived: "Archived",
    };
    for (const r of rows) {
      if (!inScope("request", r.status, scope)) continue;
      items.push({
        id: r.id,
        kind: "request",
        ref: r.number,
        date: r.submitted_at,
        status: r.status,
        statusLabel: labels[r.status] ?? r.status,
        detail: r.pickup ?? "",
      });
    }
  }

  if (types.includes("quote")) {
    const rows = await sql<{
      id: string;
      number: string;
      status: string;
      created_at: string;
      total: number;
      archived_at: string | null;
    }[]>`
      select id, number, status, created_at, total, archived_at from quotes
      where client_id = ${clientId} order by created_at desc
    `;
    const labels: Record<string, string> = {
      draft: "Draft",
      sent: "Sent",
      changes_requested: "Changes requested",
      approved: "Approved",
      rejected: "Declined",
      expired: "Expired",
    };
    for (const r of rows) {
      const archived = Boolean(r.archived_at);
      if (scope === "active" && archived) continue;
      if (scope === "archived" && !archived && !inScope("quote", r.status, "archived")) continue;
      if (scope === "active" && !inScope("quote", r.status, "active")) continue;
      items.push({
        id: r.id,
        kind: "quote",
        ref: r.number,
        date: r.created_at,
        status: archived ? "archived" : r.status,
        statusLabel: archived ? "Archived" : labels[r.status] ?? r.status,
        detail: `${(r.total / 100).toFixed(2)}`,
      });
    }
  }

  if (types.includes("job")) {
    const rows = await sql<{ id: string; number: string; status: string; created_at: string; title: string }[]>`
      select id, number, status, created_at, title from jobs
      where client_id = ${clientId} order by created_at desc
    `;
    const labels: Record<string, string> = {
      scheduled: "Scheduled",
      in_progress: "In progress",
      done: "Completed",
      cancelled: "Cancelled",
    };
    for (const r of rows) {
      if (!inScope("job", r.status, scope)) continue;
      items.push({
        id: r.id,
        kind: "job",
        ref: r.number,
        date: r.created_at,
        status: r.status,
        statusLabel: labels[r.status] ?? r.status,
        detail: r.title,
      });
    }
  }

  if (types.includes("invoice")) {
    const rows = await sql<{ id: string; number: string; status: string; created_at: string; total: number }[]>`
      select id, number,
        case when status = 'sent' and due_on < (timezone('Europe/London', now()))::date
          then 'overdue' else status end as status,
        created_at, total
      from invoices where client_id = ${clientId} order by created_at desc
    `;
    const labels: Record<string, string> = {
      draft: "Draft",
      sent: "Sent",
      paid: "Paid",
      overdue: "Past due",
      cancelled: "Cancelled",
    };
    for (const r of rows) {
      if (!inScope("invoice", r.status, scope)) continue;
      items.push({
        id: r.id,
        kind: "invoice",
        ref: r.number,
        date: r.created_at,
        status: r.status,
        statusLabel: labels[r.status] ?? r.status,
        detail: `${(r.total / 100).toFixed(2)}`,
      });
    }
  }

  items.sort((a, b) => +new Date(b.date) - +new Date(a.date));
  return { items, pendingModules: [] };
}

export interface Financials {
  lifetimePence: number;
  balancePence: number;
  invoicesReady: boolean;
}

/**
 * Lifetime value = total of non-cancelled invoices.
 * Current balance = open invoices balance minus unallocated payments.
 * Until the Invoices module creates public.invoices, both are 0 by rule
 * (computed, never hardcoded in the UI).
 */
export async function getClientFinancials(
  clientId: string,
): Promise<Financials> {
  const reg = await sql<{ exists: boolean }[]>`
    select (to_regclass('public.invoices') is not null) as exists
  `;
  if (!reg[0].exists) {
    return { lifetimePence: 0, balancePence: 0, invoicesReady: false };
  }
  // Invoices module contract (kept in sync when it lands):
  const rows = await sql<{ lifetime: number; balance: number }[]>`
    select
      coalesce(sum(case when status <> 'cancelled' then total else 0 end), 0)::int as lifetime,
      coalesce(sum(case when status in ('sent', 'overdue') then balance else 0 end), 0)::int as balance
    from invoices where client_id = ${clientId}
  `;
  return {
    lifetimePence: rows[0].lifetime,
    balancePence: rows[0].balance,
    invoicesReady: true,
  };
}

export async function getCommunications(
  clientId: string,
): Promise<Communication[]> {
  return sql<Communication[]>`
    select id, channel, direction, subject, body, status, request_id,
           sent_at, opened_at, created_at
    from communications where client_id = ${clientId}
    order by created_at desc limit 100
  `;
}

export async function getLastCommunication(
  clientId: string,
): Promise<Communication | null> {
  const rows = await sql<Communication[]>`
    select id, channel, direction, subject, body, status, request_id,
           sent_at, opened_at, created_at
    from communications where client_id = ${clientId}
    order by created_at desc limit 1
  `;
  return rows[0] ?? null;
}

export async function getClientFiles(
  clientId: string,
  source: "all" | "request" | "manual",
  kind: "all" | "images" | "documents",
  limit: number,
  offset: number,
): Promise<{ files: ClientFile[]; total: number }> {
  const typeCond =
    kind === "all"
      ? sql``
      : kind === "images"
        ? sql`and mime_type like 'image/%'`
        : sql`and mime_type not like 'image/%'`;
  const files = await sql<ClientFile[]>`
    with unified as (
      select ra.id, ra.file_name, ra.mime_type, ra.file_size, ra.created_at,
             'request'::text as source, ra.request_id::text as source_id
      from request_attachments ra
      join requests r on r.id = ra.request_id
      where r.client_id = ${clientId} ${typeCond}
      union all
      select cf.id, cf.file_name, cf.mime_type, cf.file_size, cf.created_at,
             'manual'::text as source, null::text as source_id
      from client_files cf
      where cf.client_id = ${clientId} ${typeCond}
    )
    select * from unified
    where (${source} = 'all' or source = ${source})
    order by created_at desc
    limit ${limit} offset ${offset}
  `;
  const counted = await sql<{ n: number }[]>`
    with unified as (
      select ra.id, ra.mime_type,
             'request'::text as source
      from request_attachments ra
      join requests r on r.id = ra.request_id
      where r.client_id = ${clientId} ${typeCond}
      union all
      select cf.id, cf.mime_type,
             'manual'::text as source
      from client_files cf
      where cf.client_id = ${clientId} ${typeCond}
    )
    select count(*)::int as n from unified
    where (${source} = 'all' or source = ${source})
  `;
  return {
    files: files.map((f) => ({
      ...f,
      url:
        f.source === "request"
          ? `/api/requests/${f.source_id}/files/${f.id}`
          : `/api/clients/${clientId}/files/${f.id}`,
    })),
    total: counted[0].n,
  };
}

export async function getNotes(clientId: string): Promise<Note[]> {
  return sql<Note[]>`
    select id, author, content, created_at from client_notes
    where client_id = ${clientId} order by created_at desc limit 100
  `;
}

export async function getTags(clientId: string): Promise<{ id: string; name: string }[]> {
  return sql<{ id: string; name: string }[]>`
    select t.id, t.name from tags t
    join client_tags ct on ct.tag_id = t.id
    where ct.client_id = ${clientId}
    order by t.name
  `;
}

export async function getAppointments(clientId: string): Promise<Appointment[]> {
  return sql<Appointment[]>`
    select a.id, a.title, a.kind, a.starts_at, a.ends_at, a.notes, a.status,
           a.request_id, r.number as request_number
    from appointments a
    left join requests r on r.id = a.request_id
    where a.client_id = ${clientId}
    order by a.starts_at desc limit 50
  `;
}
