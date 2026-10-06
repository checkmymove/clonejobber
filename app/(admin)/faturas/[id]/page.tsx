import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDateLondon } from "@/lib/format";
import { COMPANY_SLUG, getCompanyId } from "@/lib/company";
import { getInvoiceDetail } from "@/lib/invoices/queries";
import { invoiceSnapshotFromDetail } from "@/lib/invoices/edit-snapshot";
import { updateInvoiceStatus } from "@/lib/invoices/actions";
import { emailInvoice } from "@/lib/email/actions";
import { getGoogleConnection } from "@/lib/email/google";
import { listDeliveries } from "@/lib/email/send";
import { SendEmailButton } from "@/components/email/send-email-button";
import {
  InvoiceBillingCard,
  InvoiceItemsCard,
} from "@/components/invoices/invoice-inline-cards";
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
  const snapshot = invoiceSnapshotFromDetail(inv);
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
              Connect Gmail to send
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
        <InvoiceBillingCard snapshot={snapshot} />
        <InvoiceItemsCard snapshot={snapshot} />
        {deliveries.length ? (
          <Card className="h-fit p-5 xl:col-span-2">
            <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">Sent</h2>
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
