import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  TEMPLATE_CATALOG,
  TEMPLATE_KEYS,
  TEMPLATE_VARIABLES,
  jobDetailsText,
  renderLetter,
  renderTemplate,
} from "../.testbuild/templates/catalog.js";

describe("message templates", () => {
  it("fills variables and keeps unknown ones visible", () => {
    assert.equal(renderTemplate("Hi {{CLIENT_NAME}}, {{NOPE}}", { CLIENT_NAME: "Ana" }), "Hi Ana, {{NOPE}}");
  });

  it("drops a labelled line whose variable is empty", () => {
    const text = "Hi {{CLIENT_NAME}},\n\nDeposit required: {{DEPOSIT_AMOUNT}}\n\nThanks";
    assert.equal(renderLetter(text, { CLIENT_NAME: "Ana", DEPOSIT_AMOUNT: "" }), "Hi Ana,\n\nThanks");
    assert.equal(
      renderLetter(text, { CLIENT_NAME: "Ana", DEPOSIT_AMOUNT: "£50.00" }),
      "Hi Ana,\n\nDeposit required: £50.00\n\nThanks",
    );
  });

  it("drops a line that is only an empty variable", () => {
    assert.equal(renderLetter("A\n\n{{JOB_DETAILS}}\n\nB", { JOB_DETAILS: "" }), "A\n\nB");
  });

  it("only uses variables the Insert Variable menu offers", () => {
    const known = new Set(TEMPLATE_VARIABLES.flatMap((s) => s.items.map((v) => v.name)));
    for (const key of TEMPLATE_KEYS) {
      const t = TEMPLATE_CATALOG[key];
      for (const text of [t.email.subject, t.email.body, t.sms ?? ""]) {
        for (const [, name] of text.matchAll(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g)) {
          assert.ok(known.has(name), `${key} uses unknown variable ${name}`);
        }
      }
    }
  });

  it("builds the booking details block", () => {
    assert.equal(
      jobDetailsText({ date: "05/11/2026", time: "09:00 – 12:00", team: "", address: "12 Mare St" }),
      "Date: 05/11/2026\nTime: 09:00 – 12:00\nCollection address: 12 Mare St",
    );
  });
});
