"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { getCompanyId } from "@/lib/company";
import { sql } from "@/lib/db";
import { isIsoDate } from "@/lib/schedule/dates";
import { isUuid } from "@/lib/funnel/validation";

export type VisitSaveResult = { ok: boolean; message?: string };

export type VisitSaveInput = {
  /** Existing visit, or null to add one. */
  visitId: string | null;
  date: string;
  start: string;
  end: string;
  memberIds: string[];
};

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Job page Schedule box: date, start and end time and who goes, saved in one step
 * (no trip to Edit Job). Keeps the job's own date/window in step with its first visit.
 */
export async function saveJobVisitAction(jobId: string, input: VisitSaveInput): Promise<VisitSaveResult> {
  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId || !isUuid(jobId)) return { ok: false, message: "Job not found." };
  if (!isIsoDate(input.date)) return { ok: false, message: "Choose a date." };
  const start = input.start.trim();
  const end = input.end.trim();
  if (start && !CLOCK.test(start)) return { ok: false, message: "Start time is not valid." };
  if (end && !CLOCK.test(end)) return { ok: false, message: "End time is not valid." };
  if (start && end && end <= start) return { ok: false, message: "End time must be after the start time." };
  if (input.visitId && !isUuid(input.visitId)) return { ok: false, message: "Visit not found." };
  const anytime = !start;

  const result = await sql.begin(async (tx) => {
    const job = await tx<{ id: string; number: string; approved: boolean }[]>`
      select j.id, j.number,
             (j.approved_at is not null) as approved
      from jobs j
      where j.id = ${jobId} and j.company_id = ${companyId}
      limit 1
    `;
    if (!job[0]) return { ok: false, message: "Job not found." } as VisitSaveResult;

    let visitId = input.visitId;
    if (visitId) {
      const updated = await tx`
        update job_visits set
          visit_date = ${input.date}, start_time = ${start}, end_time = ${anytime ? "" : end},
          anytime = ${anytime}, later = false
        where id = ${visitId} and job_id = ${jobId}
        returning id
      `;
      if (!updated[0]) return { ok: false, message: "Visit not found." } as VisitSaveResult;
    } else {
      const sort = await tx<{ n: number }[]>`select count(*)::int as n from job_visits where job_id = ${jobId}`;
      const created = await tx<{ id: string }[]>`
        insert into job_visits
          (job_id, visit_date, start_time, end_time, anytime, later, confirmed_by_client, sort)
        values
          (${jobId}, ${input.date}, ${start}, ${anytime ? "" : end}, ${anytime}, false,
           ${job[0].approved}, ${sort[0]?.n ?? 0})
        returning id
      `;
      visitId = created[0].id;
    }

    const ids = [...new Set(input.memberIds)].filter(isUuid);
    const valid = ids.length
      ? await tx<{ id: string }[]>`
          select id from team_members where company_id = ${companyId} and id = any(${ids}::uuid[])
        `
      : [];
    await tx`delete from job_visit_members where visit_id = ${visitId}`;
    for (const m of valid) {
      await tx`insert into job_visit_members (visit_id, member_id) values (${visitId}, ${m.id})`;
    }
    await tx`
      update job_visits v
      set assignee = coalesce((
        select string_agg(m.name, ', ' order by m.sort, m.name)
        from job_visit_members vm join team_members m on m.id = vm.member_id
        where vm.visit_id = v.id
      ), '')
      where v.id = ${visitId}
    `;

    // The job's own date and window follow its earliest open visit.
    await tx`
      update jobs j set
        scheduled_date = f.visit_date,
        window_start = case when f.anytime then '' else f.start_time end,
        window_end = case when f.anytime then '' else f.end_time end,
        anytime = f.anytime,
        schedule_later = false,
        updated_at = now()
      from (
        select visit_date, start_time, end_time, anytime from job_visits
        where job_id = ${jobId} and status <> 'cancelled' and visit_date is not null
        order by visit_date, start_time limit 1
      ) f
      where j.id = ${jobId}
    `;
    await tx`
      insert into activity_log (company_id, actor, action, entity, entity_id, summary)
      values (${companyId}, 'admin', 'job.visit_scheduled', 'job', ${jobId},
              ${`Job ${job[0].number} scheduled for ${input.date}${start ? ` at ${start}` : ""}`})
    `;
    return { ok: true } as VisitSaveResult;
  });

  if (result.ok) {
    revalidatePath(`/servicos/${jobId}`);
    revalidatePath("/servicos");
    revalidatePath("/agenda");
    revalidatePath("/");
  }
  return result;
}
