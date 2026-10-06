import { notFound, redirect } from "next/navigation";
import { listClientsForSelect } from "@/lib/clients/queries";
import { COMPANY_SLUG } from "@/lib/company";
import { NewInvoiceForm } from "@/components/invoices/new-invoice-form";
import { getInvoiceIdForJob, getInvoicePrefillFromJob } from "@/lib/invoices/queries";
import { isUuid } from "@/lib/funnel/validation";

export const dynamic = "force-dynamic";

export default async function NovaInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ jobId?: string }>;
}) {
  const sp = await searchParams;
  const clients = await listClientsForSelect(COMPANY_SLUG);

  if (sp.jobId) {
    if (!isUuid(sp.jobId)) notFound();
    const existing = await getInvoiceIdForJob(sp.jobId);
    if (existing) redirect(`/faturas/${existing}/editar`);
    const prefill = await getInvoicePrefillFromJob(sp.jobId);
    if (!prefill) notFound();
    return (
      <div className="min-h-[calc(100dvh-6.5rem)] rounded-2xl bg-white px-6 py-8 sm:px-10">
        <div className="mx-auto max-w-[860px]">
          <NewInvoiceForm
            clients={clients}
            jobId={prefill.jobId}
            quoteId={prefill.quoteId}
            initialClientId={prefill.clientId}
            initialSubject={prefill.subject}
            initialMessage={prefill.message}
            initialNotes={prefill.notes}
            initialLines={prefill.lines}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100dvh-6.5rem)] rounded-2xl bg-white px-6 py-8 sm:px-10">
      <div className="mx-auto max-w-[860px]">
        <NewInvoiceForm clients={clients} />
      </div>
    </div>
  );
}
