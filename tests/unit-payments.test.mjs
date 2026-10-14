import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deriveJobStatus, nextVisitDate } from "../.testbuild/jobs/status.js";
import { deriveInvoiceStatus, settleInvoice } from "../.testbuild/invoices/status.js";
import { validatePaymentInput } from "../.testbuild/payments/engine.js";
import { paymentDetailsText, paymentMethodLabel } from "../.testbuild/payments/constants.js";

const today = "2026-10-14";
const open = { status: "scheduled", remindInvoice: true, invoiceCount: 0 };

describe("job list status", () => {
  it("late when an open visit is in the past", () => {
    assert.equal(deriveJobStatus(open, [{ date: "2026-10-10", later: false, status: "scheduled" }], today), "late");
  });
  it("today, upcoming and unscheduled", () => {
    assert.equal(deriveJobStatus(open, [{ date: today, later: false, status: "scheduled" }], today), "today");
    assert.equal(deriveJobStatus(open, [{ date: "2026-11-01", later: false, status: "scheduled" }], today), "upcoming");
    assert.equal(deriveJobStatus(open, [{ date: null, later: true, status: "scheduled" }], today), "unscheduled");
  });
  it("action required when no open visit remains", () => {
    assert.equal(deriveJobStatus(open, [{ date: "2026-10-10", later: false, status: "done" }], today), "action_required");
    assert.equal(deriveJobStatus(open, [], today), "action_required");
  });
  it("closed job requires invoicing until an invoice exists", () => {
    assert.equal(deriveJobStatus({ ...open, status: "done" }, [], today), "requires_invoicing");
    assert.equal(deriveJobStatus({ ...open, status: "done", invoiceCount: 1 }, [], today), "archived");
    assert.equal(deriveJobStatus({ ...open, status: "done", remindInvoice: false }, [], today), "archived");
  });
  it("next visit prefers the first date from today", () => {
    const visits = [
      { date: "2026-10-01", later: false, status: "scheduled" },
      { date: "2026-10-20", later: false, status: "scheduled" },
    ];
    assert.equal(nextVisitDate(visits, today), "2026-10-20");
  });
});

describe("invoice status", () => {
  it("derives past due and awaiting payment from the due date", () => {
    assert.equal(deriveInvoiceStatus("sent", "2026-10-13", today), "past_due");
    assert.equal(deriveInvoiceStatus("sent", today, today), "awaiting_payment");
    assert.equal(deriveInvoiceStatus("cancelled", null, today), "voided");
    assert.equal(deriveInvoiceStatus("bad_debt", null, today), "bad_debt");
  });
  it("settles to paid only when payments cover the total", () => {
    const base = { status: "sent", total: 30000, badDebt: 0, closedManually: false, everSent: true };
    assert.deepEqual(settleInvoice({ ...base, paid: 10000 }), { balance: 20000, status: "sent" });
    assert.deepEqual(settleInvoice({ ...base, paid: 30000 }), { balance: 0, status: "paid" });
  });
  it("a paid invoice goes back to sent when a payment is removed", () => {
    const r = settleInvoice({ status: "paid", total: 30000, paid: 0, badDebt: 0, closedManually: false, everSent: true });
    assert.deepEqual(r, { balance: 30000, status: "sent" });
  });
  it("manual close, bad debt and void keep their status", () => {
    assert.equal(
      settleInvoice({ status: "paid", total: 30000, paid: 0, badDebt: 0, closedManually: true, everSent: true }).status,
      "paid",
    );
    assert.equal(
      settleInvoice({ status: "bad_debt", total: 30000, paid: 0, badDebt: 30000, closedManually: true, everSent: true }).balance,
      0,
    );
    assert.equal(
      settleInvoice({ status: "cancelled", total: 30000, paid: 0, badDebt: 0, closedManually: false, everSent: true }).status,
      "cancelled",
    );
  });
});

describe("payment input", () => {
  const client = "6f1c2b9e-4b8a-4c1d-9e2f-1a2b3c4d5e6f";
  const invoice = "7f1c2b9e-4b8a-4c1d-9e2f-1a2b3c4d5e6f";
  const quote = "8f1c2b9e-4b8a-4c1d-9e2f-1a2b3c4d5e6f";
  const base = { clientId: client, kind: "payment", method: "bank_transfer", paidOn: today, reference: "", details: "" };

  it("sums the invoice allocations", () => {
    const { errors, parsed } = validatePaymentInput({
      ...base,
      allocations: [{ invoiceId: invoice, amount: "120.50" }],
    });
    assert.deepEqual(errors, {});
    assert.equal(parsed.amount, 12050);
  });
  it("requires an amount on at least one invoice", () => {
    const { errors } = validatePaymentInput({ ...base, allocations: [{ invoiceId: invoice, amount: "" }] });
    assert.ok(errors.allocations);
  });
  it("a deposit needs a quote and an amount", () => {
    const missing = validatePaymentInput({ ...base, kind: "deposit", allocations: [] });
    assert.ok(missing.errors.quoteId && missing.errors.amount);
    const ok = validatePaymentInput({ ...base, kind: "deposit", quoteId: quote, amount: "50", allocations: [] });
    assert.deepEqual(ok.errors, {});
    assert.equal(ok.parsed.amount, 5000);
  });
  it("rejects an unknown method and a bad date", () => {
    const { errors } = validatePaymentInput({
      ...base,
      method: "bitcoin",
      paidOn: "14/10/2026",
      allocations: [{ invoiceId: invoice, amount: "1" }],
    });
    assert.ok(errors.method && errors.paidOn);
  });
  it("labels and default details", () => {
    assert.equal(paymentMethodLabel("bank_transfer"), "Bank transfer");
    assert.equal(paymentDetailsText(["Invoice INV-0003"]), "Payment applied to Invoice INV-0003");
  });
});
