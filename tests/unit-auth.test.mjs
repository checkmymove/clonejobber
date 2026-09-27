import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isAllowedAdminEmail, safeNextPath } from "../.testbuild/auth/allowlist.js";

describe("admin allowlist", () => {
  it("accepts only the configured email", () => {
    process.env.ADMIN_EMAIL = "hello@movinglondontransport.com";
    assert.equal(isAllowedAdminEmail("Hello@MovingLondonTransport.com"), true);
    assert.equal(isAllowedAdminEmail("other@example.com"), false);
    assert.equal(isAllowedAdminEmail(""), false);
    assert.equal(isAllowedAdminEmail(null), false);
  });

  it("fails closed when ADMIN_EMAIL is unset", () => {
    delete process.env.ADMIN_EMAIL;
    assert.equal(isAllowedAdminEmail("hello@movinglondontransport.com"), false);
  });
});

describe("login next path", () => {
  it("keeps relative paths and drops open redirects", () => {
    assert.equal(safeNextPath("/clientes"), "/clientes");
    assert.equal(safeNextPath("/cotacoes/abc?q=1"), "/cotacoes/abc?q=1");
    assert.equal(safeNextPath("https://evil.example"), "/");
    assert.equal(safeNextPath("//evil.example"), "/");
    assert.equal(safeNextPath("/login?next=/"), "/");
    assert.equal(safeNextPath(""), "/");
  });
});
