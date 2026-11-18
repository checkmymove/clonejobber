import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ChevronRight } from "lucide-react";
import { DashCard, DashTitle } from "@/components/dashboard/kit";
import { PeriodSelect } from "@/components/dashboard/period-select";
import { cn } from "@/lib/cn";
import { formatGBP } from "@/lib/format";
import { PERFORMANCE_PERIODS, type PerformancePeriod } from "@/lib/funnel/periods";
import { prettyDay } from "@/lib/schedule/dates";

type Debtor = { id: string; name: string; balance: number; invoices: number };
type UpcomingJob = { id: string; number: string; title: string; client: string; date: string; total: number };

/** Short "Wed 19 Nov" label for a visit day. */
function shortDay(iso: string): string {
  return prettyDay(iso).replace(/,?\s\d{4}$/, "").replace(",", "");
}

function Trend({ trend }: { trend: number | null }) {
  if (trend === null) return <span className="text-slate-400">No earlier data</span>;
  const up = trend >= 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-semibold", up ? "text-emerald-600" : "text-rose-600")}>
      {up ? <ArrowUpRight size={14} aria-hidden /> : <ArrowDownRight size={14} aria-hidden />}
      {up ? "+" : ""}
      {trend}%
    </span>
  );
}

/** One block of the card (Receivables, Upcoming jobs): title, big value, note and a short list. */
function Section({
  title,
  href,
  value,
  note,
  children,
}: {
  title: string;
  href: string;
  value: number;
  note: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="py-4">
      <Link href={href} className="group -mx-2 flex items-start justify-between gap-3 rounded-lg px-2 py-1 hover:bg-slate-50">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-0.5 text-[13px] font-semibold text-slate-700">
            {title}
            <ChevronRight size={14} className="text-slate-400 group-hover:text-slate-600" aria-hidden />
          </p>
          <p className="text-xs text-slate-500">{note}</p>
        </div>
        <span className="shrink-0 text-right text-[19px] font-bold tracking-tight text-slate-900">{formatGBP(value)}</span>
      </Link>
      {children ? <ul className="mt-1.5 space-y-0.5">{children}</ul> : null}
    </div>
  );
}

function Item({ href, left, sub, right }: { href: string; left: string; sub?: string; right: string }) {
  return (
    <li>
      <Link
        href={href}
        className="-mx-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-1.5 text-[13px] hover:bg-slate-50"
      >
        <span className="min-w-0">
          <span className="block truncate font-medium text-slate-800">{left}</span>
          {sub ? <span className="block truncate text-xs text-slate-500">{sub}</span> : null}
        </span>
        <span className="font-semibold tabular-nums text-slate-700">{right}</span>
      </Link>
    </li>
  );
}

/**
 * Dashboard "Business performance", after Jobber's home card: revenue and paid for
 * the chosen period, then Receivables (who owes you) and Upcoming jobs (next 7 days).
 * Jobber's "Upcoming payouts" is left out: it belongs to Jobber Payments.
 */
export function BusinessPerformance({
  period,
  revenue,
  trend,
  paid,
  paidCount,
  receivable,
  debtorCount,
  debtors,
  upcoming,
  upcomingCount,
  upcomingJobs,
}: {
  period: PerformancePeriod;
  revenue: number;
  trend: number | null;
  paid: number;
  paidCount: number;
  receivable: number;
  debtorCount: number;
  debtors: Debtor[];
  upcoming: number;
  upcomingCount: number;
  upcomingJobs: UpcomingJob[];
}) {
  const meta = PERFORMANCE_PERIODS.find((p) => p.key === period) ?? PERFORMANCE_PERIODS[0];

  return (
    <DashCard className="p-4 sm:p-5">
      <DashTitle action={<PeriodSelect value={period} defaultValue="week" />}>Business performance</DashTitle>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <Link href="/relatorios" className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5 hover:bg-slate-50">
          <p className="text-xs text-slate-500">Revenue</p>
          <p className="text-[17px] font-bold tracking-tight text-slate-900">{formatGBP(revenue)}</p>
          <p className="text-[11px]">
            <Trend trend={trend} />
          </p>
        </Link>
        <Link href="/pagamentos" className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5 hover:bg-slate-50">
          <p className="text-xs text-slate-500">{meta.paid}</p>
          <p className="text-[17px] font-bold tracking-tight text-slate-900">{formatGBP(paid)}</p>
          <p className="text-[11px] text-slate-500">
            {paidCount} {paidCount === 1 ? "invoice" : "invoices"}
          </p>
        </Link>
      </div>

      <div className="mt-1 divide-y divide-slate-100">
        <Section
          title="Receivables"
          href="/faturas"
          value={receivable}
          note={
            debtorCount === 0
              ? "No one owes you"
              : `${debtorCount} ${debtorCount === 1 ? "client owes" : "clients owe"} you`
          }
        >
          {debtors.length
            ? debtors.map((d) => (
                <Item
                  key={d.id}
                  href={`/clientes/${d.id}`}
                  left={d.name}
                  sub={`${d.invoices} ${d.invoices === 1 ? "invoice" : "invoices"}`}
                  right={formatGBP(d.balance)}
                />
              ))
            : null}
        </Section>

        <Section
          title="Upcoming jobs"
          href="/servicos"
          value={upcoming}
          note={`${upcomingCount} ${upcomingCount === 1 ? "job" : "jobs"} in the next 7 days`}
        >
          {upcomingJobs.length
            ? upcomingJobs.map((j) => (
                <Item
                  key={j.id}
                  href={`/servicos/${j.id}`}
                  left={j.client || j.title}
                  sub={`${shortDay(j.date)} · ${j.number}`}
                  right={formatGBP(j.total)}
                />
              ))
            : null}
        </Section>
      </div>
    </DashCard>
  );
}
