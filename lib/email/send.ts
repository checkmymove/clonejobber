import "server-only";
import { sql } from "@/lib/db";
import type { ActionResult } from "@/lib/funnel/engine";
import { changeInvoiceStatus, changeQuoteStatus } from "@/lib/funnel/engine";
import { sendGmailMessage } from "./gmail";
import { getValidAccessToken } from "./google";
import type { QuoteEmailDraft } from "./draft";
import { clientQuoteUrl } from "./config";
import { invoiceEmailHtml, quoteEmailHtml, quoteEmailPlain } from "./templates";

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
      total: number;
      deposit: number;
      client_id: string;
      client_name: string;
      client_title: string;
      client_email: string;
      company_name: string;
      logo_url: string | null;
    }[]
  >`
    select q.id, q.number, q.status, q.total, q.deposit, q.client_id,
           trim(c.first_name || ' ' || c.last_name) as client_name,
           coalesce(c.title, '') as client_title,
           c.email as client_email,
           co.name as company_name,
           co.logo_url
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

  const letter = quoteEmailPlain({
    companyName: q.company_name,
    clientName: q.client_name,
    clientTitle: q.client_title,
    deposit: q.deposit,
  });
  const subject = letter.subject;
  const html = quoteEmailHtml({
    companyName: q.company_name,
    logoUrl: q.logo_url,
    viewQuoteUrl: clientQuoteUrl(quoteId),
    message: letter.message,
  });

  const sent = await deliverGmail({
    send: () =>
      sendGmailMessage({
        accessToken: token.access_token,
        from: `${q.company_name} <${token.email}>`,
        to: q.client_email,
        subject,
        html,
      }),
    record: async (gmailId) => {
      await logDelivery({
        companyId,
        clientId: q.client_id,
        documentType: "quote",
        documentId: quoteId,
        toEmail: q.client_email,
        subject,
        status: "sent",
        gmailId,
        body: html,
      });
      if (q.status === "draft") await changeQuoteStatus(sql, quoteId, "sent");
    },
    recordFailure: (message) =>
      logDelivery({
        companyId,
        clientId: q.client_id,
        documentType: "quote",
        documentId: quoteId,
        toEmail: q.client_email,
        subject,
        status: "failed",
        error: message,
        body: html,
      }),
  });
  if (!sent.ok) return sent;
  return { ok: true, id: quoteId, number: q.number };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type { QuoteEmailDraft };

export async function buildQuoteEmailDraft(
  companyId: string,
  quoteId: string,
): Promise<{ ok: true; draft: QuoteEmailDraft } | { ok: false; message: string }> {
  const quotes = await sql<
    {
      id: string;
      number: string;
      status: string;
      total: number;
      deposit: number;
      client_name: string;
      client_title: string;
      client_email: string;
      company_name: string;
    }[]
  >`
    select q.id, q.number, q.status, q.total, q.deposit,
           trim(c.first_name || ' ' || c.last_name) as client_name,
           coalesce(c.title, '') as client_title,
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
  const letter = quoteEmailPlain({
    companyName: q.company_name,
    clientName: q.client_name,
    clientTitle: q.client_title,
    deposit: q.deposit,
  });
  return {
    ok: true,
    draft: {
      quoteId: q.id,
      number: q.number,
      clientName: q.client_name,
      to: q.client_email,
      subject: letter.subject,
      message: letter.message,
    },
  };
}

export async function sendComposedQuoteEmail(input: {
  quoteId: string;
  to: string;
  subject: string;
  message: string;
  copyToSender: boolean;
}): Promise<ActionResult> {
  const companyIdRows = await sql<{ company_id: string }[]>`
    select company_id from quotes where id = ${input.quoteId} limit 1
  `;
  const companyId = companyIdRows[0]?.company_id;
  if (!companyId) return { ok: false, message: "Quote not found" };

  const token = await getValidAccessToken(companyId);
  if (!token) {
    return { ok: false, message: "Connect Gmail in Settings before sending." };
  }

  const to = input.to.trim();
  const subject = input.subject.replace(/[\r\n]+/g, " ").trim();
  const message = input.message.trim();
  if (!EMAIL.test(to)) return { ok: false, message: "Enter a valid email address." };
  if (!subject) return { ok: false, message: "Subject is required." };
  if (!message) return { ok: false, message: "Message is required." };

  const quotes = await sql<
    {
      id: string;
      status: string;
      client_id: string;
      client_email: string;
      company_name: string;
      logo_url: string | null;
    }[]
  >`
    select q.id, q.status, q.client_id, c.email as client_email,
           co.name as company_name, co.logo_url
    from quotes q
    join clients c on c.id = q.client_id
    join companies co on co.id = q.company_id
    where q.id = ${input.quoteId} and q.company_id = ${companyId}
    limit 1
  `;
  const q = quotes[0];
  if (!q) return { ok: false, message: "Quote not found" };
  if (q.status === "rejected" || q.status === "expired") {
    return { ok: false, message: "This quote cannot be emailed." };
  }

  const html = quoteEmailHtml({
    companyName: q.company_name,
    logoUrl: q.logo_url,
    viewQuoteUrl: clientQuoteUrl(input.quoteId),
    message,
  });
  const bcc = input.copyToSender ? token.email : undefined;
  const sent = await deliverGmail({
    send: () =>
      sendGmailMessage({
        accessToken: token.access_token,
        from: `${q.company_name} <${token.email}>`,
        to,
        bcc,
        subject,
        html,
      }),
    record: async (gmailId) => {
      await logDelivery({
        companyId,
        clientId: q.client_id,
        documentType: "quote",
        documentId: input.quoteId,
        toEmail: to,
        subject,
        status: "sent",
        gmailId,
        body: html,
      });
      if (q.status === "draft") await changeQuoteStatus(sql, input.quoteId, "sent");
    },
    recordFailure: (error) =>
      logDelivery({
        companyId,
        clientId: q.client_id,
        documentType: "quote",
        documentId: input.quoteId,
        toEmail: to,
        subject,
        status: "failed",
        error,
        body: html,
      }),
  });
  if (!sent.ok) return sent;
  return { ok: true, id: input.quoteId };
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

  const sent = await deliverGmail({
    send: () =>
      sendGmailMessage({
        accessToken: token.access_token,
        from: `${inv.company_name} <${token.email}>`,
        to: inv.client_email,
        subject,
        html,
      }),
    record: async (gmailId) => {
      await logDelivery({
        companyId,
        clientId: inv.client_id,
        documentType: "invoice",
        documentId: invoiceId,
        toEmail: inv.client_email,
        subject,
        status: "sent",
        gmailId,
        body: html,
      });
      if (inv.status === "draft") await changeInvoiceStatus(sql, invoiceId, "sent");
    },
    recordFailure: (message) =>
      logDelivery({
        companyId,
        clientId: inv.client_id,
        documentType: "invoice",
        documentId: invoiceId,
        toEmail: inv.client_email,
        subject,
        status: "failed",
        error: message,
        body: html,
      }),
  });
  if (!sent.ok) return sent;
  return { ok: true, id: invoiceId, number: inv.number };
}

async function deliverGmail(input: {
  send: () => Promise<{ id: string }>;
  record: (gmailId: string) => Promise<void>;
  recordFailure: (message: string) => Promise<void>;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  let gmailId: string;
  try {
    gmailId = (await input.send()).id;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gmail send failed";
    await input.recordFailure(message);
    return { ok: false, message };
  }
  try {
    await input.record(gmailId);
  } catch {
    // Gmail already accepted the message. Resend remains a separate click.
  }
  return { ok: true };
}
