import "server-only";
import { sql } from "@/lib/db";
import { todayLondonInput } from "@/lib/format";

export type ShellProfile = { id: string | null; name: string };
/** `meta` replaces the count badge on single items ("New request from Ana", "2h ago"). */
export type ShellAlert = { key: string; label: string; count: number; href: string; meta?: string };

function ago(at: string | Date): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(at).getTime()) / 60000));
  if (minutes < 60) return `${minutes || 1}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Who is signed in: the team member with the login's email, else the first administrator. */
export async function getShellProfile(companySlug: string, email: string): Promise<ShellProfile> {
  const members = await sql<{ id: string; name: string }[]>`
    select m.id, m.name
    from team_members m
    join companies co on co.id = m.company_id
    where co.slug = ${companySlug} and m.active
    order by (lower(m.email) = lower(${email}) and m.email <> '') desc,
             (m.role = 'owner') desc, (m.role = 'admin') desc, m.sort, m.name
    limit 1
  `;
  return members[0] ?? { id: null, name: email.split("@")[0] || "Admin" };
}

/** What needs attention, behind the top bar's bell. */
export async function getShellAlerts(companySlug: string): Promise<ShellAlert[]> {
  const today = todayLondonInput();
  const counts = await sql<{ requests: number; changes: number; past_due: number; to_invoice: number }[]>`
    select
      (select count(*) from requests r where r.company_id = co.id and r.status = 'new')::int as requests,
      (select count(*) from quotes q
        where q.company_id = co.id and q.status = 'changes_requested'
          and q.archived_at is null
          and not exists (select 1 from jobs j where j.quote_id = q.id))::int as changes,
      (select count(*) from invoices i
        where i.company_id = co.id and i.balance > 0
          and i.status not in ('draft', 'paid', 'bad_debt', 'cancelled')
          and (i.status = 'overdue' or i.due_on < ${today}::date))::int as past_due,
      (select count(*) from jobs j
        where j.company_id = co.id and j.status = 'done' and j.remind_invoice
          and not exists (select 1 from invoices i where i.job_id = j.id and i.status <> 'cancelled'))::int as to_invoice
    from companies co
    where co.slug = ${companySlug}
  `;
  const c = counts[0] ?? { requests: 0, changes: 0, past_due: 0, to_invoice: 0 };
  // Each new request is its own line, named after the client, newest first.
  const fresh = await sql<{ id: string; client: string; submitted_at: string }[]>`
    select r.id, trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')) as client, r.submitted_at
    from requests r
    join companies co on co.id = r.company_id
    join clients c on c.id = r.client_id
    where co.slug = ${companySlug} and r.status = 'new'
    order by r.submitted_at desc
    limit 8
  `;
  // Needs migration 0027; until it runs the bell simply leaves these out.
  const [referrals, approvedJobs] = await Promise.all([
    sql<{ id: string; client_id: string; client: string; name: string; created_at: string }[]>`
      select f.id, f.client_id, trim(c.first_name || ' ' || c.last_name) as client, f.name, f.created_at
      from referrals f
      join companies co on co.id = f.company_id
      join clients c on c.id = f.client_id
      where co.slug = ${companySlug} and f.created_at > now() - interval '14 days'
      order by f.created_at desc
      limit 5
    `.catch(() => []),
    sql<{ id: string; number: string; client: string; approved_at: string }[]>`
      select j.id, j.number, trim(c.first_name || ' ' || c.last_name) as client, j.approved_at
      from jobs j
      join companies co on co.id = j.company_id
      join clients c on c.id = j.client_id
      where co.slug = ${companySlug} and j.approved_at is not null and j.status in ('scheduled', 'in_progress')
        and not exists (select 1 from job_visits v where v.job_id = j.id and v.status <> 'cancelled' and v.visit_date is not null)
      order by j.approved_at desc
      limit 5
    `.catch(() => []),
  ]);
  const alerts: ShellAlert[] = [
    ...approvedJobs.map((j) => ({
      key: `job-approved-${j.id}`,
      label: `${j.client || "Client"} approved ${j.number}: schedule it`,
      count: 1,
      href: `/servicos/${j.id}`,
      meta: ago(j.approved_at),
    })),
    ...referrals.map((f) => ({
      key: `referral-${f.id}`,
      label: `${f.client || "A client"} referred ${f.name}`,
      count: 1,
      href: `/clientes/${f.client_id}`,
      meta: ago(f.created_at),
    })),
    ...fresh.map((r) => ({
      key: `request-${r.id}`,
      label: `New request from ${r.client || "a client"}`,
      count: 1,
      href: `/solicitacoes/${r.id}`,
      meta: ago(r.submitted_at),
    })),
    ...(c.requests > fresh.length
      ? [{ key: "requests", label: "More new requests", count: c.requests - fresh.length, href: "/solicitacoes" }]
      : []),
    { key: "changes", label: "Quotes with changes requested", count: c.changes, href: "/cotacoes" },
    { key: "past_due", label: "Invoices past due", count: c.past_due, href: "/faturas" },
    { key: "to_invoice", label: "Jobs to invoice", count: c.to_invoice, href: "/servicos" },
  ];
  return alerts.filter((a) => a.count > 0);
}
