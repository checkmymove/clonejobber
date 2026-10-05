import { notFound } from "next/navigation";
import { listClientsForSelect } from "@/lib/clients/queries";
import { COMPANY_SLUG, getCompanyId } from "@/lib/company";
import { describeService } from "@/lib/quotes/summary";
import { getQuotePrefillForClient, getQuotePrefillFromRequest } from "@/lib/quotes/queries";
import { getServiceForQuote, listServicesForQuote } from "@/lib/products/queries";
import { isUuid } from "@/lib/funnel/validation";
import { NewQuoteDialog } from "@/components/quotes/new-quote-dialog";
import { NewQuoteForm } from "@/components/quotes/new-quote-form";
import { QUOTE_TERMS } from "@/lib/quotes/terms";

export const dynamic = "force-dynamic";

export default async function NovaCotacaoPage({
  searchParams,
}: {
  searchParams: Promise<{
    requestId?: string;
    clientId?: string;
    service?: string;
  }>;
}) {
  const sp = await searchParams;
  const companyId = await getCompanyId();
  if (!companyId) notFound();

  if (!sp.service) {
    const services = await listServicesForQuote(companyId);
    return (
      <NewQuoteDialog services={services} clientId={sp.clientId} requestId={sp.requestId} />
    );
  }
  if (!isUuid(sp.service)) notFound();
  const service = await getServiceForQuote(companyId, sp.service);
  if (!service) notFound();

  const clients = await listClientsForSelect(COMPANY_SLUG);
  let prefill = sp.requestId
    ? await getQuotePrefillFromRequest(sp.requestId, service)
    : null;
  if (sp.requestId && !prefill) notFound();
  if (!prefill && sp.clientId) {
    prefill = await getQuotePrefillForClient(sp.clientId, companyId, service);
  }

  const serviceLine = [
    {
      name: service.name,
      description: service.description || describeService(service.name),
      qty: "1",
      unitPrice: service.unitPrice,
    },
  ];

  return (
    <div className="min-h-[calc(100dvh-6.5rem)] rounded-2xl bg-white px-6 py-8 sm:px-10">
      <div className="mx-auto max-w-[860px]">
        <NewQuoteForm
          clients={clients}
          requestId={prefill?.requestId ?? (sp.requestId || undefined)}
          sourceRequestId={sp.requestId}
          initialClientId={prefill?.clientId ?? sp.clientId}
          initialTitle={service.name}
          initialMoveDate={prefill?.moveDate}
          initialMoveTime={prefill?.moveTime}
          initialInventory={prefill?.inventory}
          initialFiles={prefill?.files}
          initialCollection={prefill?.collection}
          initialDelivery={prefill?.delivery}
          initialPacking={prefill?.packing}
          initialMessage={QUOTE_TERMS}
          initialLines={prefill?.lines ?? serviceLine}
          service={{
            ...service,
            description: service.description || describeService(service.name),
          }}
        />
      </div>
    </div>
  );
}
