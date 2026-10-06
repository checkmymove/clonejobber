import { notFound } from "next/navigation";
import { isUuid } from "@/lib/funnel/validation";
import { getQuoteDetail } from "@/lib/quotes/queries";
import { PublicQuoteView } from "@/components/quotes/public-quote-view";

export const dynamic = "force-dynamic";

export default async function PublicQuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const quote = await getQuoteDetail(id);
  if (!quote) notFound();

  return <PublicQuoteView quote={quote} />;
}
