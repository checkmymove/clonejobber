import "server-only";
import { sql } from "@/lib/db";
import { toDateInput } from "@/lib/format";

export type ExpenseRow = {
  id: string;
  spent_on: string;
  category: string;
  description: string;
  vendor: string;
  amount: number;
  payment_method: string;
  job_id: string | null;
  job_number: string | null;
  job_client: string | null;
};

/** True when the error is "relation expenses does not exist": migration 0025 not applied yet. */
export function isMissingExpensesTable(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "42P01";
}

/** Expenses between two London dates, newest first; null until migration 0025 runs. */
export async function listExpenses(companySlug: string, from: string, to: string): Promise<ExpenseRow[] | null> {
  try {
    const rows = await sql<(Omit<ExpenseRow, "spent_on"> & { spent_on: string | Date })[]>`
      select e.id, e.spent_on, e.category, e.description, e.vendor, e.amount, e.payment_method,
             e.job_id, j.number as job_number,
             nullif(trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), '') as job_client
      from expenses e
      join companies co on co.id = e.company_id
      left join jobs j on j.id = e.job_id
      left join clients c on c.id = j.client_id
      where co.slug = ${companySlug} and e.spent_on between ${from}::date and ${to}::date
      order by e.spent_on desc, e.created_at desc
    `;
    return rows.map((r) => ({ ...r, spent_on: toDateInput(r.spent_on) }));
  } catch (error) {
    if (isMissingExpensesTable(error)) return null;
    throw error;
  }
}

/** Pence spent per month (YYYY-MM) over a range; empty until migration 0025 runs. */
export async function expensesByMonth(companySlug: string, from: string, to: string): Promise<Map<string, number>> {
  try {
    const rows = await sql<{ month: string; total: number }[]>`
      select to_char(e.spent_on, 'YYYY-MM') as month, sum(e.amount)::int as total
      from expenses e join companies co on co.id = e.company_id
      where co.slug = ${companySlug} and e.spent_on between ${from}::date and ${to}::date
      group by 1
    `;
    return new Map(rows.map((r) => [r.month, r.total]));
  } catch (error) {
    if (isMissingExpensesTable(error)) return new Map();
    throw error;
  }
}

/** Recent jobs to link an expense to. */
export async function listJobsForExpenses(companySlug: string): Promise<{ id: string; label: string }[]> {
  const rows = await sql<{ id: string; number: string; client: string; title: string }[]>`
    select j.id, j.number, trim(c.first_name || ' ' || c.last_name) as client, coalesce(j.title, '') as title
    from jobs j
    join companies co on co.id = j.company_id
    join clients c on c.id = j.client_id
    where co.slug = ${companySlug} and j.status <> 'cancelled'
    order by j.created_at desc
    limit 200
  `;
  return rows.map((r) => ({ id: r.id, label: `${r.number} · ${r.client}${r.title ? ` · ${r.title}` : ""}` }));
}
