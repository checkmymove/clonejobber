import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { moneyText, pdfFileName, pdfSafe, renderDocumentPdf } from "../.testbuild/pdf/document.js";
import { isValidMobile, normalizePhone } from "../.testbuild/sms/phone.js";

describe("document pdf", () => {
  const base = {
    heading: "Invoice #INV-0009",
    title: "Removal Service",
    companyName: "Moving London",
    recipientName: "Ana Silva",
    recipientLines: ["1 High St, London", "+447700900123"],
    facts: [{ label: "Issued", value: "28/10/2026" }],
    headline: { label: "Total", value: "£380.00" },
    lines: [{ name: "Driver + Helper", description: "Two movers", quantity: 4, unitPrice: 9500, total: 38000 }],
    showPrices: true,
    totals: [{ label: "Total", value: "£380.00", strong: true }],
    note: "Thank you for your business.",
  };

  it("renders a one-page A4 PDF", async () => {
    const bytes = await renderDocumentPdf(base);
    assert.equal(Buffer.from(bytes.slice(0, 5)).toString("latin1"), "%PDF-");
    const doc = await PDFDocument.load(bytes);
    assert.equal(doc.getPageCount(), 1);
    assert.match(doc.getTitle() ?? "", /Invoice #INV-0009/);
  });

  it("breaks long descriptions and terms onto more pages", async () => {
    const long = Array.from({ length: 160 }, (_, i) => `Line ${i} of the service summary`).join("\n");
    const bytes = await renderDocumentPdf({ ...base, lines: [{ ...base.lines[0], description: long }], appendix: { title: "Terms", body: long }, stamp: "PAST DUE" });
    const doc = await PDFDocument.load(bytes);
    assert.ok(doc.getPageCount() >= 3);
  });

  it("formats money, names and unsupported characters", () => {
    assert.equal(moneyText(125050), "£1,250.50");
    assert.equal(moneyText(-500), "-£5.00");
    assert.equal(pdfFileName("invoice", "INV 0004"), "invoice_INV-0004.pdf");
    assert.equal(pdfSafe("Booked ✅ “today”"), "Booked  “today”");
  });
});

describe("sms phone", () => {
  it("normalizes and accepts UK mobiles", () => {
    assert.equal(normalizePhone("+44 7587 845561"), "+447587845561");
    assert.equal(isValidMobile("+44 7587 845561"), true);
    assert.equal(isValidMobile("123"), false);
  });
});
