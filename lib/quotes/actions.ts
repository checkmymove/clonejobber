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
import type { QuoteEmailDraft } from "@/lib/email/draft";
import { buildQuoteEmailDraft, sendComposedQuoteEmail } from "@/lib/email/send";
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

export async function prepareQuoteEmail(
  quoteId: string | undefined,
  input: QuoteInput,
): Promise<ActionResult & { draft?: QuoteEmailDraft }> {
  const saved = await writeQuote(quoteId, input);
  if (!saved.ok || !saved.id) return saved;
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, id: saved.id, message: "Company not found." };
  const draft = await buildQuoteEmailDraft(companyId, saved.id);
  if (!draft.ok) return { ok: false, id: saved.id, message: draft.message };
  return { ok: true, id: saved.id, draft: draft.draft };
}

export async function sendPreparedQuoteEmail(input: {
  quoteId: string;
  to: string;
  subject: string;
  message: string;
  copyToSender: boolean;
}): Promise<ActionResult> {
  await requireAdmin();
  const sent = await sendComposedQuoteEmail(input);
  if (sent.ok) {
    revalidatePath("/cotacoes");
    revalidatePath(`/cotacoes/${input.quoteId}`);
    revalidatePath("/clientes");
    redirect(`/cotacoes/${input.quoteId}`);
  }
  return sent;
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
