import "server-only";
import { sql } from "@/lib/db";
import { formatDateNumericLondon, formatGBP } from "@/lib/format";
import { sendGmailMessage } from "@/lib/email/gmail";
import { getValidAccessToken } from "@/lib/email/google";
import { paymentMethodLabel } from "./constants";
import { appUrl } from "@/lib/email/config";
import { documentEmailHtml, stampImagePath } from "@/lib/email/templates";
import { buildInvoicePdf } from "@/lib/pdf/builders";
import { LOGO_PNG_BASE64 } from "@/lib/pdf/logo";
import { baseVars, letterFor } from "@/lib/send/drafts";

/** Emails a payment receipt from the connected Gmail account and logs it on the client. */
export async function sendPaymentReceipt(
  companyId: string,
  paymentId: string,
): Promise<{ ok: boolean; message?: string }> {
  const token = await getValidAccessToken(companyId);
  if (!token) return { ok: false, message: "Connect Gmail in Settings before sending." };

  const rows = await sql<
    {
      amount: number;
      paid_on: string;
      method: string;
      reference: string;
      kind: string;
      client_id: string;
      client_name: string;
      client_email: string;
      company_name: string;
      quote_number: string | null;
    }[]
  >`
    select p.amount, p.paid_on::text as paid_on, p.method, p.reference, p.kind, p.client_id,
           trim(c.first_name || ' ' || c.last_name) as client_name, c.email as client_email,
           co.name as company_name, q.number as quote_number
    from payments p
    join clients c on c.id = p.client_id
    join companies co on co.id = p.company_id
    left join quotes q on q.id = p.quote_id
    where p.id = ${paymentId} and p.company_id = ${companyId}
  `;
  const p = rows[0];
  if (!p) return { ok: false, message: "Payment not found" };
  if (!p.client_email) return { ok: false, message: "This client has no email address." };

  const allocations = await sql<{ id: string; number: string; amount: number; balance: number }[]>`
    select i.id, i.number, a.amount, i.balance
    from payment_allocations a join invoices i on i.id = a.invoice_id
    where a.payment_id = ${paymentId}
    order by i.number
  `;
  const kindLabel = p.kind === "deposit" ? "deposit" : "payment";
  const letter = await letterFor(companyId, "payment_receipt", {
    ...baseVars({ name: p.company_name }, { name: p.client_name }),
    PAYMENT_AMOUNT: formatGBP(p.amount),
    PAYMENT_OR_DEPOSIT: kindLabel,
    QUOTE_NUMBER: p.quote_number ?? "",
    INVOICE_NUMBER: allocations.map((a) => a.number).join(", "),
  });
  const applied = [
    ...(p.kind === "deposit" && p.quote_number ? [`Deposit for quote ${p.quote_number}: ${formatGBP(p.amount)}`] : []),
    ...allocations.map((a) => `Invoice ${a.number}: ${formatGBP(a.amount)} · balance ${formatGBP(a.balance)}`),
  ];
  const message = applied.length ? `${letter.message}\n\nApplied to:\n${applied.join("\n")}` : letter.message;
  const subject = letter.subject;
  // Jobber's receipt: amount on top and a PAID watermark behind the letter.
  const html = documentEmailHtml({
    companyName: p.company_name,
    logoUrl: "cid:company-logo",
    heading: p.kind === "deposit" ? "Deposit receipt" : "Payment receipt",
    amount: formatGBP(p.amount),
    amountNote: `Paid on ${formatDateNumericLondon(p.paid_on)} · ${paymentMethodLabel(p.method)}${p.reference ? ` · Ref ${p.reference}` : ""}`,
    message,
    stampUrl: `${appUrl()}${stampImagePath("paid")}`,
  });
  // The invoice PDF goes along; a fully paid invoice carries the PAID stamp too.
  const pdfs = (
    await Promise.all(allocations.map((a) => buildInvoicePdf(a.id).catch(() => null)))
  ).filter((x): x is NonNullable<typeof x> => Boolean(x));

  try {
    await sendGmailMessage({
      accessToken: token.access_token,
      from: `${p.company_name} <${token.email}>`,
      to: p.client_email,
      subject,
      html,
      attachments: pdfs.map((pdf) => ({ fileName: pdf.fileName, mimeType: "application/pdf", data: pdf.bytes })),
      inlineImages: [
        { contentId: "company-logo", fileName: "logo.png", mimeType: "image/png", data: Buffer.from(LOGO_PNG_BASE64, "base64") },
      ],
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Gmail send failed" };
  }
  await sql`update payments set receipt_sent_at = now() where id = ${paymentId}`;
  await sql`
    insert into communications
      (company_id, client_id, channel, direction, subject, body, status, sent_at)
    values (${companyId}, ${p.client_id}, 'email', 'outbound', ${subject}, ${html}, 'sent', now())
  `;
  await sql`
    insert into activity_log (company_id, actor, action, entity, entity_id, summary)
    values (${companyId}, 'admin', 'payment.receipt_sent', 'payment', ${paymentId},
            ${`Emailed payment receipt to ${p.client_email}`})
  `;
  return { ok: true };
}
