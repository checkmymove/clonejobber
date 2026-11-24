import "server-only";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";

/** Days a sent quote waits for the client before it is archived (on the next day). */
export const QUOTE_REPLY_DAYS = 5;

/**
 * A quote sent to the client and still awaiting a response 5 days later is archived on
 * the 6th day (London dates): by then the follow-up sequence has run its course.
 * A quote the office unarchived after it was sent is left alone, and so is one that
 * already has a job. Runs from the daily cron and whenever the Quotes list or the
 * Dashboard loads, so it never depends on the cron alone.
 */
export async function archiveStaleQuotes(companySlug?: string): Promise<number> {
  try {
    const rows = await sql<{ id: string }[]>`
      with stale as (
        select q.id, q.company_id, q.number
        from quotes q
        join companies co on co.id = q.company_id
        where (${companySlug ?? null}::text is null or co.slug = ${companySlug ?? null})
          and q.status = 'sent'
          and q.archived_at is null
          and q.sent_at is not null
          and (timezone('Europe/London', now())::date
               - timezone('Europe/London', q.sent_at)::date) > ${QUOTE_REPLY_DAYS}
          and not exists (select 1 from jobs j where j.quote_id = q.id)
          and not exists (
            select 1 from activity_log a
            where a.entity = 'quote' and a.entity_id = q.id
              and a.action = 'quote.unarchived' and a.created_at > q.sent_at
          )
        for update of q skip locked
      ),
      archived as (
        update quotes set archived_at = now(), updated_at = now()
        from stale where quotes.id = stale.id
        returning quotes.id, stale.company_id, stale.number
      )
      insert into activity_log (company_id, actor, action, entity, entity_id, summary)
      select company_id, 'system', 'quote.archived', 'quote', id,
             'Quote ' || number || ' archived: no reply ' || ${QUOTE_REPLY_DAYS}::int || ' days after it was sent'
      from archived
      returning entity_id as id
    `;
    if (rows.length) {
      try {
        revalidatePath("/cotacoes");
      } catch {
        // Called during a render: the page that called it already reads fresh data.
      }
    }
    return rows.length;
  } catch (error) {
    // Never block a page on housekeeping.
    console.error("archiveStaleQuotes failed", error);
    return 0;
  }
}
