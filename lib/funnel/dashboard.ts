import "server-only";
import { sql } from "@/lib/db";
import { todayLondonInput } from "@/lib/format";
import { listRequests } from "@/lib/requests/queries";
import { listQuotes } from "@/lib/quotes/queries";
import { quoteListStatus } from "@/lib/quotes/metrics";
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
  const [requestRows, quoteRows, jobRows, invoiceRows, month] = await Promise.all([
    listRequests(companySlug),
    listQuotes(companySlug),
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

  const requests = tally(requestRows, (r) => r.status);
  const quotes = tally(
    quoteRows,
    (q) => quoteListStatus(q.status, q.converted_at, q.archived_at).key,
    (q) => q.total,
  );
  const jobs = tally(jobRows, (j) => j.list_status, (j) => j.total);
  const invoices = tally(invoiceRows, (i) => i.list_status, (i) => i.balance);

  const liveJobs = jobRows.filter((j) => j.status !== "cancelled");
  const upcomingJobs = liveJobs
    .filter((j) =>
      j.visits.some(
        (v) => v.status === "scheduled" && !v.later && v.date && v.date >= today && v.date <= weekEnd,
      ),
    )
    .reduce((s, j) => s + j.total, 0);

  const owing = invoiceRows.filter(
    (i) => (i.list_status === "past_due" || i.list_status === "awaiting_payment") && i.balance > 0,
  );
  const byClient = new Map<string, { name: string; balance: number }>();
  for (const i of owing) {
    const entry = byClient.get(i.client_id) ?? { name: i.client_name, balance: 0 };
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
  };
}
