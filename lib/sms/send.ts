import "server-only";
import { sql } from "@/lib/db";
import type { ActionResult } from "@/lib/funnel/engine";
import { formatPounds } from "@/lib/format";
import { isValidMobile, normalizePhone } from "@/lib/sms/phone";
import type { QuoteSmsDraft } from "@/lib/sms/draft";

export type { QuoteSmsDraft };

export type SmsDeliveryRow = {
  id: string;
  to_phone: string;
  status: string;
  error: string | null;
  sent_at: string;
};

export async function listSmsDeliveries(quoteId: string): Promise<SmsDeliveryRow[]> {
  return sql<SmsDeliveryRow[]>`
    select id, to_phone, status, error, sent_at
    from sms_deliveries
    where quote_id = ${quoteId}
    order by sent_at desc
    limit 20
  `;
}

export async function buildQuoteSmsDraft(
  companyId: string,
  quoteId: string,
): Promise<{ ok: true; draft: QuoteSmsDraft } | { ok: false; message: string }> {
  const quotes = await sql<
    {
      id: string;
      number: string;
      status: string;
      archived_at: string | null;
      total: number;
      company_name: string;
      client_name: string;
      client_phone: string;
    }[]
  >`
    select q.id, q.number, q.status, q.archived_at, q.total,
           co.name as company_name,
           trim(c.first_name || ' ' || c.last_name) as client_name,
           coalesce(c.phone, '') as client_phone
    from quotes q
    join clients c on c.id = q.client_id
    join companies co on co.id = q.company_id
    where q.id = ${quoteId} and q.company_id = ${companyId}
    limit 1
  `;
  const q = quotes[0];
  if (!q) return { ok: false, message: "Quote not found" };
  if (q.archived_at) return { ok: false, message: "Unarchive this quote before sending it." };
  if (q.status === "rejected" || q.status === "expired") {
    return { ok: false, message: "This quote cannot be sent by text." };
  }
  if (q.total <= 0) {
    return { ok: false, message: "Set line item prices before sending." };
  }
  const first = q.client_name.split(" ")[0] || "there";
  const message = [
    `Hi ${first},`,
    `${q.company_name} sent quote ${q.number} for ${formatPounds(q.total / 100)}.`,
    "Reply if you would like to go ahead or have any questions.",
  ].join(" ");
  return {
    ok: true,
    draft: {
      quoteId: q.id,
      number: q.number,
      clientName: q.client_name,
      to: normalizePhone(q.client_phone),
      message,
    },
  };
}

export async function sendComposedQuoteSms(input: {
  quoteId: string;
  to: string;
  message: string;
}): Promise<ActionResult> {
  const to = normalizePhone(input.to);
  const message = input.message.trim();
  if (!isValidMobile(to)) return { ok: false, message: "Enter a valid mobile number." };
  if (!message) return { ok: false, message: "Message is required." };

  const quotes = await sql<
    {
      id: string;
      company_id: string;
      client_id: string;
      number: string;
      status: string;
      archived_at: string | null;
    }[]
  >`
    select q.id, q.company_id, q.client_id, q.number, q.status, q.archived_at
    from quotes q
    where q.id = ${input.quoteId}
    limit 1
  `;
  const q = quotes[0];
  if (!q) return { ok: false, message: "Quote not found" };
  if (q.archived_at) return { ok: false, message: "Unarchive this quote before sending it." };
  if (q.status === "rejected" || q.status === "expired") {
    return { ok: false, message: "This quote cannot be sent by text." };
  }

  const settings = await sql<{ enabled: boolean; from_number: string; account_sid_sealed: string }[]>`
    select enabled, from_number, account_sid_sealed
    from sms_settings
    where company_id = ${q.company_id}
    limit 1
  `;
  const ready = Boolean(settings[0]?.enabled && settings[0].from_number && settings[0].account_sid_sealed);
  const error = ready
    ? "SMS sending is saved, but the text provider is not connected yet."
    : "Text messages aren't configured yet. This shortcut is ready for when SMS is connected.";

  await sql`
    insert into sms_deliveries
      (company_id, quote_id, to_phone, body, status, error)
    values
      (${q.company_id}, ${q.id}, ${to}, ${message}, 'failed', ${error})
  `;
  await sql`
    insert into communications
      (company_id, client_id, quote_id, channel, direction, subject, body, status)
    values
      (${q.company_id}, ${q.client_id}, ${q.id}, 'sms', 'outbound',
       ${`Quote ${q.number}`}, ${message}, 'failed')
  `;
  await sql`
    insert into activity_log (company_id, actor, action, entity, entity_id, summary)
    values (${q.company_id}, 'admin', 'quote.sms_attempted', 'quote', ${q.id},
            ${`Text to ${to} not sent: ${error}`})
  `;
  return { ok: false, id: q.id, message: error };
}
