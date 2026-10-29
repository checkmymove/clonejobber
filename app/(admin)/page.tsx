import Link from "next/link";
import { formatGBP } from "@/lib/format";
import { getDashboard, type StatusTally } from "@/lib/funnel/dashboard";
import { JOB_STATUS_META } from "@/lib/jobs/status";
import { INVOICE_STATUS_META } from "@/lib/invoices/status";
import { COMPANY_SLUG } from "@/lib/company";
import { Card } from "@/components/ui";
import { TodaysAppointments } from "@/components/dashboard/todays-appointments";
import { getTodaysAppointments } from "@/lib/team/queries";

export const dynamic = "force-dynamic";

const weekday = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/London",
}).format(new Date());

function count(rows: StatusTally, ...statuses: string[]) {
  return statuses.reduce((s, k) => s + (rows[k]?.n ?? 0), 0);
}

function sum(rows: StatusTally, ...statuses: string[]) {
  return statuses.reduce((s, k) => s + (rows[k]?.total ?? 0), 0);
}

function row(rows: StatusTally, label: string, status: string) {
  return { label: `${label} (${count(rows, status)})`, value: formatGBP(sum(rows, status)) };
}

export default async function DashboardPage() {
  const [d, today] = await Promise.all([getDashboard(COMPANY_SLUG), getTodaysAppointments(COMPANY_SLUG)]);

  const funnel = [
    {
      key: "requests",
      href: "/solicitacoes",
      label: "Requests",
      count: count(d.requests, "new", "review"),
      amount: 0,
      headline: "New and in review",
      rows: [
        { label: `New (${count(d.requests, "new")})` },
        { label: `Awaiting review (${count(d.requests, "review")})` },
      ],
      accent: "#c07a1a",
    },
    {
      key: "quotes",
      href: "/cotacoes",
      label: "Quotes",
      count: count(d.quotes, "approved"),
      amount: sum(d.quotes, "approved"),
      headline: "Approved",
      rows: [
        row(d.quotes, "Draft", "draft"),
        row(d.quotes, "Awaiting response", "awaiting"),
        row(d.quotes, "Changes requested", "changes"),
      ],
      accent: "#a4445c",
    },
    {
      key: "jobs",
      href: "/servicos",
      label: "Jobs",
      count: count(d.jobs, "requires_invoicing"),
      amount: sum(d.jobs, "requires_invoicing"),
      headline: JOB_STATUS_META.requires_invoicing.label,
      rows: (["late", "action_required", "unscheduled", "today", "upcoming"] as const).map((s) =>
        row(d.jobs, JOB_STATUS_META[s].label, s),
      ),
      accent: "#2f7d3b",
    },
    {
      key: "invoices",
      href: "/faturas",
      label: "Invoices",
      count: count(d.invoices, "past_due", "awaiting_payment"),
      amount: sum(d.invoices, "past_due", "awaiting_payment"),
      headline: "Awaiting payment",
      rows: [
        row(d.invoices, INVOICE_STATUS_META.past_due.label, "past_due"),
        row(d.invoices, "Sent but not due", "awaiting_payment"),
        row(d.invoices, INVOICE_STATUS_META.draft.label, "draft"),
      ],
      accent: "#245d8a",
    },
  ];

  return (
    <div>
      <p suppressHydrationWarning className="text-sm font-semibold capitalize text-ink-soft">
        {weekday}
      </p>
      <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-ink">Good evening, Fabiano</h1>

      <h2 className="mb-3 mt-7 text-lg font-extrabold text-ink">Workflow</h2>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {funnel.map((f) => (
          <Link key={f.key} href={f.href} className="block h-full">
            <Card accent={f.accent} className="h-full p-4 hover:bg-cream/60">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">{f.label}</p>
              <p className="mt-2 text-3xl font-extrabold text-ink">
                {f.count}
                {f.amount > 0 ? (
                  <span className="ml-2 align-middle text-sm font-bold text-ink-soft">{formatGBP(f.amount)}</span>
                ) : null}
              </p>
              <p className="mt-1 text-sm font-bold text-ink">{f.headline}</p>
              <div className="mt-3 space-y-1.5 border-t border-line pt-3">
                {f.rows.map((r) => (
                  <p key={r.label} className="flex items-center justify-between text-[13px] text-ink-soft">
                    {r.label}
                    {"value" in r && r.value ? <span className="font-semibold text-ink">{r.value}</span> : null}
                  </p>
                ))}
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
        <section className="min-w-0">
          <h2 className="mb-3 text-lg font-extrabold text-ink">Today’s appointments</h2>
          <TodaysAppointments data={today} />
        </section>

        <section>
          <h2 className="mb-3 text-lg font-extrabold text-ink">Business performance</h2>
          <Card className="divide-y divide-line p-5">
            <div className="pb-4">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-ink">Accounts receivable</h3>
                <Link href="/faturas" className="text-ink-mute hover:text-ink" aria-label="View invoices">
                  ›
                </Link>
              </div>
              <p className="mt-1 text-xs text-ink-soft">{d.debtorCount} clients have a balance</p>
              <p className="mt-1 text-2xl font-extrabold text-ink">{formatGBP(d.receivable)}</p>
              <div className="mt-3 space-y-1.5">
                {d.debtors.map((r) => (
                  <div key={r.name} className="flex items-center justify-between text-[13px]">
                    <span className="text-ink-soft">{r.name}</span>
                    <span className="font-semibold text-ink">{formatGBP(r.balance)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="py-4">
              <h3 className="font-extrabold text-ink">This month’s revenue</h3>
              <p className="mt-1 text-xs text-ink-soft">Invoices paid this month</p>
              <p className="mt-1 text-2xl font-extrabold text-ink">{formatGBP(d.monthRevenue)}</p>
            </div>
            <div className="pt-4">
              <h3 className="font-extrabold text-ink">Upcoming jobs</h3>
              <p className="mt-1 text-xs text-ink-soft">Next 7 days</p>
              <p className="mt-1 text-2xl font-extrabold text-ink">{formatGBP(d.upcomingJobs)}</p>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
