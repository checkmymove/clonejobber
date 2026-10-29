import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { LOGO_PNG_BASE64 } from "./logo";

/**
 * Quote / job / invoice PDF in the layout of Jobber's "Print or Save PDF":
 * company header on every page, RECIPIENT and a dark "Invoice #" box, the
 * Product/Service table, totals on the right and "Page x of y" at the bottom.
 */

export const COMPANY_ADDRESS_LINE = "40 Old Crabtree Lane  |  Hemel Hempstead, England HP2 4EX";
export const COMPANY_CONTACT_LINE =
  "020 335 52161  |  hello@movinglondontransport.com  |  https://movinglondontransport.com/";

export type PdfLine = {
  name: string;
  description: string;
  quantity: number;
  unitPrice: number; // pence
  total: number; // pence
};

export type PdfRow = { label: string; value: string; strong?: boolean };

export type DocumentPdf = {
  /** "Quote #Q-0017", "Job #JOB-0003", "Invoice #INV-0004" */
  heading: string;
  title: string;
  companyName: string;
  recipientName: string;
  recipientLines: string[];
  /** Rows of the dark box under the heading (Issued, Due…). */
  facts: PdfRow[];
  /** Highlighted last row of that box, e.g. Total. */
  headline?: PdfRow;
  lines: PdfLine[];
  /** Jobs list quantities only, like Jobber's job PDF. */
  showPrices: boolean;
  /** Short date or note printed above the first line item. */
  lineDate?: string;
  totals: PdfRow[];
  note: string;
  /** Long text printed after the totals (terms and conditions). */
  appendix?: { title: string; body: string };
  stamp?: string;
};

const A4: [number, number] = [595.28, 841.89];
const M = 36;
const RIGHT = A4[0] - M;
const BOTTOM = 56;
const DARK = rgb(0.34, 0.34, 0.34);
const SOFT = rgb(0.94, 0.94, 0.94);
const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.42, 0.42, 0.42);
const RULE = rgb(0.75, 0.75, 0.75);

const WIN_ANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";

/** Standard PDF fonts only encode WinAnsi; drop what they cannot draw (emoji etc.). */
export function pdfSafe(text: string): string {
  let out = "";
  for (const ch of text.replace(/\t/g, " ")) {
    const code = ch.codePointAt(0) ?? 32;
    if ((code >= 32 && code <= 126) || (code >= 160 && code <= 255) || WIN_ANSI_EXTRA.includes(ch)) out += ch;
    else if (code === 8216 || code === 8217) out += "'";
    else if (code === 8220 || code === 8221) out += '"';
  }
  return out;
}

export function moneyText(pence: number): string {
  const sign = pence < 0 ? "-" : "";
  const value = Math.abs(pence) / 100;
  return `${sign}£${value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function wrapText(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.replace(/\r/g, "").split("\n").map(pdfSafe)) {
    if (!paragraph.trim()) {
      out.push("");
      continue;
    }
    let current = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) {
        current = next;
        continue;
      }
      if (current) out.push(current);
      // A single word wider than the column is broken by characters.
      let piece = "";
      for (const ch of word) {
        if (font.widthOfTextAtSize(piece + ch, size) > width && piece) {
          out.push(piece);
          piece = "";
        }
        piece += ch;
      }
      current = piece;
    }
    out.push(current);
  }
  while (out.length && !out[out.length - 1]) out.pop();
  return out;
}

type Ctx = {
  pdf: PDFDocument;
  regular: PDFFont;
  bold: PDFFont;
  logo: PDFImage;
  doc: DocumentPdf;
  page: PDFPage;
  y: number;
};

function text(ctx: Ctx, value: string, x: number, y: number, size: number, opts: { bold?: boolean; color?: ReturnType<typeof rgb>; align?: "left" | "right" } = {}) {
  const font = opts.bold ? ctx.bold : ctx.regular;
  const safe = pdfSafe(value);
  const drawX = opts.align === "right" ? x - font.widthOfTextAtSize(safe, size) : x;
  ctx.page.drawText(safe, { x: drawX, y, size, font, color: opts.color ?? INK });
}

function newPage(ctx: Ctx) {
  ctx.page = ctx.pdf.addPage(A4);
  const top = A4[1] - M;
  ctx.page.drawImage(ctx.logo, { x: M, y: top - 62, width: 62, height: 62 });
  text(ctx, ctx.doc.companyName, 112, top - 22, 18, { bold: true });
  text(ctx, COMPANY_ADDRESS_LINE, 112, top - 36, 8.5);
  text(ctx, COMPANY_CONTACT_LINE, 112, top - 47, 8.5);
  ctx.y = top - 88;
}

function ensure(ctx: Ctx, height: number, onBreak?: () => void) {
  if (ctx.y - height >= BOTTOM) return;
  newPage(ctx);
  onBreak?.();
}

function drawRecipientAndBox(ctx: Ctx) {
  const { doc } = ctx;
  const startY = ctx.y;
  text(ctx, "RECIPIENT:", M, startY - 4, 7.5, { bold: true });
  text(ctx, doc.recipientName, M, startY - 26, 11, { bold: true });
  let ly = startY - 41;
  for (const line of doc.recipientLines.filter(Boolean)) {
    for (const wrapped of wrapText(line, ctx.regular, 9, 250)) {
      text(ctx, wrapped, M, ly, 9);
      ly -= 12;
    }
  }

  const bx = 330;
  const bw = RIGHT - bx;
  let by = startY + 10;
  ctx.page.drawRectangle({ x: bx, y: by - 30, width: bw, height: 30, color: DARK });
  text(ctx, doc.heading, bx + 10, by - 20, 13, { bold: true, color: rgb(1, 1, 1) });
  by -= 30;
  for (const row of doc.facts) {
    ctx.page.drawRectangle({ x: bx, y: by - 19, width: bw, height: 19, color: SOFT });
    ctx.page.drawLine({ start: { x: bx, y: by - 19 }, end: { x: RIGHT, y: by - 19 }, thickness: 0.5, color: rgb(1, 1, 1) });
    text(ctx, row.label, bx + 10, by - 13, 9);
    text(ctx, row.value, RIGHT - 8, by - 13, 9, { align: "right" });
    by -= 19;
  }
  if (doc.headline) {
    ctx.page.drawRectangle({ x: bx, y: by - 21, width: bw, height: 21, color: DARK });
    text(ctx, doc.headline.label, bx + 10, by - 14.5, 11, { bold: true, color: rgb(1, 1, 1) });
    text(ctx, doc.headline.value, RIGHT - 8, by - 14.5, 11, { bold: true, color: rgb(1, 1, 1), align: "right" });
    by -= 21;
  }
  ctx.y = Math.min(ly, by) - 22;
}

type Column = { label: string; x: number; width: number; align: "left" | "right" };

function columns(showPrices: boolean): Column[] {
  if (!showPrices) {
    return [
      { label: "Product/Service", x: M + 6, width: 118, align: "left" },
      { label: "Description", x: 168, width: 330, align: "left" },
      { label: "Qty.", x: RIGHT - 6, width: 40, align: "right" },
    ];
  }
  return [
    { label: "Product/Service", x: M + 6, width: 118, align: "left" },
    { label: "Description", x: 168, width: 210, align: "left" },
    { label: "Qty.", x: 420, width: 36, align: "right" },
    { label: "Unit Price", x: 492, width: 62, align: "right" },
    { label: "Total", x: RIGHT - 6, width: 62, align: "right" },
  ];
}

function drawTableHeader(ctx: Ctx, cols: Column[]) {
  ctx.page.drawRectangle({ x: M, y: ctx.y - 20, width: RIGHT - M, height: 20, color: DARK });
  for (const col of cols) {
    text(ctx, col.label, col.x, ctx.y - 13.5, 9, { bold: true, color: rgb(1, 1, 1), align: col.align });
  }
  ctx.y -= 34;
}

function drawLines(ctx: Ctx) {
  const { doc } = ctx;
  const cols = columns(doc.showPrices);
  if (doc.title.trim()) {
    ensure(ctx, 60);
    text(ctx, doc.title, M, ctx.y, 12, { bold: true });
    ctx.y -= 12;
  }
  ensure(ctx, 60);
  drawTableHeader(ctx, cols);
  if (doc.lineDate) {
    text(ctx, doc.lineDate, M + 6, ctx.y, 8.5, { bold: true, color: MUTED });
    ctx.y -= 16;
  }
  const descCol = cols[1];
  for (const line of doc.lines) {
    const names = wrapText(line.name, ctx.regular, 9, cols[0].width);
    const desc = wrapText(line.description, ctx.regular, 9, descCol.width);
    const rows = Math.max(names.length, desc.length, 1);
    ensure(ctx, 14, () => drawTableHeader(ctx, cols));
    const firstY = ctx.y;
    text(ctx, String(line.quantity), cols[2].x, firstY, 9, { align: "right" });
    if (doc.showPrices) {
      text(ctx, moneyText(line.unitPrice), cols[3].x, firstY, 9, { align: "right" });
      text(ctx, moneyText(line.total), cols[4].x, firstY, 9, { align: "right" });
    }
    for (let i = 0; i < rows; i++) {
      ensure(ctx, 12, () => drawTableHeader(ctx, cols));
      if (names[i]) text(ctx, names[i], cols[0].x, ctx.y, 9);
      if (desc[i]) text(ctx, desc[i], descCol.x, ctx.y, 9);
      ctx.y -= 11.5;
    }
    ctx.y -= 8;
  }
  ctx.page.drawLine({ start: { x: M, y: ctx.y + 2 }, end: { x: RIGHT, y: ctx.y + 2 }, thickness: 1, color: RULE });
  ctx.y -= 18;
}

function drawTotals(ctx: Ctx) {
  const { doc } = ctx;
  const noteLines = wrapText(doc.note, ctx.regular, 8.5, 270);
  const height = Math.max(doc.totals.length * 21, noteLines.length * 11) + 10;
  ensure(ctx, Math.min(height, 300));
  const startY = ctx.y;
  let ny = startY;
  for (const line of noteLines) {
    text(ctx, line, M, ny, 8.5);
    ny -= 11;
  }
  const bx = 360;
  let ty = startY;
  doc.totals.forEach((row, index) => {
    text(ctx, row.label, bx + 4, ty, 9.5, { bold: row.strong });
    text(ctx, row.value, RIGHT - 4, ty, 9.5, { bold: true, align: "right" });
    if (index < doc.totals.length - 1) {
      ctx.page.drawLine({ start: { x: bx, y: ty - 7 }, end: { x: RIGHT, y: ty - 7 }, thickness: 0.5, color: RULE });
    }
    ty -= 21;
  });
  ctx.y = Math.min(ny, ty) - 16;
}

function drawAppendix(ctx: Ctx) {
  const appendix = ctx.doc.appendix;
  if (!appendix?.body.trim()) return;
  ensure(ctx, 40);
  text(ctx, appendix.title, M, ctx.y, 10.5, { bold: true });
  ctx.y -= 15;
  for (const line of wrapText(appendix.body, ctx.regular, 8.5, RIGHT - M)) {
    ensure(ctx, 11);
    if (line) text(ctx, line, M, ctx.y, 8.5);
    ctx.y -= 11;
  }
}

export async function renderDocumentPdf(doc: DocumentPdf): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(pdfSafe(`${doc.heading} - ${doc.companyName}`));
  pdf.setProducer("Job To Go");
  const ctx: Ctx = {
    pdf,
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    logo: await pdf.embedPng(Buffer.from(LOGO_PNG_BASE64, "base64")),
    doc,
    page: undefined as unknown as PDFPage,
    y: 0,
  };
  newPage(ctx);
  drawRecipientAndBox(ctx);
  drawLines(ctx);
  drawTotals(ctx);
  drawAppendix(ctx);

  const pages = pdf.getPages();
  pages.forEach((page, index) => {
    const label = `Page ${index + 1} of ${pages.length}`;
    page.drawText(label, {
      x: RIGHT - ctx.regular.widthOfTextAtSize(label, 8.5),
      y: 28,
      size: 8.5,
      font: ctx.regular,
      color: INK,
    });
    page.drawLine({ start: { x: M, y: 42 }, end: { x: RIGHT, y: 42 }, thickness: 0.5, color: RULE });
    if (doc.stamp) {
      page.drawText(pdfSafe(doc.stamp), {
        x: 150,
        y: 330,
        size: 92,
        font: ctx.regular,
        color: rgb(0.75, 0.35, 0.35),
        opacity: 0.4,
        rotate: degrees(35),
      });
    }
  });
  return pdf.save();
}

export function pdfFileName(prefix: string, number: string): string {
  const safe = number.replace(/[^A-Za-z0-9_-]+/g, "-");
  return `${prefix}_${safe || "document"}.pdf`;
}
