import { notFound } from "next/navigation";
import { listClientsForSelect } from "@/lib/clients/queries";
import { COMPANY_SLUG, getCompanyId } from "@/lib/company";
import { describeService } from "@/lib/quotes/summary";
import { getQuotePrefillForClient, getQuotePrefillFromRequest } from "@/lib/quotes/queries";
import { getQuoteTemplate } from "@/lib/quotes/templates";
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
    template?: string;
    blank?: string;
  }>;
}) {
  const sp = await searchParams;
  const template = getQuoteTemplate(sp.template);
  if (sp.template && !template) notFound();

  const ready = sp.blank === "1" || Boolean(template);
  if (!ready) {
    return <NewQuoteDialog clientId={sp.clientId} requestId={sp.requestId} />;
  }

  const clients = await listClientsForSelect(COMPANY_SLUG);
  const serviceName = template?.serviceName;
  let prefill = sp.requestId
    ? await getQuotePrefillFromRequest(sp.requestId, serviceName)
    : null;
  if (sp.requestId && !prefill) notFound();
  if (!prefill && sp.clientId) {
    const companyId = await getCompanyId();
    if (companyId) prefill = await getQuotePrefillForClient(sp.clientId, companyId, serviceName);
  }

  const linkedClient = clients.find((c) => c.id === (prefill?.clientId ?? sp.clientId));
  const clientName = linkedClient ? `${linkedClient.first_name} ${linkedClient.last_name}`.trim() : "";

  const templateLine = template
    ? [
        {
          name: template.serviceName,
          description: describeService(template.serviceName),
          qty: "1",
          unitPrice: "",
        },
      ]
    : undefined;

  return (
    <div className="min-h-[calc(100dvh-6.5rem)] rounded-2xl bg-white px-6 py-8 sm:px-10">
      <div className="mx-auto max-w-[860px]">
        <NewQuoteForm
          clients={clients}
          requestId={prefill?.requestId ?? (sp.requestId || undefined)}
          sourceRequestId={sp.requestId}
          initialClientId={prefill?.clientId ?? sp.clientId}
          initialTitle={prefill?.title || clientName}
          initialMoveDate={prefill?.moveDate}
          initialMoveTime={prefill?.moveTime}
          initialInventory={prefill?.inventory}
          initialCollection={prefill?.collection}
          initialDelivery={prefill?.delivery}
          initialPacking={prefill?.packing}
          initialMessage={QUOTE_TERMS}
          initialLines={prefill?.lines ?? templateLine}
          templateServiceName={template?.serviceName}
          templateSummary={template ? describeService(template.serviceName) : undefined}
        />
      </div>
    </div>
  );
}
