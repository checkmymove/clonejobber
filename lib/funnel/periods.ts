// Business performance periods. Client-safe: the period select imports it.

export type PerformancePeriod = "week" | "month" | "last_month" | "year";

export const PERFORMANCE_PERIODS: { key: PerformancePeriod; label: string; paid: string }[] = [
  { key: "week", label: "This week", paid: "Paid this week" },
  { key: "month", label: "This month", paid: "Paid this month" },
  { key: "last_month", label: "Last month", paid: "Paid last month" },
  { key: "year", label: "This year", paid: "Paid this year" },
];

export function isPerformancePeriod(value: unknown): value is PerformancePeriod {
  return PERFORMANCE_PERIODS.some((p) => p.key === value);
}
