"use server";

import { requireAdmin } from "@/lib/auth/session";

import { revalidatePath } from "next/cache";
import { getCompanyId } from "@/lib/company";
import { deleteGoogleConnection } from "@/lib/email/google";
import { sendInvoiceEmail, sendQuoteEmail } from "@/lib/email/send";
import type { ActionResult } from "@/lib/funnel/engine";

export async function disconnectGmail(): Promise<ActionResult> {
  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };
  await deleteGoogleConnection(companyId);
  revalidatePath("/configuracoes/email");
  return { ok: true };
}

export async function emailQuote(quoteId: string): Promise<ActionResult> {
  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };
  const result = await sendQuoteEmail(companyId, quoteId);
  if (result.ok) {
    revalidatePath("/cotacoes");
    revalidatePath(`/cotacoes/${quoteId}`);
    revalidatePath("/clientes");
    revalidatePath("/");
  }
  return result;
}

export async function emailInvoice(invoiceId: string): Promise<ActionResult> {
  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };
  const result = await sendInvoiceEmail(companyId, invoiceId);
  if (result.ok) {
    revalidatePath("/faturas");
    revalidatePath(`/faturas/${invoiceId}`);
    revalidatePath("/clientes");
    revalidatePath("/");
  }
  return result;
}
