// Unit tests for clients validators.
// Run: npm run test:unit
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateAddressInput,
  validateClientInput,
} from "../.testbuild/clients/validation.js";

const goodClient = {
  firstName: "James",
  lastName: "Prescott",
  companyName: "",
  email: "james@example.co.uk",
  phone: "+44 7700 900101",
  notes: "",
};

describe("client input", () => {
  it("accepts a valid client", () => {
    assert.deepEqual(validateClientInput(goodClient), {});
  });
  it("rejects empty/invalid fields", () => {
    const e = validateClientInput({
      ...goodClient,
      firstName: "",
      email: "bad",
      phone: "12",
    });
    assert.ok(e.firstName && e.email && e.phone);
  });
  it("rejects overlong notes", () => {
    assert.ok(validateClientInput({ ...goodClient, notes: "x".repeat(4001) }).notes);
  });
});

describe("address input", () => {
  it("accepts a valid address", () => {
    assert.deepEqual(
      validateAddressInput({
        label: "Collection",
        addressLine: "12 Hackney Road",
        city: "London",
        postcode: "E2 8DP",
        instructions: "",
      }),
      {},
    );
  });
  it("rejects bad label and missing fields", () => {
    const e = validateAddressInput({
      label: "Moon",
      addressLine: "",
      city: "",
      postcode: "",
      instructions: "",
    });
    assert.ok(e.label && e.addressLine && e.postcode);
  });
});
