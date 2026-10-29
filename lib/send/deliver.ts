import "server-only";
import { sql } from "@/lib/db";
import { changeInvoiceStatus, changeQuoteStatus } from "@/lib/funnel/engine";
import { sendGmailMessage } from "@/lib/email/gmail";
import { getValidAccessToken } from "@/lib/email/google";
import { documentEmailHtml } from "@/lib/email/templates";
import { DEFAULT_LOGO_PATH } from "@/lib/email/config";
import { buildInvoicePdf, buildJobPdf, buildQuotePdf } from "@/lib/pdf/builders";
import { LOGO_PNG_BASE64 } from "@/lib/pdf/logo";
import { isValidMobile, normalizePhone } from "@/lib/sms/phone";
import { sendCompany } from "./drafts";
import type { ChannelResult, SendDraft, SendKind } from "./types";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Owner = { companyId: string; clientId: string; status: string };

async function owner(kind: SendKind, id: string): Promise<Owner | null> {
  const rows =
    kind === "request"
      ? await sql<Owner[]>`select company_id as "companyId", client_id as "clientId", status from requests where id = ${id}`
      : kind === "quote"
        ? await sql<Owner[]>`select company_id as "companyId", client_id as "clientId", status from quotes where id = ${id}`
        : kind === "job"
          ? await sql<Owner[]>`select company_id as "companyId", client_id as "clientId", status from jobs where id = ${id}`
          : await sql<Owner[]>`select company_id as "companyId", client_id as "clientId", status from invoices where id = ${id}`;
  return rows[0] ?? null;
}

/** communications row pointing at the document it was sent for. */
async function logCommunication(input: {
  kind: SendKind;
  id: string;
  owner: Owner;
  channel: "email" | "sms";
  subject: string;
  body: string;
  sent: boolean;
}) {
  const ref = (k: SendKind) => (input.kind === k ? input.id : null);
  await sql`
    insert into communications
      (company_id, client_id, request_id, quote_id, job_id, invoice_id, channel, direction,
       subject, body, status, sent_at)
    values
      (${input.owner.companyId}, ${input.owner.clientId}, ${ref("request")}, ${ref("quote")},
       ${ref("job")}, ${ref("invoice")}, ${input.channel}, 'outbound', ${input.subject}, ${input.body},
       ${input.sent ? "sent" : "failed"}, ${input.sent ? new Date().toISOString() : null})
  `;
}

async function activity(owner: Owner, kind: SendKind, id: string, action: string, summary: string) {
  await sql`
    insert into activity_log (company_id, actor, action, entity, entity_id, summary)
    values (${owner.companyId}, 'admin', ${`${kind}.${action}`}, ${kind}, ${id}, ${summary})
  `;
}

async function pdfFor(kind: SendKind, id: string) {
  if (kind === "quote") return buildQuotePdf(id);
  if (kind === "job") return buildJobPdf(id);
  if (kind === "invoice") return buildInvoicePdf(id);
  return null;
}

export async function deliverEmail(
  draft: SendDraft,
  input: { to: string; subject: string; message: string; copyToSender: boolean; attachPdf: boolean },
): Promise<ChannelResult> {
  const doc = await owner(draft.kind, draft.id);
  if (!doc) return { ok: false, message: "Document not found." };
  const token = await getValidAccessToken(doc.companyId);
  if (!token) return { ok: false, message: "Connect Gmail in Settings → Email before sending." };

  const to = input.to.trim();
  const subject = input.subject.replace(/[\r\n]+/g, " ").trim();
  const message = input.message.trim();
  if (!EMAIL.test(to)) return { ok: false, message: "Enter a valid email address." };
  if (!subject) return { ok: false, message: "Subject is required." };
  if (!message) return { ok: false, message: "Message is required." };

  // Without a stored logo URL the built-in logo travels inside the email.
  const builtInLogo = draft.logoUrl === DEFAULT_LOGO_PATH;
  const html = documentEmailHtml({
    companyName: draft.companyName,
    logoUrl: builtInLogo ? "cid:company-logo" : draft.logoUrl,
    ...draft.card,
    buttonUrl: draft.viewUrl,
    message,
  });
  const pdf = input.attachPdf ? await pdfFor(draft.kind, draft.id) : null;

  let gmailId: string;
  try {
    gmailId = (
      await sendGmailMessage({
        accessToken: token.access_token,
        from: `${draft.companyName} <${token.email}>`,
        to,
        bcc: input.copyToSender ? token.email : undefined,
        subject,
        html,
        attachments: pdf ? [{ fileName: pdf.fileName, mimeType: "application/pdf", data: pdf.bytes }] : [],
        inlineImages: builtInLogo
          ? [
              {
                contentId: "company-logo",
                fileName: "logo.png",
                mimeType: "image/png",
                data: Buffer.from(LOGO_PNG_BASE64, "base64"),
              },
            ]
          : [],
      })
    ).id;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Gmail send failed";
    await record(draft, doc, { to, subject, html, gmailId: null, error: reason }).catch(() => undefined);
    return { ok: false, message: reason };
  }
  // Gmail already accepted the message: a logging problem must not report a failed send.
  await record(draft, doc, { to, subject, html, gmailId, error: null }).catch(() => undefined);
  if (draft.kind === "quote" && doc.status === "draft") await changeQuoteStatus(sql, draft.id, "sent");
  if (draft.kind === "invoice" && doc.status === "draft") await changeInvoiceStatus(sql, draft.id, "sent");
  return { ok: true };
}

async function record(
  draft: SendDraft,
  doc: Owner,
  sent: { to: string; subject: string; html: string; gmailId: string | null; error: string | null },
) {
  const ok = !sent.error;
  await sql`
    insert into email_deliveries
      (company_id, document_type, document_id, to_email, subject, gmail_message_id, status, error)
    values
      (${doc.companyId}, ${draft.kind}, ${draft.id}, ${sent.to}, ${sent.subject},
       ${sent.gmailId}, ${ok ? "sent" : "failed"}, ${sent.error})
  `;
  await logCommunication({ kind: draft.kind, id: draft.id, owner: doc, channel: "email", subject: sent.subject, body: sent.html, sent: ok });
  await activity(
    doc,
    draft.kind,
    draft.id,
    "emailed",
    ok ? `Emailed ${sent.subject} to ${sent.to}` : `Email failed: ${sent.error}`,
  );
}

/**
 * Texts go through the same pipeline as email. Until an SMS provider is connected
 * the message is recorded on the client's history and reported as not sent.
 */
export async function deliverSms(draft: SendDraft, input: { to: string; message: string }): Promise<ChannelResult> {
  const doc = await owner(draft.kind, draft.id);
  if (!doc) return { ok: false, message: "Document not found." };
  const to = normalizePhone(input.to);
  const message = input.message.trim();
  if (!isValidMobile(to)) return { ok: false, message: "Enter a valid mobile number." };
  if (!message) return { ok: false, message: "Text message is required." };

  const company = await sendCompany();
  const error = company?.sms_ready
    ? "SMS sending is saved, but the text provider is not connected yet."
    : "Text messages aren't set up yet. The text was saved to the client's history.";
  try {
    await sql`
      insert into sms_deliveries
        (company_id, quote_id, document_type, document_id, to_phone, body, status, error)
      values
        (${doc.companyId}, ${draft.kind === "quote" ? draft.id : null}, ${draft.kind}, ${draft.id},
         ${to}, ${message}, 'failed', ${error})
    `;
  } catch {
    // Database without migration 0021: only quotes have an SMS log there.
    if (draft.kind === "quote") {
      await sql`
        insert into sms_deliveries (company_id, quote_id, to_phone, body, status, error)
        values (${doc.companyId}, ${draft.id}, ${to}, ${message}, 'failed', ${error})
      `;
    }
  }
  await logCommunication({
    kind: draft.kind,
    id: draft.id,
    owner: doc,
    channel: "sms",
    subject: `${draft.kind[0].toUpperCase()}${draft.kind.slice(1)} ${draft.number}`,
    body: message,
    sent: false,
  });
  await activity(doc, draft.kind, draft.id, "sms_attempted", `Text to ${to} not sent: ${error}`);
  return { ok: false, message: error };
}
