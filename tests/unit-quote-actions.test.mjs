import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { quotePdfFileName, renderQuotePdf, renderQuoteDetailPdf } from "../.testbuild/quotes/pdf.js";
import { isValidMobile, normalizePhone } from "../.testbuild/sms/phone.js";

describe("quote pdf", () => {
  it("renders a PDF header and the quote number", () => {
    const pdf = renderQuotePdf({
      number: "Q-0009",
      title: "Driver + Helper",
      companyName: "Moving London Transport",
      clientName: "Andre Campanini",
      clientEmail: "andre@example.com",
      clientPhone: "+447587845561",
      clientAddress: "40 Old Crabtree Lane",
      moveDate: "2026-10-25",
      moveTime: "09:00",
      collection: "40 Old Crabtree Lane",
      delivery: "40 Old Crabtree Lane",
      lines: [
        {
          name: "Driver + Helper",
          description: "Two-person team",
          quantity: 6,
          unitPrice: 9500,
          total: 57000,
        },
      ],
      subtotal: 57000,
      discount: 0,
      tax: 0,
      deposit: 0,
      total: 57000,
      terms: "All quotations are provided free of charge.",
    });
    const text = Buffer.from(pdf).toString("latin1");
    assert.equal(text.slice(0, 8), "%PDF-1.4");
    assert.match(text, /Q-0009/);
    assert.match(text, /%%EOF/);
    assert.equal(quotePdfFileName("Q-0009"), "Q-0009.pdf");
  });

  it("maps a quote detail into the same PDF", () => {
    const pdf = renderQuoteDetailPdf({
      number: "Q-0013",
      title: "Driver + Helper (2-person team)",
      company_name: "Moving London Transport",
      client_name: "Andre Campanini",
      client_email: "andre@example.com",
      client_phone: "+447587845561",
      client_address: "40 Old Crabtree Lane",
      valid_until: "2026-10-25",
      move_time: "09:00",
      collection: { address: "40 Old Crabtree Lane, HP2 4EX" },
      delivery: { address: "40 Old Crabtree Lane, HP2 4EX" },
      lines: [
        {
          name: "Driver + Helper",
          description: "Two-person team",
          quantity: 6,
          unitPrice: 9500,
          total: 57000,
        },
      ],
      subtotal: 57000,
      discount: 0,
      tax: 0,
      deposit: 0,
      total: 57000,
      message: "All quotations are provided free of charge.",
    });
    const text = Buffer.from(pdf).toString("latin1");
    assert.equal(text.slice(0, 8), "%PDF-1.4");
    assert.match(text, /Q-0013/);
  });
});

describe("sms phone", () => {
  it("normalizes and accepts UK mobiles", () => {
    assert.equal(normalizePhone("+44 7587 845561"), "+447587845561");
    assert.equal(isValidMobile("+44 7587 845561"), true);
    assert.equal(isValidMobile("123"), false);
  });
});
