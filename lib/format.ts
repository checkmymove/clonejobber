/** Formatting helpers. Single-tenant MVP, en-GB locale, Europe/London timezone. */

export function formatGBP(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: pence % 100 === 0 ? 0 : 2,
  }).format(pence / 100);
}

/** Form totals typed in pounds. Always two decimals, en-GB. */
export function formatPounds(pounds: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(pounds);
}

export function formatDateLondon(iso: string | Date): string {
  const date = iso instanceof Date ? iso : new Date(iso);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/London",
  }).format(date);
}

export function formatDateNumericLondon(iso: string | Date): string {
  const date = iso instanceof Date ? iso : new Date(iso);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(date);
}

/** "2026-10-30" → "Friday 30 October 2026" (a calendar date, shown as London sees it). */
export function formatLongDateLondon(isoDate: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date(`${isoDate.slice(0, 10)}T12:00:00Z`));
}

export function toDateInput(value: string | Date | null | undefined): string {
  if (!value) return "";
  const s = value instanceof Date ? value.toISOString() : String(value);
  return s.slice(0, 10);
}

/** YYYY-MM-DD in Europe/London. Safe to pass from a server page into client state. */
export function todayLondonInput(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function penceToInput(pence: number): string {
  return (pence / 100).toFixed(2);
}

export function formatDateTimeLondon(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(new Date(iso));
}

/**
 * Completes a typed pound amount to two decimals when the field is left:
 * "50" → "50.00", "50.5" → "50.50", "50.75" stays. Anything unparseable is left as typed.
 */
export function padMoney(raw: string): string {
  // "1,250" and "1,250.5" group thousands; a lone "12,5" is a decimal comma.
  let text = raw.trim().replace(/[£\s]/g, "");
  if (!text) return "";
  text = text.includes(".") || /^\d{1,3}(,\d{3})+$/.test(text) ? text.replace(/,/g, "") : text.replace(",", ".");
  const match = text.match(/^(\d*)(?:\.(\d*))?$/);
  if (!match || (!match[1] && !match[2])) return raw;
  const whole = match[1] || "0";
  const decimals = match[2] ?? "";
  if (decimals.length > 2) return text;
  return `${whole}.${decimals.padEnd(2, "0")}`;
}
