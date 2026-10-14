/** Job "More" actions from Jobber: Close job, Re-open, Delete, and visit completion. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type JobLifecycleResult = { ok: boolean; id?: string; message?: string };

async function log(db: Db, companyId: string, jobId: string, action: string, summary: string) {
  await db`
    insert into activity_log (company_id, actor, action, entity, entity_id, summary)
    values (${companyId}, 'admin', ${action}, 'job', ${jobId}, ${summary})
  `;
}

/** Close job: open visits are marked complete. With "remind me to invoice" and no invoice
 *  the job shows as Requires Invoicing, otherwise it is archived. */
export async function closeJob(db: Db, companyId: string, jobId: string): Promise<JobLifecycleResult> {
  const rows = await db`
    select id, number, status from jobs where id = ${jobId} and company_id = ${companyId} for update
  `;
  if (!rows[0]) return { ok: false, message: "Job not found" };
  if (rows[0].status === "done") return { ok: true, id: jobId };
  await db`
    update jobs set status = 'done', closed_at = now(), updated_at = now() where id = ${jobId}
  `;
  await db`
    update job_visits set status = 'done', completed_at = coalesce(completed_at, now())
    where job_id = ${jobId} and status = 'scheduled'
  `;
  await log(db, companyId, jobId, "job.closed", `Job ${rows[0].number} closed`);
  return { ok: true, id: jobId };
}

export async function reopenJob(db: Db, companyId: string, jobId: string): Promise<JobLifecycleResult> {
  const rows = await db`
    select id, number, status from jobs where id = ${jobId} and company_id = ${companyId} for update
  `;
  if (!rows[0]) return { ok: false, message: "Job not found" };
  if (rows[0].status !== "done" && rows[0].status !== "cancelled") return { ok: true, id: jobId };
  await db`
    update jobs set status = 'scheduled', closed_at = null, updated_at = now() where id = ${jobId}
  `;
  await log(db, companyId, jobId, "job.reopened", `Job ${rows[0].number} re-opened`);
  return { ok: true, id: jobId };
}

export async function deleteJob(db: Db, companyId: string, jobId: string): Promise<JobLifecycleResult> {
  const rows = await db`
    select j.id, j.number,
           (select count(*) from invoices i where i.job_id = j.id)::int as invoices
    from jobs j where j.id = ${jobId} and j.company_id = ${companyId}
  `;
  if (!rows[0]) return { ok: false, message: "Job not found" };
  if (rows[0].invoices > 0) {
    return { ok: false, message: "This job has invoices. Delete or void them first." };
  }
  await db`delete from jobs where id = ${jobId}`;
  await log(db, companyId, jobId, "job.deleted", `Job ${rows[0].number} deleted`);
  return { ok: true, id: jobId };
}

export async function setVisitDone(
  db: Db,
  companyId: string,
  visitId: string,
  done: boolean,
): Promise<JobLifecycleResult> {
  const rows = await db`
    update job_visits v
    set status = ${done ? "done" : "scheduled"},
        completed_at = case when ${done} then now() else null end
    from jobs j
    where v.id = ${visitId} and v.job_id = j.id and j.company_id = ${companyId}
    returning v.job_id
  `;
  if (!rows[0]) return { ok: false, message: "Visit not found" };
  return { ok: true, id: rows[0].job_id };
}
