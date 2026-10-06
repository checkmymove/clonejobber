import { formatDateLondon, formatPounds } from "../format";

export type QuotePdfLine = {
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type QuotePdfDoc = {
  number: string;
  title: string;
  companyName: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientAddress: string;
  moveDate: string | null;
  moveTime: string;
  collection: string;
  delivery: string;
  lines: QuotePdfLine[];
  subtotal: number;
  discount: number;
  tax: number;
  deposit: number;
  total: number;
  terms: string;
};

function pdfEscape(value: string): string {
  let out = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 32;
    if (ch === "\\" || ch === "(" || ch === ")") {
      out += `\\${ch}`;
    } else if (ch === "£") {
      out += "\\243";
    } else if (code === 8211 || code === 8212) {
      out += "-";
    } else if (code === 8216 || code === 8217) {
      out += "'";
    } else if (code === 8220 || code === 8221) {
      out += '"';
    } else if (code < 32 || code > 126) {
      if (code <= 255) out += `\\${code.toString(8).padStart(3, "0")}`;
      else out += "?";
    } else {
      out += ch;
    }
  }
  return out;
}

function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r/g, "").split("\n")) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of paragraph.split(/\s+/)) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > width && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
  }
  return lines.length ? lines : [""];
}

function money(pence: number): string {
  return formatPounds(pence / 100);
}

function buildLines(doc: QuotePdfDoc): string[][] {
  const pages: string[][] = [];
  const max = 48;
  let current: string[] = [];

  const push = (line: string) => {
    if (current.length >= max) {
      pages.push(current);
      current = [];
    }
    current.push(line);
  };

  push(doc.companyName);
  push(`Quote ${doc.number}`);
  if (doc.title) push(doc.title);
  push("");
  push(`Client: ${doc.clientName}`);
  if (doc.clientAddress) push(doc.clientAddress);
  if (doc.clientPhone) push(doc.clientPhone);
  if (doc.clientEmail) push(doc.clientEmail);
  push("");
  if (doc.moveDate) push(`Moving date: ${formatDateLondon(doc.moveDate)}`);
  if (doc.moveTime.trim()) push(`Moving time: ${doc.moveTime.trim()}`);
  if (doc.collection) push(`Collection: ${doc.collection}`);
  if (doc.delivery) push(`Delivery: ${doc.delivery}`);
  push("");
  push("Services");
  for (const line of doc.lines) {
    push(
      `${line.name}  ${line.quantity} x ${money(line.unitPrice)}  ${money(line.total)}`,
    );
    if (line.description.trim()) {
      for (const wrapped of wrap(line.description.trim(), 90).slice(0, 6)) {
        push(`  ${wrapped}`);
      }
    }
  }
  push("");
  push(`Subtotal: ${money(doc.subtotal)}`);
  if (doc.discount > 0) push(`Discount: ${money(doc.discount)}`);
  if (doc.tax > 0) push(`Tax: ${money(doc.tax)}`);
  push(`Total: ${money(doc.total)}`);
  if (doc.deposit > 0) push(`Deposit required: ${money(doc.deposit)}`);
  if (doc.terms.trim()) {
    push("");
    push("Terms and conditions");
    for (const wrapped of wrap(doc.terms.trim(), 90).slice(0, 30)) push(wrapped);
  }

  pages.push(current);
  return pages;
}

function pageContent(lines: string[]): string {
  const startY = 800;
  const commands = ["BT", "/F1 11 Tf", "14 TL", `50 ${startY} Td`];
  lines.forEach((line, index) => {
    if (index > 0) commands.push("T*");
    commands.push(`(${pdfEscape(line)}) Tj`);
  });
  commands.push("ET");
  return commands.join("\n");
}

function objectBody(index: number, body: string): string {
  return `${index} 0 obj\n${body}\nendobj\n`;
}

/** Build a one-or-more-page A4 PDF for a quote. */
export function renderQuotePdf(doc: QuotePdfDoc): Uint8Array {
  const pages = buildLines(doc);
  const pageIds = pages.map((_, i) => 3 + i);
  const contentIds = pages.map((_, i) => 3 + pages.length + i);
  const fontId = 3 + pages.length * 2;
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`,
  ];
  pages.forEach((_, i) => {
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contentIds[i]} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`,
    );
  });
  pages.forEach((lines) => {
    const stream = pageContent(lines);
    objects.push(`<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`);
  });
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  const header = "%PDF-1.4\n";
  const parts = [header];
  const offsets = [0];
  let offset = Buffer.byteLength(header, "utf8");
  objects.forEach((body, index) => {
    const obj = objectBody(index + 1, body);
    offsets.push(offset);
    parts.push(obj);
    offset += Buffer.byteLength(obj, "utf8");
  });
  const xrefStart = offset;
  const xref = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.slice(1).map((off) => `${String(off).padStart(10, "0")} 00000 n `),
    "",
  ].join("\n");
  parts.push(xref);
  parts.push(`trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`);
  return new Uint8Array(Buffer.from(parts.join(""), "utf8"));
}

export function quotePdfFileName(number: string): string {
  const safe = number.replace(/[^A-Za-z0-9_-]+/g, "-");
  return `${safe || "quote"}.pdf`;
}

export function renderQuoteDetailPdf(quote: {
  number: string;
  title: string;
  company_name: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  client_address: string;
  valid_until: string | null;
  move_time: string;
  collection: { address: string } | null;
  delivery: { address: string } | null;
  lines: QuotePdfLine[];
  subtotal: number;
  discount: number;
  tax: number;
  deposit: number;
  total: number;
  message: string;
}): Uint8Array {
  return renderQuotePdf({
    number: quote.number,
    title: quote.title,
    companyName: quote.company_name,
    clientName: quote.client_name,
    clientEmail: quote.client_email,
    clientPhone: quote.client_phone,
    clientAddress: quote.client_address,
    moveDate: quote.valid_until,
    moveTime: quote.move_time,
    collection: quote.collection?.address ?? "",
    delivery: quote.delivery?.address ?? "",
    lines: quote.lines.map((line) => ({
      name: line.name,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      total: line.total,
    })),
    subtotal: quote.subtotal,
    discount: quote.discount,
    tax: quote.tax,
    deposit: quote.deposit,
    total: quote.total,
    terms: quote.message,
  });
}

export function quotePdfResponse(pdf: Uint8Array, fileName: string): {
  body: Buffer;
  headers: Record<string, string>;
} {
  return {
    body: Buffer.from(pdf),
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${fileName}"`,
      "cache-control": "private, no-store",
    },
  };
}
