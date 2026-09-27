import "server-only";
import { sql } from "@/lib/db";

export interface AdminRequestRow {
  id: string;
  number: string;
  status: string;
  move_date: string | null;
  submitted_at: string;
  services_count: number;
  images_count: number;
  client_name: string;
  client_email: string;
  client_phone: string;
  pickup_address: string | null;
  pickup_postcode: string | null;
}

export async function listRequests(
  companySlug: string,
  q = "",
): Promise<AdminRequestRow[]> {
  const like = `%${q.trim()}%`;
  return sql<AdminRequestRow[]>`
    select r.id, r.number, r.status, r.move_date, r.submitted_at,
      (select count(*)::int from request_services rs where rs.request_id = r.id) as services_count,
      (select count(*)::int from request_attachments ra where ra.request_id = r.id) as images_count,
      trim(c.first_name || ' ' || c.last_name) as client_name,
      c.email as client_email, c.phone as client_phone,
      pl.address as pickup_address, pl.postcode as pickup_postcode
    from requests r
    join companies co on co.id = r.company_id
    join clients c on c.id = r.client_id
    left join request_locations pl on pl.request_id = r.id and pl.kind = 'pickup'
    where co.slug = ${companySlug}
      and (${q.trim() === ""}
        or r.number ilike ${like}
        or c.first_name ilike ${like}
        or c.last_name ilike ${like}
        or c.email ilike ${like}
        or pl.postcode ilike ${like}
        or pl.address ilike ${like})
    order by r.submitted_at desc
  `;
}

export interface AdminRequestDetail extends AdminRequestRow {
  client_id: string;
  move_time: string | null;
  needs_packing_service: boolean;
  needs_packing_materials: boolean;
  estimated_hours: string[];
  inventory_description: string;
  lead_source: string | null;
  company_name: string | null;
  marketing_email: boolean;
  marketing_sms: boolean;
  delivery_address: string | null;
  delivery_postcode: string | null;
  delivery_floor: string | null;
  delivery_has_lift: boolean | null;
  delivery_parking: string | null;
  delivery_bedrooms: number | null;
  pickup_floor: string | null;
  pickup_has_lift: boolean | null;
  pickup_parking: string | null;
  pickup_bedrooms: number | null;
  service_names: string[];
  files: { id: string; file_name: string; file_size: number }[];
  timeline: { action: string; summary: string; created_at: string }[];
}

export async function getRequestDetail(
  id: string,
): Promise<AdminRequestDetail | null> {
  const rows = await sql<AdminRequestDetail[]>`
    select r.id, r.number, r.status, r.move_date, r.move_time, r.submitted_at,
      r.needs_packing_service, r.needs_packing_materials,
      r.estimated_hours, r.inventory_description,
      ls.name as lead_source,
      c.id as client_id,
      trim(c.first_name || ' ' || c.last_name) as client_name,
      c.email as client_email, c.phone as client_phone,
      c.company_name, c.marketing_email_consent as marketing_email,
      c.marketing_sms_consent as marketing_sms,
      pl.address as pickup_address, pl.postcode as pickup_postcode,
      pl.floor as pickup_floor, pl.has_lift as pickup_has_lift,
      pl.parking_restrictions as pickup_parking, pl.bedrooms as pickup_bedrooms,
      dl.address as delivery_address, dl.postcode as delivery_postcode,
      dl.floor as delivery_floor, dl.has_lift as delivery_has_lift,
      dl.parking_restrictions as delivery_parking, dl.bedrooms as delivery_bedrooms,
      (select count(*)::int from request_services rs where rs.request_id = r.id) as services_count,
      (select count(*)::int from request_attachments ra where ra.request_id = r.id) as images_count
    from requests r
    join clients c on c.id = r.client_id
    left join lead_sources ls on ls.id = r.lead_source_id
    left join request_locations pl on pl.request_id = r.id and pl.kind = 'pickup'
    left join request_locations dl on dl.request_id = r.id and dl.kind = 'delivery'
    where r.id = ${id}
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;

  const [serviceRows, fileRows, logRows] = await Promise.all([
    sql<{ name: string }[]>`
      select s.name from request_services rs
      join services s on s.id = rs.service_id
      where rs.request_id = ${id} order by s.sort
    `,
    sql<{ id: string; file_name: string; file_size: number }[]>`
      select id, file_name, file_size from request_attachments
      where request_id = ${id} order by created_at
    `,
    sql<{ action: string; summary: string; created_at: string }[]>`
      select action, summary, created_at from activity_log
      where entity = 'request' and entity_id = ${id}
      order by created_at desc limit 20
    `,
  ]);

  return {
    ...row,
    service_names: serviceRows.map((s) => s.name),
    files: fileRows,
    timeline: logRows,
  };
}
