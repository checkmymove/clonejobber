import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDateLondon, penceToInput, toDateInput } from "@/lib/format";
import { getQuoteDetail } from "@/lib/quotes/queries";
import { getLatestRequestId, getRequestDetail } from "@/lib/requests/queries";
import { requestSnapshotFromDetail } from "@/lib/requests/edit-snapshot";
import { quoteLinesFromPence } from "@/lib/quotes/edit-snapshot";
import { QuoteRequestSidebar } from "@/components/quotes/quote-request-sidebar";
import { QuoteMoreMenu } from "@/components/quotes/quote-more-menu";
import {
  QuoteCollectionCard,
  QuoteDeliveryCard,
  QuoteInventoryCard,
  QuotePackingCard,
  QuoteServicesCard,
  QuoteSummaryCard,
} from "@/components/quotes/quote-inline-cards";
import { listDeliveries } from "@/lib/email/send";
import { listSmsDeliveries } from "@/lib/sms/send";
import { Badge, Card, PageHeader } from "@/components/ui";

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
  const deliveries = await listDeliveries("quote", id);
  const smsDeliveries = await listSmsDeliveries(id);
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

  return (
    <div>
      <PageHeader
        title={`${q.number} · ${q.client_name}`}
        subtitle={q.title || "Quote"}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <QuoteMoreMenu
              quoteId={id}
              status={q.status}
              archived={Boolean(q.archived_at)}
              jobId={q.job_id}
            />
            <Link
              href={`/clientes/${q.client_id}`}
              className="h-10 rounded-xl border border-line px-3 text-sm font-bold leading-10 text-accent hover:bg-accent-soft"
            >
              View client
            </Link>
            <Link
              href="/cotacoes"
              className="inline-flex h-10 items-center rounded-xl border border-line bg-card px-4 text-sm font-bold text-ink hover:bg-cream"
            >
              ← Voltar
            </Link>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={q.status}>{LABELS[q.status] ?? q.status}</Badge>
        {q.archived_at ? <Badge tone="archived">Archived</Badge> : null}
      </div>

      <div className="flex items-start gap-4">
      <div className="grid min-w-0 flex-1 gap-4">
        <QuoteSummaryCard snapshot={snapshot} />
        <QuoteServicesCard snapshot={snapshot} />
        {linkedRequest && (linkedRequest.needsPacking || linkedRequest.needsBoxes) ? (
          <QuotePackingCard request={linkedRequest} />
        ) : null}
        {linkedRequest ? <QuoteCollectionCard request={linkedRequest} /> : null}
        {linkedRequest ? <QuoteDeliveryCard request={linkedRequest} /> : null}
        <QuoteInventoryCard snapshot={snapshot} request={linkedRequest} />
        {deliveries.length || smsDeliveries.length ? (
          <Card className="h-fit p-5">
            <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">
              Sent
            </h2>
            <ul className="space-y-2 text-sm">
              {deliveries.map((d) => (
                <li key={d.id} className="flex justify-between gap-3 border-b border-line py-2 last:border-0">
                  <span>
                    {d.status === "sent" ? "Email sent" : "Email failed"} · {d.to_email}
                    {d.error ? <span className="block text-rose-700">{d.error}</span> : null}
                  </span>
                  <span className="text-ink-soft">{formatDateLondon(d.sent_at)}</span>
                </li>
              ))}
              {smsDeliveries.map((d) => (
                <li key={d.id} className="flex justify-between gap-3 border-b border-line py-2 last:border-0">
                  <span>
                    {d.status === "sent" ? "Text sent" : "Text not sent"} · {d.to_phone}
                    {d.error ? <span className="block text-rose-700">{d.error}</span> : null}
                  </span>
                  <span className="text-ink-soft">{formatDateLondon(d.sent_at)}</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
      <QuoteRequestSidebar request={request} />
      </div>
    </div>
  );
}
