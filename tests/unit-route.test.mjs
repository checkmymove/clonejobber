import { test } from "node:test";
import assert from "node:assert/strict";
import { driveMinutes, estimateFromStraightLine, formatDuration, straightMiles } from "../.testbuild/geo/route-math.js";

test("straight-line miles between two London points", () => {
  // Buckingham Palace → Canary Wharf is about 5 miles as the crow flies.
  const miles = straightMiles({ lat: 51.501, lng: -0.1419 }, { lat: 51.5054, lng: -0.0235 });
  assert.ok(miles > 4.5 && miles < 5.5, String(miles));
});

test("drive time slows down in town and speeds up on longer runs", () => {
  assert.equal(driveMinutes(0), 5);
  assert.equal(driveMinutes(10), 40);
  assert.equal(driveMinutes(30), 88);
  assert.equal(driveMinutes(75), 148);
});

test("estimate adds the road factor", () => {
  const r = estimateFromStraightLine({ lat: 51.501, lng: -0.1419 }, { lat: 51.5054, lng: -0.0235 });
  assert.equal(r.source, "estimate");
  assert.ok(r.miles > 5.9 && r.miles < 7, String(r.miles));
});

test("durations read as minutes or hours", () => {
  assert.equal(formatDuration(40), "40 min");
  assert.equal(formatDuration(60), "1 h");
  assert.equal(formatDuration(85), "1 h 25 min");
});
