import Link from "next/link";
import { notFound } from "next/navigation";
import { formatGBP, formatDateLondon } from "@/lib/format";
import { COMPANY_SLUG, getCompanyId } from "@/lib/company";
import { getQuoteDetail } from "@/lib/quotes/queries";
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
              Ligar Gmail para enviar
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
          href={`/clientes/${q.client_id}`}
          className="h-9 rounded-xl border border-line px-3 text-sm font-bold leading-9 text-accent hover:bg-accent-soft"
        >
          View client
        </Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="h-fit p-5">
          <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">
            Resumo
          </h2>
          <dl className="text-sm">
            <Row k="Origem" v={q.request_number ?? "Direct"} />
            <Row k="Recipient" v={q.client_email} />
            <Row k="Validade" v={q.valid_until ? formatDateLondon(q.valid_until) : "—"} />
            <Row k="Total" v={formatGBP(q.total)} />
          </dl>
          {q.message ? <p className="mt-3 whitespace-pre-wrap text-sm text-ink">{q.message}</p> : null}
        </Card>
        <Card className="h-fit p-5">
          <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">
            Itens
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
        {deliveries.length ? (
          <Card className="h-fit p-5 xl:col-span-2">
            <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">
              Envios
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
