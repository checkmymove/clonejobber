// Time tracking and Today's appointments rules (Jobber Timesheets + Home).
// Pure functions so unit tests can import them without a database.
import { isIsoDate, minutesFromClock, pad2 } from "../schedule/dates";

export type AppointmentStatus = "overdue" | "active" | "remaining" | "completed";

export const APPOINTMENT_GROUPS: { key: AppointmentStatus; label: string }[] = [
  { key: "overdue", label: "Overdue" },
  { key: "active", label: "Active" },
  { key: "remaining", label: "Remaining" },
  { key: "completed", label: "Completed" },
];

/** Jobber's employee clock: 00:00:00. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}`;
}

/** Timesheet duration in hours and minutes: "2h 05m", "45m". */
export function formatHoursMinutes(seconds: number): string {
  const minutes = Math.max(0, Math.round(seconds / 60));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${pad2(m)}m` : `${m}m`;
}

/** Seconds logged by one entry; a running entry counts up to `now`. */
export function entrySeconds(startedAt: string | Date, endedAt: string | Date | null, now: Date): number {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : now.getTime();
  return Math.max(0, Math.floor((end - start) / 1000));
}

/**
 * Jobber's appointment buckets for today:
 * completed when marked done; active while someone is clocked in on it or the
 * clock is inside its window; overdue once its end time has passed; else remaining.
 * Anytime items are never overdue during the day.
 */
export function appointmentStatus(
  item: { done: boolean; anytime: boolean; start: string; end: string; running: boolean },
  nowClock: string,
): AppointmentStatus {
  if (item.done) return "completed";
  if (item.running) return "active";
  if (item.anytime) return "remaining";
  const now = minutesFromClock(nowClock);
  const start = minutesFromClock(item.start);
  const end = minutesFromClock(item.end);
  if (now == null || start == null) return "remaining";
  if (end != null && end > start && now >= end) return "overdue";
  if (now >= start && (end == null || end <= start || now < end)) return "active";
  return "remaining";
}

/** Share of a job's value for one of its visits, in pence, so a day never counts a job twice. */
export function visitShare(jobTotal: number, visitCount: number): number {
  return visitCount > 0 ? Math.round(jobTotal / visitCount) : jobTotal;
}

export type ManualEntryInput = {
  date: string;
  start: string;
  end: string;
  hours: string;
  minutes: string;
};

/**
 * Jobber's "Create Timesheet Entry": a start date and time, then either an end
 * time or a duration in hours and minutes. Returns the London wall-clock start
 * and the duration in minutes.
 */
export function parseManualEntry(
  input: ManualEntryInput,
): { ok: true; date: string; start: string; minutes: number } | { ok: false; message: string } {
  if (!isIsoDate(input.date)) return { ok: false, message: "Choose a valid date." };
  const start = minutesFromClock(input.start);
  if (start == null || !/^\d{1,2}:\d{2}$/.test(input.start.trim())) {
    return { ok: false, message: "Enter a start time." };
  }
  const startClock = `${pad2(Math.floor(start / 60))}:${pad2(start % 60)}`;

  if (input.end.trim()) {
    const end = minutesFromClock(input.end);
    if (end == null) return { ok: false, message: "Enter a valid end time." };
    if (end <= start) return { ok: false, message: "End time must be after the start time." };
    return { ok: true, date: input.date, start: startClock, minutes: end - start };
  }

  const h = input.hours.trim() ? Number(input.hours) : 0;
  const m = input.minutes.trim() ? Number(input.minutes) : 0;
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || m < 0 || m > 59 || h > 24) {
    return { ok: false, message: "Enter hours (0–24) and minutes (0–59)." };
  }
  const minutes = h * 60 + m;
  if (minutes === 0) return { ok: false, message: "Enter an end time or a duration." };
  if (minutes > 24 * 60) return { ok: false, message: "An entry can't be longer than 24 hours." };
  return { ok: true, date: input.date, start: startClock, minutes };
}

/** Initials for an avatar: "Fabiano da Silva Ribeiro" → "FR". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter((p) => /^[A-Za-zÀ-ÿ]/.test(p) && p.length > 2);
  const words = parts.length > 0 ? parts : name.trim().split(/\s+/);
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
}
