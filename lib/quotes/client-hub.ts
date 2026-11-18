import "server-only";
import { sql } from "@/lib/db";
import { toDateInput } from "@/lib/format";

export type HubItem = { id: string; number: string; label: string; date: string; status: string; href: string | null };

export type ClientHub = {
  firstName: string;
  requests: HubItem[];
  quotes: HubItem[];
  jobs: HubItem[];
};

const QUOTE_STATUS: Record<string, string> = {
  sent: "Awaiting your response",
  changes_requested: "Changes requested",
  approved: "Approved",
  rejected: "Declined",
  expired: "Expired",
};

/**
 * What the client sees beside their quote: their requests, quotes and jobs with us.
 * Drafts and archived or cancelled items stay hidden.
 */
export async function getClientHub(clientId: string): Promise<ClientHub> {
  const [client, requests, quotes, jobs] = await Promise.all([
    sql<{ first_name: string }[]>`select first_name from clients where id = ${clientId} limit 1`,
    sql<{ id: string; number: string; status: string; at: string | Date }[]>`
      select id, number, status, coalesce(move_date::timestamptz, submitted_at) as at
      from requests where client_id = ${clientId} and status <> 'archived'
      order by submitted_at desc limit 8
    `,
    sql<{ id: string; number: string; title: string; status: string; at: string | Date }[]>`
      select id, number, title, status, coalesce(sent_at, created_at) as at
      from quotes where client_id = ${clientId} and status <> 'draft' and archived_at is null
      order by created_at desc limit 8
    `,
    sql<{ id: string; number: string; title: string; status: string; approved_at: string | null; at: string | Date | null }[]>`
      select j.id, j.number, j.title, j.status, j.approved_at,
             coalesce(j.scheduled_date::timestamptz, j.created_at) as at
      from jobs j where j.client_id = ${clientId} and j.status <> 'cancelled'
      order by j.created_at desc limit 8
    `,
  ]);
  const day = (v: string | Date | null) => toDateInput(v);
  return {
    firstName: client[0]?.first_name?.trim() ?? "",
    requests: requests.map((r) => ({
      id: r.id,
      number: r.number,
      label: "Moving request",
      date: day(r.at),
      status: r.status === "quoted" ? "Quoted" : "Received",
      href: null,
    })),
    quotes: quotes.map((q) => ({
      id: q.id,
      number: q.number,
      label: q.title || "Quote",
      date: day(q.at),
      status: QUOTE_STATUS[q.status] ?? q.status,
      href: `/q/${q.id}`,
    })),
    jobs: jobs.map((j) => ({
      id: j.id,
      number: j.number,
      label: j.title || "Job",
      date: day(j.at),
      status: j.status === "done" ? "Completed" : j.approved_at ? "Approved" : "Awaiting your approval",
      href: `/j/${j.id}`,
    })),
  };
}
