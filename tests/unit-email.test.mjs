import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildRawEmail, encodeHeader, toBase64Url } from "../.testbuild/email/mime.js";
import { googleRedirectUri } from "../.testbuild/email/config.js";
import { quoteEmailHtml, quoteEmailPlain } from "../.testbuild/email/templates.js";

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
  it("builds the short branded quote letter", () => {
    const letter = quoteEmailPlain({
      companyName: "Moving London Removals & Transport",
      clientName: "Andre Dutra",
      clientTitle: "Mr",
      deposit: 5000,
    });
    assert.equal(letter.subject, "Quote from Moving London Removals & Transport");
    assert.match(letter.message, /Hi Mr\. Andre Dutra,/);
    assert.match(letter.message, /Klarna/);
    assert.match(letter.message, /Deposit required: £50\.00/);
    assert.match(letter.message, /020 335 52161/);
    assert.match(letter.message, /\+44 7710 251699/);
    assert.match(letter.message, /Best wishes,/);
    assert.equal(letter.message.includes("Van"), false);
    assert.equal(letter.message.includes("Total:"), false);

    const html = quoteEmailHtml({
      companyName: "Moving London Removals & Transport",
      viewQuoteUrl: "http://127.0.0.1:3010/q/abc",
      message: letter.message,
    });
    assert.match(html, />Quote</);
    assert.match(html, /View Quote/);
    assert.match(html, /http:\/\/127\.0\.0\.1:3010\/q\/abc/);
    assert.match(html, /wa\.me\/447710251699/);
    assert.equal(html.includes("Q-0009"), false);
  });

  it("omits the deposit line when none is required", () => {
    const letter = quoteEmailPlain({
      companyName: "Moving London Transport",
      clientName: "Ada Lovelace",
      clientTitle: "no title",
      deposit: 0,
    });
    assert.match(letter.message, /Hi Ada Lovelace,/);
    assert.equal(letter.message.includes("Deposit required"), false);
  });
});
