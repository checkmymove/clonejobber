import { listClientsForSelect } from "@/lib/clients/queries";
import { COMPANY_SLUG } from "@/lib/company";
import { isUuid } from "@/lib/funnel/validation";
import { todayLondonInput } from "@/lib/format";
import { listDepositQuotes, listOutstandingInvoices } from "@/lib/payments/queries";
import { PaymentForm } from "@/components/payments/payment-form";

export const dynamic = "force-dynamic";

export default async function NovoPagamentoPage({
  searchParams,
}: {
  searchParams: Promise<{
    clientId?: string;
    invoiceId?: string;
    quoteId?: string;
    kind?: string;
    returnTo?: string;
  }>;
}) {
  const sp = await searchParams;
  const clientId = sp.clientId && isUuid(sp.clientId) ? sp.clientId : "";
  const today = todayLondonInput();
  const [clients, invoices, quotes] = await Promise.all([
    listClientsForSelect(COMPANY_SLUG),
    clientId ? listOutstandingInvoices(clientId) : [],
    clientId ? listDepositQuotes(clientId) : [],
  ]);

  return (
    <div className="min-h-[calc(100dvh-6.5rem)] rounded-2xl bg-white px-6 py-8 sm:px-10">
      <div className="mx-auto max-w-[860px]">
        <PaymentForm
          key={clientId}
          clients={clients}
          clientId={clientId}
          invoices={invoices.map((i) => ({
            ...i,
            pastDue: i.status === "overdue" || (i.status === "sent" && i.due_on < today),
          }))}
          quotes={quotes}
          initialKind={sp.kind === "deposit" || (!invoices.length && quotes.length > 0) ? "deposit" : "payment"}
          initialInvoiceId={sp.invoiceId}
          initialQuoteId={sp.quoteId}
          returnTo={sp.returnTo}
          today={today}
        />
      </div>
    </div>
  );
}
