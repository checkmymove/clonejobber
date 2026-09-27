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

export type { ActionResult };

export async function createJob(input: JobInput): Promise<ActionResult> {
  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };

  const created = await sql.begin(async (tx) => persistJob(tx, companyId, input));
  if (!created.ok) return created;

  revalidatePath("/servicos");
  revalidatePath("/cotacoes");
  revalidatePath("/clientes");
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
  redirect(`/servicos/${jobId}`);
}

export async function updateJob(jobId: string, input: JobInput): Promise<ActionResult> {
  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };

  const saved = await sql.begin(async (tx) => updateJobDocument(tx, companyId, jobId, input));
  if (!saved.ok) return saved;

  revalidatePath("/servicos");
  revalidatePath(`/servicos/${jobId}`);
  revalidatePath("/clientes");
  redirect(`/servicos/${jobId}`);
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
  }
  return result;
}
