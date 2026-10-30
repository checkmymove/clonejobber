"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { getCompanyId } from "@/lib/company";
import { sql } from "@/lib/db";
import { parseDuration, parseManualEntry, type ManualEntryInput } from "./time";
import { parseHourlyRate, validateMember, type MemberInput } from "./member";

type Db = any;

export type TeamActionResult = { ok: boolean; message?: string };

function refresh(jobId?: string | null) {
  revalidatePath("/");
  revalidatePath("/agenda");
  revalidatePath("/equipa");
  revalidatePath("/servicos");
  if (jobId) revalidatePath(`/servicos/${jobId}`);
}

async function companyOrFail(): Promise<string | null> {
  await requireAdmin();
  return getCompanyId();
}

async function visitJob(companyId: string, visitId: string): Promise<string | null> {
  const rows = await sql<{ job_id: string }[]>`
    select v.job_id from job_visits v
    join jobs j on j.id = v.job_id
    where v.id = ${visitId} and j.company_id = ${companyId}
    limit 1
  `;
  return rows[0]?.job_id ?? null;
}

async function memberExists(companyId: string, memberId: string): Promise<boolean> {
  const rows = await sql`select 1 from team_members where id = ${memberId} and company_id = ${companyId}`;
  return rows.length > 0;
}

/** Keeps job_visits.assignee (read by Schedule) in step with the assignment table. */
async function syncAssigneeText(tx: Db, visitId: string) {
  await tx`
    update job_visits v
    set assignee = coalesce((
      select string_agg(m.name, ', ' order by m.sort, m.name)
      from job_visit_members vm join team_members m on m.id = vm.member_id
      where vm.visit_id = v.id
    ), '')
    where v.id = ${visitId}
  `;
}

export async function assignVisitMembersAction(
  visitId: string,
  memberIds: string[],
): Promise<TeamActionResult> {
  const companyId = await companyOrFail();
  if (!companyId) return { ok: false, message: "Company not found." };
  const jobId = await visitJob(companyId, visitId);
  if (!jobId) return { ok: false, message: "Visit not found." };
  const ids = [...new Set(memberIds)];
  await sql.begin(async (tx) => {
    const valid = ids.length
      ? await tx<{ id: string }[]>`
          select id from team_members where company_id = ${companyId} and id = any(${ids}::uuid[])
        `
      : [];
    await tx`delete from job_visit_members where visit_id = ${visitId}`;
    for (const m of valid) {
      await tx`insert into job_visit_members (visit_id, member_id) values (${visitId}, ${m.id})`;
    }
    await syncAssigneeText(tx, visitId);
  });
  refresh(jobId);
  return { ok: true };
}

/** Jobber "Clock in" on a visit. Clocking in elsewhere first stops the running clock. */
export async function clockInAction(memberId: string, visitId: string): Promise<TeamActionResult> {
  const companyId = await companyOrFail();
  if (!companyId) return { ok: false, message: "Company not found." };
  const jobId = await visitJob(companyId, visitId);
  if (!jobId) return { ok: false, message: "Visit not found." };
  if (!(await memberExists(companyId, memberId))) return { ok: false, message: "Team member not found." };
  await sql.begin(async (tx) => {
    await tx`
      update time_entries set ended_at = now(), updated_at = now()
      where member_id = ${memberId} and ended_at is null
    `;
    // The rate is kept on the entry so a later raise does not change what was earned.
    await tx`
      insert into time_entries (company_id, member_id, job_id, visit_id, started_at, hourly_rate)
      select ${companyId}, ${memberId}, ${jobId}, ${visitId}, now(), nullif(m.hourly_rate, 0)
      from team_members m where m.id = ${memberId}
    `;
    // Working on a visit means being on it.
    await tx`
      insert into job_visit_members (visit_id, member_id) values (${visitId}, ${memberId})
      on conflict do nothing
    `;
    await syncAssigneeText(tx, visitId);
  });
  refresh(jobId);
  return { ok: true };
}

export async function clockOutAction(memberId: string): Promise<TeamActionResult> {
  const companyId = await companyOrFail();
  if (!companyId) return { ok: false, message: "Company not found." };
  const rows = await sql<{ job_id: string | null }[]>`
    update time_entries set ended_at = now(), updated_at = now()
    where member_id = ${memberId} and company_id = ${companyId} and ended_at is null
    returning job_id
  `;
  if (!rows[0]) return { ok: false, message: "No clock running." };
  refresh(rows[0].job_id);
  return { ok: true };
}

export async function addTimeEntryAction(
  input: ManualEntryInput & { memberId: string; visitId: string | null; jobId: string; notes: string },
): Promise<TeamActionResult> {
  const companyId = await companyOrFail();
  if (!companyId) return { ok: false, message: "Company not found." };
  const parsed = parseManualEntry(input);
  if (!parsed.ok) return parsed;
  if (!(await memberExists(companyId, input.memberId))) return { ok: false, message: "Choose a team member." };
  const job = await sql`select 1 from jobs where id = ${input.jobId} and company_id = ${companyId}`;
  if (!job[0]) return { ok: false, message: "Job not found." };
  if (input.visitId && (await visitJob(companyId, input.visitId)) !== input.jobId) {
    return { ok: false, message: "Visit not found." };
  }
  await sql`
    insert into time_entries (company_id, member_id, job_id, visit_id, started_at, ended_at, notes, hourly_rate)
    select ${companyId}, ${input.memberId}, ${input.jobId}, ${input.visitId},
           s.at, s.at + make_interval(mins => ${parsed.minutes}::int), ${input.notes.trim()},
           (select nullif(m.hourly_rate, 0) from team_members m where m.id = ${input.memberId})
    from (select (${parsed.date}::date + ${parsed.start}::time) at time zone 'Europe/London' as at) s
  `;
  refresh(input.jobId);
  return { ok: true };
}

/**
 * Admin trims a finished entry, e.g. 7h05 → 7h00: the start stays and the end moves.
 * Totals per visit, job and dashboard are derived from start and end, so they follow.
 */
export async function updateTimeEntryDurationAction(
  entryId: string,
  hours: string,
  minutes: string,
): Promise<TeamActionResult> {
  const companyId = await companyOrFail();
  if (!companyId) return { ok: false, message: "Company not found." };
  const parsed = parseDuration(hours, minutes);
  if (!parsed.ok) return parsed;
  const current = await sql<{ ended_at: string | null }[]>`
    select ended_at from time_entries where id = ${entryId} and company_id = ${companyId}
  `;
  if (!current[0]) return { ok: false, message: "Entry not found." };
  if (!current[0].ended_at) return { ok: false, message: "Clock out before editing a running entry." };
  const rows = await sql<{ job_id: string | null }[]>`
    update time_entries
    set ended_at = started_at + make_interval(mins => ${parsed.minutes}::int), updated_at = now()
    where id = ${entryId} and company_id = ${companyId} and ended_at is not null
    returning job_id
  `;
  if (!rows[0]) return { ok: false, message: "Entry not found." };
  refresh(rows[0].job_id);
  return { ok: true };
}

export async function deleteTimeEntryAction(entryId: string): Promise<TeamActionResult> {
  const companyId = await companyOrFail();
  if (!companyId) return { ok: false, message: "Company not found." };
  const rows = await sql<{ job_id: string | null }[]>`
    delete from time_entries where id = ${entryId} and company_id = ${companyId}
    returning job_id
  `;
  if (!rows[0]) return { ok: false, message: "Entry not found." };
  refresh(rows[0].job_id);
  return { ok: true };
}

export async function addTeamMemberAction(name: string, email = ""): Promise<TeamActionResult> {
  const companyId = await companyOrFail();
  if (!companyId) return { ok: false, message: "Company not found." };
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean) return { ok: false, message: "Enter a name." };
  if (clean.length > 80) return { ok: false, message: "Name is too long." };
  const mail = email.trim();
  if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return { ok: false, message: "Enter a valid email address." };
  const rows = await sql`
    insert into team_members (company_id, name, email, sort)
    values (${companyId}, ${clean}, ${mail},
            (select coalesce(max(sort), 0) + 1 from team_members where company_id = ${companyId}))
    on conflict (company_id, name) do update set active = true, updated_at = now()
    returning id
  `;
  if (!rows[0]) return { ok: false, message: "Could not add team member." };
  refresh();
  return { ok: true };
}

export async function renameTeamMemberAction(memberId: string, name: string): Promise<TeamActionResult> {
  const companyId = await companyOrFail();
  if (!companyId) return { ok: false, message: "Company not found." };
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean) return { ok: false, message: "Enter a name." };
  try {
    const visits = await sql.begin(async (tx) => {
      const rows = await tx`
        update team_members set name = ${clean}, updated_at = now()
        where id = ${memberId} and company_id = ${companyId}
        returning id
      `;
      if (!rows[0]) return null;
      const vs = await tx<{ visit_id: string }[]>`
        select visit_id from job_visit_members where member_id = ${memberId}
      `;
      for (const v of vs) await syncAssigneeText(tx, v.visit_id);
      return vs;
    });
    if (!visits) return { ok: false, message: "Team member not found." };
  } catch {
    return { ok: false, message: "Someone on the team already has that name." };
  }
  refresh();
  return { ok: true };
}

/** Deactivating keeps past assignments and timesheets, like Jobber's deactivated users. */
export async function setTeamMemberActiveAction(memberId: string, active: boolean): Promise<TeamActionResult> {
  const companyId = await companyOrFail();
  if (!companyId) return { ok: false, message: "Company not found." };
  await sql.begin(async (tx) => {
    await tx`
      update team_members set active = ${active}, updated_at = now()
      where id = ${memberId} and company_id = ${companyId}
    `;
    if (!active) {
      await tx`
        update time_entries set ended_at = now(), updated_at = now()
        where member_id = ${memberId} and ended_at is null
      `;
    }
  });
  refresh();
  return { ok: true };
}

/** Jobber member page: personal info, working hours and permissions. */
export async function saveTeamMemberAction(
  memberId: string,
  input: MemberInput,
): Promise<TeamActionResult & { errors?: Record<string, string> }> {
  const companyId = await companyOrFail();
  if (!companyId) return { ok: false, message: "Company not found." };
  const errors = validateMember(input);
  if (Object.keys(errors).length) return { ok: false, errors, message: Object.values(errors)[0] };
  const current = await sql<{ role: string }[]>`
    select role from team_members where id = ${memberId} and company_id = ${companyId}
  `;
  if (!current[0]) return { ok: false, message: "Team member not found." };
  // The owner stays the owner; others switch between Admin and User with "Make administrator".
  const role = current[0].role === "owner" ? "owner" : input.admin ? "admin" : "user";
  const name = input.name.trim().replace(/\s+/g, " ");
  const rate = parseHourlyRate(input.hourlyRate);
  const hourlyRate = rate.ok ? rate.rate : 0;
  try {
    await sql.begin(async (tx) => {
      await tx`
        update team_members set
          name = ${name},
          email = ${input.email.trim()},
          phone = ${input.phone.trim()},
          street = ${input.street.trim()},
          city = ${input.city.trim()},
          province = ${input.province.trim()},
          postcode = ${input.postcode.trim().toUpperCase()},
          country = ${input.country.trim()},
          role = ${role},
          permission = ${input.permission},
          working_hours = ${sql.json(input.workingHours)},
          hourly_rate = ${hourlyRate},
          updated_at = now()
        where id = ${memberId} and company_id = ${companyId}
      `;
      const vs = await tx<{ visit_id: string }[]>`select visit_id from job_visit_members where member_id = ${memberId}`;
      for (const v of vs) await syncAssigneeText(tx, v.visit_id);
    });
  } catch {
    return { ok: false, message: "Someone on the team already has that name." };
  }
  refresh();
  revalidatePath(`/equipa/${memberId}`);
  return { ok: true };
}
