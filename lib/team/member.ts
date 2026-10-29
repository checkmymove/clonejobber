// Jobber Settings › Manage team › member (observed 29 Oct 2026). Pure: client-safe and testable.

export type TeamRole = "owner" | "admin" | "user";
export type PermissionPreset = "field_crew" | "senior_field_crew" | "crew_lead" | "manager" | "custom";
export type Weekday = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
/** null = unavailable that day; otherwise ["HH:MM", "HH:MM"]. */
export type WorkingHours = Record<Weekday, [string, string] | null>;

export const ROLE_LABEL: Record<TeamRole, string> = { owner: "Owner", admin: "Admin", user: "User" };

export const WEEKDAYS: { key: Weekday; label: string }[] = [
  { key: "sun", label: "Sunday" },
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
];

export const DEFAULT_WORKING_HOURS: WorkingHours = {
  sun: null,
  mon: ["08:00", "19:00"],
  tue: ["08:00", "19:00"],
  wed: ["08:00", "19:00"],
  thu: ["08:00", "19:00"],
  fri: ["08:00", "19:00"],
  sat: ["08:00", "19:00"],
};

/** Jobber's preset permission levels, with its "can do / can't do" lists. */
export const PERMISSION_PRESETS: { key: PermissionPreset; label: string; can: string[]; cannot: string[] }[] = [
  {
    key: "field_crew",
    label: "Field crew",
    can: ["See their own schedule and mark work complete", "Start and stop timers", "Add notes and photos on their jobs"],
    cannot: [
      "See anyone else’s schedule",
      "Change their schedule",
      "Create or edit timesheets manually",
      "See prices or costs",
    ],
  },
  {
    key: "senior_field_crew",
    label: "Senior field crew",
    can: [
      "Everything Field crew can do, plus:",
      "View client files and attachments",
      "See prices",
      "Create and edit clients, quotes, jobs and invoices",
      "Collect payments",
    ],
    cannot: ["Change anyone else’s schedule", "Add or edit everyone’s timesheets", "View reports"],
  },
  {
    key: "crew_lead",
    label: "Crew lead",
    can: [
      "Everything Senior field crew can do, plus:",
      "View and change everyone’s schedule",
      "Add and edit everyone’s timesheets manually",
      "Create and edit jobs",
      "View client communications",
    ],
    cannot: ["Use marketing tools", "View reports"],
  },
  {
    key: "manager",
    label: "Manager",
    can: [
      "Everything Crew lead can do, plus:",
      "View reports",
      "Use marketing tools (if available)",
      "Use sales pipeline (if available)",
    ],
    cannot: ["Add or remove team members", "Change account settings"],
  },
  { key: "custom", label: "Custom", can: ["Permissions set one by one"], cannot: [] },
];

export const PERMISSION_LABEL = Object.fromEntries(PERMISSION_PRESETS.map((p) => [p.key, p.label])) as Record<
  PermissionPreset,
  string
>;

export type MemberInput = {
  name: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  province: string;
  postcode: string;
  country: string;
  admin: boolean;
  permission: PermissionPreset;
  workingHours: WorkingHours;
};

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateMember(input: MemberInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.name.trim()) errors.name = "Full name is required";
  else if (input.name.trim().length > 80) errors.name = "Name is too long";
  if (input.email.trim() && !EMAIL.test(input.email.trim())) errors.email = "Enter a valid email address";
  if (input.phone.trim() && !/^[+\d][\d\s()-]{6,}$/.test(input.phone.trim())) errors.phone = "Enter a valid phone number";
  if (!PERMISSION_PRESETS.some((p) => p.key === input.permission)) errors.permission = "Choose a permission level";
  for (const day of WEEKDAYS) {
    const hours = input.workingHours[day.key];
    if (hours === null) continue;
    if (!Array.isArray(hours) || !CLOCK.test(hours[0]) || !CLOCK.test(hours[1])) {
      errors[`hours.${day.key}`] = `${day.label}: enter start and end times`;
    } else if (hours[1] <= hours[0]) {
      errors[`hours.${day.key}`] = `${day.label}: end must be after start`;
    }
  }
  return errors;
}

/** "8:00 AM – 7:00 PM" or "Unavailable", as Jobber lists working hours. */
export function hoursLabel(hours: [string, string] | null): string {
  if (!hours) return "Unavailable";
  const fmt = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  };
  return `${fmt(hours[0])} – ${fmt(hours[1])}`;
}

export function normaliseHours(raw: unknown): WorkingHours {
  const out = { ...DEFAULT_WORKING_HOURS };
  if (raw && typeof raw === "object") {
    for (const day of WEEKDAYS) {
      const v = (raw as Record<string, unknown>)[day.key];
      out[day.key] = Array.isArray(v) && v.length === 2 ? [String(v[0]), String(v[1])] : v === null ? null : out[day.key];
    }
  }
  return out;
}
