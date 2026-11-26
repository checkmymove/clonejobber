import { getDashboard, getPerformance, type StatusTally } from "@/lib/funnel/dashboard";
import { isPerformancePeriod } from "@/lib/funnel/periods";
import { requireAdmin } from "@/lib/auth/session";
import { COMPANY_SLUG } from "@/lib/company";
import { formatGBPShort, greetingLondon, todayLondonInput } from "@/lib/format";
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

  const sum = (rows: StatusTally, ...statuses: string[]) => statuses.reduce((s, k) => s + (rows[k]?.total ?? 0), 0);
  const money = (pence: number) => (pence ? formatGBPShort(pence) : undefined);
  const stages: WorkflowStage[] = [
    {
      key: "requests",
      label: "Requests",
      count: count(d.requests, "new"),
      status: "New",
      href: "/solicitacoes?status=new",
      lines: [
        { text: "Awaiting review", count: count(d.requests, "review"), href: "/solicitacoes?status=review" },
        { text: "Overdue", count: count(d.requests, "overdue"), href: "/solicitacoes?status=overdue", tone: "danger" },
      ],
    },
    {
      key: "quotes",
      label: "Quotes",
      count: count(d.quotes, "approved"),
      amount: money(sum(d.quotes, "approved")),
      status: "Approved",
      href: "/cotacoes?status=approved",
      lines: [
        { text: "Draft", count: count(d.quotes, "draft"), amount: money(sum(d.quotes, "draft")), href: "/cotacoes?status=draft" },
        {
          text: "Awaiting response",
          count: count(d.quotes, "awaiting"),
          amount: money(sum(d.quotes, "awaiting")),
          href: "/cotacoes?status=awaiting",
        },
        {
          text: "Changes requested",
          count: count(d.quotes, "changes"),
          amount: money(sum(d.quotes, "changes")),
          href: "/cotacoes?status=changes",
        },
      ],
    },
    {
      key: "jobs",
      label: "Jobs",
      count: count(d.jobs, "requires_invoicing"),
      amount: money(sum(d.jobs, "requires_invoicing")),
      status: "Requires invoicing",
      href: "/servicos?status=requires_invoicing",
      lines: [
        { text: "Active", count: count(d.jobs, "active"), amount: money(sum(d.jobs, "active")), href: "/servicos?status=active" },
        {
          text: "Action required",
          count: count(d.jobs, "action_required"),
          amount: money(sum(d.jobs, "action_required")),
          href: "/servicos?status=action_required",
        },
      ],
    },
    {
      key: "invoices",
      label: "Invoices",
      count: count(d.invoices, "awaiting_payment", "past_due"),
      amount: money(sum(d.invoices, "awaiting_payment", "past_due")),
      status: "Awaiting payment",
      href: "/faturas?status=unpaid",
      lines: [
        { text: "Draft", count: count(d.invoices, "draft"), href: "/faturas?status=draft" },
        {
          text: "Past due",
          count: count(d.invoices, "past_due"),
          amount: money(sum(d.invoices, "past_due")),
          href: "/faturas?status=past_due",
          tone: "danger",
        },
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
