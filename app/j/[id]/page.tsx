import { notFound } from "next/navigation";
import { getCompanyName } from "@/lib/company";
import { formatDateNumericLondon } from "@/lib/format";
import { isUuid } from "@/lib/funnel/validation";
import { getJobDetail, type JobVisit } from "@/lib/jobs/queries";
import { ClientDocumentView } from "@/components/funnel/client-document-view";

export const dynamic = "force-dynamic";

function visitWhen(v: JobVisit): string {
  if (v.later || !v.visit_date) return "To be scheduled";
  const date = formatDateNumericLondon(v.visit_date);
  if (v.anytime || !v.start_time) return `${date} · Anytime`;
  return `${date} · ${v.start_time}${v.end_time ? ` – ${v.end_time}` : ""}`;
}

/** Client view of a job: the booking, its visits and what is included. Also "Preview as Client". */
export default async function PublicJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const job = await getJobDetail(id);
  if (!job || job.status === "cancelled") notFound();
  const companyName = await getCompanyName();
  const visits = job.visits.filter((v) => v.status !== "cancelled");

  return (
    <ClientDocumentView
      companyName={companyName}
      heading={`Job #${job.number}`}
      title={job.title}
      status={
        job.status === "done"
          ? { label: "Completed", dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-800" }
          : { label: "Booked", dot: "bg-sky-500", badge: "bg-sky-50 text-sky-900" }
      }
      clientName={job.client_name}
      clientLines={[job.client_address, job.client_phone]}
      facts={[
        { label: "Collection", value: job.pickup_address || "—" },
        { label: "Delivery", value: job.delivery_address || "—" },
        { label: "Scheduled", value: visits[0] ? visitWhen(visits[0]) : "To be scheduled" },
      ]}
      lines={job.lines}
      showPrices={false}
      totals={[]}
      pdfHref={`/j/${job.id}/pdf`}
    >
      {visits.length ? (
        <div className="mt-6 border-t border-line pt-4">
          <h2 className="mb-2 text-[15px] font-bold text-ink">Visits</h2>
          <ul className="divide-y divide-line text-[15px]">
            {visits.map((v) => (
              <li key={v.id} className="flex flex-wrap justify-between gap-3 py-2">
                <span className="text-ink">{v.title || job.title || "Visit"}</span>
                <span className="text-ink-soft">
                  {visitWhen(v)}
                  {v.status === "done" ? " · Completed" : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </ClientDocumentView>
  );
}
