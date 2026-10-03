// Unit tests for Products & services validators.
// Run: npm run test:unit
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  poundsToPence,
  validateProductInput,
  formatDuration,
} from "../.testbuild/products/validation.js";

const good = {
  itemType: "service",
  name: "Driver + Helper + Luton Van",
  description: "Two-person team",
  unitPrice: "85.00",
  taxExempt: false,
  durationMinutes: "60",
  allowQuantity: false,
};

describe("product input", () => {
  it("accepts a valid service", () => {
    assert.deepEqual(validateProductInput(good), {});
  });
  it("requires a name", () => {
    assert.ok(validateProductInput({ ...good, name: "  " }).name);
  });
  it("rejects an unknown type", () => {
    assert.ok(validateProductInput({ ...good, itemType: "bundle" }).itemType);
  });
  it("rejects a bad price", () => {
    assert.ok(validateProductInput({ ...good, unitPrice: "abc" }).unitPrice);
    assert.ok(validateProductInput({ ...good, unitPrice: "-5" }).unitPrice);
  });
  it("ignores duration for products", () => {
    assert.deepEqual(
      validateProductInput({ ...good, itemType: "product", durationMinutes: "" }),
      {},
    );
  });
});

describe("money and duration", () => {
  it("converts pounds to pence", () => {
    assert.equal(poundsToPence("85"), 8500);
    assert.equal(poundsToPence("£1,250.50"), 125050);
    assert.equal(poundsToPence(""), 0);
    assert.equal(poundsToPence("1.234"), null);
  });
  it("formats durations", () => {
    assert.equal(formatDuration(15), "15min");
    assert.equal(formatDuration(60), "1h");
    assert.equal(formatDuration(90), "1h 30min");
  });
});
