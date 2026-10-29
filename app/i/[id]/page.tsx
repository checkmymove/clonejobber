import { notFound } from "next/navigation";
import { getCompanyName } from "@/lib/company";
import { formatDateNumericLondon, formatGBP } from "@/lib/format";
import { isUuid } from "@/lib/funnel/validation";
import { getInvoiceDetail } from "@/lib/invoices/queries";
import { INVOICE_STATUS_META } from "@/lib/invoices/status";
import { ClientDocumentView, type ClientDocRow } from "@/components/funnel/client-document-view";

export const dynamic = "force-dynamic";

/** Client view of an invoice (Jobber client hub). Also the admin's "Preview as Client". */
export default async function PublicInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const inv = await getInvoiceDetail(id);
  if (!inv || inv.status === "cancelled") notFound();
  const companyName = await getCompanyName();
  const draft = inv.status === "draft";

  const totals: ClientDocRow[] = [
    { label: "Subtotal", value: formatGBP(inv.subtotal) },
    ...(inv.discount ? [{ label: "Discount", value: `-${formatGBP(inv.discount)}` }] : []),
    ...(inv.tax ? [{ label: "VAT", value: formatGBP(inv.tax) }] : []),
    { label: "Total", value: formatGBP(inv.total), strong: true },
    ...(inv.paid ? [{ label: "Payments", value: `-${formatGBP(inv.paid)}` }] : []),
    { label: "Balance due", value: formatGBP(inv.balance), strong: true },
  ];

  return (
    <ClientDocumentView
      companyName={companyName}
      heading={`Invoice #${inv.number}`}
      title={inv.subject}
      status={draft ? undefined : INVOICE_STATUS_META[inv.list_status]}
      clientName={inv.client_name}
      clientLines={[inv.client_address, inv.client_phone]}
      facts={[
        { label: "Issued", value: draft ? "—" : formatDateNumericLondon(inv.issued_on) },
        { label: "Due", value: draft ? "—" : formatDateNumericLondon(inv.due_on) },
      ]}
      lines={inv.lines}
      showPrices
      totals={totals}
      pdfHref={`/i/${inv.id}/pdf`}
    >
      {inv.message.trim() ? (
        <p className="mt-6 whitespace-pre-wrap border-t border-line pt-4 text-sm text-ink-soft">{inv.message}</p>
      ) : null}
    </ClientDocumentView>
  );
}
