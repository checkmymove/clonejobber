import { notFound } from "next/navigation";
import { listClientsForSelect } from "@/lib/clients/queries";
import { COMPANY_SLUG } from "@/lib/company";
import { penceToInput, toDateInput, todayLondonInput } from "@/lib/format";
import { getJobDetail } from "@/lib/jobs/queries";
import { NewJobForm } from "@/components/jobs/new-job-form";

export const dynamic = "force-dynamic";

export default async function EditServicoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const j = await getJobDetail(id);
  if (!j) notFound();

  const clients = await listClientsForSelect(COMPANY_SLUG);

  return (
    <div className="min-h-[calc(100dvh-6.5rem)] rounded-2xl bg-white px-6 py-8 sm:px-10">
      <div className="mx-auto max-w-[860px]">
        <NewJobForm
          clients={clients}
          jobId={j.id}
          quoteId={j.quote_id ?? undefined}
          requestId={j.request_id ?? undefined}
          initialClientId={j.client_id}
          initialTitle={j.title}
          initialJobNumber={j.number}
          initialNotes={j.notes}
          initialRemindInvoice={j.remind_invoice}
          initialVisits={
            j.visits.length
              ? j.visits.map((v) => ({
                  id: v.id,
                  title: v.title,
                  date: toDateInput(v.visit_date) || todayLondonInput(),
                  later: v.later,
                  start: v.start_time,
                  end: v.end_time,
                  anytime: v.anytime,
                  assignee: v.assignee,
                  instructions: v.instructions,
                }))
              : undefined
          }
          initialLines={j.lines.map((l) => ({
            name: l.name,
            description: l.description,
            qty: String(l.quantity),
            price: penceToInput(l.unitPrice),
          }))}
          today={todayLondonInput()}
        />
      </div>
    </div>
  );
}
