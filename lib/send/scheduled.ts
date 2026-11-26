import "server-only";
import { sql } from "@/lib/db";
import { buildJobRemovalDraft } from "./drafts";
import { deliverEmail, deliverSms } from "./deliver";

/** How long after the packing confirmation the removal confirmation goes out. */
export const REMOVAL_CONFIRMATION_DELAY_HOURS = 24;

export type PendingScheduledSend = { id: string; send_at: string; email_to: string | null; sms_to: string | null };

/**
 * After the packing confirmation of a job: the removal confirmation goes to the same
 * email and phone 24 hours later. Sending the packing confirmation again replaces it.
 */
export async function scheduleRemovalConfirmation(input: {
  jobId: string;
  emailTo: string | null;
  smsTo: string | null;
}): Promise<void> {
  if (!input.emailTo && !input.smsTo) return;
  await sql.begin(async (tx) => {
    await tx`
      update scheduled_sends set status = 'cancelled'
      where job_id = ${input.jobId} and purpose = 'job_removal_confirmation' and status = 'pending'
    `;
    await tx`
      insert into scheduled_sends (company_id, job_id, purpose, send_at, email_to, sms_to)
      select j.company_id, j.id, 'job_removal_confirmation',
             now() + make_interval(hours => ${REMOVAL_CONFIRMATION_DELAY_HOURS}),
             ${input.emailTo}, ${input.smsTo}
      from jobs j where j.id = ${input.jobId}
    `;
  });
}

/** The removal confirmation still waiting to go out for a job, if any (job page notice). */
export async function pendingRemovalConfirmation(jobId: string): Promise<PendingScheduledSend | null> {
  const rows = await sql<(Omit<PendingScheduledSend, "send_at"> & { send_at: Date })[]>`
    select id, send_at, email_to, sms_to from scheduled_sends
    where job_id = ${jobId} and purpose = 'job_removal_confirmation' and status = 'pending'
    order by send_at desc limit 1
  `.catch(() => []);
  const row = rows[0];
  return row ? { ...row, send_at: new Date(row.send_at).toISOString() } : null;
}

/**
 * Sends what is due (Vercel schedule, every 15 minutes). Each row is claimed first
 * (pending → sending), so overlapping runs never send the same message twice.
 */
export async function processScheduledSends(limit = 20): Promise<{ sent: number; failed: number }> {
  const due = await sql<{ id: string; job_id: string; email_to: string | null; sms_to: string | null }[]>`
    update scheduled_sends set status = 'sending'
    where id in (
      select id from scheduled_sends
      where status = 'pending' and send_at <= now()
      order by send_at
      limit ${limit}
      for update skip locked
    )
    returning id, job_id, email_to, sms_to
  `;
  let sent = 0;
  let failed = 0;
  for (const row of due) {
    const finish = async (status: "sent" | "failed" | "cancelled", error: string | null) => {
      await sql`
        update scheduled_sends
        set status = ${status}, error = ${error}, sent_at = ${status === "sent" ? sql`now()` : null}
        where id = ${row.id}
      `;
    };
    try {
      const job = await sql<{ status: string }[]>`select status from jobs where id = ${row.job_id}`;
      if (!job[0] || job[0].status === "cancelled") {
        await finish("cancelled", "Job cancelled or removed.");
        continue;
      }
      const prepared = await buildJobRemovalDraft(row.job_id);
      if (!prepared.ok) {
        await finish("failed", prepared.message);
        failed += 1;
        continue;
      }
      const draft = prepared.draft;
      const email = row.email_to
        ? await deliverEmail(draft, {
            to: row.email_to,
            subject: draft.email.subject,
            message: draft.email.message,
            copyToSender: false,
            attachPdf: true,
          })
        : null;
      // Texts are logged on the client's history until an SMS provider is connected.
      const sms = row.sms_to ? await deliverSms(draft, { to: row.sms_to, message: draft.sms.message }) : null;
      const ok = email ? email.ok : Boolean(sms);
      await finish(ok ? "sent" : "failed", ok ? null : (email?.message ?? sms?.message ?? "Not sent."));
      if (ok) sent += 1;
      else failed += 1;
    } catch (error) {
      await finish("failed", error instanceof Error ? error.message : "Send failed.").catch(() => undefined);
      failed += 1;
    }
  }
  return { sent, failed };
}
