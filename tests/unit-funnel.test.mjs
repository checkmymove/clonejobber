import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseGbpToPence, parseQty, parseLines } from "../.testbuild/funnel/money.js";
import {
  validateQuoteInput,
  validateInvoiceInput,
  dueOnFromTerms,
} from "../.testbuild/funnel/validation.js";

describe("money", () => {
  it("parses GBP strings to pence", () => {
    assert.equal(parseGbpToPence("12.50"), 1250);
    assert.equal(parseGbpToPence("£1,250.00"), 125000);
    assert.equal(parseGbpToPence("12,50"), 1250);
    assert.equal(parseGbpToPence(""), 0);
  });
  it("rejects negative money", () => {
    assert.equal(parseGbpToPence("-1"), null);
  });
  it("parses quantity", () => {
    assert.equal(parseQty("2.5"), 2.5);
    assert.equal(parseQty("0"), null);
  });
  it("requires a named line", () => {
    const r = parseLines([{ name: "", qty: "1", unitPrice: "10" }]);
    assert.ok(r.errors.lines);
  });
  it("keeps a description on every named line", () => {
    const r = parseLines([
      { name: "Removal", description: "Two-person team", qty: "1", unitPrice: "250" },
      { name: "Packing", description: "Full packing service", qty: "2", unitPrice: "40" },
    ]);
    assert.deepEqual(r.errors, {});
    assert.equal(r.parsed.length, 2);
    assert.equal(r.parsed[0].description, "Two-person team");
    assert.equal(r.parsed[1].description, "Full packing service");
    assert.equal(r.subtotal, 33000);
  });
});

describe("quote input", () => {
  it("accepts a priced quote", () => {
    const r = validateQuoteInput({
      clientId: "11111111-1111-4111-8111-111111111111",
      title: "Move",
      message: "",
      notes: "",
      validUntil: "2026-10-01",
      lines: [{ name: "Van", qty: "1", unitPrice: "250" }],
    });
    assert.deepEqual(r.errors, {});
    assert.equal(r.subtotal, 25000);
  });
});

describe("invoice due dates", () => {
  it("adds net 7", () => {
    const d = dueOnFromTerms("net_7", new Date("2026-09-01T12:00:00Z"));
    assert.equal(d.getUTCDate(), 8);
  });
  it("rejects a quote-less invoice client", () => {
    const r = validateInvoiceInput({
      clientId: "bad",
      subject: "Invoice",
      message: "",
      notes: "",
      paymentTerms: "due_on_receipt",
      lines: [{ name: "Job", qty: "1", unitPrice: "10" }],
    });
    assert.ok(r.errors.clientId);
  });
});
