import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { categoryLabel, validateExpense } from "../.testbuild/expenses/constants.js";

const base = {
  spentOn: "2026-10-31",
  category: "fuel",
  description: "Diesel for the Luton van",
  vendor: "Shell",
  amount: "£62.40",
  paymentMethod: "card",
  jobId: "",
};

describe("expenses", () => {
  it("accepts an expense and stores pounds as pence", () => {
    const r = validateExpense(base);
    assert.equal(r.ok, true);
    assert.equal(r.value.amount, 6240);
    assert.equal(r.value.jobId, null);
  });

  it("accepts thousands with a comma and a linked job", () => {
    const r = validateExpense({ ...base, amount: "1,250", jobId: "b684db7a-9010-41a2-970e-83b4d977aa6d" });
    assert.equal(r.ok, true);
    assert.equal(r.value.amount, 125000);
  });

  it("rejects bad input", () => {
    for (const patch of [
      { amount: "0" },
      { amount: "-5" },
      { amount: "12.345" },
      { amount: "abc" },
      { spentOn: "2026-02-30" },
      { category: "holiday" },
      { paymentMethod: "crypto" },
      { jobId: "not-a-job" },
    ]) {
      assert.equal(validateExpense({ ...base, ...patch }).ok, false, JSON.stringify(patch));
    }
  });

  it("labels categories", () => {
    assert.equal(categoryLabel("van_hire"), "Van hire");
    assert.equal(categoryLabel("unknown"), "unknown");
  });
});
