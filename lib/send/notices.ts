import "server-only";
import { sql } from "@/lib/db";
import { formatDateNumericLondon } from "@/lib/format";
import { jobDetailsText } from "@/lib/templates/catalog";
import { baseVars, buildSendDraft, letterFor, sendCompany, visitTeamNames } from "./drafts";
import { deliverEmail, deliverSms } from "./deliver";
import type { SendOutcome } from "./types";

type ApprovedQuote = {
  number: string;
  client_name: string;
  client_title: string | null;
  move_date: string | Date | null;
  move_time: string | null;
  pickup: string | null;
  job_id: string | null;
  job_pickup: string | null;
};

/**
 * Jobber "Quote approval": when the client approves, thank them by email and text with
 * the booking details (date, time, team and collection address). Never blocks the approval.
 */
export async function sendQuoteApprovedNotice(quoteId: string): Promise<SendOutcome> {
  const company = await sendCompany();
  if (!company) return { ok: false, message: "Company not found." };
  const rows = await sql<ApprovedQuote[]>`
    select q.number,
           trim(c.first_name || ' ' || c.last_name) as client_name,
           coalesce(c.title, '') as client_title,
           q.valid_until as move_date, q.move_time,
           nullif(trim(concat_ws(', ', nullif(pl.address, ''), nullif(pl.postcode, ''))), '') as pickup,
           j.id as job_id, nullif(j.pickup_address, '') as job_pickup
    from quotes q
    join clients c on c.id = q.client_id
    left join request_locations pl on pl.request_id = q.request_id and pl.kind = 'pickup'
    left join lateral (
      select id, pickup_address from jobs where quote_id = q.id order by created_at limit 1
    ) j on true
    where q.id = ${quoteId}
    limit 1
  `;
  const q = rows[0];
  if (!q) return { ok: false, message: "Quote not found." };

  // A job made from this quote has the real schedule and team; before that, the quote's move date.
  let date = q.move_date ? formatDateNumericLondon(q.move_date) : "";
  let time = q.move_time?.trim() ?? "";
  let team = "";
  if (q.job_id) {
    const visits = await sql<{ id: string; visit_date: string | Date | null; start_time: string; end_time: string }[]>`
      select id, visit_date, start_time, end_time from job_visits
      where job_id = ${q.job_id} and status <> 'cancelled' and not later and visit_date is not null
      order by visit_date, sort limit 1
    `;
    const v = visits[0];
    if (v) {
      date = formatDateNumericLondon(v.visit_date as string);
      time = v.start_time ? `${v.start_time}${v.end_time ? ` – ${v.end_time}` : ""}` : time;
      team = (await visitTeamNames([v.id])).get(v.id) ?? "";
    }
  }
  const address = q.job_pickup || q.pickup || "";

  const letter = await letterFor(company.id, "quote_approved", {
    ...baseVars(company, { name: q.client_name, title: q.client_title ?? "" }),
    QUOTE_NUMBER: q.number,
    JOB_DATE: date,
    ARRIVAL_WINDOW: time,
    ASSIGNED_TO: team,
    JOB_LOCATION: address,
    JOB_DETAILS: jobDetailsText({ date, time, team: team || "To be confirmed", address }),
  });

  const prepared = await buildSendDraft("quote", quoteId);
  if (!prepared.ok) return { ok: false, message: prepared.message };
  const draft = { ...prepared.draft, card: { heading: "Quote approved", buttonLabel: "View Quote" } };

  const email = draft.email.to
    ? await deliverEmail(draft, {
        to: draft.email.to,
        subject: letter.subject,
        message: letter.message,
        copyToSender: false,
        attachPdf: true,
      }).catch((e) => ({ ok: false, message: e instanceof Error ? e.message : "Email failed" }))
    : undefined;
  const sms =
    draft.sms.to && letter.sms
      ? await deliverSms(draft, { to: draft.sms.to, message: letter.sms }).catch(() => ({ ok: false }))
      : undefined;
  return { ok: Boolean(email?.ok), email, sms };
}
