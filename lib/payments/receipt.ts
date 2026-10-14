import "server-only";
import { sql } from "@/lib/db";
import { formatDateNumericLondon, formatGBP } from "@/lib/format";
import { sendGmailMessage } from "@/lib/email/gmail";
import { getValidAccessToken } from "@/lib/email/google";
import { paymentMethodLabel } from "./constants";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function paymentReceiptHtml(input: {
  companyName: string;
  clientName: string;
  amount: number;
  paidOn: string;
  method: string;
  reference: string;
  appliedTo: { label: string; amount: number; balance: number | null }[];
}): string {
  const rows = input.appliedTo
    .map(
      (a) => `<tr>
        <td style="padding:6px 0;border-bottom:1px solid #d5dde1">${escapeHtml(a.label)}</td>
        <td style="padding:6px 0;border-bottom:1px solid #d5dde1;text-align:right">${formatGBP(a.amount)}</td>
        <td style="padding:6px 0;border-bottom:1px solid #d5dde1;text-align:right;color:#5d6f78">${
          a.balance == null ? "" : `Balance ${formatGBP(a.balance)}`
        }</td>
      </tr>`,
    )
    .join("");
  return `<div style="font-family:system-ui,sans-serif;color:#042b3c;max-width:560px">
    <p>Hello ${escapeHtml(input.clientName)},</p>
    <p>Thank you. ${escapeHtml(input.companyName)} has received your payment of <strong>${formatGBP(input.amount)}</strong>.</p>
    <p style="color:#5d6f78">Date ${formatDateNumericLondon(input.paidOn)} · ${escapeHtml(paymentMethodLabel(input.method))}${
      input.reference ? ` · Ref ${escapeHtml(input.reference)}` : ""
    }</p>
    ${rows ? `<table width="100%" cellpadding="0" cellspacing="0">${rows}</table>` : ""}
    <p>Please reply to this email if you have any questions.</p>
  </div>`;
}

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

  const allocations = await sql<{ number: string; amount: number; balance: number }[]>`
    select i.number, a.amount, i.balance
    from payment_allocations a join invoices i on i.id = a.invoice_id
    where a.payment_id = ${paymentId}
    order by i.number
  `;
  const appliedTo = [
    ...(p.kind === "deposit" && p.quote_number
      ? [{ label: `Deposit for quote ${p.quote_number}`, amount: p.amount, balance: null }]
      : []),
    ...allocations.map((a) => ({ label: `Invoice ${a.number}`, amount: a.amount, balance: a.balance })),
  ];
  const subject = `Payment receipt from ${p.company_name}`;
  const html = paymentReceiptHtml({
    companyName: p.company_name,
    clientName: p.client_name,
    amount: p.amount,
    paidOn: p.paid_on,
    method: p.method,
    reference: p.reference,
    appliedTo,
  });

  try {
    await sendGmailMessage({
      accessToken: token.access_token,
      from: `${p.company_name} <${token.email}>`,
      to: p.client_email,
      subject,
      html,
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
