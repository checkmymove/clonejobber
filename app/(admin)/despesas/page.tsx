import { PageHeader } from "@/components/ui";
import { MonthNav } from "@/components/month-nav";
import { BarList } from "@/components/bar-list";
import { DashCard, DashTitle } from "@/components/dashboard/kit";
import { ExpenseManager } from "@/components/expenses/expense-manager";
import { COMPANY_SLUG } from "@/lib/company";
import { formatGBP, todayLondonInput } from "@/lib/format";
import { EXPENSE_CATEGORIES } from "@/lib/expenses/constants";
import { listExpenses, listJobsForExpenses } from "@/lib/expenses/queries";

export const dynamic = "force-dynamic";

function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const sp = await searchParams;
  const today = todayLondonInput();
  const month = sp.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month) ? sp.month : today.slice(0, 7);
  const { from, to } = monthRange(month);
  const [rows, jobs] = await Promise.all([listExpenses(COMPANY_SLUG, from, to), listJobsForExpenses(COMPANY_SLUG)]);

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle="What the business spends: fuel, van hire, materials and the rest."
        action={<MonthNav path="/despesas" month={month} />}
      />

      {rows === null ? (
        <DashCard className="p-5">
          <p className="font-semibold text-ink">Expenses need the latest database update.</p>
          <p className="mt-1 text-sm text-ink-soft">
            Run <code className="rounded bg-cream px-1.5 py-0.5">npm run migrate</code> once and reload this page.
          </p>
        </DashCard>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <ExpenseManager rows={rows} jobs={jobs} today={month === today.slice(0, 7) ? today : from} />
          <div className="grid gap-4">
            <DashCard className="p-5">
              <p className="text-sm text-ink-soft">Total spent</p>
              <p className="mt-1 text-[32px] font-bold leading-none tracking-tight text-ink">
                {formatGBP(rows.reduce((s, r) => s + r.amount, 0))}
              </p>
              <p className="mt-2 text-sm text-ink-soft">
                {rows.length} {rows.length === 1 ? "expense" : "expenses"}
                {rows.some((r) => r.job_id) ? ` · ${rows.filter((r) => r.job_id).length} linked to jobs` : ""}
              </p>
            </DashCard>
            <DashCard className="p-5">
              <DashTitle>By category</DashTitle>
              <div className="mt-4">
                <BarList
                  items={EXPENSE_CATEGORIES.map((c) => ({
                    label: c.label,
                    value: rows.filter((r) => r.category === c.key).reduce((s, r) => s + r.amount, 0),
                  }))}
                  empty="No expenses this month."
                />
              </div>
            </DashCard>
          </div>
        </div>
      )}
    </div>
  );
}
