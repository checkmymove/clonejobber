import "server-only";
import { sql } from "@/lib/db";
import type { ActionResult } from "@/lib/funnel/engine";
import { changeInvoiceStatus, changeQuoteStatus } from "@/lib/funnel/engine";
import { sendGmailMessage } from "./gmail";
import { getValidAccessToken } from "./google";
import { invoiceEmailHtml, quoteEmailHtml } from "./templates";

export type DeliveryRow = {
  id: string;
  to_email: string;
  subject: string;
  status: string;
  error: string | null;
  gmail_message_id: string | null;
  sent_at: string;
};

export async function listDeliveries(
  documentType: "quote" | "invoice",
  documentId: string,
): Promise<DeliveryRow[]> {
  return sql<DeliveryRow[]>`
    select id, to_email, subject, status, error, gmail_message_id, sent_at
    from email_deliveries
    where document_type = ${documentType} and document_id = ${documentId}
    order by sent_at desc
    limit 20
  `;
}

async function logDelivery(input: {
  companyId: string;
  clientId: string;
  documentType: "quote" | "invoice";
  documentId: string;
  toEmail: string;
  subject: string;
  status: "sent" | "failed";
  error?: string;
  gmailId?: string;
  body: string;
}): Promise<void> {
  await sql`
    insert into email_deliveries
      (company_id, document_type, document_id, to_email, subject,
       gmail_message_id, status, error)
    values
      (${input.companyId}, ${input.documentType}, ${input.documentId},
       ${input.toEmail}, ${input.subject}, ${input.gmailId ?? null},
       ${input.status}, ${input.error ?? null})
  `;
  await sql`
    insert into communications
      (company_id, client_id, quote_id, invoice_id, channel, direction,
       subject, body, status, sent_at)
    values
      (${input.companyId}, ${input.clientId},
       ${input.documentType === "quote" ? input.documentId : null},
       ${input.documentType === "invoice" ? input.documentId : null},
       'email', 'outbound', ${input.subject}, ${input.body},
       ${input.status === "sent" ? "sent" : "failed"},
       ${input.status === "sent" ? new Date().toISOString() : null})
  `;
  await sql`
    insert into activity_log (company_id, actor, action, entity, entity_id, summary)
    values (${input.companyId}, 'admin', ${`${input.documentType}.emailed`},
            ${input.documentType}, ${input.documentId},
            ${input.status === "sent"
              ? `Emailed ${input.subject} to ${input.toEmail}`
              : `Email failed: ${input.error || "unknown"}`})
  `;
}

export async function sendQuoteEmail(
  companyId: string,
  quoteId: string,
): Promise<ActionResult> {
  const token = await getValidAccessToken(companyId);
  if (!token) {
    return { ok: false, message: "Connect Gmail in Settings before sending." };
  }

  const quotes = await sql<
    {
      id: string;
      number: string;
      status: string;
      title: string;
      message: string;
      total: number;
      valid_until: string | null;
      client_id: string;
      client_name: string;
      client_email: string;
      company_name: string;
    }[]
  >`
    select q.id, q.number, q.status, q.title, q.message, q.total, q.valid_until,
           q.client_id,
           trim(c.first_name || ' ' || c.last_name) as client_name,
           c.email as client_email,
           co.name as company_name
    from quotes q
    join clients c on c.id = q.client_id
    join companies co on co.id = q.company_id
    where q.id = ${quoteId} and q.company_id = ${companyId}
    limit 1
  `;
  const q = quotes[0];
  if (!q) return { ok: false, message: "Quote not found" };
  if (q.status === "rejected" || q.status === "expired") {
    return { ok: false, message: "This quote cannot be emailed." };
  }
  if (q.total <= 0) {
    return { ok: false, message: "Set line item prices before sending." };
  }
  if (!q.client_email) {
    return { ok: false, message: "Client has no email address." };
  }

  const lines = await sql<
    { name: string; description: string; quantity: number; unitPrice: number; total: number }[]
  >`
    select name, description, quantity::float as quantity,
           unit_price as "unitPrice", total
    from quote_line_items where quote_id = ${quoteId} order by sort
  `;

  const subject = `Quote ${q.number} from ${q.company_name}`;
  const html = quoteEmailHtml({
    companyName: q.company_name,
    clientName: q.client_name,
    number: q.number,
    title: q.title,
    message: q.message,
    validUntil: q.valid_until,
    total: q.total,
    lines,
  });

  try {
    const sent = await sendGmailMessage({
      accessToken: token.access_token,
      from: `${q.company_name} <${token.email}>`,
      to: q.client_email,
      subject,
      html,
    });
    await logDelivery({
      companyId,
      clientId: q.client_id,
      documentType: "quote",
      documentId: quoteId,
      toEmail: q.client_email,
      subject,
      status: "sent",
      gmailId: sent.id,
      body: html,
    });
    if (q.status === "draft") {
      const status = await changeQuoteStatus(sql, quoteId, "sent");
      if (!status.ok) return status;
    }
    return { ok: true, id: quoteId, number: q.number };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gmail send failed";
    await logDelivery({
      companyId,
      clientId: q.client_id,
      documentType: "quote",
      documentId: quoteId,
      toEmail: q.client_email,
      subject,
      status: "failed",
      error: message,
      body: html,
    });
    return { ok: false, message };
  }
}

export async function sendInvoiceEmail(
  companyId: string,
  invoiceId: string,
): Promise<ActionResult> {
  const token = await getValidAccessToken(companyId);
  if (!token) {
    return { ok: false, message: "Connect Gmail in Settings before sending." };
  }

  const invoices = await sql<
    {
      id: string;
      number: string;
      status: string;
      subject: string;
      message: string;
      total: number;
      balance: number;
      due_on: string;
      client_id: string;
      client_name: string;
      client_email: string;
      company_name: string;
    }[]
  >`
    select i.id, i.number, i.status, i.subject, i.message, i.total, i.balance,
           i.due_on, i.client_id,
           trim(c.first_name || ' ' || c.last_name) as client_name,
           c.email as client_email,
           co.name as company_name
    from invoices i
    join clients c on c.id = i.client_id
    join companies co on co.id = i.company_id
    where i.id = ${invoiceId} and i.company_id = ${companyId}
    limit 1
  `;
  const inv = invoices[0];
  if (!inv) return { ok: false, message: "Invoice not found" };
  if (inv.status === "cancelled") {
    return { ok: false, message: "A cancelled invoice cannot be emailed." };
  }
  if (inv.total <= 0) {
    return { ok: false, message: "Set line item prices before sending." };
  }

  const lines = await sql<
    { name: string; description: string; quantity: number; unitPrice: number; total: number }[]
  >`
    select name, description, quantity::float as quantity,
           unit_price as "unitPrice", total
    from invoice_line_items where invoice_id = ${invoiceId} order by sort
  `;

  const subject = `Invoice ${inv.number} from ${inv.company_name}`;
  const html = invoiceEmailHtml({
    companyName: inv.company_name,
    clientName: inv.client_name,
    number: inv.number,
    subject: inv.subject,
    message: inv.message,
    dueOn: inv.due_on,
    total: inv.total,
    balance: inv.balance,
    lines,
  });

  try {
    const sent = await sendGmailMessage({
      accessToken: token.access_token,
      from: `${inv.company_name} <${token.email}>`,
      to: inv.client_email,
      subject,
      html,
    });
    await logDelivery({
      companyId,
      clientId: inv.client_id,
      documentType: "invoice",
      documentId: invoiceId,
      toEmail: inv.client_email,
      subject,
      status: "sent",
      gmailId: sent.id,
      body: html,
    });
    if (inv.status === "draft") {
      const status = await changeInvoiceStatus(sql, invoiceId, "sent");
      if (!status.ok) return status;
    }
    return { ok: true, id: invoiceId, number: inv.number };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gmail send failed";
    await logDelivery({
      companyId,
      clientId: inv.client_id,
      documentType: "invoice",
      documentId: invoiceId,
      toEmail: inv.client_email,
      subject,
      status: "failed",
      error: message,
      body: html,
    });
    return { ok: false, message };
  }
}
