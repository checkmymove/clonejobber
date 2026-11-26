import "server-only";
import { sql } from "@/lib/db";

import type { ShellNotification } from "@/lib/notification-types";

export { NOTIFICATIONS_SEEN_COOKIE, type ShellNotification } from "@/lib/notification-types";

type LogRow = {
  id: string;
  action: string;
  actor: string;
  entity: string;
  entity_id: string;
  summary: string;
  created_at: Date;
  number: string | null;
  client: string | null;
  client_id: string | null;
  source_number: string | null;
};

const ACTIONS = [
  "request.submitted",
  "quote.created",
  "quote.status_changed",
  "job.created",
  "job.approved",
  "job.status_changed",
  "invoice.status_changed",
  "client.referral",
];

const HREF: Record<string, string> = {
  request: "/solicitacoes",
  quote: "/cotacoes",
  job: "/servicos",
  invoice: "/faturas",
  client: "/clientes",
};

function fromLog(r: LogRow): ShellNotification | null {
  const client = r.client?.trim() || "a client";
  const n = r.number ?? "";
  const status = r.summary.split("→ ")[1]?.trim() ?? "";
  const base = { id: r.id, detail: r.client?.trim() || "", href: `${HREF[r.entity]}/${r.entity_id}`, at: r.created_at.toISOString() };
  switch (r.action) {
    case "request.submitted":
      return r.actor === "admin"
        ? { ...base, kind: "request", title: `Request ${n} created for ${client}` }
        : { ...base, kind: "request", title: `New request from ${client}` };
    case "quote.created":
      // Only the funnel step: a request turned into a quote.
      return r.source_number ? { ...base, kind: "quote", title: `Request ${r.source_number} converted to quote ${n}` } : null;
    case "quote.status_changed":
      if (status === "sent") return { ...base, kind: "quote", title: `Quote ${n} sent to ${client}` };
      if (status === "approved")
        return {
          ...base,
          kind: "approved",
          title: r.actor === "client" ? `${client} approved quote ${n}` : `Quote ${n} marked approved`,
        };
      if (status === "changes_requested") return { ...base, kind: "changes", title: `${client} requested changes on quote ${n}` };
      if (status === "rejected") return { ...base, kind: "declined", title: `Quote ${n} declined` };
      return null;
    case "job.created":
      return {
        ...base,
        kind: "job",
        title: r.source_number ? `Quote ${r.source_number} converted to job ${n}` : `Job ${n} created for ${client}`,
      };
    case "job.approved":
      return { ...base, kind: "approved", title: `${client} approved job ${n}` };
    case "job.status_changed":
      return status === "done" ? { ...base, kind: "job", title: `Job ${n} completed` } : null;
    case "invoice.status_changed":
      return status === "sent" ? { ...base, kind: "invoice", title: `Invoice ${n} sent to ${client}` } : null;
    case "client.referral":
      return { ...base, kind: "referral", title: r.summary.replace(/\s*\(.*\)$/, "") };
    default:
      return null;
  }
}

function pounds(pence: number) {
  return `£${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** The latest funnel events (last 30 days), newest first. */
export async function getNotifications(companySlug: string, limit = 30): Promise<ShellNotification[]> {
  const [logs, payments] = await Promise.all([
    sql<LogRow[]>`
      select a.id, a.action, a.actor, a.entity, a.entity_id, a.summary, a.created_at,
             coalesce(rq.number, qq.number, jj.number, ii.number) as number,
             nullif(trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), '') as client,
             c.id as client_id,
             coalesce(qr.number, jq.number) as source_number
      from activity_log a
      join companies co on co.id = a.company_id
      left join requests rq on a.entity = 'request' and rq.id = a.entity_id
      left join quotes qq on a.entity = 'quote' and qq.id = a.entity_id
      left join requests qr on qr.id = qq.request_id
      left join jobs jj on a.entity = 'job' and jj.id = a.entity_id
      left join quotes jq on jq.id = jj.quote_id
      left join invoices ii on a.entity = 'invoice' and ii.id = a.entity_id
      left join clients c on c.id = coalesce(rq.client_id, qq.client_id, jj.client_id, ii.client_id,
                                             case when a.entity = 'client' then a.entity_id end)
      where co.slug = ${companySlug}
        and a.action in ${sql(ACTIONS)}
        and a.created_at > now() - interval '30 days'
        and coalesce(rq.id, qq.id, jj.id, ii.id, c.id) is not null
      order by a.created_at desc
      limit ${limit * 2}
    `,
    sql<{ id: string; kind: string; amount: number; created_at: Date; client: string | null; invoice_id: string | null; invoice_number: string | null }[]>`
      select p.id, p.kind, p.amount, p.created_at,
             nullif(trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), '') as client,
             (select pa.invoice_id from payment_allocations pa where pa.payment_id = p.id limit 1) as invoice_id,
             (select i.number from payment_allocations pa join invoices i on i.id = pa.invoice_id
               where pa.payment_id = p.id limit 1) as invoice_number
      from payments p
      join companies co on co.id = p.company_id
      join clients c on c.id = p.client_id
      where co.slug = ${companySlug} and p.kind in ('payment', 'deposit')
        and p.created_at > now() - interval '30 days'
      order by p.created_at desc
      limit ${limit}
    `.catch(() => []),
  ]);

  const items: ShellNotification[] = [];
  for (const row of logs) {
    const item = fromLog(row);
    if (item) items.push(item);
  }
  for (const p of payments) {
    const who = p.client?.trim() || "A client";
    items.push({
      id: `payment-${p.id}`,
      kind: "payment",
      title:
        p.kind === "deposit"
          ? `Deposit of ${pounds(p.amount)} received from ${who}`
          : `Payment of ${pounds(p.amount)} received${p.invoice_number ? ` for invoice ${p.invoice_number}` : ""}`,
      detail: p.client?.trim() || "",
      href: `/pagamentos/${p.id}`,
      at: p.created_at.toISOString(),
    });
  }
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
