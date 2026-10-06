import { notFound, redirect } from "next/navigation";
import { listClientsForSelect } from "@/lib/clients/queries";
import { COMPANY_SLUG } from "@/lib/company";
import { NewJobForm } from "@/components/jobs/new-job-form";
import { getJobIdForQuote, getJobPrefillFromQuote } from "@/lib/jobs/queries";
import { isUuid } from "@/lib/funnel/validation";

export const dynamic = "force-dynamic";

export default async function NovoServicoPage({
  searchParams,
}: {
  searchParams: Promise<{ quoteId?: string }>;
}) {
  const sp = await searchParams;
  const clients = await listClientsForSelect(COMPANY_SLUG);

  if (sp.quoteId) {
    if (!isUuid(sp.quoteId)) notFound();
    const existing = await getJobIdForQuote(sp.quoteId);
    if (existing) redirect(`/servicos/${existing}/editar`);
    const prefill = await getJobPrefillFromQuote(sp.quoteId);
    if (!prefill) notFound();
    return (
      <div className="min-h-[calc(100dvh-6.5rem)] rounded-2xl bg-white px-6 py-8 sm:px-10">
        <div className="mx-auto max-w-[860px]">
          <NewJobForm
            clients={clients}
            quoteId={prefill.quoteId}
            requestId={prefill.requestId}
            initialClientId={prefill.clientId}
            initialTitle={prefill.title}
            initialNotes={prefill.notes}
            initialVisits={prefill.visits}
            initialLines={prefill.lines}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100dvh-6.5rem)] rounded-2xl bg-white px-6 py-8 sm:px-10">
      <div className="mx-auto max-w-[860px]">
        <NewJobForm clients={clients} />
      </div>
    </div>
  );
}
