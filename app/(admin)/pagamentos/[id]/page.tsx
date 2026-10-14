import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDateNumericLondon, formatGBP } from "@/lib/format";
import { getPaymentDetail } from "@/lib/payments/queries";
import { PAYMENT_KIND_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/payments/constants";
import { PaymentDetailsCard, PaymentHeaderActions } from "@/components/payments/payment-actions";
import { StatusPill } from "@/components/funnel/list-kit";
import { CardTitle, ClientBox } from "@/components/funnel/document-cards";
import { Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PagamentoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getPaymentDetail(id);
  if (!p) notFound();
  const kind = PAYMENT_KIND_LABEL[p.kind] ?? p.kind;
  const unallocated = p.amount - p.allocations.reduce((s, a) => s + a.amount, 0);

  return (
    <div>
      <PageHeader
        title={`${kind} · ${formatGBP(p.amount)}`}
        subtitle={`${p.client_name} · ${formatDateNumericLondon(p.paid_on)}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/pagamentos"
              className="inline-flex h-10 items-center rounded-xl border border-line bg-card px-4 text-sm font-bold text-ink hover:bg-cream"
            >
              ← Back
            </Link>
            <PaymentHeaderActions paymentId={p.id} />
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusPill
          badge="bg-emerald-50 text-emerald-800"
          dot="bg-emerald-500"
          label={PAYMENT_STATUS_LABEL[p.status] ?? p.status}
        />
        {p.receipt_sent_at ? (
          <span className="text-xs text-ink-mute">Receipt sent {formatDateNumericLondon(p.receipt_sent_at)}</span>
        ) : null}
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <ClientBox
          clientId={p.client_id}
          name={p.client_name}
          address={p.client_address}
          addressLabel="Billing address"
          phone={p.client_phone}
          email={p.client_email}
        />
        <PaymentDetailsCard
          paymentId={p.id}
          method={p.method}
          paidOn={p.paid_on}
          reference={p.reference}
          details={p.details}
        />

        <Card className="h-fit p-5 xl:col-span-2">
          <CardTitle>Applied to</CardTitle>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs font-semibold text-ink-mute">
                  <th className="py-2 pr-4 font-semibold">Document</th>
                  <th className="py-2 pr-4 text-right font-semibold">Applied</th>
                  <th className="py-2 pr-4 text-right font-semibold">Document total</th>
                  <th className="py-2 text-right font-semibold">Balance now</th>
                </tr>
              </thead>
              <tbody>
                {p.quote_id ? (
                  <tr className="border-b border-line">
                    <td className="py-3 pr-4">
                      <Link href={`/cotacoes/${p.quote_id}`} className="font-semibold text-accent underline">
                        Quote {p.quote_number}
                      </Link>
                      <span className="ml-2 text-xs text-ink-mute">deposit</span>
                    </td>
                    <td className="py-3 pr-4 text-right text-ink">{formatGBP(p.amount)}</td>
                    <td className="py-3 pr-4 text-right text-ink-soft">—</td>
                    <td className="py-3 text-right text-ink-soft">—</td>
                  </tr>
                ) : null}
                {p.allocations.map((a) => (
                  <tr key={a.invoice_id} className="border-b border-line last:border-0">
                    <td className="py-3 pr-4">
                      <Link href={`/faturas/${a.invoice_id}`} className="font-semibold text-accent underline">
                        Invoice {a.number}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-right text-ink">{formatGBP(a.amount)}</td>
                    <td className="py-3 pr-4 text-right text-ink-soft">{formatGBP(a.total)}</td>
                    <td className="py-3 text-right font-semibold text-ink">{formatGBP(a.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {p.kind === "deposit" && unallocated > 0 ? (
            <p className="mt-3 text-sm text-ink-soft">
              {formatGBP(unallocated)} of this deposit is not on an invoice yet. It is applied when the
              job&apos;s invoice is created.
            </p>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
