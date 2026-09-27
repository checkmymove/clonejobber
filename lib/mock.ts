/**
 * Mock data for the Etapa 1 dashboard shells.
 * Shapes mirror IMPLEMENTATION_PLAN §6 entities (pence for money, REQ-/Q-/JOB-/INV- numbers).
 * Will be replaced by Supabase queries in Etapa 3 — page components already consume
 * these shapes so the swap is mechanical.
 */

export type FunnelCard = {
  key: string;
  label: string;
  count: number;
  amountPence: number;
  headline: string;
  rows: { label: string; value?: string }[];
  accent: string;
};

export const funnel: FunnelCard[] = [
  {
    key: "requests",
    label: "Requests",
    count: 3,
    amountPence: 0,
    headline: "New",
    rows: [
      { label: "Awaiting review (2)" },
      { label: "Overdue (1)" },
    ],
    accent: "#c07a1a",
  },
  {
    key: "quotes",
    label: "Quotes",
    count: 4,
    amountPence: 184500,
    headline: "Approved",
    rows: [
      { label: "Draft (2)", value: "£1,240" },
      { label: "Sent (3)", value: "£2,180" },
    ],
    accent: "#a4445c",
  },
  {
    key: "jobs",
    label: "Jobs",
    count: 3,
    amountPence: 0,
    headline: "Need action",
    rows: [
      { label: "Scheduled (2)", value: "£1,150" },
      { label: "Unassigned (1)", value: "£520" },
    ],
    accent: "#2f7d3b",
  },
  {
    key: "invoices",
    label: "Invoices",
    count: 2,
    amountPence: 27000,
    headline: "Awaiting payment",
    rows: [
      { label: "Draft (1)" },
      { label: "Overdue (1)", value: "£190" },
    ],
    accent: "#245d8a",
  },
];

export type TodayJob = {
  id: string;
  title: string;
  window: string;
  amountPence: number;
  state: "overdue" | "active" | "upcoming" | "done";
};

export const todayJobs: TodayJob[] = [
  {
    id: "JOB-0042",
    title: "Chaquiras family — Removals",
    window: "14:00 – 18:00",
    amountPence: 19000,
    state: "overdue",
  },
  {
    id: "JOB-0043",
    title: "James Prescott — Removals",
    window: "11:00 – 16:30",
    amountPence: 52000,
    state: "done",
  },
];

export const receivables = {
  totalPence: 27000,
  debtors: 2,
  rows: [
    { name: "Shahima Begum", balancePence: 19000, overduePence: 19000 },
    { name: "Hannah Reddy", balancePence: 8000, overduePence: 8000 },
  ],
};

export type Client = {
  id: string;
  name: string;
  email: string;
  phone: string;
  postcode: string;
  requests: number;
  quotes: number;
  jobs: number;
  invoices: number;
  balancePence: number;
  lastActivity: string;
};

export const clients: Client[] = [
  {
    id: "CLI-0101",
    name: "James Prescott",
    email: "james.prescott@example.co.uk",
    phone: "+44 7700 900101",
    postcode: "E2 8DP",
    requests: 2,
    quotes: 2,
    jobs: 1,
    invoices: 1,
    balancePence: 0,
    lastActivity: "2026-09-14",
  },
  {
    id: "CLI-0102",
    name: "Shahima Begum",
    email: "s.begum@example.co.uk",
    phone: "+44 7700 900102",
    postcode: "N1 4QT",
    requests: 1,
    quotes: 1,
    jobs: 1,
    invoices: 1,
    balancePence: 19000,
    lastActivity: "2026-09-13",
  },
  {
    id: "CLI-0103",
    name: "Hannah Reddy",
    email: "hannah.r@example.co.uk",
    phone: "+44 7700 900103",
    postcode: "SW11 3DG",
    requests: 1,
    quotes: 2,
    jobs: 0,
    invoices: 1,
    balancePence: 8000,
    lastActivity: "2026-09-12",
  },
  {
    id: "CLI-0104",
    name: "Toni Franco-Valencia",
    email: "toni.fv@example.co.uk",
    phone: "+44 7700 900104",
    postcode: "SE15 5DQ",
    requests: 1,
    quotes: 1,
    jobs: 1,
    invoices: 0,
    balancePence: 0,
    lastActivity: "2026-09-11",
  },
];

export type Request = {
  id: string;
  client: string;
  route: string;
  moveDate: string;
  bedrooms: number;
  status: "new" | "review" | "quoted" | "archived";
  overdue?: boolean;
};

export const requests: Request[] = [
  {
    id: "REQ-0121",
    client: "Amelia Hart",
    route: "E2 8DP → N1 4QT",
    moveDate: "2026-09-22",
    bedrooms: 2,
    status: "new",
  },
  {
    id: "REQ-0120",
    client: "Toni Franco-Valencia",
    route: "SE15 5DQ → SW11 3DG",
    moveDate: "2026-09-19",
    bedrooms: 3,
    status: "review",
    overdue: true,
  },
  {
    id: "REQ-0119",
    client: "James Prescott",
    route: "E2 8DP → E9 6LH",
    moveDate: "2026-09-14",
    bedrooms: 1,
    status: "quoted",
  },
  {
    id: "REQ-0118",
    client: "Priya Nair",
    route: "W4 2ED → TW9 1AB",
    moveDate: "2026-09-08",
    bedrooms: 2,
    status: "archived",
  },
];

export const requestStatusLabel: Record<Request["status"], string> = {
  new: "New",
  review: "Awaiting review",
  quoted: "Quoted",
  archived: "Closed / archived",
};

export type Quote = {
  id: string;
  client: string;
  source: string;
  totalPence: number;
  validUntil: string;
  status: "draft" | "sent" | "approved" | "rejected" | "expired";
};

export const quotes: Quote[] = [
  {
    id: "Q-0081",
    client: "Amelia Hart",
    source: "REQ-0121",
    totalPence: 124000,
    validUntil: "2026-09-26",
    status: "draft",
  },
  {
    id: "Q-0080",
    client: "Toni Franco-Valencia",
    source: "REQ-0120",
    totalPence: 94000,
    validUntil: "2026-09-21",
    status: "sent",
  },
  {
    id: "Q-0079",
    client: "Hannah Reddy",
    source: "Direct",
    totalPence: 61500,
    validUntil: "2026-09-20",
    status: "approved",
  },
  {
    id: "Q-0078",
    client: "Priya Nair",
    source: "REQ-0118",
    totalPence: 48000,
    validUntil: "2026-09-05",
    status: "expired",
  },
  {
    id: "Q-0077",
    client: "Daniel Osei",
    source: "Direct",
    totalPence: 73000,
    validUntil: "2026-09-10",
    status: "rejected",
  },
];

export const quoteStatusLabel: Record<Quote["status"], string> = {
  draft: "Draft",
  sent: "Sent",
  approved: "Approved",
  rejected: "Declined",
  expired: "Expired",
};

export type Job = {
  id: string;
  client: string;
  date: string;
  window: string;
  address: string;
  status: "scheduled" | "in_progress" | "done" | "cancelled";
  crew: boolean;
};

export const jobs: Job[] = [
  {
    id: "JOB-0043",
    client: "James Prescott",
    date: "2026-09-19",
    window: "11:00 – 16:30",
    address: "E2 8DP → E9 6LH",
    status: "scheduled",
    crew: true,
  },
  {
    id: "JOB-0042",
    client: "Toni Franco-Valencia",
    date: "2026-09-19",
    window: "14:00 – 18:00",
    address: "SE15 5DQ → SW11 3DG",
    status: "in_progress",
    crew: false,
  },
  {
    id: "JOB-0041",
    client: "Shahima Begum",
    date: "2026-09-18",
    window: "09:00 – 13:00",
    address: "N1 4QT → E8 3RH",
    status: "done",
    crew: true,
  },
  {
    id: "JOB-0040",
    client: "Daniel Osei",
    date: "2026-09-17",
    window: "10:00 – 14:00",
    address: "NW5 2PB → N19 5PX",
    status: "cancelled",
    crew: false,
  },
];

export const jobStatusLabel: Record<Job["status"], string> = {
  scheduled: "Scheduled",
  in_progress: "In progress",
  done: "Completed",
  cancelled: "Cancelled",
};

export type Invoice = {
  id: string;
  client: string;
  source: string;
  totalPence: number;
  due: string;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
};

export const invoices: Invoice[] = [
  {
    id: "INV-0031",
    client: "Shahima Begum",
    source: "JOB-0041",
    totalPence: 19000,
    due: "2026-09-12",
    status: "overdue",
  },
  {
    id: "INV-0030",
    client: "Hannah Reddy",
    source: "Direct",
    totalPence: 8000,
    due: "2026-09-25",
    status: "sent",
  },
  {
    id: "INV-0029",
    client: "James Prescott",
    source: "JOB-0039",
    totalPence: 52000,
    due: "2026-09-15",
    status: "paid",
  },
  {
    id: "INV-0028",
    client: "Amelia Hart",
    source: "Q-0075",
    totalPence: 61000,
    due: "2026-09-28",
    status: "draft",
  },
];

export const invoiceStatusLabel: Record<Invoice["status"], string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};
