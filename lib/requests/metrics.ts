/**
 * Requests list statuses and the Jobber "New requests" / "Conversion rate" cards.
 * Pure: shared by the Requests page and the Dashboard, and testable.
 *
 * Jobber (observed 24 Nov 2026, `requestKpis`): both cards look at requests received in
 * the past 30 days. "New requests" counts the ones still waiting (status New), and the
 * conversion rate is converted ÷ (new + converted) over the same requests. The arrow
 * compares with the 30 days before.
 */

export type RequestListStatus = "new" | "review" | "converted" | "archived";

export const REQUEST_STATUS_META: Record<RequestListStatus, { label: string; dot: string }> = {
  new: { label: "New", dot: "bg-sky-500" },
  review: { label: "Awaiting review", dot: "bg-amber-400" },
  converted: { label: "Converted", dot: "bg-violet-500" },
  archived: { label: "Archived", dot: "bg-stone-400" },
};

export type RequestLike = {
  status: string;
  has_quote: boolean;
  move_date: string | Date | null;
  submitted_at: string | Date;
};

export function requestListStatus(r: Pick<RequestLike, "status" | "has_quote">): RequestListStatus {
  if (r.status === "archived") return "archived";
  if (r.has_quote || r.status === "quoted") return "converted";
  if (r.status === "review") return "review";
  return "new";
}

function isoDay(value: string | Date | null): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

/** Still waiting for a quote and the moving date has already passed. */
export function isRequestOverdue(r: RequestLike, today: string): boolean {
  const s = requestListStatus(r);
  if (s !== "new" && s !== "review") return false;
  const day = isoDay(r.move_date);
  return Boolean(day && day < today);
}

const DAY_MS = 24 * 60 * 60 * 1000;

export type RequestKpis = {
  newCount: number;
  newTrend: number | null;
  conversionRate: number;
  conversionTrend: number | null;
};

function change(current: number, previous: number): number | null {
  return previous ? ((current - previous) / previous) * 100 : null;
}

export function requestKpis(rows: RequestLike[], now = new Date()): RequestKpis {
  const end = now.getTime();
  const start = end - 30 * DAY_MS;
  const prevStart = end - 60 * DAY_MS;
  const cur = { waiting: 0, converted: 0 };
  const prev = { waiting: 0, converted: 0 };
  for (const r of rows) {
    const t = new Date(r.submitted_at).getTime();
    const bucket = t >= start && t <= end ? cur : t >= prevStart && t < start ? prev : null;
    if (!bucket) continue;
    const s = requestListStatus(r);
    if (s === "converted") bucket.converted += 1;
    else if (s === "new" || s === "review") bucket.waiting += 1;
  }
  const rate = (b: typeof cur) => (b.waiting + b.converted ? (b.converted / (b.waiting + b.converted)) * 100 : 0);
  return {
    newCount: cur.waiting,
    newTrend: change(cur.waiting, prev.waiting),
    conversionRate: rate(cur),
    conversionTrend: prev.waiting + prev.converted ? change(rate(cur), rate(prev)) : null,
  };
}
