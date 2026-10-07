import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  addMinutesToClock,
  addMonths,
  describeVisitSlot,
  durationMinutes,
  formatDaySlash,
  formatClock12,
  hourFromOffset,
  isIsoDate,
  minutesFromClock,
  monthGrid,
  parseClockToInput,
  snapMinutes,
  startOfWeek,
  weekdayMon0,
  weekDays,
} from "../.testbuild/schedule/dates.js";
import { buildRescheduleMessage, visitSlotChanged } from "../.testbuild/schedule/notify.js";

describe("schedule dates", () => {
  it("builds a Monday-first month grid", () => {
    const grid = monthGrid("2026-10-07");
    assert.equal(grid[0], "2026-09-28");
    assert.equal(grid[9], "2026-10-07");
    assert.equal(grid.length, 42);
    assert.equal(weekdayMon0("2026-10-07"), 2);
  });

  it("walks weeks and months", () => {
    assert.equal(startOfWeek("2026-10-07"), "2026-10-05");
    assert.deepEqual(weekDays("2026-10-07").slice(0, 3), ["2026-10-05", "2026-10-06", "2026-10-07"]);
    assert.equal(addDays("2026-10-31", 1), "2026-11-01");
    assert.equal(addMonths("2026-10-31", 1), "2026-11-30");
    assert.equal(isIsoDate("2026-02-29"), false);
    assert.equal(isIsoDate("2026-10-07"), true);
  });

  it("formats and parses clocks", () => {
    assert.equal(formatClock12("11:00"), "11 AM");
    assert.equal(formatClock12("15:30"), "3:30 PM");
    assert.equal(parseClockToInput("9 AM"), "09:00");
    assert.equal(parseClockToInput("10:30 AM"), "10:30");
  });

  it("keeps visit duration when shifting a clock", () => {
    assert.equal(minutesFromClock("09:30"), 9 * 60 + 30);
    assert.equal(durationMinutes("09:00", "11:00"), 120);
    assert.equal(addMinutesToClock("09:00", 90), "10:30");
    assert.equal(snapMinutes(67), 60);
    assert.equal(hourFromOffset(56), "08:00");
    assert.equal(formatDaySlash("2026-10-09"), "09/10/2026");
  });

  it("describes visit slots for client messages", () => {
    assert.equal(describeVisitSlot({ date: null, start: "", end: "", anytime: false, unscheduled: true }), "unscheduled");
    assert.match(
      describeVisitSlot({ date: "2026-10-08", start: "09:00", end: "11:00", anytime: false, unscheduled: false }),
      /Thu, 8 Oct 2026, 9 AM – 11 AM/,
    );
  });
});

describe("schedule notify", () => {
  it("builds a reschedule letter when the slot changes", () => {
    const previous = { date: "2026-10-07", start: "09:00", end: "11:00", anytime: false, unscheduled: false };
    const next = { date: "2026-10-08", start: "13:00", end: "15:00", anytime: false, unscheduled: false };
    assert.equal(visitSlotChanged(previous, next), true);
    assert.equal(visitSlotChanged(previous, previous), false);
    const letter = buildRescheduleMessage({
      clientName: "Fabiano Teste",
      companyName: "Moving London Transport",
      jobNumber: "JOB-12",
      previous,
      next,
    });
    assert.match(letter.subject, /rescheduled/i);
    assert.match(letter.message, /Previously:/);
    assert.match(letter.message, /Now:/);
    assert.match(letter.message, /Hi Fabiano/);
  });
});
