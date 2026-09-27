import Link from "next/link";
import { notFound } from "next/navigation";
import { formatGBP, formatDateLondon } from "@/lib/format";
import { COMPANY_SLUG, getCompanyId } from "@/lib/company";
import { getInvoiceDetail } from "@/lib/invoices/queries";
import { updateInvoiceStatus } from "@/lib/invoices/actions";
import { emailInvoice } from "@/lib/email/actions";
import { getGoogleConnection } from "@/lib/email/google";
import { listDeliveries } from "@/lib/email/send";
import { SendEmailButton } from "@/components/email/send-email-button";
import { Badge, Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const inv = await getInvoiceDetail(id);
  if (!inv) notFound();
  const companyId = await getCompanyId(COMPANY_SLUG);
  const gmail = companyId ? await getGoogleConnection(companyId) : null;
  const deliveries = await listDeliveries("invoice", id);
  const canEmail = inv.status === "draft" || inv.status === "sent" || inv.status === "overdue";

  return (
    <div>
      <PageHeader
        title={`${inv.number} · ${inv.client_name}`}
        subtitle={inv.subject}
        action={
          <Link
            href="/faturas"
            className="inline-flex h-10 items-center rounded-xl border border-line bg-card px-4 text-sm font-bold text-ink hover:bg-cream"
          >
            ← Voltar
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={inv.status}>{LABELS[inv.status] ?? inv.status}</Badge>
        {inv.status === "draft" ? (
          <Link
            href={`/faturas/${id}/editar`}
            className="h-9 rounded-xl border border-line bg-card px-3 text-sm font-bold leading-9 text-ink hover:bg-cream"
          >
            Edit
          </Link>
        ) : null}
        {inv.status === "draft" ? <StatusForm id={id} status="sent" label="Mark as sent" /> : null}
        {canEmail ? (
          gmail ? (
            <SendEmailButton
              label={inv.status === "draft" ? "Send by email" : "Resend by email"}
              run={emailInvoice.bind(null, id)}
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
        {inv.status === "sent" || inv.status === "overdue" ? (
          <StatusForm id={id} status="paid" label="Mark as paid" />
        ) : null}
        {inv.status !== "paid" && inv.status !== "cancelled" ? (
          <StatusForm id={id} status="cancelled" label="Cancel" />
        ) : null}
        <Link
          href={`/clientes/${inv.client_id}`}
          className="h-9 rounded-xl border border-line px-3 text-sm font-bold leading-9 text-accent hover:bg-accent-soft"
        >
          View client
        </Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="h-fit p-5">
          <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">Billing</h2>
          <dl className="text-sm">
            <Row k="Job" v={inv.job_number ?? "Direct"} />
            <Row k="Recipient" v={inv.client_email} />
            <Row k="Issued" v={formatDateLondon(inv.issued_on)} />
            <Row k="Vencimento" v={formatDateLondon(inv.due_on)} />
            <Row k="Total" v={formatGBP(inv.total)} />
            <Row k="Saldo" v={formatGBP(inv.balance)} />
          </dl>
          {inv.message ? <p className="mt-3 whitespace-pre-wrap text-sm text-ink">{inv.message}</p> : null}
        </Card>
        <Card className="h-fit p-5">
          <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">Itens</h2>
          {inv.lines.map((l, i) => (
            <div key={i} className="flex justify-between gap-3 border-b border-line py-2 text-sm last:border-0">
              <div>
                <p className="font-bold text-ink">{l.name}</p>
                <p className="text-xs text-ink-mute">
                  {l.quantity} × {formatGBP(l.unitPrice)}
                </p>
              </div>
              <p className="font-bold text-ink">{formatGBP(l.total)}</p>
            </div>
          ))}
        </Card>
        {deliveries.length ? (
          <Card className="h-fit p-5 xl:col-span-2">
            <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">Envios</h2>
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
  status: "draft" | "sent" | "paid" | "cancelled";
  label: string;
}) {
  return (
    <form
      action={async () => {
        "use server";
        await updateInvoiceStatus(id, status);
      }}
    >
      <button type="submit" className="h-9 rounded-xl border border-line bg-card px-3 text-sm font-bold text-ink hover:bg-cream">
        {label}
      </button>
    </form>
  );
}
