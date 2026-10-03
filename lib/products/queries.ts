import "server-only";
import { sql } from "@/lib/db";
import { penceToInput } from "@/lib/format";
import type { QuoteServiceChoice } from "@/lib/quotes/types";

export interface ProductRow {
  id: string;
  item_type: "service" | "product";
  name: string;
  description: string;
  unit_price: number;
  tax_exempt: boolean;
  service_duration_minutes: number;
  allow_quantity: boolean;
}

export type ProductSort = "name" | "type";

export async function listProducts(
  companyId: string,
  q: string,
  sort: ProductSort,
  dir: "asc" | "desc",
): Promise<ProductRow[]> {
  const term = q.trim().replace(/[\\%_]/g, "\\$&");
  const like = `%${term}%`;
  const desc = dir === "desc";
  return sql<ProductRow[]>`
    select id, item_type, name, description, unit_price, tax_exempt,
           service_duration_minutes, allow_quantity
    from products_services
    where company_id = ${companyId}
      and active
      and (${term === ""} or name ilike ${like} or description ilike ${like})
    order by
      case when ${sort === "type" && !desc} then item_type end asc,
      case when ${sort === "type" && desc} then item_type end desc,
      case when ${sort === "name" && !desc} then lower(name) end asc,
      case when ${sort === "name" && desc} then lower(name) end desc,
      lower(name) asc
    limit 500
  `;
}

export async function listServicesForQuote(
  companyId: string,
): Promise<{ id: string; name: string }[]> {
  return sql<{ id: string; name: string }[]>`
    select id, name
    from products_services
    where company_id = ${companyId} and active and item_type = 'service'
    order by lower(name)
  `;
}

export async function getServiceForQuote(
  companyId: string,
  id: string,
): Promise<QuoteServiceChoice | null> {
  const rows = await sql<{ id: string; name: string; description: string; unit_price: number }[]>`
    select id, name, description, unit_price
    from products_services
    where company_id = ${companyId} and id = ${id} and active and item_type = 'service'
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    unitPrice: row.unit_price > 0 ? penceToInput(row.unit_price) : "",
  };
}
