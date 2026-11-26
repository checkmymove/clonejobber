import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { formatDateLondon, penceToInput, toDateInput } from "@/lib/format";
import { getQuoteDetail } from "@/lib/quotes/queries";
import { getLatestRequestId, getRequestDetail } from "@/lib/requests/queries";
import { requestSnapshotFromDetail } from "@/lib/requests/edit-snapshot";
import { quoteLinesFromPence } from "@/lib/quotes/edit-snapshot";
import { QuoteRequestSidebar } from "@/components/quotes/quote-request-sidebar";
import {
  ConvertToJobButton,
  QuoteMoreMenu,
  SendQuoteButton,
} from "@/components/quotes/quote-more-menu";
import { QuoteInfoCard } from "@/components/quotes/quote-info-card";
import { listProducts } from "@/lib/products/queries";
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
import { ClientContactCard } from "@/components/funnel/client-contact-card";
import { NotesCard } from "@/components/funnel/notes-card";
import { getClientContact } from "@/lib/clients/queries";
import { getCompanyId } from "@/lib/company";
import { getActiveServices } from "@/lib/requests/company";
import { getQuoteDeposits } from "@/lib/payments/queries";
import { SentCard } from "@/components/funnel/sent-card";
import { RouteEstimateCard } from "@/components/funnel/route-estimate-card";
import { Badge, PageHeader, buttonOutline } from "@/components/ui";

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
  const [services, products] = companyId
    ? await Promise.all([getActiveServices(companyId), listProducts(companyId, "", "name", "asc")])
    : [[], []];
  const catalog = products.map((p) => ({
    id: p.id,
    type: p.item_type,
    name: p.name,
    description: p.description,
    price: penceToInput(p.unit_price),
  }));
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

  const moveDate = snapshot.validUntil;
  const subtitle = [
    q.number,
    q.request_number ? `From request ${q.request_number}` : null,
    request && q.request_id ? `Received ${formatDateLondon(request.submitted_at)}` : null,
    moveDate ? `Move on ${formatDateLondon(moveDate)} ${moveDate.slice(0, 4)}${snapshot.moveTime ? ` at ${snapshot.moveTime}` : ""}` : null,
  ]
    .filter(Boolean)
    .join(" • ");
  const archived = Boolean(q.archived_at);

  return (
    <div>
      <PageHeader
        title={`Quote for ${q.client_name}`}
        subtitle={subtitle}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={q.job_id && q.status !== "approved" ? "converted" : q.status} size="lg">
              {q.job_id && q.status !== "approved" ? "Converted" : (LABELS[q.status] ?? q.status)}
            </Badge>
            <QuoteMoreMenu quoteId={id} clientId={q.client_id} status={q.status} archived={archived} jobId={q.job_id} />
            <Link href="/cotacoes" className={buttonOutline}>
              <ArrowLeft size={17} aria-hidden />
              Back
            </Link>
            {/* Draft: Send Quote. Once sent, the green button moves on to the job; Resend is under More. */}
            {q.status === "draft" && !q.job_id ? (
              <SendQuoteButton quoteId={id} status={q.status} archived={archived} />
            ) : (
              <ConvertToJobButton quoteId={id} status={q.status} archived={archived} jobId={q.job_id} />
            )}
          </div>
        }
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="grid min-w-0 flex-1 grid-cols-1 items-start gap-4 xl:grid-cols-2">
          <ClientContactCard
            title="Client information"
            client={client}
            address={linkedRequest ? [linkedRequest.pickupAddress, linkedRequest.pickupPostcode].filter(Boolean).join(", ") : ""}
          />
          <QuoteInfoCard
            number={q.number}
            status={q.status}
            statusLabel={LABELS[q.status] ?? q.status}
            archived={archived}
            createdAt={q.created_at}
            requestId={q.request_id}
            requestNumber={q.request_number}
            clientId={q.client_id}
            clientNumber={client.number ?? null}
            clientName={q.client_name}
            jobId={q.job_id}
          />
          {linkedRequest ? (
            <>
              <RequestLocationCard title="Collection address" snapshot={linkedRequest} kind="pickup" />
              <RequestLocationCard title="Delivery address" snapshot={linkedRequest} kind="delivery" />
            </>
          ) : null}
          <RouteEstimateCard
            collection={
              linkedRequest
                ? [linkedRequest.pickupAddress, linkedRequest.pickupPostcode].filter(Boolean).join(", ")
                : q.collection?.address ?? ""
            }
            delivery={
              linkedRequest
                ? [linkedRequest.deliveryAddress, linkedRequest.deliveryPostcode].filter(Boolean).join(", ")
                : q.delivery?.address ?? ""
            }
          />
          <QuoteMovingCard snapshot={snapshot} />
          {linkedRequest ? (
            hasRemovalService(linkedRequest) ? (
              <>
                <RemovalServiceCard snapshot={linkedRequest} services={services} half />
                <PackingServiceCard snapshot={linkedRequest} half />
              </>
            ) : (
              <PackingServiceCard snapshot={linkedRequest} />
            )
          ) : null}
          <QuoteServicesCard snapshot={snapshot} catalog={catalog} />

          <div className="grid gap-4 xl:col-span-2 xl:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
            <div className="flex min-w-0 flex-col gap-4">
              <QuoteInventoryCard snapshot={snapshot} request={linkedRequest} files={linkedRequest ? request?.files : undefined} />
              <QuoteTermsCard snapshot={snapshot} />
              <NotesCard kind="quote" id={id} notes={q.notes} />
              <SentCard kind="quote" id={id} />
            </div>
            <div className="flex min-w-0 flex-col gap-4">
              <QuoteTotalsCard snapshot={snapshot} deposits={deposits} />
            </div>
          </div>
        </div>
        <QuoteRequestSidebar request={request} defaultOpen={false} />
      </div>
    </div>
  );
}
