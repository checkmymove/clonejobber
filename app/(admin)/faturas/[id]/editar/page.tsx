import { notFound } from "next/navigation";
import { listClientsForSelect } from "@/lib/clients/queries";
import { COMPANY_SLUG } from "@/lib/company";
import { penceToInput } from "@/lib/format";
import { getInvoiceDetail } from "@/lib/invoices/queries";
import { NewInvoiceForm } from "@/components/invoices/new-invoice-form";

export const dynamic = "force-dynamic";

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const inv = await getInvoiceDetail(id);
  if (!inv) notFound();

  const clients = await listClientsForSelect(COMPANY_SLUG);

  return (
    <div className="min-h-[calc(100dvh-6.5rem)] rounded-2xl bg-white px-6 py-8 sm:px-10">
      <div className="mx-auto max-w-[860px]">
        <NewInvoiceForm
          clients={clients}
          invoiceId={inv.id}
          jobId={inv.job_id ?? undefined}
          quoteId={inv.quote_id ?? undefined}
          initialClientId={inv.client_id}
          initialSubject={inv.subject}
          initialMessage={inv.message}
          initialNotes={inv.notes}
          initialTerms={inv.payment_terms}
          initialNumber={inv.number}
          initialLines={inv.lines.map((l) => ({
            name: l.name,
            description: l.description,
            qty: String(l.quantity),
            price: penceToInput(l.unitPrice),
          }))}
        />
      </div>
    </div>
  );
}
