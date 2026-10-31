import "server-only";
import { sql } from "@/lib/db";
import { todayLondonInput } from "@/lib/format";
import { getPerformance, periodRange } from "@/lib/funnel/dashboard";
import type { PerformancePeriod } from "@/lib/funnel/periods";
import { expensesByMonth, isMissingExpensesTable } from "@/lib/expenses/queries";
import { addMonths, startOfMonth } from "@/lib/schedule/dates";

export type MonthPoint = { month: string; value: number };

export type Report = {
  from: string;
  to: string;
  invoiced: number;
  trend: number | null;
  paid: number;
  paidCount: number;
  /** null until migration 0025 (expenses) is applied. */
  expenses: number | null;
  expensesByCategory: { category: string; total: number }[];
  labour: number;
  labourByMember: { id: string; name: string; seconds: number; price: number }[];
  funnel: { requests: number; quotes: number; approved: number; jobs: number; invoices: number };
  topClients: { name: string; total: number }[];
  paidByMonth: MonthPoint[];
  expensesByMonth: MonthPoint[];
};

/** Everything the Reports page shows for one period, plus the last twelve months. */
export async function getReport(companySlug: string, period: PerformancePeriod): Promise<Report> {
  const today = todayLondonInput();
  const { from, to } = periodRange(period, today);
  const yearFrom = startOfMonth(addMonths(today, -11));

  const expenseTotals = async () => {
    try {
      return await sql<{ category: string; total: number }[]>`
        select e.category, sum(e.amount)::int as total
        from expenses e join companies co on co.id = e.company_id
        where co.slug = ${companySlug} and e.spent_on between ${from}::date and ${to}::date
        group by 1 order by 2 desc
      `;
    } catch (error) {
      if (isMissingExpensesTable(error)) return null;
      throw error;
    }
  };

  const [perf, expenses, labour, funnel, clients, paidMonths, expenseMonths] = await Promise.all([
    getPerformance(companySlug, period),
    expenseTotals(),
    sql<{ id: string; name: string; seconds: number; price: number }[]>`
      select m.id, m.name,
             sum(extract(epoch from (coalesce(t.ended_at, now()) - t.started_at)))::int as seconds,
             round(sum(extract(epoch from (coalesce(t.ended_at, now()) - t.started_at)) / 3600
                   * coalesce(t.hourly_rate, m.hourly_rate) * 100))::int as price
      from time_entries t
      join team_members m on m.id = t.member_id
      join companies co on co.id = t.company_id
      where co.slug = ${companySlug}
        and (t.started_at at time zone 'Europe/London')::date between ${from}::date and ${to}::date
      group by m.id, m.name
      order by seconds desc
    `,
    sql<{ requests: number; quotes: number; approved: number; jobs: number; invoices: number }[]>`
      select
        (select count(*) from requests r where r.company_id = co.id
          and (r.submitted_at at time zone 'Europe/London')::date between ${from}::date and ${to}::date)::int as requests,
        (select count(*) from quotes q where q.company_id = co.id
          and (q.created_at at time zone 'Europe/London')::date between ${from}::date and ${to}::date)::int as quotes,
        (select count(*) from quotes q where q.company_id = co.id and q.status = 'approved'
          and (q.created_at at time zone 'Europe/London')::date between ${from}::date and ${to}::date)::int as approved,
        (select count(*) from jobs j where j.company_id = co.id
          and (j.created_at at time zone 'Europe/London')::date between ${from}::date and ${to}::date)::int as jobs,
        (select count(*) from invoices i where i.company_id = co.id and i.status not in ('draft', 'cancelled')
          and i.issued_on between ${from}::date and ${to}::date)::int as invoices
      from companies co where co.slug = ${companySlug}
    `,
    sql<{ name: string; total: number }[]>`
      select trim(c.first_name || ' ' || c.last_name) as name, sum(i.total)::int as total
      from invoices i
      join clients c on c.id = i.client_id
      join companies co on co.id = i.company_id
      where co.slug = ${companySlug} and i.status not in ('draft', 'cancelled')
        and i.issued_on between ${from}::date and ${to}::date
      group by c.id, 1 order by 2 desc limit 5
    `,
    sql<{ month: string; total: number }[]>`
      select to_char((i.paid_at at time zone 'Europe/London')::date, 'YYYY-MM') as month, sum(i.total)::int as total
      from invoices i join companies co on co.id = i.company_id
      where co.slug = ${companySlug} and i.status = 'paid'
        and (i.paid_at at time zone 'Europe/London')::date between ${yearFrom}::date and ${today}::date
      group by 1
    `,
    expensesByMonth(companySlug, yearFrom, today),
  ]);

  const months = Array.from({ length: 12 }, (_, i) => addMonths(yearFrom, i).slice(0, 7));
  const paidMap = new Map(paidMonths.map((r) => [r.month, r.total]));

  return {
    from,
    to,
    invoiced: perf.revenue,
    trend: perf.trend,
    paid: perf.paid,
    paidCount: perf.paidCount,
    expenses: expenses ? expenses.reduce((s, e) => s + e.total, 0) : null,
    expensesByCategory: expenses ?? [],
    labour: labour.reduce((s, l) => s + (l.price ?? 0), 0),
    labourByMember: labour.map((l) => ({ ...l, price: l.price ?? 0 })),
    funnel: funnel[0] ?? { requests: 0, quotes: 0, approved: 0, jobs: 0, invoices: 0 },
    topClients: clients,
    paidByMonth: months.map((m) => ({ month: m, value: paidMap.get(m) ?? 0 })),
    expensesByMonth: months.map((m) => ({ month: m, value: expenseMonths.get(m) ?? 0 })),
  };
}
