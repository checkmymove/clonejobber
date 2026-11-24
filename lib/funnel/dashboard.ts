import "server-only";
import { sql } from "@/lib/db";
import { todayLondonInput } from "@/lib/format";
import { addMonths, startOfMonth, startOfWeek } from "@/lib/schedule/dates";
import type { PerformancePeriod } from "@/lib/funnel/periods";
import { listRequests } from "@/lib/requests/queries";
import { listQuotes } from "@/lib/quotes/queries";
import { quoteFilterTally } from "@/lib/quotes/metrics";
import { archiveStaleQuotes } from "@/lib/quotes/auto-archive";
import { isRequestOverdue, requestListStatus } from "@/lib/requests/metrics";
import { listJobs } from "@/lib/jobs/queries";
import { listInvoices } from "@/lib/invoices/queries";

export type StatusTally = Record<string, { n: number; total: number }>;

function tally<T>(rows: T[], key: (row: T) => string, amount: (row: T) => number = () => 0): StatusTally {
  const out: StatusTally = {};
  for (const row of rows) {
    const k = key(row);
    out[k] ??= { n: 0, total: 0 };
    out[k].n += 1;
    out[k].total += amount(row);
  }
  return out;
}

function addDays(day: string, days: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Dashboard figures. Counts come from the same list queries and derived statuses
 * as the Requests, Quotes, Jobs and Invoices pages, so the numbers always match.
 */
export async function getDashboard(companySlug: string) {
  await archiveStaleQuotes(companySlug);
  const [requestRows, quoteRows, jobRows, invoiceRows, month] = await Promise.all([
    listRequests(companySlug),
    listQuotes(companySlug, "", { includeArchived: true }),
    listJobs(companySlug),
    listInvoices(companySlug),
    sql<{ revenue: number }[]>`
      select coalesce(sum(i.total), 0)::int as revenue
      from invoices i
      join companies co on co.id = i.company_id
      where co.slug = ${companySlug}
        and i.status = 'paid'
        and date_trunc('month', i.paid_at) = date_trunc('month', timezone('Europe/London', now()))
    `,
  ]);

  const today = todayLondonInput();
  const weekEnd = addDays(today, 7);

  // Same keys as the ?status= filters of each list, so a click shows exactly these rows.
  const requests = tally(requestRows, (r) => requestListStatus(r));
  requests.overdue = { n: requestRows.filter((r) => isRequestOverdue(r, today)).length, total: 0 };
  const quotes = quoteFilterTally(quoteRows);
  const jobs = tally(jobRows, (j) => j.list_status, (j) => j.total);
  const activeJobs = jobRows.filter((j) => j.list_status !== "archived");
  jobs.active = { n: activeJobs.length, total: activeJobs.reduce((s, j) => s + j.total, 0) };
  const invoices = tally(invoiceRows, (i) => i.list_status, (i) => i.balance);

  const liveJobs = jobRows.filter((j) => j.status !== "cancelled");
  const upcoming = liveJobs.filter((j) =>
    j.visits.some((v) => v.status === "scheduled" && !v.later && v.date && v.date >= today && v.date <= weekEnd),
  );
  const upcomingJobs = upcoming.reduce((s, j) => s + j.total, 0);
  const nextVisit = (j: (typeof upcoming)[number]) =>
    j.visits
      .filter((v) => v.status === "scheduled" && !v.later && v.date && v.date >= today && v.date <= weekEnd)
      .map((v) => v.date as string)
      .sort()[0];
  const upcomingList = upcoming
    .map((j) => ({ id: j.id, number: j.number, title: j.title, client: j.client_name, date: nextVisit(j), total: j.total }))
    .sort((a, b) => a.date.localeCompare(b.date) || b.total - a.total);

  const owing = invoiceRows.filter(
    (i) => (i.list_status === "past_due" || i.list_status === "awaiting_payment") && i.balance > 0,
  );
  const byClient = new Map<string, { id: string; name: string; balance: number; invoices: number }>();
  for (const i of owing) {
    const entry = byClient.get(i.client_id) ?? { id: i.client_id, name: i.client_name, balance: 0, invoices: 0 };
    entry.invoices += 1;
    entry.balance += i.balance;
    byClient.set(i.client_id, entry);
  }
  const allDebtors = [...byClient.values()].sort((a, b) => b.balance - a.balance);

  return {
    requests,
    quotes,
    jobs,
    invoices,
    debtors: allDebtors.slice(0, 5),
    debtorCount: allDebtors.length,
    receivable: allDebtors.reduce((s, d) => s + d.balance, 0),
    monthRevenue: month[0]?.revenue ?? 0,
    upcomingJobs,
    upcomingCount: upcoming.length,
    upcomingList: upcomingList.slice(0, 3),
    owingCount: owing.length,
  };
}


/** [from, to] London dates of a period and of the one before it, cut to the same length. */
export function periodRange(period: PerformancePeriod, today: string) {
  const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
  if (period === "week") {
    // Monday to today, against the same days of last week.
    const from = startOfWeek(today);
    const prevFrom = addDays(from, -7);
    return { from, to: today, prevFrom, prevTo: addDays(prevFrom, days(from, today)) };
  }
  if (period === "last_month") {
    const from = startOfMonth(addMonths(today, -1));
    const to = addDays(startOfMonth(today), -1);
    const prevFrom = startOfMonth(addMonths(today, -2));
    return { from, to, prevFrom, prevTo: addDays(from, -1) };
  }
  const from = period === "year" ? `${today.slice(0, 4)}-01-01` : startOfMonth(today);
  const prevFrom = period === "year" ? `${Number(today.slice(0, 4)) - 1}-01-01` : startOfMonth(addMonths(today, -1));
  return { from, to: today, prevFrom, prevTo: addDays(prevFrom, days(from, today)) };
}

/**
 * Business performance card: invoiced (revenue) and paid in the period, with revenue
 * compared to the same stretch of the period before.
 */
export async function getPerformance(companySlug: string, period: PerformancePeriod) {
  const today = todayLondonInput();
  const r = periodRange(period, today);
  const rows = await sql<{ revenue: number; previous: number; paid: number; paid_count: number }[]>`
    select
      coalesce(sum(i.total) filter (where i.status not in ('draft', 'cancelled')
        and i.issued_on between ${r.from}::date and ${r.to}::date), 0)::int as revenue,
      coalesce(sum(i.total) filter (where i.status not in ('draft', 'cancelled')
        and i.issued_on between ${r.prevFrom}::date and ${r.prevTo}::date), 0)::int as previous,
      coalesce(sum(i.total) filter (where i.status = 'paid'
        and (i.paid_at at time zone 'Europe/London')::date between ${r.from}::date and ${r.to}::date), 0)::int as paid,
      (count(*) filter (where i.status = 'paid'
        and (i.paid_at at time zone 'Europe/London')::date between ${r.from}::date and ${r.to}::date))::int as paid_count
    from invoices i
    join companies co on co.id = i.company_id
    where co.slug = ${companySlug}
  `;
  const row = rows[0] ?? { revenue: 0, previous: 0, paid: 0, paid_count: 0 };
  return {
    revenue: row.revenue,
    /** Percent change on the period before; null when there is nothing to compare. */
    trend: row.previous > 0 ? Math.round(((row.revenue - row.previous) / row.previous) * 100) : null,
    paid: row.paid,
    paidCount: row.paid_count,
  };
}
