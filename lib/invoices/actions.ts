"use server";

import { requireAdmin } from "@/lib/auth/session";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { getCompanyId } from "@/lib/company";
import {
  changeInvoiceStatus,
  convertCompletedJobToInvoice,
  isUniqueViolation,
  persistInvoice,
  updateInvoiceDocument,
  type ActionResult,
} from "@/lib/funnel/engine";
import type { InvoiceInput } from "@/lib/funnel/validation";

export type { ActionResult };

export async function createInvoice(input: InvoiceInput): Promise<ActionResult> {
  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };

  const created = await sql.begin(async (tx) => persistInvoice(tx, companyId, input));
  if (!created.ok) return created;

  revalidatePath("/faturas");
  revalidatePath("/servicos");
  revalidatePath("/clientes");
  redirect(`/faturas/${created.id}`);
}

export async function convertJobToInvoice(jobId: string): Promise<ActionResult> {
  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };

  let invoiceId: string | undefined;
  try {
    const result = await sql.begin(async (tx) =>
      convertCompletedJobToInvoice(tx, companyId, jobId),
    );
    if (!result.ok) return result;
    invoiceId = result.id;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const existing = await sql<{ id: string }[]>`
      select id from invoices where job_id = ${jobId} limit 1
    `;
    if (!existing[0]) throw error;
    invoiceId = existing[0].id;
  }
  if (!invoiceId) return { ok: false, message: "Invoice not found" };

  revalidatePath("/faturas");
  revalidatePath("/servicos");
  revalidatePath("/clientes");
  redirect(`/faturas/${invoiceId}`);
}

export async function updateInvoice(
  invoiceId: string,
  input: InvoiceInput,
): Promise<ActionResult> {
  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };

  const saved = await sql.begin(async (tx) =>
    updateInvoiceDocument(tx, companyId, invoiceId, input),
  );
  if (!saved.ok) return saved;

  revalidatePath("/faturas");
  revalidatePath(`/faturas/${invoiceId}`);
  revalidatePath("/clientes");
  redirect(`/faturas/${invoiceId}`);
}

export async function updateInvoiceStatus(
  invoiceId: string,
  status: "draft" | "sent" | "paid" | "cancelled",
): Promise<ActionResult> {
  await requireAdmin();
  const result = await changeInvoiceStatus(sql, invoiceId, status);
  if (result.ok) {
    revalidatePath("/faturas");
    revalidatePath(`/faturas/${invoiceId}`);
    revalidatePath("/");
  }
  return result;
}
