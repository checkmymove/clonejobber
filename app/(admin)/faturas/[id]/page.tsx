import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { formatDateNumericLondon, formatGBP } from "@/lib/format";
import { getInvoiceDetail } from "@/lib/invoices/queries";
import { INVOICE_STATUS_META, paymentTermsLabel } from "@/lib/invoices/status";
import { listInvoicePayments } from "@/lib/payments/queries";
import { paymentMethodLabel } from "@/lib/payments/constants";
import { getClientFinancials } from "@/lib/clients/crm-queries";
import { SentCard } from "@/components/funnel/sent-card";
import { getRequestDetail } from "@/lib/requests/queries";
import { requestSnapshotFromDetail } from "@/lib/requests/edit-snapshot";
import {
  PackingServiceCard,
  RemovalServiceCard,
  RequestInventoryCard,
  RequestLocationCard,
} from "@/components/requests/request-inline-cards";
import { hasRemovalService } from "@/lib/requests/edit-snapshot";
import { ClientContactCard } from "@/components/funnel/client-contact-card";
import { FunnelHistoryCard } from "@/components/funnel/funnel-history-card";
import { getClientContact } from "@/lib/clients/queries";
import { getCompanyId } from "@/lib/company";
import { getActiveServices } from "@/lib/requests/company";
import { InvoiceHeaderActions } from "@/components/invoices/invoice-actions";
import { NotesCard } from "@/components/funnel/notes-card";
import { StatusPill } from "@/components/funnel/list-kit";
import {
  CardTitle,
  DetailRows,
  LineItemsCard,
  dateOrDash,
  type TotalRow,
} from "@/components/funnel/document-cards";
import { Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await getInvoiceDetail(id);
  if (!inv) notFound();

  const [payments, financials, request, client, companyId] = await Promise.all([
    listInvoicePayments(id),
    getClientFinancials(inv.client_id),
    inv.linked_request_id ? getRequestDetail(inv.linked_request_id) : null,
    getClientContact(inv.client_id),
    getCompanyId(),
  ]);
  if (!client) notFound();
  const services = companyId ? await getActiveServices(companyId) : [];
  const snapshot = request ? requestSnapshotFromDetail(request) : null;
  const meta = INVOICE_STATUS_META[inv.list_status];

  const totals: TotalRow[] = [
    { label: "Subtotal", value: formatGBP(inv.subtotal), muted: true },
    ...(inv.discount ? [{ label: "Discount", value: `-${formatGBP(inv.discount)}`, muted: true }] : []),
    ...(inv.tax ? [{ label: "VAT", value: formatGBP(inv.tax), muted: true }] : []),
    { label: "Total", value: formatGBP(inv.total), strong: true },
    ...payments.map((p) => ({
      label: (
        <Link href={`/pagamentos/${p.payment_id}`} className="text-accent underline">
          {p.kind === "deposit" ? "Deposit collected" : "Payment"} · {formatDateNumericLondon(p.paid_on)} ·{" "}
          {paymentMethodLabel(p.method)}
        </Link>
      ),
      value: `-${formatGBP(p.amount)}`,
      muted: true,
    })),
    ...(inv.bad_debt_amount
      ? [{ label: "Bad debt", value: `-${formatGBP(inv.bad_debt_amount)}`, muted: true }]
      : []),
    { label: "Invoice balance", value: formatGBP(inv.status === "cancelled" ? 0 : inv.balance), highlight: true },
    { label: "Account balance", value: formatGBP(financials.balancePence), muted: true },
  ];

  const statusDate: [string, string][] = [];
  if (inv.status === "paid" && inv.paid_at) {
    statusDate.push([inv.closed_at ? "Closed" : "Paid", dateOrDash(inv.paid_at)]);
  }
  if (inv.status === "bad_debt" && inv.closed_at) statusDate.push(["Bad debt", dateOrDash(inv.closed_at)]);
  if (inv.voided_at) statusDate.push(["Voided", dateOrDash(inv.voided_at)]);

  return (
    <div>
      <PageHeader
        title={`${inv.number} · ${inv.client_name}`}
        subtitle={inv.subject}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/faturas"
              className="inline-flex h-10 items-center rounded-xl border border-line bg-card px-4 text-sm font-bold text-ink hover:bg-cream"
            >
              ← Back
            </Link>
            <InvoiceHeaderActions
              invoiceId={inv.id}
              clientId={inv.client_id}
              status={inv.status}
              balance={inv.balance}
              paymentCount={payments.length}
            />
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusPill badge={meta.badge} dot={meta.dot} label={meta.label} />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        <ClientContactCard client={client} address={inv.client_address} addressLabel="Billing address" />
        <FunnelHistoryCard
          clientId={inv.client_id}
          jobId={inv.job_id}
          quoteId={inv.quote_id}
          invoiceId={inv.id}
          currentId={inv.id}
        />

        {snapshot && request ? (
          <>
            <RequestLocationCard title="Collection Information" snapshot={snapshot} kind="pickup" />
            <RequestLocationCard title="Delivery Information" snapshot={snapshot} kind="delivery" />
            <PackingServiceCard snapshot={snapshot} />
            {hasRemovalService(snapshot) ? <RemovalServiceCard snapshot={snapshot} services={services} /> : null}
          </>
        ) : null}

        <DetailRows
          title="Invoice details"
          rows={[
            ["Invoice #", inv.number],
            [
              "Invoice for",
              inv.job_id ? (
                <Link href={`/servicos/${inv.job_id}`} className="text-accent underline">
                  Job {inv.job_number}
                </Link>
              ) : (
                "—"
              ),
            ],
            ...(inv.quote_id
              ? ([
                  [
                    "From quote",
                    <Link key="q" href={`/cotacoes/${inv.quote_id}`} className="text-accent underline">
                      {inv.quote_number}
                    </Link>,
                  ],
                ] as [string, React.ReactNode][])
              : []),
            ["Issued", inv.status === "draft" ? "Not sent yet" : dateOrDash(inv.issued_on)],
            ["Payment terms", paymentTermsLabel(inv.payment_terms)],
            ["Due date", inv.status === "draft" ? "—" : dateOrDash(inv.due_on)],
            ...(inv.sent_at ? ([["Sent", dateOrDash(inv.sent_at)]] as [string, string][]) : []),
            ...statusDate,
          ]}
        />

        <LineItemsCard
          lines={inv.lines}
          totals={totals}
          action={
            inv.status !== "cancelled" ? (
              <Link
                href={`/faturas/${inv.id}/editar`}
                aria-label="Edit line items"
                className="grid h-7 w-7 place-items-center rounded-lg text-ink-soft hover:bg-cream hover:text-ink"
              >
                <Pencil size={14} />
              </Link>
            ) : null
          }
        />

        {snapshot && request ? <RequestInventoryCard snapshot={snapshot} files={request.files} /> : null}

        {inv.message ? (
          <Card className="h-fit p-5 xl:col-span-2">
            <CardTitle>Contract / Disclaimer</CardTitle>
            <p className="whitespace-pre-wrap text-sm text-ink">{inv.message}</p>
          </Card>
        ) : null}

        <SentCard kind="invoice" id={inv.id} />

        <NotesCard kind="invoice" id={inv.id} notes={inv.notes} />
      </div>
    </div>
  );
}
