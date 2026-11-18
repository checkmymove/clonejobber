"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { isUuid } from "@/lib/funnel/validation";

export type ReferralResult = { ok: boolean; message?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[+\d][\d\s()-]{6,}$/;

/** "Refer a friend" on the client's quote page: who to contact on their behalf. */
export async function submitReferral(
  quoteId: string,
  input: { name: string; contact: string; note: string },
): Promise<ReferralResult> {
  if (!isUuid(quoteId)) return { ok: false, message: "This page is no longer available." };
  const name = input.name.trim().slice(0, 120);
  const contact = input.contact.trim().slice(0, 160);
  const note = input.note.trim().slice(0, 1000);
  if (!name) return { ok: false, message: "Please add your friend's name." };
  if (!EMAIL.test(contact) && !PHONE.test(contact)) {
    return { ok: false, message: "Please add their email or phone number." };
  }
  const quote = await sql<{ company_id: string; client_id: string; client: string }[]>`
    select q.company_id, q.client_id, trim(c.first_name || ' ' || c.last_name) as client
    from quotes q join clients c on c.id = q.client_id
    where q.id = ${quoteId} and q.status <> 'draft'
    limit 1
  `;
  if (!quote[0]) return { ok: false, message: "This page is no longer available." };
  // A page left open must not flood the office: a few referrals a day per client.
  let recent: { n: number }[];
  try {
    recent = await sql<{ n: number }[]>`
      select count(*)::int as n from referrals
      where client_id = ${quote[0].client_id} and created_at > now() - interval '1 day'
    `;
  } catch {
    // Referrals table not created yet (migration 0027).
    return { ok: false, message: "Referrals are not available just yet. Please try again later." };
  }
  if ((recent[0]?.n ?? 0) >= 5) {
    return { ok: false, message: "Thanks! You have sent several referrals today. Please try again tomorrow." };
  }
  await sql`
    insert into referrals (company_id, client_id, quote_id, name, contact, note)
    values (${quote[0].company_id}, ${quote[0].client_id}, ${quoteId}, ${name}, ${contact}, ${note})
  `;
  await sql`
    insert into activity_log (company_id, actor, action, entity, entity_id, summary)
    values (${quote[0].company_id}, 'client', 'client.referral', 'client', ${quote[0].client_id},
            ${`${quote[0].client} referred ${name} (${contact})`})
  `;
  revalidatePath(`/clientes/${quote[0].client_id}`);
  return { ok: true };
}
