/**
 * Jobber job list statuses, derived from the stored job lifecycle, its visits and invoices.
 * jobs.status keeps scheduled / in_progress (open), done (closed) and cancelled.
 */

export type JobListStatus =
  | "late"
  | "today"
  | "unscheduled"
  | "upcoming"
  | "action_required"
  | "requires_invoicing"
  | "archived";

export const JOB_STATUS_META: Record<JobListStatus, { label: string; dot: string; badge: string }> = {
  late: { label: "Late", dot: "bg-rose-500", badge: "bg-rose-50 text-rose-800" },
  today: { label: "Today", dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-800" },
  unscheduled: { label: "Unscheduled", dot: "bg-amber-400", badge: "bg-amber-50 text-amber-900" },
  upcoming: { label: "Upcoming", dot: "bg-sky-500", badge: "bg-sky-50 text-sky-900" },
  action_required: {
    label: "Action Required",
    dot: "bg-amber-400",
    badge: "bg-amber-50 text-amber-900",
  },
  requires_invoicing: {
    label: "Requires Invoicing",
    dot: "bg-amber-400",
    badge: "bg-amber-50 text-amber-900",
  },
  archived: { label: "Archived", dot: "bg-stone-400", badge: "bg-stone-100 text-stone-600" },
};

/** Order of the Overview card and of the default list sort (Jobber sorts by status). */
export const JOB_STATUS_ORDER: JobListStatus[] = [
  "late",
  "requires_invoicing",
  "action_required",
  "unscheduled",
  "today",
  "upcoming",
  "archived",
];

export type JobStatusVisit = {
  date: string | null;
  later: boolean;
  status: string;
};

export function deriveJobStatus(
  job: { status: string; remindInvoice: boolean; invoiceCount: number },
  visits: JobStatusVisit[],
  today: string,
): JobListStatus {
  if (job.status === "cancelled") return "archived";
  if (job.status === "done") {
    return job.remindInvoice && job.invoiceCount === 0 ? "requires_invoicing" : "archived";
  }
  const open = visits.filter((v) => v.status === "scheduled");
  if (open.some((v) => !v.later && v.date && v.date < today)) return "late";
  if (open.some((v) => !v.later && v.date === today)) return "today";
  if (open.some((v) => v.later || !v.date)) return "unscheduled";
  if (open.some((v) => v.date && v.date > today)) return "upcoming";
  return "action_required";
}

/** Next open visit date (YYYY-MM-DD) for the Schedule column, or null. */
export function nextVisitDate(visits: JobStatusVisit[], today: string): string | null {
  const dates = visits
    .filter((v) => v.status === "scheduled" && !v.later && v.date)
    .map((v) => v.date as string)
    .sort();
  return dates.find((d) => d >= today) ?? dates[dates.length - 1] ?? null;
}
