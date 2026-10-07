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
