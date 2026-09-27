"use server";

import { requireAdmin } from "@/lib/auth/session";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { getCompanyId } from "@/lib/company";
import {
  changeQuoteStatus,
  persistQuote,
  updateQuoteDocument,
  type ActionResult,
} from "@/lib/funnel/engine";
import type { QuoteInput } from "@/lib/funnel/validation";

export type { ActionResult };

export async function createQuote(input: QuoteInput): Promise<ActionResult> {
  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };

  const created = await sql.begin(async (tx) => persistQuote(tx, companyId, input));
  if (!created.ok) return created;

  revalidatePath("/cotacoes");
  revalidatePath("/solicitacoes");
  revalidatePath("/clientes");
  redirect(`/cotacoes/${created.id}`);
}

export async function updateQuote(quoteId: string, input: QuoteInput): Promise<ActionResult> {
  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };

  const saved = await sql.begin(async (tx) =>
    updateQuoteDocument(tx, companyId, quoteId, input),
  );
  if (!saved.ok) return saved;

  revalidatePath("/cotacoes");
  revalidatePath(`/cotacoes/${quoteId}`);
  revalidatePath("/clientes");
  redirect(`/cotacoes/${quoteId}`);
}

export async function updateQuoteStatus(
  quoteId: string,
  status: "sent" | "approved" | "rejected" | "expired" | "draft",
): Promise<ActionResult> {
  await requireAdmin();
  const result = await changeQuoteStatus(sql, quoteId, status);
  if (result.ok) {
    revalidatePath("/cotacoes");
    revalidatePath(`/cotacoes/${quoteId}`);
  }
  return result;
}
