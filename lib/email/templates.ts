import { formatGBP, formatDateLondon } from "../format";

type Line = { name: string; description?: string; quantity: number; unitPrice: number; total: number };

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

export function quoteEmailHtml(input: {
  companyName: string;
  clientName: string;
  number: string;
  title: string;
  message: string;
  validUntil: string | null;
  total: number;
  lines: Line[];
}): string {
  const validity = input.validUntil
    ? `Valid until ${formatDateLondon(input.validUntil)}.`
    : "";
  return `<div style="font-family:system-ui,sans-serif;color:#042b3c;max-width:560px">
    <p>Hello ${escapeHtml(input.clientName)},</p>
    <p>${escapeHtml(input.companyName)} has sent quote <strong>${escapeHtml(input.number)}</strong>${input.title ? ` — ${escapeHtml(input.title)}` : ""}.</p>
    ${input.message ? `<p>${escapeHtml(input.message).replace(/\n/g, "<br/>")}</p>` : ""}
    ${linesTable(input.lines)}
    <p style="font-size:18px;font-weight:700">Total ${formatGBP(input.total)}</p>
    ${validity ? `<p style="color:#5d6f78">${validity}</p>` : ""}
    <p>Please reply to this email if you have any questions.</p>
  </div>`;
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
