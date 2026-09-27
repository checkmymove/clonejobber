import Link from "next/link";
import { formatDateLondon, formatGBP, toDateInput } from "@/lib/format";
import { listJobs } from "@/lib/jobs/queries";
import { COMPANY_SLUG } from "@/lib/company";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { ListSearch } from "@/components/funnel/list-search";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  in_progress: "In progress",
  done: "Completed",
  cancelled: "Cancelled",
};

function todayLondon() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
}

export default async function ServicosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const jobs = await listJobs(COMPANY_SLUG, q);
  const todayStr = todayLondon();
  const onDay = (value: string | Date | null) => toDateInput(value);
  const today = jobs.filter((j) => onDay(j.scheduled_date) === todayStr && j.status !== "cancelled");
  const rest = jobs.filter((j) => onDay(j.scheduled_date) !== todayStr || j.status === "cancelled");

  return (
    <div>
      <PageHeader
        title="Jobs"
        subtitle="Today’s schedule, upcoming jobs and progress"
        action={
          <Link
            href="/servicos/novo"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-bold text-white hover:opacity-90"
          >
            + New job
          </Link>
        }
      />

      <ListSearch defaultValue={q} placeholder="Search by client, ID or address" />

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card className="p-4">
          <h2 className="font-extrabold text-ink">Today · {today.length} jobs</h2>
          <div className="mt-3 space-y-2">
            {today.map((j) => (
              <Link
                key={j.id}
                href={`/servicos/${j.id}`}
                className="flex items-center gap-3 rounded-xl border border-line p-3 hover:bg-cream"
              >
                <span className="h-10 w-1.5 rounded-full bg-job" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">
                    {j.client_name} · {j.number}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {j.anytime ? "Anytime" : `${j.window_start || "—"} – ${j.window_end || "—"}`} ·{" "}
                    {j.pickup_address || "No address"}
                  </p>
                  <p className="mt-1">
                    <Badge tone={j.status}>{LABELS[j.status] ?? j.status}</Badge>
                  </p>
                </div>
                <span className="ml-auto text-sm font-bold text-ink">{formatGBP(j.total)}</span>
              </Link>
            ))}
            {today.length === 0 ? <EmptyState>No jobs scheduled for today.</EmptyState> : null}
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="font-extrabold text-ink">Upcoming and other statuses</h2>
          <div className="mt-3 space-y-2">
            {rest.map((j) => (
              <Link
                key={j.id}
                href={`/servicos/${j.id}`}
                className="flex items-center gap-3 rounded-xl border border-line p-3 hover:bg-cream"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">
                    {j.client_name} · {j.number}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {onDay(j.scheduled_date) ? formatDateLondon(onDay(j.scheduled_date)) : "No date"} · {j.title}
                  </p>
                </div>
                <span className="ml-auto">
                  <Badge tone={j.status}>{LABELS[j.status] ?? j.status}</Badge>
                </span>
              </Link>
            ))}
            {rest.length === 0 ? <EmptyState>Nothing scheduled ahead.</EmptyState> : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
