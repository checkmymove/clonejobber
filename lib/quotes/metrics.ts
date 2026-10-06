/** Quote list metrics for the past 30 days, and the 30 days before that. */

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export const OVERVIEW_STATUSES = [
  { key: "draft", label: "Draft", dot: "bg-stone-400" },
  { key: "awaiting", label: "Awaiting response", dot: "bg-amber-400" },
  { key: "changes", label: "Changes requested", dot: "bg-sky-500" },
  { key: "approved", label: "Approved", dot: "bg-emerald-500" },
] as const;

export type OverviewStatusKey = (typeof OVERVIEW_STATUSES)[number]["key"];

export interface QuoteActivity {
  status: string;
  total: number;
  created_at: string | Date;
  sent_at: string | Date | null;
  converted_at: string | Date | null;
}

export interface QuoteListStatus {
  key: string;
  label: string;
  dot: string;
}

export interface QuoteWindowStats {
  overview: Record<OverviewStatusKey, number>;
  conversionRate: number;
  conversionTrend: number | null;
  sentCount: number;
  sentTrend: number | null;
  sentTotal: number;
  convertedCount: number;
  convertedTrend: number | null;
  convertedTotal: number;
}

export function quoteListStatus(
  status: string,
  convertedAt: string | Date | null,
  archivedAt?: string | Date | null,
): QuoteListStatus {
  if (archivedAt) {
    return { key: "archived", label: "Archived", dot: "bg-stone-400" };
  }
  if (convertedAt) {
    return { key: "converted", label: "Converted", dot: "bg-emerald-600" };
  }
  switch (status) {
    case "draft":
      return { key: "draft", label: "Draft", dot: "bg-stone-400" };
    case "sent":
      return { key: "awaiting", label: "Awaiting response", dot: "bg-amber-400" };
    case "changes_requested":
      return { key: "changes", label: "Changes requested", dot: "bg-sky-500" };
    case "approved":
      return { key: "approved", label: "Approved", dot: "bg-emerald-500" };
    case "rejected":
      return { key: "rejected", label: "Declined", dot: "bg-rose-400" };
    case "expired":
      return { key: "expired", label: "Expired", dot: "bg-stone-300" };
    default:
      return { key: status, label: status, dot: "bg-stone-400" };
  }
}

function stamp(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

/** Percent change versus the previous window. No baseline means no trend. */
export function relativeChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function quoteWindowStats(
  quotes: QuoteActivity[],
  now = new Date(),
): QuoteWindowStats {
  const end = now.getTime();
  const currentStart = end - WINDOW_MS;
  const previousStart = end - WINDOW_MS * 2;
  const inCurrent = (time: number | null) => time != null && time >= currentStart && time <= end;
  const inPrevious = (time: number | null) =>
    time != null && time >= previousStart && time < currentStart;

  const overview: Record<OverviewStatusKey, number> = {
    draft: 0,
    awaiting: 0,
    changes: 0,
    approved: 0,
  };
  let sentCount = 0;
  let sentPrev = 0;
  let sentTotal = 0;
  let convertedCount = 0;
  let convertedPrev = 0;
  let convertedTotal = 0;

  for (const quote of quotes) {
    const display = quoteListStatus(quote.status, quote.converted_at);
    if (
      inCurrent(stamp(quote.created_at)) &&
      (display.key === "draft" ||
        display.key === "awaiting" ||
        display.key === "changes" ||
        display.key === "approved")
    ) {
      overview[display.key] += 1;
    }

    const sent = stamp(quote.sent_at);
    if (inCurrent(sent)) {
      sentCount += 1;
      sentTotal += quote.total;
    } else if (inPrevious(sent)) {
      sentPrev += 1;
    }

    const converted = stamp(quote.converted_at);
    if (inCurrent(converted)) {
      convertedCount += 1;
      convertedTotal += quote.total;
    } else if (inPrevious(converted)) {
      convertedPrev += 1;
    }
  }

  const conversionRate = sentCount === 0 ? 0 : (convertedCount / sentCount) * 100;
  const previousRate = sentPrev === 0 ? 0 : (convertedPrev / sentPrev) * 100;

  return {
    overview,
    conversionRate,
    conversionTrend: relativeChange(conversionRate, previousRate),
    sentCount,
    sentTrend: relativeChange(sentCount, sentPrev),
    sentTotal,
    convertedCount,
    convertedTrend: relativeChange(convertedCount, convertedPrev),
    convertedTotal,
  };
}
