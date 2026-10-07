"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { changeQuoteStatus, type ActionResult } from "@/lib/funnel/engine";
import { isUuid } from "@/lib/funnel/validation";

type PublicQuote = {
  id: string;
  company_id: string;
  client_id: string;
  number: string;
  status: string;
  archived_at: string | null;
};

async function loadQuote(quoteId: string): Promise<PublicQuote | null> {
  if (!isUuid(quoteId)) return null;
  const rows = await sql<PublicQuote[]>`
    select id, company_id, client_id, number, status, archived_at
    from quotes
    where id = ${quoteId}
    limit 1
  `;
  return rows[0] ?? null;
}

function refresh(quoteId: string) {
  revalidatePath(`/q/${quoteId}`);
  revalidatePath("/cotacoes");
  revalidatePath(`/cotacoes/${quoteId}`);
  revalidatePath("/agenda");
  revalidatePath("/servicos");
}

function canRespond(quote: PublicQuote): ActionResult | null {
  if (quote.archived_at) return { ok: false, message: "This quote is no longer available." };
  if (["rejected", "expired"].includes(quote.status)) {
    return { ok: false, message: "This quote can no longer be updated." };
  }
  return null;
}

export async function approvePublicQuote(quoteId: string): Promise<ActionResult> {
  const quote = await loadQuote(quoteId);
  if (!quote) return { ok: false, message: "Quote not found." };
  const blocked = canRespond(quote);
  if (blocked) return blocked;
  if (quote.status === "approved") return { ok: true, id: quote.id };
  const result = await changeQuoteStatus(sql, quote.id, "approved", "client");
  if (result.ok) refresh(quote.id);
  return result;
}

export async function requestPublicQuoteChanges(
  quoteId: string,
  message: string,
): Promise<ActionResult> {
  const quote = await loadQuote(quoteId);
  if (!quote) return { ok: false, message: "Quote not found." };
  const blocked = canRespond(quote);
  if (blocked) return blocked;
  const body = message.trim();
  if (!body) return { ok: false, message: "Please describe the changes you need." };
  if (quote.status !== "changes_requested") {
    const result = await changeQuoteStatus(sql, quote.id, "changes_requested", "client");
    if (!result.ok) return result;
  }
  await sql`
    insert into communications
      (company_id, client_id, quote_id, channel, direction, subject, body, status, sent_at)
    values
      (${quote.company_id}, ${quote.client_id}, ${quote.id}, 'email', 'inbound',
       ${`Change request for ${quote.number}`}, ${body}, 'logged', now())
  `;
  await sql`
    insert into activity_log (company_id, actor, action, entity, entity_id, summary)
    values (${quote.company_id}, 'client', 'quote.changes_requested', 'quote', ${quote.id},
            ${`Client requested changes on ${quote.number}`})
  `;
  refresh(quote.id);
  return { ok: true, id: quote.id };
}
