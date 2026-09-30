import { formatDateLondon, formatGBP, formatPounds } from "../format";

type Line = { name: string; description?: string; quantity: number; unitPrice: number; total: number };

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

export function quoteEmailPlain(input: {
  companyName: string;
  clientName: string;
  clientTitle: string;
  total: number;
  deposit: number;
  validUntil: string | null;
  moveTime: string;
  lines: Line[];
}): { subject: string; message: string } {
  const today = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date());
  const honorific =
    input.clientTitle.trim() && input.clientTitle.trim().toLowerCase() !== "no title"
      ? `${input.clientTitle.trim()} `
      : "";
  const greeted = `${honorific}${input.clientName}`.trim();
  const lineText = input.lines
    .map(
      (line) =>
        `${line.name}\n${line.quantity} × ${formatPounds(line.unitPrice / 100)}    ${formatPounds(line.total / 100)}`,
    )
    .join("\n\n");
  const schedule = [
    input.validUntil ? `Moving date: ${formatDateLondon(input.validUntil)}` : "",
    input.moveTime.trim() ? `Moving time: ${input.moveTime.trim()}` : "",
  ].filter(Boolean);
  const message = [
    `Hi ${greeted},`,
    "",
    "We are sending this quote based on the information you provided. Please note that we can tailor this quote to your needs.",
    "",
    lineText,
    "",
    `Total: ${formatPounds(input.total / 100)}`,
    ...schedule,
    "",
    input.deposit > 0 ? `Deposit required: ${formatPounds(input.deposit / 100)}` : "",
    "",
    "If you have any questions or concerns regarding this quote, please reply to this email.",
  ]
    .filter((line, index, all) => line !== "" || all[index - 1] !== "")
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return {
    subject: `Quote from ${input.companyName} - ${today}`,
    message,
  };
}

export function quoteEmailHtml(input: {
  companyName: string;
  clientName: string;
  number: string;
  title: string;
  message: string;
  validUntil: string | null;
  moveTime?: string;
  total: number;
  lines: Line[];
}): string {
  const schedule = [
    input.validUntil ? `Moving date ${formatDateLondon(input.validUntil)}` : "",
    input.moveTime?.trim() ? `Moving time ${escapeHtml(input.moveTime.trim())}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return `<div style="font-family:system-ui,sans-serif;color:#042b3c;max-width:560px">
    <p>Hello ${escapeHtml(input.clientName)},</p>
    <p>${escapeHtml(input.companyName)} has sent quote <strong>${escapeHtml(input.number)}</strong>${input.title ? ` — ${escapeHtml(input.title)}` : ""}.</p>
    ${linesTable(input.lines)}
    <p style="font-size:18px;font-weight:700">Total ${formatGBP(input.total)}</p>
    ${schedule ? `<p style="color:#5d6f78">${schedule}</p>` : ""}
    ${input.message ? `<p>${escapeHtml(input.message).replace(/\n/g, "<br/>")}</p>` : ""}
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
