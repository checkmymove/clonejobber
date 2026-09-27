import "server-only";
import { sql } from "@/lib/db";
import type { ParsedLine } from "@/lib/funnel/money";

export interface QuoteRow {
  id: string;
  number: string;
  status: string;
  title: string;
  total: number;
  valid_until: string | null;
  created_at: string;
  client_id: string;
  client_name: string;
  request_number: string | null;
}

export interface QuoteDetail extends QuoteRow {
  request_id: string | null;
  message: string;
  notes: string;
  subtotal: number;
  discount: number;
  tax: number;
  sent_at: string | null;
  pickup: string | null;
  client_email: string;
  lines: ParsedLine[];
}

export async function listQuotes(
  companySlug: string,
  q = "",
): Promise<QuoteRow[]> {
  const like = `%${q.trim()}%`;
  return sql<QuoteRow[]>`
    select q.id, q.number, q.status, q.title, q.total, q.valid_until, q.created_at,
           q.client_id,
           trim(c.first_name || ' ' || c.last_name) as client_name,
           r.number as request_number
    from quotes q
    join companies co on co.id = q.company_id
    join clients c on c.id = q.client_id
    left join requests r on r.id = q.request_id
    where co.slug = ${companySlug}
      and (${q.trim() === ""}
        or q.number ilike ${like}
        or q.title ilike ${like}
        or c.first_name ilike ${like}
        or c.last_name ilike ${like})
    order by q.created_at desc
  `;
}

export async function getQuoteDetail(id: string): Promise<QuoteDetail | null> {
  const rows = await sql<QuoteDetail[]>`
    select q.id, q.number, q.status, q.title, q.total, q.valid_until, q.created_at,
           q.client_id, q.request_id, q.message, q.notes, q.subtotal, q.discount,
           q.tax, q.sent_at,
           trim(c.first_name || ' ' || c.last_name) as client_name,
           c.email as client_email,
           r.number as request_number,
           pl.address as pickup
    from quotes q
    join clients c on c.id = q.client_id
    left join requests r on r.id = q.request_id
    left join request_locations pl on pl.request_id = r.id and pl.kind = 'pickup'
    where q.id = ${id}
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  const lines = await sql<ParsedLine[]>`
    select name, description, quantity::float as quantity,
           unit_price as "unitPrice", total
    from quote_line_items where quote_id = ${id} order by sort
  `;
  return { ...row, lines };
}

export async function getQuotePrefillFromRequest(requestId: string): Promise<{
  clientId: string;
  title: string;
  lines: { name: string; description: string; qty: string; unitPrice: string }[];
} | null> {
  const req = await sql<{
    client_id: string;
    inventory_description: string;
  }[]>`
    select client_id, inventory_description from requests where id = ${requestId} limit 1
  `;
  if (!req[0]) return null;
  const services = await sql<{ name: string }[]>`
    select s.name from request_services rs
    join services s on s.id = rs.service_id
    where rs.request_id = ${requestId} order by s.sort
  `;
  const lines =
    services.length > 0
      ? services.map((s) => ({
          name: s.name,
          description: req[0].inventory_description.slice(0, 400),
          qty: "1",
          unitPrice: "",
        }))
      : [
          {
            name: "Moving service",
            description: req[0].inventory_description.slice(0, 400),
            qty: "1",
            unitPrice: "",
          },
        ];
  return { clientId: req[0].client_id, title: "Moving quote", lines };
}
