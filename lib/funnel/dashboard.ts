import "server-only";
import { sql } from "@/lib/db";

export async function getDashboard(companySlug: string) {
  const [requests, quotes, jobs, invoices, todayJobs, debtors] = await Promise.all([
    sql<{ status: string; n: number }[]>`
      select r.status, count(*)::int as n
      from requests r
      join companies co on co.id = r.company_id
      where co.slug = ${companySlug}
      group by r.status
    `,
    sql<{ status: string; n: number; total: number }[]>`
      select q.status, count(*)::int as n, coalesce(sum(q.total), 0)::int as total
      from quotes q
      join companies co on co.id = q.company_id
      where co.slug = ${companySlug}
      group by q.status
    `,
    sql<{ status: string; n: number; total: number }[]>`
      select j.status, count(*)::int as n, coalesce(sum(j.total), 0)::int as total
      from jobs j
      join companies co on co.id = j.company_id
      where co.slug = ${companySlug}
      group by j.status
    `,
    sql<{ status: string; n: number; total: number; balance: number }[]>`
      select
        case
          when i.status = 'sent' and i.due_on < (timezone('Europe/London', now()))::date
            then 'overdue' else i.status
        end as status,
        count(*)::int as n,
        coalesce(sum(i.total), 0)::int as total,
        coalesce(sum(i.balance), 0)::int as balance
      from invoices i
      join companies co on co.id = i.company_id
      where co.slug = ${companySlug}
      group by 1
    `,
    sql<{
      id: string;
      number: string;
      title: string;
      window: string;
      total: number;
      status: string;
      client_name: string;
    }[]>`
      select j.id, j.number, j.title,
             case
               when j.anytime then 'Anytime'
               when j.window_start <> '' and j.window_end <> ''
                 then j.window_start || ' – ' || j.window_end
               else '—'
             end as window,
             j.total, j.status,
             trim(c.first_name || ' ' || c.last_name) as client_name
      from jobs j
      join companies co on co.id = j.company_id
      join clients c on c.id = j.client_id
      where co.slug = ${companySlug}
        and j.scheduled_date = (timezone('Europe/London', now()))::date
        and j.status <> 'cancelled'
      order by j.window_start, j.created_at
    `,
    sql<{ name: string; balance: number }[]>`
      select trim(c.first_name || ' ' || c.last_name) as name,
             sum(i.balance)::int as balance
      from invoices i
      join companies co on co.id = i.company_id
      join clients c on c.id = i.client_id
      where co.slug = ${companySlug}
        and i.status in ('sent', 'overdue')
        and i.balance > 0
      group by c.id, c.first_name, c.last_name
      order by 2 desc
      limit 5
    `,
  ]);

  const month = await sql<{ revenue: number; upcoming: number }[]>`
    select
      coalesce((
        select sum(total) from invoices i
        join companies co on co.id = i.company_id
        where co.slug = ${companySlug}
          and i.status = 'paid'
          and date_trunc('month', i.paid_at) = date_trunc('month', timezone('Europe/London', now()))
      ), 0)::int as revenue,
      coalesce((
        select sum(total) from jobs j
        join companies co on co.id = j.company_id
        where co.slug = ${companySlug}
          and j.status in ('scheduled', 'in_progress')
          and j.scheduled_date between (timezone('Europe/London', now()))::date
            and (timezone('Europe/London', now()))::date + 7
      ), 0)::int as upcoming
  `;

  return {
    requests,
    quotes,
    jobs,
    invoices,
    todayJobs,
    debtors,
    monthRevenue: month[0]?.revenue ?? 0,
    upcomingJobs: month[0]?.upcoming ?? 0,
  };
}
