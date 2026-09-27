import { notFound } from "next/navigation";
import { listClientsForSelect } from "@/lib/clients/queries";
import { COMPANY_SLUG } from "@/lib/company";
import { getQuotePrefillFromRequest } from "@/lib/quotes/queries";
import { NewQuoteForm } from "@/components/quotes/new-quote-form";

export const dynamic = "force-dynamic";

export default async function NovaCotacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ requestId?: string; clientId?: string }>;
}) {
  const sp = await searchParams;
  const clients = await listClientsForSelect(COMPANY_SLUG);
  const prefill = sp.requestId ? await getQuotePrefillFromRequest(sp.requestId) : null;
  if (sp.requestId && !prefill) notFound();

  return (
    <div className="min-h-[calc(100dvh-6.5rem)] rounded-2xl bg-white px-6 py-8 sm:px-10">
      <div className="mx-auto max-w-[860px]">
        <NewQuoteForm
          clients={clients}
          requestId={sp.requestId}
          initialClientId={prefill?.clientId ?? sp.clientId}
          initialTitle={prefill?.title}
          initialLines={prefill?.lines}
        />
      </div>
    </div>
  );
}
