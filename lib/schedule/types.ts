export type ScheduleKind =
  | "visit"
  | "task"
  | "event"
  | "request"
  | "quote_reminder"
  | "invoice_reminder";

export type ScheduleStatus = "scheduled" | "done" | "cancelled";

export type ScheduleView = "month" | "week" | "day";

export type ScheduleLine = {
  name: string;
  quantity: number;
  total: number;
};

export type ScheduleItem = {
  id: string;
  kind: ScheduleKind;
  title: string;
  date: string | null;
  start: string;
  end: string;
  anytime: boolean;
  unscheduled: boolean;
  status: ScheduleStatus;
  confirmed: boolean;
  assignee: string;
  href: string;
  editHref: string | null;
  clientName: string;
  clientId: string | null;
  clientEmail: string;
  clientPhone: string;
  jobNumber: string | null;
  jobId: string | null;
  quoteId: string | null;
  invoiceId: string | null;
  address: string;
  deliveryAddress: string;
  notes: string;
  detailLabel: string;
  summary: string;
  teamLabel: string;
  lines: ScheduleLine[];
  linesTotal: number;
};

export type ScheduleSettings = {
  hideWeekends: boolean;
  dayOrientation: "vertical" | "horizontal";
};

export type VisitNotifyDraft = {
  visitId: string;
  jobId: string;
  clientName: string;
  toEmail: string;
  toPhone: string;
  subject: string;
  message: string;
  nextLabel: string;
};

export const KIND_META: Record<
  ScheduleKind,
  { label: string; filter: "visits" | "tasks" | "events" | "requests" | "reminders"; color: string; done: string }
> = {
  visit: { label: "Visit", filter: "visits", color: "#3d8c45", done: "#8aa88c" },
  task: { label: "Task", filter: "tasks", color: "#3b6ea8", done: "#8aa0b8" },
  event: { label: "Event", filter: "events", color: "#c4a035", done: "#c4b888" },
  request: { label: "Request", filter: "requests", color: "#b07828", done: "#c4b08a" },
  quote_reminder: { label: "Reminder", filter: "reminders", color: "#9a8b2e", done: "#c4bc90" },
  invoice_reminder: { label: "Reminder", filter: "reminders", color: "#c45c48", done: "#c4a090" },
};

export const TYPE_FILTERS = [
  { id: "visits", label: "Visits" },
  { id: "requests", label: "Requests" },
  { id: "tasks", label: "Tasks" },
  { id: "events", label: "Events" },
  { id: "reminders", label: "Reminders" },
] as const;

export const STATUS_FILTERS = [
  { id: "overdue", label: "Overdue" },
  { id: "completed", label: "Completed" },
  { id: "upcoming", label: "Upcoming" },
  { id: "confirmed", label: "Confirmed" },
] as const;
