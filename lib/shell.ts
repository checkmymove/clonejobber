import "server-only";
import { sql } from "@/lib/db";
import { todayLondonInput } from "@/lib/format";

export type ShellProfile = { id: string | null; name: string };
export type ShellAlert = { key: string; label: string; count: number; href: string };

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

/** What needs attention (counts), under the notifications in the top bar's bell. */
export async function getShellAlerts(companySlug: string): Promise<ShellAlert[]> {
  const today = todayLondonInput();
  const counts = await sql<{
    requests: number;
    to_convert: number;
    changes: number;
    past_due: number;
    to_invoice: number;
  }[]>`
    select
      (select count(*) from requests r where r.company_id = co.id and r.status = 'new'
        and not exists (select 1 from quotes q where q.request_id = r.id))::int as requests,
      (select count(*) from quotes q
        where q.company_id = co.id and q.status = 'approved' and q.archived_at is null
          and not exists (select 1 from jobs j where j.quote_id = q.id))::int as to_convert,
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
  const c = counts[0] ?? { requests: 0, to_convert: 0, changes: 0, past_due: 0, to_invoice: 0 };
  // Needs migration 0027; until it runs the bell simply leaves this out.
  const toSchedule = await sql<{ n: number }[]>`
    select count(*)::int as n
    from jobs j
    join companies co on co.id = j.company_id
    where co.slug = ${companySlug} and j.approved_at is not null and j.status in ('scheduled', 'in_progress')
      and not exists (select 1 from job_visits v where v.job_id = j.id and v.status <> 'cancelled' and v.visit_date is not null)
  `.catch(() => [{ n: 0 }]);
  const alerts: ShellAlert[] = [
    { key: "requests", label: "New requests to quote", count: c.requests, href: "/solicitacoes?status=new" },
    { key: "to_convert", label: "Approved quotes to convert to job", count: c.to_convert, href: "/cotacoes?status=approved" },
    { key: "changes", label: "Quotes with changes requested", count: c.changes, href: "/cotacoes?status=changes" },
    { key: "to_schedule", label: "Approved jobs to schedule", count: toSchedule[0]?.n ?? 0, href: "/servicos" },
    { key: "past_due", label: "Invoices past due", count: c.past_due, href: "/faturas?status=past_due" },
    { key: "to_invoice", label: "Jobs to invoice", count: c.to_invoice, href: "/servicos?status=requires_invoicing" },
  ];
  return alerts.filter((a) => a.count > 0);
}
