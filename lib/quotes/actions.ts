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
  archiveQuote as archiveQuoteRecord,
  deleteQuote as deleteQuoteRecord,
  type ActionResult,
} from "@/lib/funnel/engine";
import { buildSendDraft } from "@/lib/send/drafts";
import type { SendDraft } from "@/lib/send/types";
import { isUuid, type QuoteInput } from "@/lib/funnel/validation";
import { getServiceForQuote } from "@/lib/products/queries";
import { getQuotePrefillForClient, getQuotePrefillFromRequest } from "@/lib/quotes/queries";
import type { QuotePrefill } from "@/lib/quotes/types";

export type { ActionResult };

export async function loadQuotePrefill(input: {
  clientId: string;
  requestId?: string;
  serviceId?: string;
}): Promise<QuotePrefill | null> {
  await requireAdmin();
  if (!isUuid(input.clientId)) return null;
  const companyId = await getCompanyId();
  if (!companyId) return null;
  const service =
    input.serviceId && isUuid(input.serviceId)
      ? ((await getServiceForQuote(companyId, input.serviceId)) ?? undefined)
      : undefined;
  if (input.requestId && isUuid(input.requestId)) {
    const pinned = await getQuotePrefillFromRequest(input.requestId, service);
    if (pinned?.clientId === input.clientId) return pinned;
  }
  return getQuotePrefillForClient(input.clientId, companyId, service);
}

async function writeQuote(quoteId: string | undefined, input: QuoteInput): Promise<ActionResult> {
  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };

  const saved = quoteId
    ? await sql.begin(async (tx) => updateQuoteDocument(tx, companyId, quoteId, input))
    : await sql.begin(async (tx) => persistQuote(tx, companyId, input));
  if (saved.ok) {
    revalidatePath("/cotacoes");
    revalidatePath("/solicitacoes");
    revalidatePath("/clientes");
    if (saved.id) revalidatePath(`/cotacoes/${saved.id}`);
  }
  return saved;
}

export async function createQuote(input: QuoteInput): Promise<ActionResult> {
  const created = await writeQuote(undefined, input);
  if (!created.ok || !created.id) return created;
  redirect(`/cotacoes/${created.id}`);
}

export async function updateQuote(quoteId: string, input: QuoteInput): Promise<ActionResult> {
  const saved = await writeQuote(quoteId, input);
  if (!saved.ok) return saved;
  redirect(`/cotacoes/${quoteId}`);
}

export async function saveQuoteInPlace(quoteId: string, input: QuoteInput): Promise<ActionResult> {
  return writeQuote(quoteId, input);
}

/** Save button "Send email & text": saves the quote, then opens the send dialog. */
export async function saveQuoteAndPrepareSend(
  quoteId: string | undefined,
  input: QuoteInput,
): Promise<ActionResult & { draft?: SendDraft }> {
  const saved = await writeQuote(quoteId, input);
  if (!saved.ok || !saved.id) return saved;
  const prepared = await buildSendDraft("quote", saved.id);
  if (!prepared.ok) return { ok: false, id: saved.id, message: prepared.message };
  return { ok: true, id: saved.id, draft: prepared.draft };
}

export async function archiveSavedQuote(quoteId: string, archived = true): Promise<ActionResult> {
  await requireAdmin();
  if (!isUuid(quoteId)) return { ok: false, message: "Quote not found." };
  const result = await archiveQuoteRecord(sql, quoteId, archived);
  if (result.ok) {
    revalidatePath("/cotacoes");
    revalidatePath(`/cotacoes/${quoteId}`);
    revalidatePath("/clientes");
  }
  return result;
}

export async function deleteSavedQuote(quoteId: string): Promise<ActionResult> {
  await requireAdmin();
  if (!isUuid(quoteId)) return { ok: false, message: "Quote not found." };
  const result = await deleteQuoteRecord(sql, quoteId);
  if (result.ok) {
    revalidatePath("/cotacoes");
    revalidatePath("/clientes");
    redirect("/cotacoes");
  }
  return result;
}

export async function saveQuoteAndConvert(
  quoteId: string | undefined,
  input: QuoteInput,
): Promise<ActionResult> {
  const saved = await writeQuote(quoteId, input);
  if (!saved.ok || !saved.id) return saved;
  redirect(`/servicos/novo?quoteId=${saved.id}`);
}

export async function updateQuoteStatus(
  quoteId: string,
  status: "sent" | "approved" | "rejected" | "expired" | "draft" | "changes_requested",
): Promise<ActionResult> {
  await requireAdmin();
  const result = await changeQuoteStatus(sql, quoteId, status);
  if (result.ok) {
    revalidatePath("/cotacoes");
    revalidatePath(`/cotacoes/${quoteId}`);
    revalidatePath("/agenda");
    revalidatePath("/servicos");
  }
  return result;
}
