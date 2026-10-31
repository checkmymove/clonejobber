import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { DashCard, DashTitle } from "@/components/dashboard/kit";
import { PeriodSelect } from "@/components/dashboard/period-select";
import { cn } from "@/lib/cn";
import { formatGBP } from "@/lib/format";
import { PERFORMANCE_PERIODS, type PerformancePeriod } from "@/lib/funnel/periods";

type Row = { label: string; value: number; note: React.ReactNode; href: string };

export function BusinessPerformance({
  period,
  revenue,
  trend,
  receivable,
  owingCount,
  upcoming,
  upcomingCount,
  paid,
  paidCount,
}: {
  period: PerformancePeriod;
  revenue: number;
  trend: number | null;
  receivable: number;
  owingCount: number;
  upcoming: number;
  upcomingCount: number;
  paid: number;
  paidCount: number;
}) {
  const meta = PERFORMANCE_PERIODS.find((p) => p.key === period) ?? PERFORMANCE_PERIODS[0];
  const rows: Row[] = [
    {
      label: "Revenue",
      value: revenue,
      href: "/faturas",
      note:
        trend === null ? (
          <span className="text-slate-400">invoiced</span>
        ) : (
          <span className={cn("inline-flex items-center gap-0.5 font-semibold", trend >= 0 ? "text-emerald-600" : "text-rose-600")}>
            {trend >= 0 ? <ArrowUpRight size={14} aria-hidden /> : <ArrowDownRight size={14} aria-hidden />}
            {trend >= 0 ? "+" : ""}
            {trend}%
          </span>
        ),
    },
    { label: "Accounts receivable", value: receivable, href: "/faturas", note: `${owingCount} awaiting payment` },
    { label: "Upcoming jobs value", value: upcoming, href: "/servicos", note: `${upcomingCount} in next 7 days` },
    { label: meta.paid, value: paid, href: "/pagamentos", note: `${paidCount} ${paidCount === 1 ? "invoice" : "invoices"}` },
  ];

  return (
    <DashCard className="p-4 sm:p-5">
      <DashTitle action={<PeriodSelect value={period} />}>Business performance</DashTitle>
      <div className="mt-3 divide-y divide-slate-100">
        {rows.map((r) => (
          <Link
            key={r.label}
            href={r.href}
            className="-mx-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 rounded-lg px-2 py-3 hover:bg-slate-50"
          >
            <span className="text-[13px] text-slate-600">{r.label}</span>
            <span className="text-right text-[17px] font-bold tracking-tight text-slate-900">{formatGBP(r.value)}</span>
            <span className="col-span-2 text-right text-xs text-slate-500">
              {r.note}
            </span>
          </Link>
        ))}
      </div>
    </DashCard>
  );
}
