// Unit tests for CRM validators.
// Run: npm run test:unit
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateAppointment,
  validateContactInput,
  validateMessage,
  validateNote,
  validateProfile,
  validateProperty,
  validateTag,
  validateFullProperty,
  validateNewClient,
} from "../.testbuild/clients/crm-validation.js";

describe("profile", () => {
  const good = {
    title: "Mr",
    firstName: "Andre",
    lastName: "Silva",
    companyName: "",
    clientType: "individual",
    status: "active",
    email: "andre@example.co.uk",
    phone: "+44 7700 900200",
    phoneMobile: "",
    paymentTerms: "due_on_receipt",
    paymentTermsCustom: "",
    askForReview: true,
  };
  it("accepts a valid profile", () => {
    assert.deepEqual(validateProfile(good), {});
  });
  it("rejects bad status/type/terms", () => {
    const e = validateProfile({
      ...good,
      status: "vip",
      clientType: "alien",
      paymentTerms: "net_99",
      email: "",
    });
    assert.ok(e.status && e.clientType && e.paymentTerms && e.email);
  });
  it("requires custom terms description", () => {
    assert.ok(
      validateProfile({ ...good, paymentTerms: "custom", paymentTermsCustom: "" })
        .paymentTermsCustom,
    );
  });
});

describe("property/contact/note/tag", () => {
  it("validates property", () => {
    assert.deepEqual(
      validateProperty({
        label: "Collection",
        addressLine: "12 Hackney Road",
        city: "London",
        postcode: "E2 8DP",
        instructions: "",
        isPrimary: true,
        isBilling: false,
      }),
      {},
    );
    assert.ok(
      validateProperty({
        label: "Moon",
        addressLine: "",
        city: "",
        postcode: "",
        instructions: "",
        isPrimary: false,
        isBilling: false,
      }).label,
    );
  });
  it("validates contact", () => {
    assert.deepEqual(
      validateContactInput({ name: "Ops Manager", role: "", phone: "", email: "", notes: "" }),
      {},
    );
    assert.ok(
      validateContactInput({ name: "", role: "", phone: "x", email: "bad", notes: "" }).name,
    );
  });
  it("validates note and tag", () => {
    assert.ok(validateNote("").content);
    assert.ok(validateNote("ok").content === undefined);
    assert.deepEqual(validateTag("VIP"), {});
    assert.ok(validateTag("").name);
  });
});

describe("appointment/message", () => {
  it("validates appointment dates", () => {
    assert.deepEqual(
      validateAppointment({
        title: "Assessment",
        kind: "assessment",
        startsAt: "2026-10-01T10:00",
        endsAt: "2026-10-01T11:00",
        notes: "",
      }),
      {},
    );
    const e = validateAppointment({
      title: "",
      kind: "party",
      startsAt: "2026-10-01T11:00",
      endsAt: "2026-10-01T10:00",
      notes: "",
    });
    assert.ok(e.title && e.kind && e.endsAt);
  });
  it("validates message", () => {
    assert.deepEqual(
      validateMessage({ channel: "email", subject: "Hi", body: "Hello" }),
      {},
    );
    assert.ok(validateMessage({ channel: "pigeon", subject: "", body: "" }).channel);
  });
});

describe("new client aggregate", () => {
  const profile = {
    title: "No title",
    firstName: "A",
    lastName: "B",
    companyName: "",
    clientType: "individual",
    status: "active",
    email: "a.b@example.co.uk",
    phone: "+44 7700 900200",
    phoneMobile: "",
    paymentTerms: "due_on_receipt",
    paymentTermsCustom: "",
    askForReview: true,
  };
  const property = {
    label: "Collection",
    addressLine: "12 Hackney Road",
    street2: "",
    city: "London",
    county: "Greater London",
    postcode: "E2 8DP",
    country: "United Kingdom",
    taxRate: "",
    instructions: "",
    isPrimary: false,
    isBilling: false,
    billingSame: true,
  };
  it("accepts a complete payload", () => {
    assert.deepEqual(
      validateNewClient(
        {
          profile,
          leadSourceId: "ls-1",
          marketingEmail: false,
          marketingSms: false,
          contacts: [{ name: "Ops", role: "", phone: "", email: "", notes: "" }],
          properties: [property],
        },
        ["ls-1"],
      ),
      {},
    );
  });
  it("indexes nested errors", () => {
    const e = validateNewClient(
      {
        profile: { ...profile, email: "" },
        leadSourceId: "unknown",
        marketingEmail: false,
        marketingSms: false,
        contacts: [{ name: "", role: "", phone: "", email: "", notes: "" }],
        properties: [{ ...property, addressLine: "", country: "" }],
      },
      ["ls-1"],
    );
    assert.ok(e.email && e.leadSourceId);
    assert.ok(e["contacts.0.name"]);
    assert.ok(e["properties.0.addressLine"] && e["properties.0.country"]);
  });
  it("rejects overlong tax rate", () => {
    assert.ok(validateFullProperty({ ...property, taxRate: "x".repeat(61) }).taxRate);
  });
});
