import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildRawEmail, encodeHeader, toBase64Url } from "../.testbuild/email/mime.js";
import { googleRedirectUri } from "../.testbuild/email/config.js";
import { quoteEmailHtml } from "../.testbuild/email/templates.js";

describe("mime", () => {
  it("encodes ascii subjects unchanged", () => {
    assert.equal(encodeHeader("Quote Q-0001"), "Quote Q-0001");
  });
  it("builds a gmail raw payload", () => {
    const raw = buildRawEmail({
      from: "Ops <ops@example.com>",
      to: "client@example.co.uk",
      subject: "Quote Q-0001",
      html: "<p>Hello</p>",
    });
    assert.match(raw, /To: client@example.co.uk/);
    assert.match(raw, /<p>Hello<\/p>/);
    const encoded = toBase64Url(raw);
    assert.equal(encoded.includes("+"), false);
    assert.equal(encoded.includes("/"), false);
  });
});

describe("oauth config", () => {
  it("uses GOOGLE_REDIRECT_URI when set", () => {
    process.env.GOOGLE_REDIRECT_URI = "http://127.0.0.1:3000/api/integrations/google/callback";
    assert.equal(
      googleRedirectUri(),
      "http://127.0.0.1:3000/api/integrations/google/callback",
    );
  });
});

describe("templates", () => {
  it("includes quote number and total", () => {
    const html = quoteEmailHtml({
      companyName: "Moving London",
      clientName: "Ada",
      number: "Q-0009",
      title: "Move",
      message: "Thanks",
      validUntil: "2026-10-10",
      total: 17500,
      lines: [{ name: "Van", quantity: 1, unitPrice: 17500, total: 17500 }],
    });
    assert.match(html, /Q-0009/);
    assert.match(html, /£175/);
  });
});
