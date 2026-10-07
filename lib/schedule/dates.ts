/** Calendar math on YYYY-MM-DD strings. Monday-first weeks, Europe/London. */

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function isIsoDate(value: string): boolean {
  if (!ISO.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function addMonths(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
  const last = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(d, last);
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(day)}`;
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayMon0(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const utcDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return (utcDay + 6) % 7;
}

export function startOfWeek(iso: string): string {
  return addDays(iso, -weekdayMon0(iso));
}

export function monthGrid(iso: string): string[] {
  const first = startOfMonth(iso);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function weekDays(iso: string): string[] {
  const start = startOfWeek(iso);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function monthLabel(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

export function weekdayShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function dayNum(iso: string): number {
  return Number(iso.slice(8, 10));
}

export function sameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

export function compareIso(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function formatClock12(hhmm: string): string {
  const raw = hhmm.trim();
  if (!raw) return "";
  const match = raw.match(/^(\d{1,2})(?::(\d{2}))?/);
  if (!match) return raw;
  let hour = Number(match[1]);
  const minutes = Number(match[2] || "0");
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return raw;
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  if (!minutes) return `${hour12} ${period}`;
  return `${hour12}:${pad2(minutes)} ${period}`;
}

export function parseClockToInput(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const withMinutes = t.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (withMinutes) {
    let hour = Number(withMinutes[1]);
    const minutes = withMinutes[2];
    const period = withMinutes[3]?.toUpperCase();
    if (period === "PM" && hour < 12) hour += 12;
    if (period === "AM" && hour === 12) hour = 0;
    if (hour < 0 || hour > 23) return "";
    return `${pad2(hour)}:${minutes}`;
  }
  const hourOnly = t.match(/^(\d{1,2})\s*(AM|PM)$/i);
  if (!hourOnly) return "";
  let hour = Number(hourOnly[1]);
  const period = hourOnly[2].toUpperCase();
  if (period === "PM" && hour < 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;
  if (hour < 0 || hour > 23) return "";
  return `${pad2(hour)}:00`;
}

export const BUSINESS_HOURS = Array.from({ length: 13 }, (_, i) => i + 7);
export const HOUR_PX = 56;
export const DAY_START_HOUR = 7;
export const DAY_END_HOUR = 20;
export const SNAP_MINUTES = 15;

export function snapMinutes(total: number, step = SNAP_MINUTES): number {
  return Math.round(total / step) * step;
}

export function blockLayout(start: string, end: string): { top: number; height: number } {
  const startMin = minutesFromClock(start) ?? DAY_START_HOUR * 60;
  const top = ((startMin - DAY_START_HOUR * 60) / 60) * HOUR_PX;
  const height = Math.max(18, (durationMinutes(start, end) / 60) * HOUR_PX);
  return { top: Math.max(0, top), height };
}

export function hourFromOffset(offsetY: number): string {
  const index = Math.min(
    BUSINESS_HOURS.length - 1,
    Math.max(0, Math.floor(offsetY / HOUR_PX)),
  );
  return `${pad2(BUSINESS_HOURS[index])}:00`;
}

export function hourFromStart(start: string): number | null {
  const match = start.trim().match(/^(\d{1,2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return null;
  return hour;
}

export function minutesFromClock(hhmm: string): number | null {
  const match = hhmm.trim().match(/^(\d{1,2})(?::(\d{2}))?/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minutes = Number(match[2] || "0");
  if (!Number.isFinite(hour) || hour < 0 || hour > 23 || minutes < 0 || minutes > 59) return null;
  return hour * 60 + minutes;
}

export function clockFromMinutes(total: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, total));
  const hour = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${pad2(hour)}:${pad2(minutes)}`;
}

export function addMinutesToClock(hhmm: string, minutes: number): string {
  const start = minutesFromClock(hhmm);
  if (start == null) return hhmm;
  return clockFromMinutes(start + minutes);
}

export function durationMinutes(start: string, end: string): number {
  const a = minutesFromClock(start);
  const b = minutesFromClock(end);
  if (a == null) return 60;
  if (b == null || b <= a) return 60;
  return b - a;
}

export function formatDaySlash(iso: string): string {
  if (!isIsoDate(iso)) return iso;
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function prettyDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function describeVisitSlot(input: {
  date: string | null;
  start: string;
  end: string;
  anytime: boolean;
  unscheduled: boolean;
}): string {
  if (input.unscheduled || !input.date) return "unscheduled";
  const day = prettyDay(input.date);
  if (input.anytime || !input.start) return `${day}, anytime`;
  const start = formatClock12(input.start);
  const end = input.end ? formatClock12(input.end) : "";
  return end ? `${day}, ${start} – ${end}` : `${day}, ${start}`;
}
