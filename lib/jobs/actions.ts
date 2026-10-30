"use server";

import { requireAdmin } from "@/lib/auth/session";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { syncVisitMembersFromText } from "@/lib/team/sync";
import { getCompanyId } from "@/lib/company";
import {
  changeJobStatus,
  convertApprovedQuoteToJob,
  convertCompletedJobToInvoice,
  isUniqueViolation,
  persistJob,
  updateJobDocument,
  type ActionResult,
} from "@/lib/funnel/engine";
import type { JobInput } from "@/lib/funnel/validation";
import { closeJob, deleteJob, reopenJob, setVisitDone } from "@/lib/jobs/lifecycle";
import { getVisitCompletion, type VisitCompletion } from "@/lib/jobs/queries";
import { getVisitLabour, type JobLabour } from "@/lib/team/queries";
import { buildSendDraft } from "@/lib/send/drafts";
import type { SendDraft } from "@/lib/send/types";

export type { ActionResult };

async function saveJobRecord(
  jobId: string | undefined,
  input: JobInput,
): Promise<ActionResult> {
  if (jobId) return writeJob(jobId, input);

  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };

  try {
    const created = await sql.begin(async (tx) => persistJob(tx, companyId, input));
    if (created.ok && created.id) await syncVisitMembersFromText(created.id);
    if (created.ok) {
      revalidatePath("/servicos");
      revalidatePath("/cotacoes");
      revalidatePath("/clientes");
      revalidatePath("/agenda");
      if (created.id) revalidatePath(`/servicos/${created.id}`);
    }
    return created;
  } catch (error) {
    if (!input.quoteId || !isUniqueViolation(error)) throw error;
    const existing = await sql<{ id: string }[]>`
      select id from jobs where quote_id = ${input.quoteId} limit 1
    `;
    if (!existing[0]) throw error;
    return { ok: true, id: existing[0].id, alreadyExisted: true };
  }
}

export async function createJob(input: JobInput): Promise<ActionResult> {
  const created = await saveJobRecord(undefined, input);
  if (!created.ok || !created.id) return created;
  redirect(`/servicos/${created.id}`);
}

export async function convertQuoteToJob(quoteId: string): Promise<ActionResult> {
  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };

  let jobId: string | undefined;
  try {
    const result = await sql.begin(async (tx) =>
      convertApprovedQuoteToJob(tx, companyId, quoteId),
    );
    if (!result.ok) return result;
    jobId = result.id;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const existing = await sql<{ id: string }[]>`
      select id from jobs where quote_id = ${quoteId} limit 1
    `;
    if (!existing[0]) throw error;
    jobId = existing[0].id;
  }
  if (!jobId) return { ok: false, message: "Job not found" };

  revalidatePath("/servicos");
  revalidatePath("/cotacoes");
  revalidatePath("/clientes");
  revalidatePath("/agenda");
  redirect(`/servicos/${jobId}`);
}

async function writeJob(jobId: string, input: JobInput): Promise<ActionResult> {
  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };

  const saved = await sql.begin(async (tx) => updateJobDocument(tx, companyId, jobId, input));
  if (saved.ok) await syncVisitMembersFromText(jobId);
  if (saved.ok) {
    revalidatePath("/servicos");
    revalidatePath(`/servicos/${jobId}`);
    revalidatePath("/clientes");
    revalidatePath("/agenda");
  }
  return saved;
}

export async function updateJob(jobId: string, input: JobInput): Promise<ActionResult> {
  const saved = await writeJob(jobId, input);
  if (!saved.ok) return saved;
  redirect(`/servicos/${jobId}`);
}

export async function saveJobInPlace(jobId: string, input: JobInput): Promise<ActionResult> {
  return writeJob(jobId, input);
}

export async function saveJobAndConvert(
  jobId: string | undefined,
  input: JobInput,
): Promise<ActionResult> {
  const saved = await saveJobRecord(jobId, input);
  if (!saved.ok || !saved.id) return saved;
  redirect(`/faturas/novo?jobId=${saved.id}`);
}

/** Save button "Send email & text": saves the job, then opens the send dialog. */
export async function saveJobAndPrepareSend(
  jobId: string | undefined,
  input: JobInput,
): Promise<ActionResult & { draft?: SendDraft }> {
  const saved = await saveJobRecord(jobId, input);
  if (!saved.ok || !saved.id) return saved;
  const prepared = await buildSendDraft("job", saved.id);
  if (!prepared.ok) return { ok: false, id: saved.id, message: prepared.message };
  return { ok: true, id: saved.id, draft: prepared.draft };
}

export async function updateJobStatus(
  jobId: string,
  status: "scheduled" | "in_progress" | "done" | "cancelled",
): Promise<ActionResult> {
  await requireAdmin();
  const result = await changeJobStatus(sql, jobId, status);
  if (result.ok) {
    revalidatePath("/servicos");
    revalidatePath(`/servicos/${jobId}`);
    revalidatePath("/");
    revalidatePath("/agenda");
  }
  return result;
}

function refreshJob(jobId: string) {
  revalidatePath("/servicos");
  revalidatePath(`/servicos/${jobId}`);
  revalidatePath("/clientes");
  revalidatePath("/agenda");
  revalidatePath("/");
}

export async function closeJobAction(jobId: string): Promise<ActionResult> {
  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };
  const result = await sql.begin((tx) => closeJob(tx, companyId, jobId));
  if (result.ok) refreshJob(jobId);
  return result;
}

export async function reopenJobAction(jobId: string): Promise<ActionResult> {
  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };
  const result = await sql.begin((tx) => reopenJob(tx, companyId, jobId));
  if (result.ok) refreshJob(jobId);
  return result;
}

export async function deleteJobAction(jobId: string): Promise<ActionResult> {
  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };
  const result = await sql.begin((tx) => deleteJob(tx, companyId, jobId));
  if (!result.ok) return result;
  refreshJob(jobId);
  revalidatePath("/cotacoes");
  redirect("/servicos");
}

export async function setVisitDoneAction(visitId: string, done: boolean): Promise<ActionResult> {
  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };
  const result = await setVisitDone(sql, companyId, visitId, done);
  if (result.ok && result.id) refreshJob(result.id);
  return result;
}

export async function saveJobNotes(jobId: string, notes: string): Promise<ActionResult> {
  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };
  const rows = await sql`
    update jobs set notes = ${notes.trim()}, updated_at = now()
    where id = ${jobId} and company_id = ${companyId}
    returning id
  `;
  if (!rows[0]) return { ok: false, message: "Job not found" };
  revalidatePath(`/servicos/${jobId}`);
  return { ok: true, id: jobId };
}

/** Data for the dialog that opens when a visit's checkbox is ticked. */
export async function getVisitCompletionAction(
  visitId: string,
): Promise<{ ok: boolean; message?: string; visit?: VisitCompletion; labour?: JobLabour }> {
  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };
  const visit = await getVisitCompletion(companyId, visitId);
  if (!visit) return { ok: false, message: "Visit not found." };
  const labour = await getVisitLabour(visitId);
  return { ok: true, visit, labour };
}

class CompletionAborted extends Error {}

/**
 * Ticking a visit done, as one transaction: mark the visit done, clock out anyone
 * still on it, create the job's invoice if asked, and close the job once no visit is
 * left open ("close" closes it now, finishing any other open visits).
 */
export async function completeVisitAction(
  visitId: string,
  mode: "done" | "invoice" | "close",
): Promise<{ ok: boolean; message?: string; jobId?: string; invoiceId?: string; jobClosed?: boolean }> {
  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };

  let outcome: { jobId: string; invoiceId?: string; jobClosed: boolean };
  try {
    outcome = await sql.begin(async (tx) => {
      const done = await setVisitDone(tx, companyId, visitId, true);
      if (!done.ok || !done.id) throw new CompletionAborted(done.message ?? "Visit not found.");
      const jobId = done.id;

      await tx`
        update time_entries set ended_at = now(), updated_at = now()
        where visit_id = ${visitId} and company_id = ${companyId} and ended_at is null
      `;

      let invoiceId: string | undefined;
      if (mode === "invoice") {
        const invoice = await convertCompletedJobToInvoice(tx, companyId, jobId);
        if (!invoice.ok || !invoice.id) {
          const reason = invoice.message ?? Object.values(invoice.errors ?? {})[0] ?? "Could not create the invoice.";
          throw new CompletionAborted(reason);
        }
        invoiceId = invoice.id;
      }

      const open = await tx<{ n: number }[]>`
        select count(*)::int as n from job_visits where job_id = ${jobId} and status = 'scheduled'
      `;
      const jobClosed = mode === "close" || open[0].n === 0;
      if (jobClosed) {
        await tx`
          update time_entries set ended_at = now(), updated_at = now()
          where job_id = ${jobId} and company_id = ${companyId} and ended_at is null
        `;
        const closed = await closeJob(tx, companyId, jobId);
        if (!closed.ok) throw new CompletionAborted(closed.message ?? "Could not close the job.");
      }
      return { jobId, invoiceId, jobClosed };
    });
  } catch (error) {
    if (error instanceof CompletionAborted) return { ok: false, message: error.message };
    throw error;
  }

  refreshJob(outcome.jobId);
  if (outcome.invoiceId) {
    revalidatePath("/faturas");
    revalidatePath(`/faturas/${outcome.invoiceId}`);
  }
  return { ok: true, ...outcome };
}
