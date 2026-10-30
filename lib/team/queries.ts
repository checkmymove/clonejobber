import "server-only";
import { sql } from "@/lib/db";
import { toDateInput, todayLondonInput } from "@/lib/format";
import { getScheduleBundle } from "@/lib/schedule/queries";
import { KIND_META, type ScheduleKind } from "@/lib/schedule/types";
import { appointmentStatus, entryPrice, entrySeconds, visitShare, type AppointmentStatus } from "./time";
import { normaliseHours, type PermissionPreset, type TeamRole, type WorkingHours } from "./member";

export type TeamMemberDetail = {
  id: string;
  name: string;
  active: boolean;
  role: TeamRole;
  permission: PermissionPreset;
  email: string;
  phone: string;
  street: string;
  city: string;
  province: string;
  postcode: string;
  country: string;
  workingHours: WorkingHours;
  /** Pounds per hour. */
  hourlyRate: number;
  lastActive: string | null;
};

/** Jobber Manage team › member page. "Last active" is the member's latest time entry. */
export async function getTeamMember(companySlug: string, id: string): Promise<TeamMemberDetail | null> {
  const rows = await sql<(Omit<TeamMemberDetail, "workingHours"> & { working_hours: unknown })[]>`
    select m.id, m.name, m.active, m.role, m.permission, m.email, m.phone, m.street, m.city,
           m.province, m.postcode, m.country, m.working_hours, m.hourly_rate::float as "hourlyRate",
           (select max(coalesce(t.ended_at, t.started_at)) from time_entries t where t.member_id = m.id) as "lastActive"
    from team_members m
    join companies co on co.id = m.company_id
    where co.slug = ${companySlug} and m.id = ${id}
    limit 1
  `;
  const r = rows[0];
  if (!r) return null;
  const { working_hours, ...rest } = r;
  return { ...rest, workingHours: normaliseHours(working_hours) };
}

export type TeamMember = {
  id: string;
  name: string;
  active: boolean;
  role?: TeamRole;
  email?: string;
  phone?: string;
};

export async function listTeam(companySlug: string, includeInactive = false): Promise<TeamMember[]> {
  return sql<TeamMember[]>`
    select m.id, m.name, m.active, m.role, m.email, m.phone
    from team_members m
    join companies co on co.id = m.company_id
    where co.slug = ${companySlug}
      and (${includeInactive} or m.active)
    order by m.active desc, m.sort, m.name
  `;
}

export type TimeEntry = {
  id: string;
  member_id: string;
  member_name: string;
  job_id: string | null;
  visit_id: string | null;
  started_at: string;
  ended_at: string | null;
  notes: string;
};

/** A team member on one visit, with the time they logged on it. */
export type AppointmentPerson = {
  id: string;
  name: string;
  seconds: number;
  /** ISO start of their running clock on this visit, if any. */
  runningSince: string | null;
};

export type Appointment = {
  id: string;
  kind: ScheduleKind;
  title: string;
  window: { anytime: boolean; start: string; end: string };
  status: AppointmentStatus;
  value: number;
  href: string;
  jobId: string | null;
  color: string;
  people: AppointmentPerson[];
  seconds: number;
  /** Visits only: time can be logged and people assigned. */
  trackable: boolean;
};

/** Jobber's Employee tab header: time each person logged today, on any job. */
export type EmployeeDay = {
  id: string;
  name: string;
  seconds: number;
  runningSince: string | null;
  runningVisitId: string | null;
  appointments: number;
};

export type TodaysAppointments = {
  today: string;
  now: string;
  appointments: Appointment[];
  employees: EmployeeDay[];
  unassigned: number;
  team: TeamMember[];
  revenue: Record<AppointmentStatus | "total", number>;
};

function londonClock(now: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
}

/**
 * Dashboard "Today's appointments": Jobber's Visit tab (buckets and value) merged
 * with its Employee tab (who is on each visit and how long they worked).
 */
export async function getTodaysAppointments(companySlug: string): Promise<TodaysAppointments> {
  const now = new Date();
  const today = todayLondonInput(now);
  const nowClock = londonClock(now);

  const [bundle, team, todayEntries] = await Promise.all([
    getScheduleBundle(companySlug, today, today),
    listTeam(companySlug),
    sql<TimeEntry[]>`
      select t.id, t.member_id, m.name as member_name, t.job_id, t.visit_id,
             t.started_at, t.ended_at, t.notes
      from time_entries t
      join team_members m on m.id = t.member_id
      join companies co on co.id = t.company_id
      where co.slug = ${companySlug}
        and (
          t.ended_at is null
          or (t.started_at at time zone 'Europe/London')::date = ${today}::date
          or (t.ended_at at time zone 'Europe/London')::date = ${today}::date
        )
    `,
  ]);

  const items = bundle.items.filter(
    (i) => i.date === today && i.status !== "cancelled" && i.kind !== "quote_reminder" && i.kind !== "invoice_reminder",
  );
  const visitIds = items.filter((i) => i.kind === "visit").map((i) => i.id);
  const jobIds = [...new Set(items.map((i) => i.jobId).filter((id): id is string => Boolean(id)))];

  const [members, visitEntries, jobs] = await Promise.all([
    visitIds.length
      ? sql<{ visit_id: string; member_id: string; name: string }[]>`
          select vm.visit_id, m.id as member_id, m.name
          from job_visit_members vm
          join team_members m on m.id = vm.member_id
          where vm.visit_id = any(${visitIds}::uuid[])
          order by m.sort, m.name
        `
      : [],
    visitIds.length
      ? sql<TimeEntry[]>`
          select t.id, t.member_id, m.name as member_name, t.job_id, t.visit_id,
                 t.started_at, t.ended_at, t.notes
          from time_entries t
          join team_members m on m.id = t.member_id
          where t.visit_id = any(${visitIds}::uuid[])
        `
      : [],
    jobIds.length
      ? sql<{ id: string; total: number; visits: number }[]>`
          select j.id, j.total,
                 (select count(*)::int from job_visits v
                  where v.job_id = j.id and v.status <> 'cancelled') as visits
          from jobs j where j.id = any(${jobIds}::uuid[])
        `
      : [],
  ]);

  const jobValue = new Map(jobs.map((j) => [j.id, visitShare(j.total, j.visits)]));

  const appointments: Appointment[] = items.map((item) => {
    const trackable = item.kind === "visit";
    const entries = trackable ? visitEntries.filter((e) => e.visit_id === item.id) : [];
    const people = new Map<string, AppointmentPerson>();
    for (const m of members.filter((m) => m.visit_id === item.id)) {
      people.set(m.member_id, { id: m.member_id, name: m.name, seconds: 0, runningSince: null });
    }
    // Someone who logged time without being assigned still shows on the visit.
    for (const e of entries) {
      const p = people.get(e.member_id) ?? { id: e.member_id, name: e.member_name, seconds: 0, runningSince: null };
      p.seconds += entrySeconds(e.started_at, e.ended_at, now);
      if (!e.ended_at) p.runningSince = new Date(e.started_at).toISOString();
      people.set(e.member_id, p);
    }
    const list = [...people.values()];
    const running = list.some((p) => p.runningSince);
    const done = item.status === "done";
    return {
      id: item.id,
      kind: item.kind,
      title: item.kind === "visit" ? item.title : item.detailLabel || item.title,
      window: { anytime: item.anytime || !item.start, start: item.start, end: item.end },
      status: appointmentStatus(
        { done, anytime: item.anytime || !item.start, start: item.start, end: item.end, running },
        nowClock,
      ),
      value: item.jobId ? jobValue.get(item.jobId) ?? 0 : 0,
      href: item.href,
      jobId: item.jobId,
      color: done ? KIND_META[item.kind].done : KIND_META[item.kind].color,
      people: list,
      seconds: list.reduce((s, p) => s + p.seconds, 0),
      trackable,
    };
  });

  appointments.sort((a, b) => {
    const ak = a.window.anytime ? "" : a.window.start;
    const bk = b.window.anytime ? "" : b.window.start;
    return ak.localeCompare(bk) || a.title.localeCompare(b.title);
  });

  const employees: EmployeeDay[] = team.map((m) => {
    const mine = todayEntries.filter((e) => e.member_id === m.id);
    const running = mine.find((e) => !e.ended_at) ?? null;
    return {
      id: m.id,
      name: m.name,
      seconds: mine.reduce((s, e) => s + entrySeconds(e.started_at, e.ended_at, now), 0),
      runningSince: running ? new Date(running.started_at).toISOString() : null,
      runningVisitId: running?.visit_id ?? null,
      appointments: appointments.filter((a) => a.people.some((p) => p.id === m.id)).length,
    };
  });

  const revenue = { total: 0, overdue: 0, active: 0, remaining: 0, completed: 0 };
  for (const a of appointments) {
    revenue.total += a.value;
    revenue[a.status] += a.value;
  }

  return {
    today,
    now: now.toISOString(),
    appointments,
    employees,
    unassigned: appointments.filter((a) => a.trackable && a.people.length === 0).length,
    team,
    revenue,
  };
}

type LabourEntry = TimeEntry & {
  visit_date: string | null;
  seconds: number;
  /** Pounds per hour the entry is paid at. */
  hourly_rate: number;
  /** Pence. */
  price: number;
};

export type LabourPerson = { id: string; name: string; seconds: number; price: number };

export type JobLabour = {
  entries: LabourEntry[];
  seconds: number;
  /** Pence: what the team earned on these entries. */
  price: number;
  byMember: LabourPerson[];
};

type LabourRow = TimeEntry & { visit_date: string | Date | null; hourly_rate: number };

function summariseLabour(rows: LabourRow[], now: Date): JobLabour {
  const entries = rows.map((r) => {
    const seconds = entrySeconds(r.started_at, r.ended_at, now);
    return {
      ...r,
      visit_date: toDateInput(r.visit_date) || null,
      seconds,
      price: entryPrice(seconds, r.hourly_rate),
    };
  });
  const byMember = new Map<string, LabourPerson>();
  for (const e of entries) {
    const m = byMember.get(e.member_id) ?? { id: e.member_id, name: e.member_name, seconds: 0, price: 0 };
    m.seconds += e.seconds;
    m.price += e.price;
    byMember.set(e.member_id, m);
  }
  return {
    entries,
    seconds: entries.reduce((s, e) => s + e.seconds, 0),
    price: entries.reduce((s, e) => s + e.price, 0),
    byMember: [...byMember.values()].sort((a, b) => b.seconds - a.seconds),
  };
}

/**
 * Jobber job page "Labour": every time entry logged on the job. An entry without a
 * stored rate (logged before the person had one) is paid at their current rate.
 */
export async function getJobLabour(jobId: string): Promise<JobLabour> {
  const rows = await sql<LabourRow[]>`
    select t.id, t.member_id, m.name as member_name, t.job_id, t.visit_id,
           t.started_at, t.ended_at, t.notes, v.visit_date,
           coalesce(t.hourly_rate, m.hourly_rate)::float as hourly_rate
    from time_entries t
    join team_members m on m.id = t.member_id
    left join job_visits v on v.id = t.visit_id
    where t.job_id = ${jobId}
    order by t.started_at desc
  `;
  return summariseLabour(rows, new Date());
}

/** Time logged on one visit, as the complete-visit dialog shows it. */
export async function getVisitLabour(visitId: string): Promise<JobLabour> {
  const rows = await sql<LabourRow[]>`
    select t.id, t.member_id, m.name as member_name, t.job_id, t.visit_id,
           t.started_at, t.ended_at, t.notes, v.visit_date,
           coalesce(t.hourly_rate, m.hourly_rate)::float as hourly_rate
    from time_entries t
    join team_members m on m.id = t.member_id
    left join job_visits v on v.id = t.visit_id
    where t.visit_id = ${visitId}
    order by t.started_at desc
  `;
  return summariseLabour(rows, new Date());
}

/** Assigned people per visit of a job (job page Visits table and assignment picker). */
export async function getVisitMembers(visitIds: string[]): Promise<Map<string, TeamMember[]>> {
  const out = new Map<string, TeamMember[]>();
  if (visitIds.length === 0) return out;
  const rows = await sql<{ visit_id: string; id: string; name: string; active: boolean }[]>`
    select vm.visit_id, m.id, m.name, m.active
    from job_visit_members vm
    join team_members m on m.id = vm.member_id
    where vm.visit_id = any(${visitIds}::uuid[])
    order by m.sort, m.name
  `;
  for (const r of rows) {
    const list = out.get(r.visit_id) ?? [];
    list.push({ id: r.id, name: r.name, active: r.active });
    out.set(r.visit_id, list);
  }
  return out;
}
