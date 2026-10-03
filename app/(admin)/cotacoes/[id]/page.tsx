import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye } from "lucide-react";
import { formatGBP, formatDateLondon } from "@/lib/format";
import { COMPANY_SLUG, getCompanyId } from "@/lib/company";
import { getQuoteDetail } from "@/lib/quotes/queries";
import { getLatestRequestId, getRequestDetail } from "@/lib/requests/queries";
import { QuoteRequestSidebar } from "@/components/quotes/quote-request-sidebar";
import { updateQuoteStatus } from "@/lib/quotes/actions";
import { convertQuoteToJob } from "@/lib/jobs/actions";
import { emailQuote } from "@/lib/email/actions";
import { getGoogleConnection } from "@/lib/email/google";
import { listDeliveries } from "@/lib/email/send";
import { SendEmailButton } from "@/components/email/send-email-button";
import { Badge, Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
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
  const companyId = await getCompanyId(COMPANY_SLUG);
  const gmail = companyId ? await getGoogleConnection(companyId) : null;
  const deliveries = await listDeliveries("quote", id);
  const canEmail = q.status === "draft" || q.status === "sent";
  const requestId = q.request_id ?? (await getLatestRequestId(q.client_id));
  const request = requestId ? await getRequestDetail(requestId) : null;

  return (
    <div>
      <PageHeader
        title={`${q.number} · ${q.client_name}`}
        subtitle={q.title || "Quote"}
        action={
          <Link
            href="/cotacoes"
            className="inline-flex h-10 items-center rounded-xl border border-line bg-card px-4 text-sm font-bold text-ink hover:bg-cream"
          >
            ← Voltar
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={q.status}>{LABELS[q.status] ?? q.status}</Badge>
        {q.status === "draft" ? (
          <Link
            href={`/cotacoes/${id}/editar`}
            className="h-9 rounded-xl border border-line bg-card px-3 text-sm font-bold leading-9 text-ink hover:bg-cream"
          >
            Edit
          </Link>
        ) : null}
        {q.status === "draft" ? (
          <StatusForm id={id} status="sent" label="Mark as sent" />
        ) : null}
        {canEmail ? (
          gmail ? (
            <SendEmailButton
              label={q.status === "sent" ? "Resend by email" : "Send by email"}
              run={emailQuote.bind(null, id)}
            />
          ) : (
            <Link
              href="/configuracoes/email"
              className="h-9 rounded-xl bg-ink px-3 text-sm font-bold leading-9 text-white hover:opacity-90"
            >
              Connect Gmail to send
            </Link>
          )
        ) : null}
        {q.status === "sent" ? (
          <>
            <StatusForm id={id} status="approved" label="Approve" />
            <StatusForm id={id} status="rejected" label="Decline" />
          </>
        ) : null}
        {q.status === "approved" ? (
          <form
            action={async () => {
              "use server";
              await convertQuoteToJob(id);
            }}
          >
            <button
              type="submit"
              className="h-9 rounded-xl bg-ink px-3 text-sm font-bold text-white hover:opacity-90"
            >
              Convert to job
            </button>
          </form>
        ) : null}
        <Link
          href={`/cotacoes/${id}/preview`}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-line bg-card px-3 text-sm font-bold text-ink hover:bg-cream"
        >
          <Eye size={16} />
          Preview as Client
        </Link>
        <Link
          href={`/clientes/${q.client_id}`}
          className="h-9 rounded-xl border border-line px-3 text-sm font-bold leading-9 text-accent hover:bg-accent-soft"
        >
          View client
        </Link>
      </div>

      <div className="flex items-start gap-4">
      <div className="grid min-w-0 flex-1 gap-4">
        <Card className="h-fit p-5">
          <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">
            Resumo
          </h2>
          <dl className="text-sm">
            <Row k="Source" v={q.request_number ?? "Direct"} />
            <Row k="Recipient" v={q.client_email} />
            <Row k="Moving date" v={q.valid_until ? formatDateLondon(q.valid_until) : "—"} />
            <Row k="Moving time" v={q.move_time?.trim() || "—"} />
            <Row k="Subtotal" v={formatGBP(q.subtotal)} />
            {q.discount ? <Row k="Discount" v={formatGBP(q.discount)} /> : null}
            {q.tax ? <Row k="Tax" v={formatGBP(q.tax)} /> : null}
            <Row k="Total" v={formatGBP(q.total)} />
            {q.deposit ? <Row k="Required deposit" v={formatGBP(q.deposit)} /> : null}
          </dl>
          {q.message ? (
            <details className="mt-4 rounded-xl border border-line">
              <summary className="cursor-pointer px-3 py-2 text-sm font-bold text-ink">
                Terms and conditions
              </summary>
              <p className="max-h-80 overflow-y-auto whitespace-pre-wrap border-t border-line px-3 py-3 text-sm text-ink">
                {q.message}
              </p>
            </details>
          ) : null}
        </Card>
        <Card className="h-fit p-5">
          <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">
            Services
          </h2>
          <div className="space-y-2 text-sm">
            {q.lines.map((l, i) => (
              <div key={i} className="flex justify-between gap-3 border-b border-line py-2 last:border-0">
                <div>
                  <p className="font-bold text-ink">{l.name}</p>
                  {l.description ? <p className="text-ink-soft">{l.description}</p> : null}
                  <p className="text-xs text-ink-mute">
                    {l.quantity} × {formatGBP(l.unitPrice)}
                  </p>
                </div>
                <p className="font-bold text-ink">{formatGBP(l.total)}</p>
              </div>
            ))}
          </div>
        </Card>
        {q.packing ? (
          <Card className="h-fit p-5">
            <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">
              Packing service
            </h2>
            <dl className="text-sm">
              <Row k="Packing services" v={q.packing.service} />
              <Row k="Packing materials" v={q.packing.materials} />
            </dl>
          </Card>
        ) : null}
        {q.collection ? (
          <Card className="h-fit p-5">
            <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">
              Collection Information
            </h2>
            <dl className="text-sm">
              <Row k="Address" v={q.collection.address} />
              <Row k="Floor" v={q.collection.floor} />
              <Row k="Lift" v={q.collection.lift} />
              <Row k="Parking" v={q.collection.parking} />
              <Row k="Bedrooms" v={q.collection.bedrooms} />
            </dl>
          </Card>
        ) : null}
        {q.delivery ? (
          <Card className="h-fit p-5">
            <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">
              Delivery Information
            </h2>
            <dl className="text-sm">
              <Row k="Address" v={q.delivery.address} />
              <Row k="Floor" v={q.delivery.floor} />
              <Row k="Lift" v={q.delivery.lift} />
              <Row k="Parking" v={q.delivery.parking} />
              <Row k="Bedrooms" v={q.delivery.bedrooms} />
            </dl>
          </Card>
        ) : null}
        {q.inventory?.trim() ? (
          <Card className="h-fit p-5">
            <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">
              Inventory list
            </h2>
            <p className="whitespace-pre-wrap text-sm text-ink">{q.inventory}</p>
          </Card>
        ) : null}
        {deliveries.length ? (
          <Card className="h-fit p-5">
            <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">
              Sent
            </h2>
            <ul className="space-y-2 text-sm">
              {deliveries.map((d) => (
                <li key={d.id} className="flex justify-between gap-3 border-b border-line py-2 last:border-0">
                  <span>
                    {d.status === "sent" ? "Sent" : "Falhou"} · {d.to_email}
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

function Row({ k, v }: { k: string; v: string }) {
  return (
    <p className="flex justify-between gap-4 py-0.5">
      <span className="text-ink-soft">{k}</span>
      <span className="font-semibold text-ink">{v}</span>
    </p>
  );
}

function StatusForm({
  id,
  status,
  label,
}: {
  id: string;
  status: "sent" | "approved" | "rejected";
  label: string;
}) {
  return (
    <form
      action={async () => {
        "use server";
        await updateQuoteStatus(id, status);
      }}
    >
      <button
        type="submit"
        className="h-9 rounded-xl border border-line bg-card px-3 text-sm font-bold text-ink hover:bg-cream"
      >
        {label}
      </button>
    </form>
  );
}
