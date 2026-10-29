import Link from "next/link";
import { notFound } from "next/navigation";
import { formatGBP, penceToInput, toDateInput } from "@/lib/format";
import { getQuoteDetail } from "@/lib/quotes/queries";
import { getLatestRequestId, getRequestDetail } from "@/lib/requests/queries";
import { requestSnapshotFromDetail } from "@/lib/requests/edit-snapshot";
import { quoteLinesFromPence } from "@/lib/quotes/edit-snapshot";
import { QuoteRequestSidebar } from "@/components/quotes/quote-request-sidebar";
import { ConvertToJobButton, QuoteMoreMenu } from "@/components/quotes/quote-more-menu";
import {
  QuoteCollectionCard,
  QuoteDeliveryCard,
  QuoteInventoryCard,
  QuotePackingCard,
  QuoteServicesCard,
  QuoteSummaryCard,
} from "@/components/quotes/quote-inline-cards";
import { TotalsCard, depositTotalRows, type TotalRow } from "@/components/funnel/document-cards";
import { getQuoteDeposits } from "@/lib/payments/queries";
import { SentCard } from "@/components/funnel/sent-card";
import { Badge, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  changes_requested: "Changes requested",
  approved: "Approved",
  rejected: "Declined",
  expired: "Expired",
};

export default async function CotacaoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const q = await getQuoteDetail(id);
  if (!q) notFound();
  const deposits = await getQuoteDeposits(id);
  const requestId = q.request_id ?? (await getLatestRequestId(q.client_id));
  const request = requestId ? await getRequestDetail(requestId) : null;
  const linkedRequest =
    q.request_id && request?.id === q.request_id ? requestSnapshotFromDetail(request) : null;
  const snapshot = {
    id: q.id,
    clientId: q.client_id,
    requestId: q.request_id ?? undefined,
    title: q.title,
    message: q.message,
    notes: q.notes,
    validUntil: toDateInput(q.valid_until),
    moveTime: q.move_time ?? "",
    inventory: q.inventory ?? "",
    discount: penceToInput(q.discount),
    tax: penceToInput(q.tax),
    deposit: penceToInput(q.deposit),
    recipient: q.client_email,
    source: q.request_number ?? "Direct",
    subtotal: q.subtotal,
    total: q.total,
    depositPence: q.deposit,
    discountPence: q.discount,
    taxPence: q.tax,
    lines: quoteLinesFromPence(q.lines),
  };

  const totals: TotalRow[] = [
    { label: "Subtotal", value: formatGBP(q.subtotal), muted: true },
    ...(q.discount ? [{ label: "Discount", value: `-${formatGBP(q.discount)}`, muted: true }] : []),
    ...(q.tax ? [{ label: "Tax", value: formatGBP(q.tax), muted: true }] : []),
    { label: "Total", value: formatGBP(q.total), strong: true },
    ...depositTotalRows(deposits, true),
  ];

  return (
    <div>
      <PageHeader
        title={`${q.number} · ${q.client_name}`}
        subtitle={q.title || "Quote"}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <QuoteMoreMenu
              quoteId={id}
              clientId={q.client_id}
              status={q.status}
              archived={Boolean(q.archived_at)}
              jobId={q.job_id}
            />
            <Link
              href="/cotacoes"
              className="inline-flex h-10 items-center rounded-xl border border-line bg-card px-4 text-sm font-bold text-ink hover:bg-cream"
            >
              ← Voltar
            </Link>
            <ConvertToJobButton
              quoteId={id}
              status={q.status}
              archived={Boolean(q.archived_at)}
              jobId={q.job_id}
            />
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={q.status}>{LABELS[q.status] ?? q.status}</Badge>
        {q.archived_at ? <Badge tone="archived">Archived</Badge> : null}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="grid grid-cols-1 min-w-0 flex-1 items-start gap-4 xl:grid-cols-2">
        <QuoteSummaryCard snapshot={snapshot} />
        <QuoteServicesCard snapshot={snapshot} />
        {linkedRequest ? <QuoteCollectionCard request={linkedRequest} /> : null}
        {linkedRequest ? <QuoteDeliveryCard request={linkedRequest} /> : null}
        <div className="xl:col-span-2">
          <QuoteInventoryCard snapshot={snapshot} request={linkedRequest} />
        </div>
        {linkedRequest && (linkedRequest.needsPacking || linkedRequest.needsBoxes) ? (
          <div className="xl:col-span-2">
            <QuotePackingCard request={linkedRequest} />
          </div>
        ) : null}
        <SentCard kind="quote" id={id} />
        <TotalsCard totals={totals} />
      </div>
      <QuoteRequestSidebar request={request} />
      </div>
    </div>
  );
}
