"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { getCompanyId } from "@/lib/company";
import { sql } from "@/lib/db";
import { sendGmailMessage } from "@/lib/email/gmail";
import { getValidAccessToken } from "@/lib/email/google";
import { plainToEmailHtml } from "@/lib/email/templates";
import { toDateInput } from "@/lib/format";
import { isValidMobile, normalizePhone } from "@/lib/sms/phone";
import {
  addMinutesToClock,
  describeVisitSlot,
  durationMinutes,
  isIsoDate,
} from "./dates";
import { buildRescheduleMessage, visitSlotChanged, type VisitSlot } from "./notify";
import type { ScheduleKind, ScheduleSettings, VisitNotifyDraft } from "./types";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ScheduleActionResult = {
  ok: boolean;
  message?: string;
  notify?: VisitNotifyDraft;
};

type VisitContext = {
  id: string;
  visit_date: string | Date | null;
  start_time: string;
  end_time: string;
  anytime: boolean;
  later: boolean;
  job_id: string;
  job_number: string;
  client_id: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  company_name: string;
};

function refresh() {
  revalidatePath("/agenda");
  revalidatePath("/servicos");
  revalidatePath("/");
}

function validDate(value: string | null): string | null {
  if (!value) return null;
  return isIsoDate(value) ? value : null;
}

function asDay(value: string | Date | null): string | null {
  const key = toDateInput(value);
  return key || null;
}

function slotFromVisit(row: VisitContext, override?: Partial<VisitSlot>): VisitSlot {
  const date = override?.date !== undefined ? override.date : asDay(row.visit_date);
  const unscheduled = override?.unscheduled ?? (row.later || !date);
  return {
    date: unscheduled ? null : date,
    start: override?.start ?? row.start_time,
    end: override?.end ?? row.end_time,
    anytime: override?.anytime ?? row.anytime,
    unscheduled,
  };
}

async function loadVisit(companyId: string, id: string): Promise<VisitContext | null> {
  const rows = await sql<VisitContext[]>`
    select v.id, v.visit_date, v.start_time, v.end_time, v.anytime, v.later,
           j.id as job_id, j.number as job_number,
           c.id as client_id,
           trim(c.first_name || ' ' || c.last_name) as client_name,
           coalesce(c.email, '') as client_email,
           coalesce(nullif(c.phone_mobile, ''), c.phone, '') as client_phone,
           co.name as company_name
    from job_visits v
    join jobs j on j.id = v.job_id
    join clients c on c.id = j.client_id
    join companies co on co.id = j.company_id
    where v.id = ${id} and j.company_id = ${companyId}
    limit 1
  `;
  return rows[0] ?? null;
}

function notifyFrom(previous: VisitContext, next: VisitSlot): VisitNotifyDraft | undefined {
  const prevSlot = slotFromVisit(previous);
  if (!visitSlotChanged(prevSlot, next)) return undefined;
  const toEmail = previous.client_email.trim();
  const toPhone = previous.client_phone.trim();
  if (!toEmail && !toPhone) return undefined;
  const letter = buildRescheduleMessage({
    clientName: previous.client_name,
    companyName: previous.company_name,
    jobNumber: previous.job_number,
    previous: prevSlot,
    next,
  });
  return {
    visitId: previous.id,
    jobId: previous.job_id,
    clientName: previous.client_name,
    toEmail,
    toPhone,
    subject: letter.subject,
    message: letter.message,
    nextLabel: describeVisitSlot(next),
  };
}

function nextTimes(previous: { start_time: string; end_time: string }, start?: string) {
  const startTime = start?.trim() ?? "";
  if (!startTime) {
    return { startTime: previous.start_time, endTime: previous.end_time, timed: false };
  }
  const duration = previous.start_time ? durationMinutes(previous.start_time, previous.end_time) : 60;
  return { startTime, endTime: addMinutesToClock(startTime, duration), timed: true };
}

export async function moveScheduleItem(
  id: string,
  kind: ScheduleKind,
  date: string | null,
  start?: string,
): Promise<ScheduleActionResult> {
  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };
  const nextDate = validDate(date);
  const later = !nextDate;
  const startTime = start?.trim() ?? "";

  let notify: VisitNotifyDraft | undefined;

  if (kind === "visit") {
    const previous = await loadVisit(companyId, id);
    if (!previous) return { ok: false, message: "Visit not found." };
    const times = nextTimes(previous, startTime);
    const anytime = times.timed ? false : later ? false : previous.anytime || previous.start_time === "";
    await sql`
      update job_visits v
      set visit_date = ${nextDate},
          later = ${later},
          anytime = ${anytime},
          start_time = ${times.startTime},
          end_time = ${times.endTime}
      from jobs j
      where v.id = ${id} and v.job_id = j.id and j.company_id = ${companyId}
    `;
    notify = notifyFrom(
      previous,
      slotFromVisit(previous, {
        date: nextDate,
        start: times.startTime,
        end: times.endTime,
        anytime,
        unscheduled: later,
      }),
    );
  } else if (kind === "task") {
    const rows = await sql<{ start_time: string; end_time: string; anytime: boolean }[]>`
      select start_time, end_time, anytime from schedule_tasks
      where id = ${id} and company_id = ${companyId} limit 1
    `;
    const prev = rows[0] ?? { start_time: "", end_time: "", anytime: true };
    const times = nextTimes(prev, startTime);
    const anytime = times.timed ? false : later ? false : prev.anytime;
    await sql`
      update schedule_tasks
      set task_date = ${nextDate}, later = ${later},
          start_time = ${times.startTime},
          end_time = ${times.endTime},
          anytime = ${anytime},
          updated_at = now()
      where id = ${id} and company_id = ${companyId}
    `;
  } else if (kind === "event") {
    const rows = await sql<{ start_time: string; end_time: string; anytime: boolean }[]>`
      select start_time, end_time, anytime from schedule_events
      where id = ${id} and company_id = ${companyId} limit 1
    `;
    const prev = rows[0] ?? { start_time: "", end_time: "", anytime: true };
    const times = nextTimes(prev, startTime);
    const anytime = times.timed ? false : later ? false : prev.anytime;
    await sql`
      update schedule_events
      set event_date = ${nextDate}, later = ${later},
          start_time = ${times.startTime},
          end_time = ${times.endTime},
          anytime = ${anytime},
          updated_at = now()
      where id = ${id} and company_id = ${companyId}
    `;
  } else if (kind === "quote_reminder" || kind === "invoice_reminder") {
    if (!nextDate) return { ok: false, message: "Reminders need a date." };
    await sql`
      update schedule_reminders
      set reminder_date = ${nextDate}, updated_at = now()
      where id = ${id} and company_id = ${companyId}
    `;
  } else if (kind === "request") {
    if (!nextDate) return { ok: false, message: "Assessments need a date." };
    const hour = startTime || "09:00";
    await sql`
      update appointments
      set starts_at = (${nextDate}::date + ${hour}::time) at time zone 'Europe/London'
      where id = ${id} and company_id = ${companyId}
    `;
  }
  refresh();
  return { ok: true, notify };
}

export async function resizeScheduleItem(
  id: string,
  kind: ScheduleKind,
  end: string,
): Promise<ScheduleActionResult> {
  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };
  const endTime = end.trim();
  if (!/^\d{2}:\d{2}$/.test(endTime)) return { ok: false, message: "Invalid end time." };

  let notify: VisitNotifyDraft | undefined;

  if (kind === "visit") {
    const previous = await loadVisit(companyId, id);
    if (!previous) return { ok: false, message: "Visit not found." };
    await sql`
      update job_visits v
      set end_time = ${endTime}, anytime = false
      from jobs j
      where v.id = ${id} and v.job_id = j.id and j.company_id = ${companyId}
    `;
    notify = notifyFrom(
      previous,
      slotFromVisit(previous, { end: endTime, anytime: false }),
    );
  } else if (kind === "task") {
    await sql`
      update schedule_tasks
      set end_time = ${endTime}, anytime = false, updated_at = now()
      where id = ${id} and company_id = ${companyId}
    `;
  } else if (kind === "event") {
    await sql`
      update schedule_events
      set end_time = ${endTime}, anytime = false, updated_at = now()
      where id = ${id} and company_id = ${companyId}
    `;
  } else {
    return { ok: false, message: "This item cannot be resized." };
  }
  refresh();
  return { ok: true, notify };
}

export async function duplicateVisit(id: string): Promise<ScheduleActionResult> {
  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };
  const previous = await loadVisit(companyId, id);
  if (!previous) return { ok: false, message: "Visit not found." };
  await sql`
    insert into job_visits
      (job_id, title, visit_date, start_time, end_time, anytime, later,
       assignee, instructions, status, sort)
    select v.job_id, v.title, v.visit_date, v.start_time, v.end_time, v.anytime, v.later,
           v.assignee, v.instructions, 'scheduled',
           coalesce((select max(sort) from job_visits where job_id = v.job_id), 0) + 1
    from job_visits v
    join jobs j on j.id = v.job_id
    where v.id = ${id} and j.company_id = ${companyId}
  `;
  refresh();
  return { ok: true };
}

export async function completeScheduleItem(
  id: string,
  kind: ScheduleKind,
  done: boolean,
): Promise<ScheduleActionResult> {
  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };
  const status = done ? "done" : "scheduled";

  if (kind === "visit") {
    await sql`
      update job_visits v
      set status = ${status},
          completed_at = case when ${done} then now() else null end
      from jobs j
      where v.id = ${id} and v.job_id = j.id and j.company_id = ${companyId}
    `;
  } else if (kind === "task") {
    await sql`
      update schedule_tasks
      set status = ${status}, updated_at = now()
      where id = ${id} and company_id = ${companyId}
    `;
  } else if (kind === "event") {
    await sql`
      update schedule_events
      set status = ${status}, updated_at = now()
      where id = ${id} and company_id = ${companyId}
    `;
  } else if (kind === "quote_reminder" || kind === "invoice_reminder") {
    await sql`
      update schedule_reminders
      set status = ${status}, updated_at = now()
      where id = ${id} and company_id = ${companyId}
    `;
  } else if (kind === "request") {
    await sql`
      update appointments
      set status = ${status}
      where id = ${id} and company_id = ${companyId}
    `;
  }
  refresh();
  return { ok: true };
}

export async function createScheduleTask(input: {
  title: string;
  date: string;
  start: string;
  end: string;
  anytime: boolean;
  later: boolean;
  assignee: string;
  notes: string;
}): Promise<ScheduleActionResult> {
  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };
  const title = input.title.trim();
  if (!title) return { ok: false, message: "Give this task a title." };
  const date = input.later ? null : validDate(input.date);
  await sql`
    insert into schedule_tasks
      (company_id, title, notes, task_date, start_time, end_time, anytime, later, assignee)
    values
      (${companyId}, ${title}, ${input.notes.trim()}, ${date},
       ${input.anytime || input.later ? "" : input.start},
       ${input.anytime || input.later ? "" : input.end},
       ${input.anytime && !input.later}, ${input.later || !date},
       ${input.assignee.trim()})
  `;
  refresh();
  return { ok: true };
}

export async function createScheduleEvent(input: {
  title: string;
  date: string;
  start: string;
  end: string;
  anytime: boolean;
  later: boolean;
  notes: string;
}): Promise<ScheduleActionResult> {
  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };
  const title = input.title.trim();
  if (!title) return { ok: false, message: "Give this event a title." };
  const date = input.later ? null : validDate(input.date);
  await sql`
    insert into schedule_events
      (company_id, title, notes, event_date, start_time, end_time, anytime, later)
    values
      (${companyId}, ${title}, ${input.notes.trim()}, ${date},
       ${input.anytime || input.later ? "" : input.start},
       ${input.anytime || input.later ? "" : input.end},
       ${input.anytime && !input.later}, ${input.later || !date})
  `;
  refresh();
  return { ok: true };
}

export async function saveScheduleSettings(input: ScheduleSettings): Promise<ScheduleActionResult> {
  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };
  const orientation = input.dayOrientation === "horizontal" ? "horizontal" : "vertical";
  await sql`
    insert into schedule_settings (company_id, hide_weekends, day_orientation, updated_at)
    values (${companyId}, ${Boolean(input.hideWeekends)}, ${orientation}, now())
    on conflict (company_id) do update
      set hide_weekends = excluded.hide_weekends,
          day_orientation = excluded.day_orientation,
          updated_at = now()
  `;
  revalidatePath("/agenda");
  return { ok: true };
}

export async function sendVisitRescheduleEmail(input: {
  visitId: string;
  toEmail: string;
  subject: string;
  message: string;
}): Promise<ScheduleActionResult> {
  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };
  const visit = await loadVisit(companyId, input.visitId);
  if (!visit) return { ok: false, message: "Visit not found." };
  const to = input.toEmail.trim() || visit.client_email.trim();
  if (!EMAIL.test(to)) return { ok: false, message: "Client has no email address." };
  const subject = input.subject.trim() || "Your visit has been rescheduled";
  const message = input.message.trim();
  if (!message) return { ok: false, message: "Write a short message first." };

  const token = await getValidAccessToken(companyId);
  if (!token) return { ok: false, message: "Connect Gmail in Settings before sending." };

  const html = plainToEmailHtml(message);
  try {
    await sendGmailMessage({
      accessToken: token.access_token,
      from: `${visit.company_name} <${token.email}>`,
      to,
      subject,
      html,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : "Gmail send failed";
    await sql`
      insert into communications
        (company_id, client_id, job_id, channel, direction, subject, body, status)
      values
        (${companyId}, ${visit.client_id}, ${visit.job_id}, 'email', 'outbound',
         ${subject}, ${message}, 'failed')
    `;
    await sql`
      insert into activity_log (company_id, actor, action, entity, entity_id, summary)
      values (${companyId}, 'admin', 'visit.email_failed', 'job', ${visit.job_id},
              ${`Reschedule email failed: ${error}`})
    `;
    return { ok: false, message: error };
  }

  await sql`
    insert into communications
      (company_id, client_id, job_id, channel, direction, subject, body, status, sent_at)
    values
      (${companyId}, ${visit.client_id}, ${visit.job_id}, 'email', 'outbound',
       ${subject}, ${message}, 'sent', now())
  `;
  await sql`
    insert into activity_log (company_id, actor, action, entity, entity_id, summary)
    values (${companyId}, 'admin', 'visit.reschedule_emailed', 'job', ${visit.job_id},
            ${`Emailed reschedule to ${to}`})
  `;
  refresh();
  return { ok: true };
}

export async function sendVisitRescheduleSms(input: {
  visitId: string;
  toPhone: string;
  message: string;
}): Promise<ScheduleActionResult> {
  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };
  const visit = await loadVisit(companyId, input.visitId);
  if (!visit) return { ok: false, message: "Visit not found." };
  const to = normalizePhone(input.toPhone.trim() || visit.client_phone);
  if (!isValidMobile(to)) return { ok: false, message: "Client has no mobile number." };
  const message = input.message.trim();
  if (!message) return { ok: false, message: "Write a short message first." };

  const error = "Text messages aren't configured yet. This shortcut is ready for when SMS is connected.";
  await sql`
    insert into communications
      (company_id, client_id, job_id, channel, direction, subject, body, status)
    values
      (${companyId}, ${visit.client_id}, ${visit.job_id}, 'sms', 'outbound',
       ${`Visit ${visit.job_number}`}, ${message}, 'failed')
  `;
  await sql`
    insert into activity_log (company_id, actor, action, entity, entity_id, summary)
    values (${companyId}, 'admin', 'visit.sms_attempted', 'job', ${visit.job_id},
            ${`Text to ${to} not sent: ${error}`})
  `;
  return { ok: false, message: error };
}
