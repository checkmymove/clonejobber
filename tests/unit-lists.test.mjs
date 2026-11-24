import { test } from "node:test";
import assert from "node:assert/strict";
import { isRequestOverdue, requestKpis, requestListStatus } from "../.testbuild/requests/metrics.js";
import { quoteFilterKey, quoteFilterTally } from "../.testbuild/quotes/metrics.js";
import { formatGBPShort } from "../.testbuild/format.js";

test("request list status follows Jobber's New / Converted / Archived", () => {
  assert.equal(requestListStatus({ status: "new", has_quote: false }), "new");
  assert.equal(requestListStatus({ status: "review", has_quote: false }), "review");
  assert.equal(requestListStatus({ status: "new", has_quote: true }), "converted");
  assert.equal(requestListStatus({ status: "quoted", has_quote: false }), "converted");
  assert.equal(requestListStatus({ status: "archived", has_quote: true }), "archived");
});

test("a waiting request is overdue once its moving date has passed", () => {
  const base = { status: "new", has_quote: false, submitted_at: "2026-11-01T10:00:00Z" };
  assert.equal(isRequestOverdue({ ...base, move_date: "2026-11-20" }, "2026-11-24"), true);
  assert.equal(isRequestOverdue({ ...base, move_date: "2026-11-24" }, "2026-11-24"), false);
  assert.equal(isRequestOverdue({ ...base, has_quote: true, move_date: "2026-11-20" }, "2026-11-24"), false);
});

test("request KPIs: new = still waiting, conversion = converted ÷ (new + converted) in 30 days", () => {
  const now = new Date("2026-11-24T12:00:00Z");
  const rows = [
    { status: "new", has_quote: false, move_date: null, submitted_at: "2026-11-20T10:00:00Z" },
    { status: "new", has_quote: true, move_date: null, submitted_at: "2026-11-10T10:00:00Z" },
    { status: "new", has_quote: true, move_date: null, submitted_at: "2026-11-05T10:00:00Z" },
    { status: "new", has_quote: true, move_date: null, submitted_at: "2026-11-02T10:00:00Z" },
    { status: "archived", has_quote: false, move_date: null, submitted_at: "2026-11-02T10:00:00Z" },
    { status: "new", has_quote: true, move_date: null, submitted_at: "2026-10-10T10:00:00Z" },
    { status: "new", has_quote: false, move_date: null, submitted_at: "2026-10-12T10:00:00Z" },
  ];
  const k = requestKpis(rows, now);
  assert.equal(k.newCount, 1);
  assert.equal(Math.round(k.conversionRate), 75);
  assert.equal(k.newTrend, 0);
  assert.equal(Math.round(k.conversionTrend), 50);
});

test("quote filter: archived, then converted (has a job), then the stored status", () => {
  assert.equal(quoteFilterKey({ status: "sent", converted_at: null, archived_at: "2026-11-01" }), "archived");
  assert.equal(quoteFilterKey({ status: "approved", converted_at: "2026-11-01", archived_at: null }), "converted");
  assert.equal(quoteFilterKey({ status: "approved", converted_at: null }), "approved");
  assert.equal(quoteFilterKey({ status: "sent", converted_at: null }), "awaiting");
  assert.equal(quoteFilterKey({ status: "changes_requested", converted_at: null }), "changes");
  const t = quoteFilterTally([
    { status: "draft", total: 1000, converted_at: null },
    { status: "draft", total: 2500, converted_at: null },
  ]);
  assert.deepEqual(t.draft, { n: 2, total: 3500 });
});

test("short amounts like Jobber's Workflow", () => {
  assert.equal(formatGBPShort(140600), "£1,406");
  assert.equal(formatGBPShort(8190170), "£81.9k");
  assert.equal(formatGBPShort(0), "£0");
});
