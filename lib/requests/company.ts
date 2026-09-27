import "server-only";
import { sql } from "@/lib/db";

export interface Company {
  id: string;
  slug: string;
  name: string;
  brand_name: string;
  logo_url: string | null;
  primary_color: string;
  terms_url: string | null;
  max_request_images: number;
  request_form_active: boolean;
}

export interface LeadSource {
  id: string;
  name: string;
}

export interface ServiceOption {
  id: string;
  name: string;
}

export async function getCompanyBySlug(
  slug: string,
): Promise<Company | null> {
  const rows = await sql<Company[]>`
    select id, slug, name, brand_name, logo_url, primary_color,
           terms_url, max_request_images, request_form_active
    from companies where slug = ${slug} limit 1
  `;
  return rows[0] ?? null;
}

export async function getLeadSources(
  companyId: string,
): Promise<LeadSource[]> {
  return sql<LeadSource[]>`
    select id, name from lead_sources
    where company_id = ${companyId} and active = true
    order by sort, name
  `;
}

export async function getActiveServices(
  companyId: string,
): Promise<ServiceOption[]> {
  return sql<ServiceOption[]>`
    select id, name from services
    where company_id = ${companyId} and active = true
    order by sort, name
  `;
}
