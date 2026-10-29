import "server-only";
import { sql } from "@/lib/db";
import { COMPANY_SLUG } from "@/lib/company";
import { formatDateNumericLondon, todayLondonInput } from "@/lib/format";
import { getInvoiceDetail } from "@/lib/invoices/queries";
import { deriveInvoiceStatus } from "@/lib/invoices/status";
import { getJobDetail } from "@/lib/jobs/queries";
import { getQuoteDetail } from "@/lib/quotes/queries";
import { moneyText, pdfFileName, renderDocumentPdf, type PdfRow } from "./document";

export type BuiltPdf = { bytes: Uint8Array; fileName: string; companyId: string };

async function companyName(): Promise<{ id: string; name: string }> {
  const rows = await sql<{ id: string; name: string }[]>`
    select id, name from companies where slug = ${COMPANY_SLUG} limit 1
  `;
  return rows[0] ?? { id: "", name: "" };
}

function date(value: string | Date | null | undefined): string {
  return value ? formatDateNumericLondon(value) : "—";
}

function addressLines(address: string): string[] {
  return address
    .split(/,\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<string[]>((lines, part) => {
      // Two address parts per line, like Jobber's recipient block.
      const last = lines[lines.length - 1];
      if (last && !last.includes(",")) lines[lines.length - 1] = `${last}, ${part}`;
      else lines.push(part);
      return lines;
    }, []);
}

export async function buildQuotePdf(quoteId: string): Promise<BuiltPdf | null> {
  const q = await getQuoteDetail(quoteId);
  if (!q) return null;
  const totals: PdfRow[] = [
    { label: "Subtotal", value: moneyText(q.subtotal) },
    ...(q.discount ? [{ label: "Discount", value: `-${moneyText(q.discount)}` }] : []),
    ...(q.tax ? [{ label: "Tax", value: moneyText(q.tax) }] : []),
    { label: "Total", value: moneyText(q.total), strong: true },
    ...(q.deposit ? [{ label: "Required deposit", value: moneyText(q.deposit) }] : []),
  ];
  const bytes = await renderDocumentPdf({
    heading: `Quote #${q.number}`,
    title: q.title,
    companyName: q.company_name,
    recipientName: q.client_name,
    recipientLines: [...addressLines(q.client_address), q.client_phone, q.client_email],
    facts: [
      { label: "Sent", value: date(q.sent_at ?? q.created_at) },
      { label: "Moving date", value: date(q.valid_until) },
      ...(q.move_time.trim() ? [{ label: "Moving time", value: q.move_time.trim() }] : []),
    ],
    headline: { label: "Total", value: moneyText(q.total) },
    lines: q.lines,
    showPrices: true,
    totals,
    note: [
      q.collection ? `Collection: ${q.collection.address}` : "",
      q.delivery ? `Delivery: ${q.delivery.address}` : "",
      "",
      "This quote is valid for the next 30 days, after which values may be subject to change.",
    ]
      .filter((line, index, all) => line || (index > 0 && all[index - 1]))
      .join("\n"),
    appendix: q.message.trim() ? { title: "Terms and conditions", body: q.message } : undefined,
  });
  return { bytes, fileName: pdfFileName("quote", q.number), companyId: q.company_id };
}

export async function buildJobPdf(jobId: string): Promise<BuiltPdf | null> {
  const j = await getJobDetail(jobId);
  if (!j) return null;
  const company = await companyName();
  const dated = j.visits
    .filter((v) => v.visit_date && !v.later)
    .map((v) => v.visit_date as string)
    .sort();
  const first = j.visits.find((v) => v.visit_date === dated[0]);
  const time = first && !first.anytime && first.start_time ? `${first.start_time}${first.end_time ? ` - ${first.end_time}` : ""}` : "";
  const bytes = await renderDocumentPdf({
    heading: `Job #${j.number}`,
    title: j.title,
    companyName: company.name,
    recipientName: j.client_name,
    recipientLines: [...addressLines(j.pickup_address || j.client_address), j.client_phone, j.client_email],
    facts: [
      { label: "Scheduled", value: dated[0] ? date(dated[0]) : "Unscheduled" },
      ...(time ? [{ label: "Arrival time", value: time }] : []),
      { label: "Description", value: j.title || "Job" },
    ],
    lines: j.lines,
    showPrices: false,
    lineDate: dated[0] ? date(dated[0]) : undefined,
    totals: [],
    note: [
      j.pickup_address ? `Collection: ${j.pickup_address}` : "",
      j.delivery_address ? `Delivery: ${j.delivery_address}` : "",
      "",
      "We appreciate your trust and will be here in the future whenever you need our help!",
    ]
      .filter((line, index, all) => line || (index > 0 && all[index - 1]))
      .join("\n"),
  });
  return { bytes, fileName: pdfFileName("job", j.number), companyId: company.id };
}

const INVOICE_NOTE = "Thank you for your business. Please contact us with any questions regarding this invoice.";

export async function buildInvoicePdf(invoiceId: string): Promise<BuiltPdf | null> {
  const inv = await getInvoiceDetail(invoiceId);
  if (!inv) return null;
  const company = await companyName();
  const status = deriveInvoiceStatus(inv.status, inv.due_on, todayLondonInput());
  const draft = inv.status === "draft";
  const totals: PdfRow[] = [
    { label: "Subtotal", value: moneyText(inv.subtotal) },
    ...(inv.discount ? [{ label: "Discount", value: `-${moneyText(inv.discount)}` }] : []),
    ...(inv.tax ? [{ label: "VAT", value: moneyText(inv.tax) }] : []),
    { label: "Total", value: moneyText(inv.total), strong: true },
    ...(inv.paid ? [{ label: "Payments", value: `-${moneyText(inv.paid)}` }] : []),
    { label: "Balance due", value: moneyText(inv.balance), strong: true },
  ];
  const bytes = await renderDocumentPdf({
    heading: `Invoice #${inv.number}`,
    title: inv.subject,
    companyName: company.name,
    recipientName: inv.client_name,
    recipientLines: addressLines(inv.client_address),
    facts: [
      { label: "Issued", value: draft ? date(todayLondonInput()) : date(inv.issued_on) },
      { label: "Due", value: draft ? "—" : date(inv.due_on) },
    ],
    headline: { label: "Total", value: moneyText(inv.total) },
    lines: inv.lines,
    showPrices: true,
    totals,
    note: INVOICE_NOTE,
    appendix:
      inv.message.trim() && inv.message.trim() !== INVOICE_NOTE
        ? { title: "Contract / Disclaimer", body: inv.message }
        : undefined,
    stamp: status === "paid" ? "PAID" : status === "past_due" ? "PAST DUE" : undefined,
  });
  return { bytes, fileName: pdfFileName("invoice", inv.number), companyId: company.id };
}

export function pdfDownload(pdf: BuiltPdf, disposition: "attachment" | "inline" = "attachment"): Response {
  return new Response(Buffer.from(pdf.bytes), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `${disposition}; filename="${pdf.fileName}"`,
      "cache-control": "private, no-store",
    },
  });
}
