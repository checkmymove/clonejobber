import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { BarList } from "@/components/bar-list";
import { MonthColumns } from "@/components/month-columns";
import { DashCard, DashTitle } from "@/components/dashboard/kit";
import { PeriodSelect } from "@/components/dashboard/period-select";
import { Avatar } from "@/components/team/team-ui";
import { cn } from "@/lib/cn";
import { COMPANY_SLUG } from "@/lib/company";
import { formatDateNumericLondon, formatGBP } from "@/lib/format";
import { categoryLabel } from "@/lib/expenses/constants";
import { PERFORMANCE_PERIODS, isPerformancePeriod } from "@/lib/funnel/periods";
import { getReport } from "@/lib/reports/queries";
import { hoursDecimal } from "@/lib/team/time";

export const dynamic = "force-dynamic";

function pct(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—";
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const sp = await searchParams;
  const period = isPerformancePeriod(sp.period) ? sp.period : "month";
  const r = await getReport(COMPANY_SLUG, period);
  const periodLabel = PERFORMANCE_PERIODS.find((p) => p.key === period)?.label ?? "This month";
  const profit = r.paid - (r.expenses ?? 0) - r.labour;

  const tiles: { label: string; value: number; note: React.ReactNode; tone?: "good" | "bad" }[] = [
    {
      label: "Invoiced",
      value: r.invoiced,
      note:
        r.trend === null ? (
          "Invoices issued"
        ) : (
          <span className={cn("inline-flex items-center gap-0.5 font-semibold", r.trend >= 0 ? "text-emerald-600" : "text-rose-600")}>
            {r.trend >= 0 ? <ArrowUpRight size={14} aria-hidden /> : <ArrowDownRight size={14} aria-hidden />}
            {r.trend >= 0 ? "+" : ""}
            {r.trend}% vs period before
          </span>
        ),
    },
    { label: "Paid", value: r.paid, note: `${r.paidCount} ${r.paidCount === 1 ? "invoice" : "invoices"} paid` },
    {
      label: "Expenses",
      value: r.expenses ?? 0,
      note: r.expenses === null ? "Needs the database update" : <Link href="/despesas" className="text-[#1d4ed8] hover:underline">See expenses</Link>,
    },
    { label: "Labour", value: r.labour, note: <Link href="/horas" className="text-[#1d4ed8] hover:underline">See timesheets</Link> },
    { label: "Profit", value: profit, note: "Paid − expenses − labour", tone: profit >= 0 ? "good" : "bad" },
  ];

  const steps = [
    { label: "Requests received", value: r.funnel.requests, rate: null },
    { label: "Quotes created", value: r.funnel.quotes, rate: null },
    { label: "Quotes approved", value: r.funnel.approved, rate: pct(r.funnel.approved, r.funnel.quotes) },
    { label: "Jobs created", value: r.funnel.jobs, rate: null },
    { label: "Invoices issued", value: r.funnel.invoices, rate: null },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reports"
        subtitle={`${periodLabel} · ${formatDateNumericLondon(r.from)} – ${formatDateNumericLondon(r.to)}`}
        action={<PeriodSelect value={period} />}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {tiles.map((t) => (
          <DashCard key={t.label} className={cn("p-5", t.label === "Profit" && "col-span-2 md:col-span-1")}>
            <p className="text-sm text-ink-soft">{t.label}</p>
            <p
              className={cn(
                "mt-1 text-[28px] font-bold leading-none tracking-tight",
                t.tone === "bad" ? "text-rose-600" : "text-ink",
              )}
            >
              {formatGBP(t.value)}
            </p>
            <p className="mt-2 text-xs text-ink-soft">{t.note}</p>
          </DashCard>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DashCard className="p-5">
          <DashTitle>Paid by month</DashTitle>
          <div className="mt-4">
            <MonthColumns points={r.paidByMonth} label="Paid by month, last 12 months" />
          </div>
        </DashCard>
        <DashCard className="p-5">
          <DashTitle>Expenses by month</DashTitle>
          <div className="mt-4">
            <MonthColumns points={r.expensesByMonth} label="Expenses by month, last 12 months" color="#64748b" />
          </div>
        </DashCard>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <DashCard className="p-5">
          <DashTitle>Sales funnel</DashTitle>
          <ul className="mt-3 divide-y divide-line text-sm">
            {steps.map((s) => (
              <li key={s.label} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-ink-soft">{s.label}</span>
                <span className="flex items-baseline gap-2">
                  {s.rate ? <span className="text-xs text-ink-mute">{s.rate}</span> : null}
                  <span className="min-w-8 text-right text-[17px] font-bold text-ink">{s.value}</span>
                </span>
              </li>
            ))}
          </ul>
        </DashCard>

        <DashCard className="p-5">
          <DashTitle>Top clients</DashTitle>
          <p className="mt-0.5 text-xs text-ink-soft">By value invoiced</p>
          <div className="mt-4">
            <BarList items={r.topClients.map((c) => ({ label: c.name, value: c.total }))} empty="No invoices in this period." />
          </div>
        </DashCard>

        <DashCard className="p-5">
          <DashTitle>Expenses by category</DashTitle>
          <div className="mt-4">
            {r.expenses === null ? (
              <p className="text-sm text-ink-mute">Run npm run migrate to start recording expenses.</p>
            ) : (
              <BarList
                items={r.expensesByCategory.map((e) => ({ label: categoryLabel(e.category), value: e.total }))}
                empty="No expenses in this period."
              />
            )}
          </div>
        </DashCard>

        <DashCard className="p-5 lg:col-span-2 xl:col-span-3">
          <DashTitle>Labour by person</DashTitle>
          {r.labourByMember.length === 0 ? (
            <p className="mt-3 text-sm text-ink-mute">No time logged in this period.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm tabular-nums">
                <thead>
                  <tr className="border-b border-line text-xs font-medium text-ink-soft">
                    <th className="py-2.5 pr-4 font-medium">Team member</th>
                    <th className="py-2.5 pr-4 text-right font-medium">Hours</th>
                    <th className="py-2.5 text-right font-medium">Pay</th>
                  </tr>
                </thead>
                <tbody>
                  {r.labourByMember.map((m) => (
                    <tr key={m.id} className="border-b border-line last:border-0">
                      <td className="py-2.5 pr-4">
                        <span className="flex items-center gap-2.5">
                          <Avatar id={m.id} name={m.name} size={26} />
                          <span className="font-medium text-ink">{m.name}</span>
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-right text-ink">{hoursDecimal(m.seconds) || "0"}h</td>
                      <td className="py-2.5 text-right font-semibold text-ink">{formatGBP(m.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DashCard>
      </div>
    </div>
  );
}
