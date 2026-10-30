import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  appointmentStatus,
  entryPrice,
  entrySeconds,
  formatClock,
  formatHoursMinutes,
  initials,
  parseDuration,
  parseManualEntry,
  roundDownToHour,
  visitShare,
} from "../.testbuild/team/time.js";
import { DEFAULT_WORKING_HOURS, hoursLabel, normaliseHours, parseHourlyRate, validateMember } from "../.testbuild/team/member.js";

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

describe("labour price and duration edits", () => {
  it("prices an entry from its duration and hourly rate, in pence", () => {
    assert.equal(entryPrice(7 * 3600, 15), 10500);
    assert.equal(entryPrice(7 * 3600 + 5 * 60, 15), 10625);
    assert.equal(entryPrice(20 * 60, 12.5), 417);
    assert.equal(entryPrice(3600, 0), 0);
    assert.equal(entryPrice(0, 20), 0);
    assert.equal(entryPrice(3600, Number.NaN), 0);
  });

  it("rounds a duration down to full hours", () => {
    assert.equal(roundDownToHour(7 * 60 + 5), 7 * 60);
    assert.equal(roundDownToHour(7 * 60), 7 * 60);
    assert.equal(roundDownToHour(59), 59);
  });

  it("accepts an edited duration between 1 minute and 24 hours", () => {
    assert.deepEqual(parseDuration("7", "0"), { ok: true, minutes: 420 });
    assert.deepEqual(parseDuration("", "45"), { ok: true, minutes: 45 });
    assert.equal(parseDuration("0", "0").ok, false);
    assert.equal(parseDuration("24", "1").ok, false);
    assert.equal(parseDuration("2", "60").ok, false);
    assert.equal(parseDuration("1.5", "0").ok, false);
  });

  it("reads an hourly rate in pounds", () => {
    assert.deepEqual(parseHourlyRate(""), { ok: true, rate: 0 });
    assert.deepEqual(parseHourlyRate("£15.50"), { ok: true, rate: 15.5 });
    assert.deepEqual(parseHourlyRate("18"), { ok: true, rate: 18 });
    assert.equal(parseHourlyRate("-1").ok, false);
    assert.equal(parseHourlyRate("12.345").ok, false);
    assert.equal(parseHourlyRate("abc").ok, false);
  });
});

describe("team member (Jobber Manage team)", () => {
  const base = {
    name: "Jailton Bento",
    email: "",
    phone: "",
    street: "",
    city: "",
    province: "",
    postcode: "",
    country: "United Kingdom",
    admin: false,
    permission: "field_crew",
    workingHours: DEFAULT_WORKING_HOURS,
    hourlyRate: "",
  };

  it("accepts a member with only a name", () => {
    assert.deepEqual(validateMember(base), {});
  });

  it("checks email, permission level and working hours", () => {
    const e = validateMember({
      ...base,
      email: "nope",
      permission: "boss",
      workingHours: { ...DEFAULT_WORKING_HOURS, mon: ["19:00", "08:00"] },
    });
    assert.ok(e.email && e.permission && e["hours.mon"]);
  });

  it("lists hours like Jobber", () => {
    assert.equal(hoursLabel(["08:00", "19:00"]), "8:00 AM – 7:00 PM");
    assert.equal(hoursLabel(null), "Unavailable");
  });

  it("fills missing days from the default week", () => {
    const h = normaliseHours({ sun: null, mon: ["09:00", "17:00"] });
    assert.deepEqual(h.mon, ["09:00", "17:00"]);
    assert.deepEqual(h.tue, ["08:00", "19:00"]);
    assert.equal(h.sun, null);
  });
});
