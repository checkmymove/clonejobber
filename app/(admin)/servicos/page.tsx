import Link from "next/link";
import { ClickableRow } from "@/components/clickable-row";
import { formatDateNumericLondon, formatGBP, formatPounds } from "@/lib/format";
import { getJobKpis, listJobs, type JobRow } from "@/lib/jobs/queries";
import { JOB_STATUS_META, JOB_STATUS_ORDER, type JobListStatus } from "@/lib/jobs/status";
import { COMPANY_SLUG } from "@/lib/company";
import { Card, EmptyState } from "@/components/ui";
import { ListSearch } from "@/components/funnel/list-search";
import {
  ConvertedToggle,
  KpiCard,
  OverviewCard,
  SortTh,
  StatusDot,
  listHref,
} from "@/components/funnel/list-kit";

export const dynamic = "force-dynamic";

type Params = { q?: string; status?: string; sort?: string; dir?: string; view?: string };

const OVERVIEW: JobListStatus[] = [
  "late",
  "requires_invoicing",
  "action_required",
  "unscheduled",
  "today",
  "upcoming",
];

function trendPct(current: number, previous: number): number | null {
  return previous ? ((current - previous) / previous) * 100 : null;
}

function sortJobs(rows: JobRow[], sort: string | undefined, dir: string | undefined): JobRow[] {
  const sign = dir === "desc" ? -1 : 1;
  const rank = (s: JobListStatus) => JOB_STATUS_ORDER.indexOf(s);
  const num = (n: string) => Number(n.replace(/\D/g, "")) || 0;
  const by: Record<string, (a: JobRow, b: JobRow) => number> = {
    client: (a, b) => a.client_name.localeCompare(b.client_name),
    number: (a, b) => num(a.number) - num(b.number),
    schedule: (a, b) => (a.next_visit ?? "9999").localeCompare(b.next_visit ?? "9999"),
    status: (a, b) =>
      rank(a.list_status) - rank(b.list_status) ||
      (a.next_visit ?? "9999").localeCompare(b.next_visit ?? "9999"),
    total: (a, b) => a.total - b.total,
  };
  const cmp = by[sort ?? "status"] ?? by.status;
  return [...rows].sort((a, b) => sign * cmp(a, b));
}

export default async function ServicosPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const [listed, kpis] = await Promise.all([listJobs(COMPANY_SLUG, params.q ?? ""), getJobKpis(COMPANY_SLUG)]);
  // A job that already has an invoice (or is closed) leaves the list unless asked for.
  const waiting = listed.filter((j) => j.invoice_count === 0 && j.list_status !== "archived");
  const all = params.view === "all" || params.status === "archived" ? listed : waiting;
  const counts = Object.fromEntries(
    JOB_STATUS_ORDER.map((s) => [s, all.filter((j) => j.list_status === s).length]),
  ) as Record<JobListStatus, number>;
  const filtered = params.status ? all.filter((j) => j.list_status === params.status) : all;
  const rows = sortJobs(filtered, params.sort, params.dir);
  const filtering = Boolean(params.status || params.q);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Jobs</h1>
        <Link
          href="/servicos/novo"
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-bold text-white hover:opacity-90"
        >
          + New job
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <OverviewCard
          items={OVERVIEW.map((s) => ({
            key: s,
            label: JOB_STATUS_META[s].label,
            dot: JOB_STATUS_META[s].dot,
            count: counts[s],
            href: listHref("/servicos", {}, { status: s }),
          }))}
        />
        <KpiCard
          title="Recent visits"
          period="Past 30 days"
          hint="Visits from the past 30 days, including today. The amount totals the jobs of those visits."
          value={String(kpis.recentVisits)}
          trend={trendPct(kpis.recentVisits, kpis.prevRecentVisits)}
          sub={formatGBP(kpis.recentRevenue)}
        />
        <KpiCard
          title="Visits scheduled"
          period="Next 30 days"
          hint="Visits in the next 30 days, excluding today. The amount totals the jobs of those visits."
          value={String(kpis.scheduledVisits)}
          sub={formatGBP(kpis.scheduledRevenue)}
        />
      </div>

      <div className="mt-6 mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-ink">
          {filtering ? "Filtered jobs" : params.view === "all" ? "All jobs" : "Awaiting an invoice"}{" "}
          <span className="font-medium text-ink-mute">({rows.length} results)</span>
        </h2>
        <ConvertedToggle base="/servicos" params={params} hidden={listed.length - waiting.length} />
        {params.status ? (
          <Link
            href={listHref("/servicos", params, { status: undefined })}
            className="text-sm font-semibold text-accent hover:underline"
          >
            Clear filter
          </Link>
        ) : null}
      </div>
      <Card className="p-4">
        <ListSearch
          defaultValue={params.q}
          placeholder="Search jobs..."
          keep={{ status: params.status, sort: params.sort, dir: params.dir, view: params.view }}
        />
        {rows.length === 0 ? (
          <EmptyState>
            {filtering ? "No jobs match these filters." : "No jobs yet. Approve a quote, or create a job directly."}
          </EmptyState>
        ) : (
          <div className="-mx-4 overflow-x-auto">
            <table className="w-full min-w-[760px] table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[18%]" />
                <col className="w-[18%]" />
                <col className="w-[26%]" />
                <col className="w-[13%]" />
                <col className="w-[15%]" />
                <col className="w-[10%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-line text-xs font-semibold text-ink-mute">
                  <SortTh label="Client" sortKey="client" base="/servicos" params={params} />
                  <SortTh label="Job number" sortKey="number" base="/servicos" params={params} />
                  <th className="px-4 py-3 font-semibold">Property</th>
                  <SortTh label="Schedule" sortKey="schedule" base="/servicos" params={params} />
                  <SortTh label="Status" sortKey="status" base="/servicos" params={params} />
                  <SortTh label="Total" sortKey="total" base="/servicos" params={params} align="right" />
                </tr>
              </thead>
              <tbody>
                {rows.map((job) => {
                  const href = `/servicos/${job.id}`;
                  const meta = JOB_STATUS_META[job.list_status];
                  const showDate = job.list_status !== "archived" && job.list_status !== "action_required";
                  return (
                    <ClickableRow key={job.id} href={href}>
                      <td className="px-4 py-3.5 font-semibold break-words text-ink">
                        <Link href={href} className="hover:underline">
                          {job.client_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5">
                        <Link href={href} className="font-semibold text-accent hover:underline">
                          {job.number}
                        </Link>
                        {job.title ? <p className="truncate text-xs text-ink-mute">{job.title}</p> : null}
                      </td>
                      <td className="px-4 py-3.5 text-[13px] break-words text-ink-soft">
                        {job.pickup_address || "—"}
                      </td>
                      <td className="px-4 py-3.5 text-ink-soft">
                        {showDate && job.next_visit ? formatDateNumericLondon(job.next_visit) : "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusDot dot={meta.dot} label={meta.label} />
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold text-ink">
                        {formatPounds(job.total / 100)}
                      </td>
                    </ClickableRow>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
