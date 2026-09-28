import "server-only";
import { sql } from "@/lib/db";

export interface ClientOption {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  status: string;
  address_line: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
}

export async function listClientsForSelect(
  companySlug: string,
): Promise<ClientOption[]> {
  return sql<ClientOption[]>`
    select c.id, c.first_name, c.last_name, c.email,
           coalesce(c.phone, '') as phone,
           coalesce(c.status, 'lead') as status,
           a.address_line as address_line,
           a.city as city,
           a.postcode as postcode,
           a.country as country
    from clients c
    join companies co on co.id = c.company_id
    left join lateral (
      select address_line, city, postcode, country
      from client_addresses
      where client_id = c.id
      order by is_primary desc, created_at asc
      limit 1
    ) a on true
    where co.slug = ${companySlug}
    order by c.last_name, c.first_name
    limit 500
  `;
}

export interface ClientDetails extends ClientOption {
  company_name: string | null;
}

export async function getClientDetails(
  clientId: string,
): Promise<ClientDetails | null> {
  const rows = await sql<ClientDetails[]>`
    select c.id, c.first_name, c.last_name, c.email,
           coalesce(c.phone, '') as phone,
           coalesce(c.status, 'lead') as status,
           c.company_name,
           a.address_line as address_line,
           a.city as city,
           a.postcode as postcode,
           a.country as country
    from clients c
    left join lateral (
      select address_line, city, postcode, country
      from client_addresses
      where client_id = c.id
      order by is_primary desc, created_at asc
      limit 1
    ) a on true
    where c.id = ${clientId}
    limit 1
  `;
  return rows[0] ?? null;
}

export interface ClientRow {
  id: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  email: string;
  phone: string;
  created_at: string;
  requests_count: number;
  quotes_count: number;
  jobs_count: number;
  invoices_count: number;
}

export async function listClients(
  companySlug: string,
  q: string,
): Promise<ClientRow[]> {
  const like = `%${q.trim()}%`;
  return sql<ClientRow[]>`
    select c.id, c.first_name, c.last_name, c.company_name, c.email, c.phone,
           c.created_at,
      (select count(*)::int from requests r where r.client_id = c.id) as requests_count,
      (select count(*)::int from quotes q where q.client_id = c.id) as quotes_count,
      (select count(*)::int from jobs j where j.client_id = c.id) as jobs_count,
      (select count(*)::int from invoices i where i.client_id = c.id) as invoices_count
    from clients c
    join companies co on co.id = c.company_id
    where co.slug = ${companySlug}
      and (${q.trim() === ""}
        or c.first_name ilike ${like}
        or c.last_name ilike ${like}
        or c.email ilike ${like}
        or c.phone ilike ${like})
    order by c.created_at desc
    limit 100
  `;
}
