import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  appointmentStatus,
  entrySeconds,
  formatClock,
  formatHoursMinutes,
  initials,
  parseManualEntry,
  visitShare,
} from "../.testbuild/team/time.js";

const visit = (patch = {}) => ({
  done: false,
  anytime: false,
  start: "09:00",
  end: "15:00",
  running: false,
  ...patch,
});

describe("team time formatting", () => {
  it("shows Jobber's employee clock", () => {
    assert.equal(formatClock(0), "00:00:00");
    assert.equal(formatClock(3725), "01:02:05");
    assert.equal(formatClock(-5), "00:00:00");
  });

  it("shows timesheet durations in hours and minutes", () => {
    assert.equal(formatHoursMinutes(45 * 60), "45m");
    assert.equal(formatHoursMinutes(2 * 3600 + 5 * 60), "2h 05m");
  });

  it("counts a running entry up to now", () => {
    const now = new Date("2026-10-29T12:00:00Z");
    assert.equal(entrySeconds("2026-10-29T11:30:00Z", null, now), 1800);
    assert.equal(entrySeconds("2026-10-29T09:00:00Z", "2026-10-29T10:15:00Z", now), 4500);
  });

  it("builds initials like Jobber's avatars", () => {
    assert.equal(initials("Fabiano da Silva Ribeiro"), "FR");
    assert.equal(initials("Jailton Bento"), "JB");
    assert.equal(initials("Ed Li"), "EL");
  });
});

describe("today's appointment buckets", () => {
  it("is completed once marked done, whatever the time", () => {
    assert.equal(appointmentStatus(visit({ done: true, running: true }), "16:00"), "completed");
  });

  it("is active while someone is clocked in, even outside the window", () => {
    assert.equal(appointmentStatus(visit({ running: true }), "07:00"), "active");
    assert.equal(appointmentStatus(visit({ running: true }), "17:00"), "active");
  });

  it("follows the window when nobody is clocked in", () => {
    assert.equal(appointmentStatus(visit(), "08:59"), "remaining");
    assert.equal(appointmentStatus(visit(), "09:00"), "active");
    assert.equal(appointmentStatus(visit(), "15:00"), "overdue");
  });

  it("never marks Anytime items overdue during the day", () => {
    assert.equal(appointmentStatus(visit({ anytime: true, start: "", end: "" }), "23:00"), "remaining");
  });

  it("treats a start with no end as active from the start", () => {
    assert.equal(appointmentStatus(visit({ end: "" }), "10:00"), "active");
  });
});

describe("visit value", () => {
  it("splits a job across its visits so a day never counts it twice", () => {
    assert.equal(visitShare(189950, 1), 189950);
    assert.equal(visitShare(100000, 3), 33333);
    assert.equal(visitShare(5000, 0), 5000);
  });
});

describe("manual time entry", () => {
  const base = { date: "2026-10-29", start: "09:00", end: "", hours: "", minutes: "" };

  it("accepts a start and end time", () => {
    assert.deepEqual(parseManualEntry({ ...base, end: "17:30" }), {
      ok: true,
      date: "2026-10-29",
      start: "09:00",
      minutes: 510,
    });
  });

  it("accepts a duration in hours and minutes", () => {
    const r = parseManualEntry({ ...base, hours: "2", minutes: "15" });
    assert.equal(r.ok, true);
    assert.equal(r.minutes, 135);
  });

  it("rejects bad input", () => {
    assert.equal(parseManualEntry({ ...base, date: "2026-02-30", end: "10:00" }).ok, false);
    assert.equal(parseManualEntry({ ...base, start: "" , end: "10:00" }).ok, false);
    assert.equal(parseManualEntry({ ...base, end: "08:00" }).ok, false);
    assert.equal(parseManualEntry({ ...base }).ok, false);
    assert.equal(parseManualEntry({ ...base, minutes: "75" }).ok, false);
    assert.equal(parseManualEntry({ ...base, hours: "1.5" }).ok, false);
  });
});
