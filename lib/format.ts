/** Formatting helpers. Single-tenant MVP, en-GB locale, Europe/London timezone. */

export function formatGBP(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: pence % 100 === 0 ? 0 : 2,
  }).format(pence / 100);
}

export function formatDateLondon(iso: string | Date): string {
  const date = iso instanceof Date ? iso : new Date(iso);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/London",
  }).format(date);
}

export function toDateInput(value: string | Date | null | undefined): string {
  if (!value) return "";
  const s = value instanceof Date ? value.toISOString() : String(value);
  return s.slice(0, 10);
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
