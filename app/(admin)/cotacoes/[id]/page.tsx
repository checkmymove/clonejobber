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
  QuoteInventoryCard,
  QuoteMovingCard,
  QuoteServicesCard,
  QuoteTermsCard,
  QuoteTotalsCard,
} from "@/components/quotes/quote-inline-cards";
import {
  PackingServiceCard,
  RemovalServiceCard,
  RequestLocationCard,
} from "@/components/requests/request-inline-cards";
import { hasRemovalService } from "@/lib/requests/edit-snapshot";
import { depositTotalRows, type TotalRow } from "@/components/funnel/document-cards";
import { FunnelHistoryCard } from "@/components/funnel/funnel-history-card";
import { ClientContactCard } from "@/components/funnel/client-contact-card";
import { NotesCard } from "@/components/funnel/notes-card";
import { getClientContact } from "@/lib/clients/queries";
import { getCompanyId } from "@/lib/company";
import { getActiveServices } from "@/lib/requests/company";
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
  const [deposits, client, companyId] = await Promise.all([
    getQuoteDeposits(id),
    getClientContact(q.client_id),
    getCompanyId(),
  ]);
  if (!client) notFound();
  const services = companyId ? await getActiveServices(companyId) : [];
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
        <ClientContactCard
          client={client}
          address={linkedRequest ? [linkedRequest.pickupAddress, linkedRequest.pickupPostcode].filter(Boolean).join(", ") : ""}
        />
        <FunnelHistoryCard clientId={q.client_id} requestId={q.request_id} quoteId={id} currentId={id} />
        {linkedRequest ? (
          <>
            <RequestLocationCard title="Collection Information" snapshot={linkedRequest} kind="pickup" />
            <RequestLocationCard title="Delivery Information" snapshot={linkedRequest} kind="delivery" />
          </>
        ) : null}
        <QuoteMovingCard snapshot={snapshot} />
        {linkedRequest ? (
          <>
            <PackingServiceCard snapshot={linkedRequest} />
            {hasRemovalService(linkedRequest) ? (
              <RemovalServiceCard snapshot={linkedRequest} services={services} />
            ) : null}
          </>
        ) : null}
        <QuoteServicesCard snapshot={snapshot} />
        <QuoteInventoryCard snapshot={snapshot} request={linkedRequest} />
        <NotesCard kind="quote" id={id} notes={q.notes} />
        <QuoteTermsCard snapshot={snapshot} />
        <SentCard kind="quote" id={id} />
        <QuoteTotalsCard snapshot={snapshot} totals={totals} />
      </div>
      <QuoteRequestSidebar request={request} />
      </div>
    </div>
  );
}
