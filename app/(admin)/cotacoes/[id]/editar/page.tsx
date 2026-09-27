import { notFound, redirect } from "next/navigation";
import { listClientsForSelect } from "@/lib/clients/queries";
import { COMPANY_SLUG } from "@/lib/company";
import { penceToInput, toDateInput } from "@/lib/format";
import { getQuoteDetail } from "@/lib/quotes/queries";
import { NewQuoteForm } from "@/components/quotes/new-quote-form";

export const dynamic = "force-dynamic";

export default async function EditarCotacaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const q = await getQuoteDetail(id);
  if (!q) notFound();
  if (q.status !== "draft") redirect(`/cotacoes/${id}`);

  const clients = await listClientsForSelect(COMPANY_SLUG);

  return (
    <div className="min-h-[calc(100dvh-6.5rem)] rounded-2xl bg-white px-6 py-8 sm:px-10">
      <div className="mx-auto max-w-[860px]">
        <NewQuoteForm
          clients={clients}
          quoteId={q.id}
          requestId={q.request_id ?? undefined}
          initialClientId={q.client_id}
          initialTitle={q.title}
          initialValidUntil={toDateInput(q.valid_until)}
          initialMessage={q.message}
          initialNotes={q.notes}
          initialLines={q.lines.map((l) => ({
            name: l.name,
            description: l.description,
            qty: String(l.quantity),
            unitPrice: penceToInput(l.unitPrice),
          }))}
        />
      </div>
    </div>
  );
}
