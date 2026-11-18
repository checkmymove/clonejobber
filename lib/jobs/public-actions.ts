"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { isUuid } from "@/lib/funnel/validation";

export type PublicJobResult = { ok: boolean; message?: string };

/** The client approves a job from its page (/j/[id]). The office then schedules it. */
export async function approvePublicJob(jobId: string): Promise<PublicJobResult> {
  if (!isUuid(jobId)) return { ok: false, message: "Job not found." };
  const rows = await sql<{ id: string; company_id: string; number: string; status: string; approved_at: string | null }[]>`
    select id, company_id, number, status, (to_jsonb(jobs) ->> 'approved_at') as approved_at
    from jobs where id = ${jobId} limit 1
  `;
  const job = rows[0];
  if (!job || job.status === "cancelled") return { ok: false, message: "This job is no longer available." };
  if (job.approved_at) return { ok: true };
  try {
    await approveJob(job, jobId);
  } catch {
    return { ok: false, message: "We could not record your approval just now. Please try again shortly." };
  }
  revalidatePath(`/j/${jobId}`);
  revalidatePath(`/servicos/${jobId}`);
  revalidatePath("/servicos");
  revalidatePath("/");
  return { ok: true };
}

async function approveJob(job: { company_id: string; number: string }, jobId: string) {
  await sql.begin(async (tx) => {
    await tx`update jobs set approved_at = now(), updated_at = now() where id = ${jobId} and approved_at is null`;
    await tx`update job_visits set confirmed_by_client = true where job_id = ${jobId} and status <> 'cancelled'`;
    await tx`
      insert into activity_log (company_id, actor, action, entity, entity_id, summary)
      values (${job.company_id}, 'client', 'job.approved', 'job', ${jobId}, ${`Client approved job ${job.number}`})
    `;
  });
}
