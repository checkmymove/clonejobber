"use server";

import { requireAdmin } from "@/lib/auth/session";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { getCompanyId } from "@/lib/company";
import { buildSendDraft } from "@/lib/send/drafts";
import type { SendDraft } from "@/lib/send/types";
import {
  changeInvoiceStatus,
  convertCompletedJobToInvoice,
  isUniqueViolation,
  persistInvoice,
  updateInvoiceDocument,
  type ActionResult,
} from "@/lib/funnel/engine";
import type { InvoiceInput } from "@/lib/funnel/validation";
import {
  closeInvoiceWithoutPayment,
  deleteInvoice,
  markInvoiceBadDebt,
  reopenInvoice,
  voidInvoice,
} from "@/lib/invoices/lifecycle";

export type { ActionResult };

async function saveInvoiceRecord(
  invoiceId: string | undefined,
  input: InvoiceInput,
): Promise<ActionResult> {
  if (invoiceId) return writeInvoice(invoiceId, input);

  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };

  const created = await sql.begin(async (tx) => persistInvoice(tx, companyId, input));
  if (created.ok) {
    revalidatePath("/faturas");
    revalidatePath("/servicos");
    revalidatePath("/clientes");
    if (created.id) revalidatePath(`/faturas/${created.id}`);
  }
  return created;
}

export async function createInvoice(input: InvoiceInput): Promise<ActionResult> {
  const created = await saveInvoiceRecord(undefined, input);
  if (!created.ok || !created.id) return created;
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

async function writeInvoice(invoiceId: string, input: InvoiceInput): Promise<ActionResult> {
  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };

  const saved = await sql.begin(async (tx) =>
    updateInvoiceDocument(tx, companyId, invoiceId, input),
  );
  if (saved.ok) {
    revalidatePath("/faturas");
    revalidatePath(`/faturas/${invoiceId}`);
    revalidatePath("/clientes");
  }
  return saved;
}

export async function updateInvoice(
  invoiceId: string,
  input: InvoiceInput,
): Promise<ActionResult> {
  const saved = await writeInvoice(invoiceId, input);
  if (!saved.ok) return saved;
  redirect(`/faturas/${invoiceId}`);
}

export async function saveInvoiceInPlace(
  invoiceId: string,
  input: InvoiceInput,
): Promise<ActionResult> {
  return writeInvoice(invoiceId, input);
}

/** Save button "Send email & text": saves the invoice, then opens the send dialog. */
export async function saveInvoiceAndPrepareSend(
  invoiceId: string | undefined,
  input: InvoiceInput,
): Promise<ActionResult & { draft?: SendDraft }> {
  const saved = await saveInvoiceRecord(invoiceId, input);
  if (!saved.ok || !saved.id) return saved;
  const prepared = await buildSendDraft("invoice", saved.id);
  if (!prepared.ok) return { ok: false, id: saved.id, message: prepared.message };
  return { ok: true, id: saved.id, draft: prepared.draft };
}

export async function saveInvoiceAndMarkSent(
  invoiceId: string | undefined,
  input: InvoiceInput,
): Promise<ActionResult> {
  const saved = await saveInvoiceRecord(invoiceId, input);
  if (!saved.ok || !saved.id) return saved;
  const marked = await updateInvoiceStatus(saved.id, "sent");
  if (!marked.ok) return { ok: false, id: saved.id, message: marked.message };
  redirect(`/faturas/${saved.id}`);
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
    revalidatePath("/agenda");
  }
  return result;
}

function refreshInvoice(invoiceId: string) {
  revalidatePath("/faturas");
  revalidatePath(`/faturas/${invoiceId}`);
  revalidatePath("/servicos");
  revalidatePath("/pagamentos");
  revalidatePath("/clientes");
  revalidatePath("/agenda");
  revalidatePath("/");
}

async function runLifecycle(
  invoiceId: string,
  run: (tx: typeof sql, companyId: string) => Promise<ActionResult>,
): Promise<ActionResult> {
  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await sql.begin((tx: any) => run(tx, companyId));
  if (result.ok) refreshInvoice(invoiceId);
  return result;
}

export async function closeInvoiceAction(invoiceId: string): Promise<ActionResult> {
  return runLifecycle(invoiceId, (tx, companyId) =>
    closeInvoiceWithoutPayment(tx, companyId, invoiceId),
  );
}

export async function badDebtInvoiceAction(invoiceId: string): Promise<ActionResult> {
  return runLifecycle(invoiceId, (tx, companyId) => markInvoiceBadDebt(tx, companyId, invoiceId));
}

export async function reopenInvoiceAction(invoiceId: string): Promise<ActionResult> {
  return runLifecycle(invoiceId, (tx, companyId) => reopenInvoice(tx, companyId, invoiceId));
}

export async function voidInvoiceAction(invoiceId: string): Promise<ActionResult> {
  return runLifecycle(invoiceId, (tx, companyId) => voidInvoice(tx, companyId, invoiceId));
}

export async function deleteInvoiceAction(invoiceId: string): Promise<ActionResult> {
  const result = await runLifecycle(invoiceId, (tx, companyId) =>
    deleteInvoice(tx, companyId, invoiceId),
  );
  if (!result.ok) return result;
  redirect("/faturas");
}

export async function saveInvoiceNotes(invoiceId: string, notes: string): Promise<ActionResult> {
  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };
  const rows = await sql`
    update invoices set notes = ${notes.trim()}, updated_at = now()
    where id = ${invoiceId} and company_id = ${companyId}
    returning id
  `;
  if (!rows[0]) return { ok: false, message: "Invoice not found" };
  revalidatePath(`/faturas/${invoiceId}`);
  return { ok: true, id: invoiceId };
}
