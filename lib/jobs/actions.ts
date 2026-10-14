"use server";

import { requireAdmin } from "@/lib/auth/session";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { getCompanyId } from "@/lib/company";
import {
  changeJobStatus,
  convertApprovedQuoteToJob,
  isUniqueViolation,
  persistJob,
  updateJobDocument,
  type ActionResult,
} from "@/lib/funnel/engine";
import type { JobInput } from "@/lib/funnel/validation";
import { closeJob, deleteJob, reopenJob, setVisitDone } from "@/lib/jobs/lifecycle";

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
