import "server-only";
import { sql } from "@/lib/db";
import { COMPANY_SLUG } from "@/lib/company";
import { DEFAULT_LOGO_PATH, clientInvoiceUrl, clientJobUrl, clientQuoteUrl } from "@/lib/email/config";
import {
  COMPANY_PHONE_DISPLAY,
  COMPANY_WHATSAPP_DISPLAY,
  quoteClientGreeting,
  quoteEmailPlain,
} from "@/lib/email/templates";
import { formatDateNumericLondon, formatPounds } from "@/lib/format";
import { getInvoiceDetail } from "@/lib/invoices/queries";
import { getJobDetail } from "@/lib/jobs/queries";
import { pdfFileName } from "@/lib/pdf/document";
import { getQuoteDetail } from "@/lib/quotes/queries";
import { getRequestDetail } from "@/lib/requests/queries";
import { normalizePhone } from "@/lib/sms/phone";
import type { SendDraft, SendKind } from "./types";

type Company = { id: string; name: string; logo_url: string | null; sms_ready: boolean };

export async function sendCompany(): Promise<Company | null> {
  const rows = await sql<Company[]>`
    select co.id, co.name, co.logo_url,
           coalesce(s.enabled and s.from_number <> '' and s.account_sid_sealed <> '', false) as sms_ready
    from companies co
    left join sms_settings s on s.company_id = co.id
    where co.slug = ${COMPANY_SLUG}
    limit 1
  `;
  return rows[0] ?? null;
}

const pounds = (pence: number) => formatPounds(pence / 100);
const firstName = (name: string) => name.trim().split(/\s+/)[0] || "there";
const contactLine = `If you have any questions, please don't hesitate to get in touch with us at ${COMPANY_PHONE_DISPLAY} or by WhatsApp ${COMPANY_WHATSAPP_DISPLAY}.`;

type Result = { ok: true; draft: SendDraft } | { ok: false; message: string };

function base(company: Company, kind: SendKind) {
  return {
    kind,
    companyName: company.name,
    logoUrl: company.logo_url || DEFAULT_LOGO_PATH,
    smsReady: company.sms_ready,
  };
}

async function requestDraft(company: Company, id: string): Promise<Result> {
  const r = await getRequestDetail(id);
  if (!r) return { ok: false, message: "Request not found." };
  const name = `${r.client_first_name} ${r.client_last_name}`.trim();
  const when = r.move_date ? ` for your move on ${formatDateNumericLondon(r.move_date)}` : "";
  return {
    ok: true,
    draft: {
      ...base(company, "request"),
      id,
      number: r.number,
      clientName: name,
      viewUrl: null,
      card: { heading: "Request received" },
      email: {
        to: r.client_email,
        subject: `We received your request ${r.number} - ${company.name}`,
        message: [
          `Hi ${name},`,
          "",
          `Thank you for getting in touch. We have received your request${when} and our team is preparing your quote.`,
          "",
          "We will send it to you shortly.",
          "",
          contactLine,
          "",
          "Best wishes,",
          "",
          company.name,
        ].join("\n"),
      },
      sms: {
        to: normalizePhone(r.client_phone),
        message: `Hi ${firstName(name)}, thanks for your request ${r.number} with ${company.name}. We'll send your quote shortly.`,
      },
      attachment: null,
    },
  };
}

async function quoteDraft(company: Company, id: string): Promise<Result> {
  const q = await getQuoteDetail(id);
  if (!q) return { ok: false, message: "Quote not found." };
  if (q.archived_at) return { ok: false, message: "Unarchive this quote before sending it." };
  if (q.status === "rejected" || q.status === "expired") {
    return { ok: false, message: "This quote cannot be sent." };
  }
  if (q.total <= 0) return { ok: false, message: "Set line item prices before sending." };
  const letter = quoteEmailPlain({
    companyName: company.name,
    clientName: q.client_name,
    clientTitle: q.client_title,
    deposit: q.deposit,
  });
  const url = clientQuoteUrl(id);
  return {
    ok: true,
    draft: {
      ...base(company, "quote"),
      id,
      number: q.number,
      clientName: q.client_name,
      viewUrl: url,
      card: {
        heading: "Quote",
        amount: pounds(q.total),
        amountNote: q.deposit > 0 ? `Deposit required: ${pounds(q.deposit)}` : undefined,
        buttonLabel: "View Quote",
      },
      email: { to: q.client_email, subject: letter.subject, message: letter.message },
      sms: {
        to: normalizePhone(q.client_phone),
        message: `Hi ${firstName(q.client_name)}, here's your quote from ${company.name} for ${pounds(q.total)}. View it here: ${url}`,
      },
      attachment: pdfFileName("quote", q.number),
    },
  };
}

async function jobDraft(company: Company, id: string): Promise<Result> {
  const j = await getJobDetail(id);
  if (!j) return { ok: false, message: "Job not found." };
  const visit = j.visits
    .filter((v) => v.visit_date && !v.later && v.status !== "cancelled")
    .sort((a, b) => String(a.visit_date).localeCompare(String(b.visit_date)))[0];
  const date = visit?.visit_date ? formatDateNumericLondon(visit.visit_date) : "To be confirmed";
  const time =
    visit && !visit.anytime && visit.start_time
      ? `${visit.start_time}${visit.end_time ? ` – ${visit.end_time}` : ""}`
      : "Anytime";
  const location = j.pickup_address || j.client_address || "—";
  const url = clientJobUrl(id);
  return {
    ok: true,
    draft: {
      ...base(company, "job"),
      id,
      number: j.number,
      clientName: j.client_name,
      viewUrl: url,
      card: { heading: "Booking confirmation", buttonLabel: "View Job" },
      email: {
        to: j.client_email,
        subject: `Booking confirmation from ${company.name}`,
        message: [
          `Hi ${j.client_name},`,
          "",
          "Your booking is confirmed!",
          "Thank you for choosing us.",
          "",
          `Location: ${location}`,
          ...(j.delivery_address ? [`Delivery: ${j.delivery_address}`] : []),
          `Date: ${date}`,
          `Estimated Arrival Time: ${time}`,
          "",
          contactLine,
          "",
          "Best,",
          "",
          company.name,
        ].join("\n"),
      },
      sms: {
        to: normalizePhone(j.client_phone),
        message: [
          "Good news, your move is booked!",
          "",
          `Date: ${date}`,
          `Arrival: ${time}`,
          "",
          `View details here ${url}`,
        ].join("\n"),
      },
      attachment: pdfFileName("job", j.number),
    },
  };
}

async function invoiceDraft(company: Company, id: string): Promise<Result> {
  const inv = await getInvoiceDetail(id);
  if (!inv) return { ok: false, message: "Invoice not found." };
  if (inv.status === "cancelled") return { ok: false, message: "A voided invoice cannot be sent." };
  if (inv.total <= 0) return { ok: false, message: "Set line item prices before sending." };
  const due = inv.status === "draft" ? "" : formatDateNumericLondon(inv.due_on);
  const url = clientInvoiceUrl(id);
  const greeted = quoteClientGreeting("", inv.client_name);
  return {
    ok: true,
    draft: {
      ...base(company, "invoice"),
      id,
      number: inv.number,
      clientName: inv.client_name,
      viewUrl: url,
      card: {
        heading: "Invoice",
        amount: pounds(inv.balance || inv.total),
        amountNote: due ? `Your invoice is due on ${due}` : "Your invoice is due upon receipt",
        buttonLabel: "View Invoice",
      },
      email: {
        to: inv.client_email,
        // Jobber adds the invoice subject unless it already reads "Invoice from …".
        subject: `Invoice from ${company.name}${inv.subject && !/^invoice\b/i.test(inv.subject) ? ` - ${inv.subject}` : ""}`,
        message: [
          `Hi ${greeted},`,
          "",
          "Thank you for your recent business with us.",
          "",
          `The invoice total is ${pounds(inv.total)}, with ${pounds(inv.balance)} to be paid${due ? ` by ${due}` : " upon receipt"}.`,
          "",
          `If you have any questions or concerns regarding this invoice, please don't hesitate to get in touch with us at ${COMPANY_PHONE_DISPLAY} or by WhatsApp ${COMPANY_WHATSAPP_DISPLAY}.`,
          "",
          "Sincerely,",
          "",
          company.name,
        ].join("\n"),
      },
      sms: {
        to: normalizePhone(inv.client_phone),
        message: `Hi ${firstName(inv.client_name)}, here's your invoice from ${company.name} for ${pounds(inv.balance || inv.total)}. View your invoice here: ${url}`,
      },
      attachment: pdfFileName("invoice", inv.number),
    },
  };
}

export async function buildSendDraft(kind: SendKind, id: string): Promise<Result> {
  const company = await sendCompany();
  if (!company) return { ok: false, message: "Company not found." };
  switch (kind) {
    case "request":
      return requestDraft(company, id);
    case "quote":
      return quoteDraft(company, id);
    case "job":
      return jobDraft(company, id);
    case "invoice":
      return invoiceDraft(company, id);
  }
}
