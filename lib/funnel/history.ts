import "server-only";
import { sql } from "@/lib/db";

export type FunnelStage = "client" | "request" | "quote" | "job" | "invoice" | "payment";

export type FunnelStep = {
  stage: FunnelStage;
  id: string;
  number: string;
  /** ISO timestamp or date the document was created (payments: paid on). */
  at: string;
  href: string;
  detail: string;
};

const HREF: Record<FunnelStage, string> = {
  client: "/clientes",
  request: "/solicitacoes",
  quote: "/cotacoes",
  job: "/servicos",
  invoice: "/faturas",
  payment: "/pagamentos",
};

type Anchor = {
  clientId: string;
  requestId?: string | null;
  quoteId?: string | null;
  jobId?: string | null;
  invoiceId?: string | null;
};

const iso = (v: string | Date) => (v instanceof Date ? v.toISOString() : String(v));
const uniq = (ids: (string | null | undefined)[]) => [...new Set(ids.filter((x): x is string => Boolean(x)))];

/**
 * The document's whole chain, Client → Request → Quote → Job → Invoice → Payment.
 * Starts from whichever document the page shows and follows the links both ways.
 */
export async function getFunnelHistory(anchor: Anchor): Promise<FunnelStep[]> {
  let requestIds = uniq([anchor.requestId]);
  let quoteIds = uniq([anchor.quoteId]);
  let jobIds = uniq([anchor.jobId]);
  let invoiceIds = uniq([anchor.invoiceId]);

  // Walk up to the earliest stage the page knows about.
  if (invoiceIds.length) {
    const rows = await sql<{ job_id: string | null }[]>`select job_id from invoices where id = any(${invoiceIds}::uuid[])`;
    jobIds = uniq([...jobIds, ...rows.map((r) => r.job_id)]);
  }
  if (jobIds.length) {
    const rows = await sql<{ quote_id: string | null; request_id: string | null }[]>`
      select quote_id, request_id from jobs where id = any(${jobIds}::uuid[])`;
    quoteIds = uniq([...quoteIds, ...rows.map((r) => r.quote_id)]);
    requestIds = uniq([...requestIds, ...rows.map((r) => r.request_id)]);
  }
  if (quoteIds.length) {
    const rows = await sql<{ request_id: string | null }[]>`select request_id from quotes where id = any(${quoteIds}::uuid[])`;
    requestIds = uniq([...requestIds, ...rows.map((r) => r.request_id)]);
  }
  // Then down again, so every quote of the request and every job, invoice and payment shows.
  if (requestIds.length) {
    const rows = await sql<{ id: string }[]>`select id from quotes where request_id = any(${requestIds}::uuid[])`;
    quoteIds = uniq([...quoteIds, ...rows.map((r) => r.id)]);
  }
  if (quoteIds.length || requestIds.length) {
    const rows = await sql<{ id: string }[]>`
      select id from jobs
      where quote_id = any(${quoteIds}::uuid[]) or request_id = any(${requestIds}::uuid[])`;
    jobIds = uniq([...jobIds, ...rows.map((r) => r.id)]);
  }
  if (jobIds.length) {
    const rows = await sql<{ id: string }[]>`select id from invoices where job_id = any(${jobIds}::uuid[])`;
    invoiceIds = uniq([...invoiceIds, ...rows.map((r) => r.id)]);
  }

  const [client, requests, quotes, jobs, invoices, payments] = await Promise.all([
    sql<{ id: string; number: number | null; created_at: string; name: string }[]>`
      select id, number, created_at, trim(first_name || ' ' || last_name) as name
      from clients where id = ${anchor.clientId}`,
    requestIds.length
      ? sql<{ id: string; number: string; created_at: string }[]>`
          select id, number, coalesce(submitted_at, created_at) as created_at
          from requests where id = any(${requestIds}::uuid[]) order by 3`
      : [],
    quoteIds.length
      ? sql<{ id: string; number: string; created_at: string; status: string }[]>`
          select id, number, created_at, status from quotes where id = any(${quoteIds}::uuid[]) order by created_at`
      : [],
    jobIds.length
      ? sql<{ id: string; number: string; created_at: string; status: string }[]>`
          select id, number, created_at, status from jobs where id = any(${jobIds}::uuid[]) order by created_at`
      : [],
    invoiceIds.length
      ? sql<{ id: string; number: string; created_at: string; status: string }[]>`
          select id, number, created_at, status from invoices where id = any(${invoiceIds}::uuid[]) order by created_at`
      : [],
    invoiceIds.length || quoteIds.length
      ? sql<{ id: string; kind: string; amount: number; paid_on: string }[]>`
          select distinct p.id, p.kind, p.amount, p.paid_on
          from payments p
          left join payment_allocations a on a.payment_id = p.id
          where a.invoice_id = any(${invoiceIds}::uuid[]) or p.quote_id = any(${quoteIds}::uuid[])
          order by p.paid_on`
      : [],
  ]);

  const steps: FunnelStep[] = [];
  const c = client[0];
  if (c) {
    steps.push({
      stage: "client",
      id: c.id,
      number: c.number ? `#${c.number}` : c.name,
      at: iso(c.created_at),
      href: `${HREF.client}/${c.id}`,
      detail: c.name,
    });
  }
  for (const r of requests) steps.push({ stage: "request", id: r.id, number: r.number, at: iso(r.created_at), href: `${HREF.request}/${r.id}`, detail: "" });
  for (const q of quotes) steps.push({ stage: "quote", id: q.id, number: q.number, at: iso(q.created_at), href: `${HREF.quote}/${q.id}`, detail: q.status });
  for (const j of jobs) steps.push({ stage: "job", id: j.id, number: j.number, at: iso(j.created_at), href: `${HREF.job}/${j.id}`, detail: j.status });
  for (const i of invoices) steps.push({ stage: "invoice", id: i.id, number: i.number, at: iso(i.created_at), href: `${HREF.invoice}/${i.id}`, detail: i.status });
  for (const p of payments) {
    steps.push({
      stage: "payment",
      id: p.id,
      number: `£${(p.amount / 100).toFixed(2)}`,
      at: iso(p.paid_on),
      href: `${HREF.payment}/${p.id}`,
      detail: p.kind === "deposit" ? "deposit" : "payment",
    });
  }
  return steps;
}
