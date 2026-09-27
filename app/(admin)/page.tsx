import Link from "next/link";
import { formatGBP } from "@/lib/format";
import { getDashboard } from "@/lib/funnel/dashboard";
import { COMPANY_SLUG } from "@/lib/company";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

const weekday = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/London",
}).format(new Date());

function count(rows: { status: string; n: number }[], status: string) {
  return rows.find((r) => r.status === status)?.n ?? 0;
}

function sum(rows: { status: string; total?: number; balance?: number; n: number }[], statuses: string[], field: "total" | "balance" = "total") {
  return rows
    .filter((r) => statuses.includes(r.status))
    .reduce((s, r) => s + (r[field] ?? 0), 0);
}

export default async function DashboardPage() {
  const d = await getDashboard(COMPANY_SLUG);
  const reqNew = count(d.requests, "new") + count(d.requests, "review");
  const quotesApproved = count(d.quotes, "approved");
  const jobsAction = count(d.jobs, "scheduled") + count(d.jobs, "in_progress");
  const invOpen = count(d.invoices, "sent") + count(d.invoices, "overdue");
  const overdueJobs = d.todayJobs.filter((j) => j.status === "scheduled");
  const doneJobs = d.todayJobs.filter((j) => j.status === "done");
  const totalToday = d.todayJobs.reduce((s, j) => s + j.total, 0);
  const receive = d.debtors.reduce((s, r) => s + r.balance, 0);

  const funnel = [
    {
      key: "requests",
      href: "/solicitacoes",
      label: "Requests",
      count: reqNew,
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
      count: quotesApproved,
      amount: sum(d.quotes, ["approved"]),
      headline: "Approved",
      rows: [
        { label: `Draft (${count(d.quotes, "draft")})`, value: formatGBP(sum(d.quotes, ["draft"])) },
        { label: `Sent (${count(d.quotes, "sent")})`, value: formatGBP(sum(d.quotes, ["sent"])) },
      ],
      accent: "#a4445c",
    },
    {
      key: "jobs",
      href: "/servicos",
      label: "Jobs",
      count: jobsAction,
      amount: sum(d.jobs, ["scheduled", "in_progress"]),
      headline: "Need action",
      rows: [
        { label: `Scheduled (${count(d.jobs, "scheduled")})`, value: formatGBP(sum(d.jobs, ["scheduled"])) },
        { label: `In progress (${count(d.jobs, "in_progress")})`, value: formatGBP(sum(d.jobs, ["in_progress"])) },
      ],
      accent: "#2f7d3b",
    },
    {
      key: "invoices",
      href: "/faturas",
      label: "Invoices",
      count: invOpen,
      amount: sum(d.invoices, ["sent", "overdue"], "balance"),
      headline: "Awaiting payment",
      rows: [
        { label: `Draft (${count(d.invoices, "draft")})` },
        { label: `Overdue (${count(d.invoices, "overdue")})`, value: formatGBP(sum(d.invoices, ["overdue"], "balance")) },
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
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {funnel.map((f) => (
          <Link key={f.key} href={f.href}>
            <Card accent={f.accent} className="p-4 hover:bg-cream/60">
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

      <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_320px]">
        <section>
          <h2 className="mb-3 text-lg font-extrabold text-ink">Today’s jobs</h2>
          <Card className="p-4 sm:p-5">
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <div>
                <p className="text-xs text-ink-mute">Total</p>
                <p className="text-2xl font-extrabold text-ink">{formatGBP(totalToday)}</p>
              </div>
              <div>
                <p className="text-xs text-ink-mute">Scheduled</p>
                <p className="text-2xl font-extrabold text-ink">{overdueJobs.length}</p>
              </div>
              <div>
                <p className="text-xs text-ink-mute">Completed</p>
                <p className="text-2xl font-extrabold text-ink">{doneJobs.length}</p>
              </div>
              <Link
                href="/servicos"
                className="ml-auto self-center rounded-xl border border-line px-3 py-2 text-sm font-bold text-accent hover:bg-accent-soft"
              >
                View schedule
              </Link>
            </div>

            {d.todayJobs.length === 0 ? (
              <p className="mt-6 text-sm text-ink-mute">No jobs for today.</p>
            ) : (
              <div className="mt-6 space-y-2">
                {d.todayJobs.map((j) => (
                  <Link
                    key={j.id}
                    href={`/servicos/${j.id}`}
                    className="flex items-center gap-3 rounded-xl border border-line p-3"
                  >
                    <span className="h-10 w-1.5 rounded-full bg-accent" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-ink">
                        {j.client_name} — {j.title || "Job"}
                      </p>
                      <p className="text-xs text-ink-soft">
                        {j.window} · {j.number}
                      </p>
                    </div>
                    <span className="ml-auto text-sm font-bold text-ink">{formatGBP(j.total)}</span>
                  </Link>
                ))}
              </div>
            )}
          </Card>
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
              <p className="mt-1 text-xs text-ink-soft">{d.debtors.length} clients have a balance</p>
              <p className="mt-1 text-2xl font-extrabold text-ink">{formatGBP(receive)}</p>
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
