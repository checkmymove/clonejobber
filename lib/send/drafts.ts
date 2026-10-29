import "server-only";
import { sql } from "@/lib/db";
import { COMPANY_SLUG } from "@/lib/company";
import { DEFAULT_LOGO_PATH, clientInvoiceUrl, clientJobUrl, clientQuoteUrl } from "@/lib/email/config";
import { COMPANY_PHONE_DISPLAY, quoteClientGreeting } from "@/lib/email/templates";
import { formatDateNumericLondon, formatPounds } from "@/lib/format";
import { getInvoiceDetail } from "@/lib/invoices/queries";
import { getJobDetail } from "@/lib/jobs/queries";
import { pdfFileName } from "@/lib/pdf/document";
import { getQuoteDetail } from "@/lib/quotes/queries";
import { getRequestDetail } from "@/lib/requests/queries";
import { normalizePhone } from "@/lib/sms/phone";
import { jobDetailsText, renderLetter, type TemplateKey } from "@/lib/templates/catalog";
import { getTemplate } from "@/lib/templates/queries";
import type { SendDraft, SendKind } from "./types";

type Company = { id: string; name: string; logo_url: string | null; sms_ready: boolean };

/** "Everaldo Aquino, Jailton Bento" per visit, from Team assignments. */
export async function visitTeamNames(visitIds: string[]): Promise<Map<string, string>> {
  if (visitIds.length === 0) return new Map();
  const rows = await sql<{ visit_id: string; names: string }[]>`
    select vm.visit_id, string_agg(m.name, ', ' order by m.sort, m.name) as names
    from job_visit_members vm join team_members m on m.id = vm.member_id
    where vm.visit_id = any(${visitIds}::uuid[])
    group by vm.visit_id
  `.catch(() => []);
  return new Map(rows.map((r) => [r.visit_id, r.names]));
}

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
export const COMPANY_EMAIL_DISPLAY = "hello@movinglondontransport.com";

/** Variables every template can use (Jobber: General, Client, Your Branding). */
export function baseVars(company: { name: string }, client: { name: string; title?: string }) {
  const parts = client.name.trim().split(/\s+/);
  return {
    CURRENT_DATE: formatDateNumericLondon(new Date()),
    CLIENT_NAME: quoteClientGreeting(client.title ?? "", client.name),
    CLIENT_FIRST_NAME: parts[0] || "there",
    CLIENT_LAST_NAME: parts.length > 1 ? parts[parts.length - 1] : "",
    CLIENT_COMPANY_NAME: "",
    COMPANY_NAME: company.name,
    DEFAULT_EMAIL: COMPANY_EMAIL_DISPLAY,
    DEFAULT_PHONE: COMPANY_PHONE_DISPLAY,
  };
}

/** The account's template (Settings › Emails & Texts) filled in for one document. */
export async function letterFor(companyId: string, key: TemplateKey, vars: Record<string, string>) {
  const t = await getTemplate(companyId, key);
  return {
    subject: renderLetter(t.email.subject, vars),
    message: renderLetter(t.email.body, vars),
    sms: t.sms ? renderLetter(t.sms.body, vars) : "",
  };
}

/** Jobber adds the document link to template texts. */
const withLink = (text: string, url: string | null) => (url ? `${text}\n\n${url}` : text);

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
  const letter = await letterFor(company.id, "request_submitted", {
    ...baseVars(company, { name }),
    CLIENT_COMPANY_NAME: r.company_name ?? "",
    REQUEST_NUMBER: r.number,
  });
  return {
    ok: true,
    draft: {
      ...base(company, "request"),
      id,
      number: r.number,
      clientName: name,
      viewUrl: null,
      card: { heading: "Request received" },
      email: { to: r.client_email, subject: letter.subject, message: letter.message },
      sms: { to: normalizePhone(r.client_phone), message: letter.sms },
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
  const letter = await letterFor(company.id, "quote_sent", {
    ...baseVars(company, { name: q.client_name, title: q.client_title }),
    QUOTE_NUMBER: q.number,
    QUOTE_TOTAL: pounds(q.total),
    DEPOSIT_AMOUNT: q.deposit > 0 ? pounds(q.deposit) : "",
    DISCOUNT_AMOUNT: q.discount > 0 ? pounds(q.discount) : "",
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
        message: withLink(letter.sms, url),
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
  const location = j.pickup_address || j.client_address || "";
  const url = clientJobUrl(id);
  const team = visit ? (await visitTeamNames([visit.id])).get(visit.id) ?? "" : "";
  const letter = await letterFor(company.id, "job_booking", {
    ...baseVars(company, { name: j.client_name }),
    JOB_NUMBER: j.number,
    JOB_TITLE: j.title || "",
    JOB_DATE: date,
    ARRIVAL_WINDOW: time,
    ASSIGNED_TO: team,
    JOB_LOCATION: location,
    JOB_DETAILS: jobDetailsText({ date, time, team, address: location }),
  });
  return {
    ok: true,
    draft: {
      ...base(company, "job"),
      id,
      number: j.number,
      clientName: j.client_name,
      viewUrl: url,
      card: { heading: "Booking confirmation", buttonLabel: "View Job" },
      email: { to: j.client_email, subject: letter.subject, message: letter.message },
      sms: { to: normalizePhone(j.client_phone), message: withLink(letter.sms, url) },
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
  const letter = await letterFor(company.id, "invoice_sent", {
    ...baseVars(company, { name: inv.client_name }),
    INVOICE_NUMBER: inv.number,
    INVOICE_SUBJECT: inv.subject && !/^invoice\b/i.test(inv.subject) ? inv.subject : "",
    INVOICE_TOTAL: pounds(inv.total),
    INVOICE_BALANCE: pounds(inv.balance),
    INVOICE_DUE_DATE: due || "upon receipt",
  });
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
        // Jobber's subject reads "… - {{INVOICE_SUBJECT}}"; drop the dangling dash when there is none.
        subject: letter.subject.replace(/\s+-\s*$/, ""),
        message: letter.message,
      },
      sms: { to: normalizePhone(inv.client_phone), message: withLink(letter.sms, url) },
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
