import Link from "next/link";
import { notFound } from "next/navigation";
import { getJobDetail } from "@/lib/jobs/queries";
import { jobSnapshotFromDetail } from "@/lib/jobs/edit-snapshot";
import { updateJobStatus } from "@/lib/jobs/actions";
import { convertJobToInvoice } from "@/lib/invoices/actions";
import {
  JobItemsCard,
  JobScheduleCard,
  JobVisitsCard,
} from "@/components/jobs/job-inline-cards";
import { Badge, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  in_progress: "In progress",
  done: "Completed",
  cancelled: "Cancelled",
};

export default async function ServicoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const j = await getJobDetail(id);
  if (!j) notFound();
  const snapshot = jobSnapshotFromDetail(j);

  return (
    <div>
      <PageHeader
        title={`${j.number} · ${j.client_name}`}
        subtitle={j.title || "Job"}
        action={
          <Link
            href="/servicos"
            className="inline-flex h-10 items-center rounded-xl border border-line bg-card px-4 text-sm font-bold text-ink hover:bg-cream"
          >
            ← Voltar
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={j.status}>{LABELS[j.status] ?? j.status}</Badge>
        {j.status === "scheduled" ? (
          <StatusForm id={id} status="in_progress" label="Start" />
        ) : null}
        {j.status === "scheduled" || j.status === "in_progress" ? (
          <StatusForm id={id} status="done" label="Complete" />
        ) : null}
        {j.status !== "cancelled" && j.status !== "done" ? (
          <StatusForm id={id} status="cancelled" label="Cancel" />
        ) : null}
        {j.status === "done" ? (
          <form
            action={async () => {
              "use server";
              await convertJobToInvoice(id);
            }}
          >
            <button type="submit" className="h-9 rounded-xl bg-ink px-3 text-sm font-bold text-white hover:opacity-90">
              Create invoice
            </button>
          </form>
        ) : null}
        <Link
          href={`/clientes/${j.client_id}`}
          className="h-9 rounded-xl border border-line px-3 text-sm font-bold leading-9 text-accent hover:bg-accent-soft"
        >
          View client
        </Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <JobScheduleCard snapshot={snapshot} />
        <JobVisitsCard snapshot={snapshot} />
        <JobItemsCard snapshot={snapshot} />
      </div>
    </div>
  );
}

function StatusForm({
  id,
  status,
  label,
}: {
  id: string;
  status: "scheduled" | "in_progress" | "done" | "cancelled";
  label: string;
}) {
  return (
    <form
      action={async () => {
        "use server";
        await updateJobStatus(id, status);
      }}
    >
      <button type="submit" className="h-9 rounded-xl border border-line bg-card px-3 text-sm font-bold text-ink hover:bg-cream">
        {label}
      </button>
    </form>
  );
}
