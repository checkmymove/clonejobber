import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getClientIp } from "../.testbuild/ratelimit.js";
import {
  isSealedToken,
  openToken,
  sealToken,
} from "../.testbuild/email/token-crypto.js";

describe("client ip", () => {
  it("prefers x-real-ip over a caller-supplied forwarded chain", () => {
    const headers = new Headers({
      "x-real-ip": "203.0.113.10",
      "x-forwarded-for": "1.2.3.4, 203.0.113.10",
    });
    assert.equal(getClientIp(headers), "203.0.113.10");
  });

  it("uses the last forwarded hop when the platform did not set x-real-ip", () => {
    const headers = new Headers({
      "x-forwarded-for": "1.2.3.4, 198.51.100.8",
    });
    assert.equal(getClientIp(headers), "198.51.100.8");
  });
});

describe("gmail token sealing", () => {
  it("round-trips a token and leaves legacy plaintext readable", () => {
    process.env.TOKEN_ENCRYPTION_KEY = "ab".repeat(32);
    const sealed = sealToken("refresh-token-value");
    assert.equal(isSealedToken(sealed), true);
    assert.equal(openToken(sealed), "refresh-token-value");
    assert.equal(openToken("legacy-plaintext-token"), "legacy-plaintext-token");
  });

  it("rejects a sealed token opened with another key", () => {
    process.env.TOKEN_ENCRYPTION_KEY = "cd".repeat(32);
    const sealed = sealToken("refresh-token-value");
    process.env.TOKEN_ENCRYPTION_KEY = "ef".repeat(32);
    assert.throws(() => openToken(sealed), /TOKEN_ENCRYPTION_KEY/);
  });
});
