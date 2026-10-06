import { formatDateLondon, formatGBP, formatPounds } from "../format";

type Line = { name: string; description?: string; quantity: number; unitPrice: number; total: number };

export const COMPANY_PHONE_DISPLAY = "020 335 52161";
export const COMPANY_WHATSAPP_DISPLAY = "+44 7710 251699";
export const COMPANY_WHATSAPP_HREF = "https://wa.me/447710251699";

const VIEW_QUOTE_GREEN = "#2e7d32";

export function plainToEmailHtml(text: string): string {
  const body = escapeHtml(text).replace(/\n/g, "<br/>");
  return `<div style="font-family:system-ui,sans-serif;color:#042b3c;max-width:560px;font-size:15px;line-height:1.5">${body}</div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function linesTable(lines: Line[]): string {
  const rows = lines
    .map(
      (l) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #d5dde1">
          <strong>${escapeHtml(l.name)}</strong>
          ${l.description ? `<div style="color:#5d6f78;font-size:13px">${escapeHtml(l.description)}</div>` : ""}
          <div style="color:#8aa0a8;font-size:12px">${l.quantity} × ${formatGBP(l.unitPrice)}</div>
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #d5dde1;text-align:right">${formatGBP(l.total)}</td>
      </tr>`,
    )
    .join("");
  return `<table width="100%" cellpadding="0" cellspacing="0">${rows}</table>`;
}

export function quoteClientGreeting(title: string, name: string): string {
  const honorific = title.trim();
  const fullName = name.trim();
  if (!honorific || ["no title", "none"].includes(honorific.toLowerCase())) {
    return fullName;
  }
  const label = honorific.endsWith(".") ? honorific : `${honorific}.`;
  return `${label} ${fullName}`.trim();
}

export function quoteEmailPlain(input: {
  companyName: string;
  clientName: string;
  clientTitle: string;
  deposit: number;
}): { subject: string; message: string } {
  const greeted = quoteClientGreeting(input.clientTitle, input.clientName);
  const depositLine =
    input.deposit > 0 ? `Deposit required: ${formatPounds(input.deposit / 100)}` : "";
  const message = [
    `Hi ${greeted},`,
    "",
    "We are sending this quote based on the information you provided. Please note that we can tailor this quote to your needs, such as the number of people and flexible payment methods, including bank transfer, debit and credit cards, and Klarna.",
    "",
    "With Klarna, you can pay in up to 3 installments, so you don't have to worry about paying the entire amount in a single payment.",
    "",
    depositLine,
    depositLine ? "" : null,
    `If you have any questions or concerns regarding this quote, please don't hesitate to get in touch with us at ${COMPANY_PHONE_DISPLAY} or by WhatsApp ${COMPANY_WHATSAPP_DISPLAY}.`,
    "",
    "Looking forward to hearing from you.",
    "",
    "Best wishes,",
    "",
    input.companyName.trim(),
  ]
    .filter((line): line is string => line !== null)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return {
    subject: `Quote from ${input.companyName.trim()}`,
    message,
  };
}

function letterBodyHtml(message: string): string {
  const wa = escapeHtml(COMPANY_WHATSAPP_DISPLAY);
  let body = escapeHtml(message).replace(/\n/g, "<br/>");
  body = body.replace(
    wa,
    `<a href="${COMPANY_WHATSAPP_HREF}" style="color:#1a73e8;text-decoration:underline">${wa}</a>`,
  );
  return body;
}

export function quoteEmailHtml(input: {
  companyName: string;
  logoUrl?: string | null;
  viewQuoteUrl: string;
  message: string;
}): string {
  const company = escapeHtml(input.companyName.trim());
  const viewUrl = escapeHtml(input.viewQuoteUrl);
  const logo = input.logoUrl
    ? `<img src="${escapeHtml(input.logoUrl)}" alt="${company}" width="92" style="display:block;border:0;max-width:92px;height:auto"/>`
    : `<div style="width:92px;text-align:center;line-height:1.15">
        <div style="color:#c4a35a;font-size:22px;line-height:1">▲</div>
        <div style="margin-top:4px;font-size:10px;font-weight:800;letter-spacing:0.4px;color:#123035">MOVING<br/>LONDON</div>
      </div>`;

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#ffffff">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff">
    <tr>
      <td align="center" style="padding:0">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;font-family:Arial,Helvetica,sans-serif;color:#5d6f78;font-size:15px;line-height:1.55">
          <tr>
            <td style="padding:28px 36px 18px">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td valign="middle" width="110">${logo}</td>
                  <td valign="middle" align="right" style="font-size:16px;font-weight:600;color:#3d4f57">${company}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 36px">
              <div style="border-top:1px solid #e6ebed;line-height:0;font-size:0">&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 36px 40px">
              <h1 style="margin:0 0 22px;font-size:22px;line-height:1.2;font-weight:700;color:#1c3d46">Quote</h1>
              <p style="margin:0;color:#5d6f78">${letterBodyHtml(input.message)}</p>
              <p style="margin:28px 0 0">
                <a href="${viewUrl}" target="_blank" style="background-color:${VIEW_QUOTE_GREEN};border:1px solid ${VIEW_QUOTE_GREEN};border-radius:4px;color:#ffffff;display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;line-height:1;padding:12px 18px;text-decoration:none">View Quote</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function invoiceEmailHtml(input: {
  companyName: string;
  clientName: string;
  number: string;
  subject: string;
  message: string;
  dueOn: string;
  total: number;
  balance: number;
  lines: Line[];
}): string {
  return `<div style="font-family:system-ui,sans-serif;color:#042b3c;max-width:560px">
    <p>Hello ${escapeHtml(input.clientName)},</p>
    <p>${escapeHtml(input.companyName)} has sent invoice <strong>${escapeHtml(input.number)}</strong> — ${escapeHtml(input.subject)}.</p>
    ${input.message ? `<p>${escapeHtml(input.message).replace(/\n/g, "<br/>")}</p>` : ""}
    ${linesTable(input.lines)}
    <p style="font-size:18px;font-weight:700">Total ${formatGBP(input.total)}</p>
    <p>Balance due ${formatGBP(input.balance)} · Due ${formatDateLondon(input.dueOn)}</p>
    <p>Please reply to this email if you have any questions.</p>
  </div>`;
}
