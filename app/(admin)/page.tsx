import { getDashboard, getPerformance, type StatusTally } from "@/lib/funnel/dashboard";
import { isPerformancePeriod } from "@/lib/funnel/periods";
import { requireAdmin } from "@/lib/auth/session";
import { COMPANY_SLUG } from "@/lib/company";
import { greetingLondon, todayLondonInput } from "@/lib/format";
import { formatClock12, isIsoDate } from "@/lib/schedule/dates";
import { getShellProfile } from "@/lib/shell";
import { getTodaysAppointments, getWeeklyTimesheets } from "@/lib/team/queries";
import { TodaysAppointments } from "@/components/dashboard/todays-appointments";
import { BusinessPerformance } from "@/components/dashboard/business-performance";
import { WeeklyTimesheets } from "@/components/dashboard/weekly-timesheets";
import { LiveMap, type MapPoint } from "@/components/dashboard/live-map";
import { DateNav } from "@/components/dashboard/date-nav";
import { Workflow, type WorkflowStage } from "@/components/dashboard/workflow";

export const dynamic = "force-dynamic";

function count(rows: StatusTally, ...statuses: string[]) {
  return statuses.reduce((s, k) => s + (rows[k]?.n ?? 0), 0);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; period?: string }>;
}) {
  const sp = await searchParams;
  const today = todayLondonInput();
  const day = sp.date && isIsoDate(sp.date) ? sp.date : today;
  const period = isPerformancePeriod(sp.period) ? sp.period : "week";
  const user = await requireAdmin();

  const [d, ops, perf, week, profile] = await Promise.all([
    getDashboard(COMPANY_SLUG),
    getTodaysAppointments(COMPANY_SLUG, day),
    getPerformance(COMPANY_SLUG, period),
    getWeeklyTimesheets(COMPANY_SLUG, day),
    getShellProfile(COMPANY_SLUG, user.email ?? ""),
  ]);

  const toInvoice = count(d.jobs, "requires_invoicing");
  const late = count(d.jobs, "late");
  const pastDue = count(d.invoices, "past_due");
  const stages: WorkflowStage[] = [
    {
      key: "requests",
      href: "/solicitacoes",
      label: "Requests",
      count: count(d.requests, "new", "review"),
      lines: [{ text: `${count(d.requests, "new")} new` }, { text: `${count(d.requests, "review")} in review` }],
    },
    {
      key: "quotes",
      href: "/cotacoes",
      label: "Quotes",
      count: count(d.quotes, "draft", "awaiting", "changes", "approved"),
      lines: [
        { text: `${count(d.quotes, "awaiting")} awaiting response` },
        count(d.quotes, "changes")
          ? { text: `${count(d.quotes, "changes")} changes requested`, tone: "warn" }
          : { text: `${count(d.quotes, "approved")} approved` },
      ],
    },
    {
      key: "jobs",
      href: "/servicos",
      label: "Jobs",
      count: count(d.jobs, "late", "requires_invoicing", "action_required", "unscheduled", "today", "upcoming"),
      lines: [
        { text: `${count(d.jobs, "today")} today` },
        toInvoice
          ? { text: `${toInvoice} to invoice`, tone: "warn" }
          : late
            ? { text: `${late} late`, tone: "danger" }
            : { text: `${count(d.jobs, "upcoming")} upcoming` },
      ],
    },
    {
      key: "invoices",
      href: "/faturas",
      label: "Invoices",
      count: count(d.invoices, "past_due", "awaiting_payment", "draft"),
      lines: [
        { text: `${count(d.invoices, "awaiting_payment")} awaiting payment` },
        { text: `${pastDue} overdue`, tone: pastDue ? "danger" : undefined },
      ],
    },
  ];

  const points: MapPoint[] = ops.appointments
    .filter((a) => a.location)
    .map((a) => ({
      id: a.id,
      lat: a.location!.lat,
      lng: a.location!.lng,
      time: a.window.anytime ? "Anytime" : formatClock12(a.window.start),
      title: a.clientName || a.title,
      address: a.address,
      href: a.href,
      done: a.status === "completed",
      people: a.people.map((p) => ({ id: p.id, name: p.name, running: Boolean(p.runningSince) })),
    }));
  const live = new Set(ops.appointments.flatMap((a) => a.people.filter((p) => p.runningSince).map((p) => p.id))).size;

  return (
    <div className="min-w-0 space-y-5 pt-1">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-slate-900 sm:text-[32px]">
            {greetingLondon()}, {profile.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-[15px] text-slate-500 sm:text-base">Here’s what’s happening with your business today.</p>
        </div>
        <DateNav day={day} today={today} />
      </div>

      <Workflow stages={stages} />

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_clamp(330px,25vw,390px)]">
        <TodaysAppointments data={ops} />
        <div className="grid min-w-0 items-start gap-5 md:grid-cols-2 xl:grid-cols-1">
          <BusinessPerformance
            period={period}
            revenue={perf.revenue}
            trend={perf.trend}
            paid={perf.paid}
            paidCount={perf.paidCount}
            receivable={d.receivable}
            debtorCount={d.debtorCount}
            debtors={d.debtors.slice(0, 3)}
            upcoming={d.upcomingJobs}
            upcomingCount={d.upcomingCount}
            upcomingJobs={d.upcomingList}
          />
          <WeeklyTimesheets data={week} />
        </div>
      </div>

      <LiveMap points={points} live={live} />
    </div>
  );
}
