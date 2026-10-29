import "server-only";
import { sql } from "@/lib/db";

export const COMPANY_SLUG = "moving-london";

export async function getCompanyId(
  slug: string = COMPANY_SLUG,
): Promise<string | null> {
  const rows = await sql<{ id: string }[]>`
    select id from companies where slug = ${slug} limit 1
  `;
  return rows[0]?.id ?? null;
}

export async function getCompanyName(slug: string = COMPANY_SLUG): Promise<string> {
  const rows = await sql<{ name: string }[]>`
    select name from companies where slug = ${slug} limit 1
  `;
  return rows[0]?.name ?? "";
}
