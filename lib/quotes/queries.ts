import "server-only";
import { sql } from "@/lib/db";
import type { ParsedLine } from "@/lib/funnel/money";
import { buildServiceSummary, describeService, hoursToQty } from "@/lib/quotes/summary";
import type {
  QuoteInventoryFile,
  QuotePacking,
  QuotePrefill,
  QuoteServiceChoice,
  QuoteStop,
} from "@/lib/quotes/types";

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

export interface QuoteListRow extends QuoteRow {
  service_name: string;
  property: string;
  sent_at: string | null;
  converted_at: string | null;
}

export interface QuoteDetail extends QuoteRow {
  request_id: string | null;
  message: string;
  notes: string;
  move_time: string;
  inventory: string;
  subtotal: number;
  discount: number;
  tax: number;
  deposit: number;
  sent_at: string | null;
  pickup: string | null;
  client_email: string;
  client_phone: string;
  client_title: string;
  company_name: string;
  client_address: string;
  collection: QuoteStop | null;
  delivery: QuoteStop | null;
  packing: QuotePacking | null;
  lines: ParsedLine[];
}

function toPacking(service: boolean | null, materials: boolean | null): QuotePacking | null {
  if (service == null && materials == null) return null;
  return {
    service: service ? "Yes" : "No",
    materials: materials ? "Yes" : "No",
  };
}

function toStop(input: {
  address: string | null;
  postcode: string | null;
  floor: string | null;
  hasLift: boolean | null;
  parking: string | null;
  bedrooms: number | null;
}): QuoteStop | null {
  const present =
    [input.address, input.postcode, input.floor, input.parking].some((value) => value?.trim()) ||
    input.bedrooms != null ||
    input.hasLift != null;
  if (!present) return null;
  return {
    address: [input.address, input.postcode].filter(Boolean).join(", ") || "—",
    floor: input.floor?.trim() || "—",
    lift: input.hasLift ? "Yes" : "No",
    parking: input.parking?.trim() || "—",
    bedrooms: input.bedrooms == null ? "—" : String(input.bedrooms),
  };
}

export async function listQuotes(
  companySlug: string,
  q = "",
): Promise<QuoteListRow[]> {
  const like = `%${q.trim()}%`;
  return sql<QuoteListRow[]>`
    select q.id, q.number, q.status, q.title, q.total, q.valid_until, q.created_at,
           q.sent_at, q.client_id,
           trim(both ' ' from concat_ws(
             ' ',
             case
               when lower(btrim(coalesce(c.title, ''))) in ('', 'no title', 'none') then null
               else btrim(c.title)
             end,
             c.first_name,
             c.last_name
           )) as client_name,
           r.number as request_number,
           coalesce((
             select li.name
             from quote_line_items li
             where li.quote_id = q.id
             order by li.sort asc, li.id asc
             limit 1
           ), '') as service_name,
           coalesce(
             nullif(trim(both ', ' from concat_ws(', ', nullif(pl.address, ''), nullif(pl.postcode, ''))), ''),
             nullif(trim(both ', ' from concat_ws(', ', nullif(ca.address_line, ''), nullif(ca.city, ''), nullif(ca.postcode, ''))), ''),
             ''
           ) as property,
           (
             select j.created_at
             from jobs j
             where j.quote_id = q.id
             order by j.created_at asc
             limit 1
           ) as converted_at
    from quotes q
    join companies co on co.id = q.company_id
    join clients c on c.id = q.client_id
    left join requests r on r.id = q.request_id
    left join request_locations pl on pl.request_id = r.id and pl.kind = 'pickup'
    left join lateral (
      select address_line, city, postcode
      from client_addresses
      where client_id = c.id
      order by is_primary desc, created_at asc
      limit 1
    ) ca on true
    where co.slug = ${companySlug}
      and (${q.trim() === ""}
        or q.number ilike ${like}
        or q.title ilike ${like}
        or c.first_name ilike ${like}
        or c.last_name ilike ${like}
        or c.title ilike ${like}
        or coalesce(pl.address, '') ilike ${like}
        or coalesce(pl.postcode, '') ilike ${like}
        or coalesce(ca.address_line, '') ilike ${like}
        or exists (
          select 1 from quote_line_items li
          where li.quote_id = q.id and li.name ilike ${like}
        ))
    order by q.created_at desc
  `;
}

export async function getQuoteDetail(id: string): Promise<QuoteDetail | null> {
  const rows = await sql<
    (Omit<QuoteDetail, "lines" | "collection" | "delivery" | "packing" | "client_address"> & {
      pickup_postcode: string | null;
      pickup_floor: string | null;
      pickup_has_lift: boolean | null;
      pickup_parking: string | null;
      pickup_bedrooms: number | null;
      delivery_address: string | null;
      delivery_postcode: string | null;
      delivery_floor: string | null;
      delivery_has_lift: boolean | null;
      delivery_parking: string | null;
      delivery_bedrooms: number | null;
      needs_packing_service: boolean | null;
      needs_packing_materials: boolean | null;
      client_phone: string;
      client_title: string;
      company_name: string;
      client_address_line: string | null;
      client_city: string | null;
      client_postcode: string | null;
    })[]
  >`
    select q.id, q.number, q.status, q.title, q.total, q.valid_until, q.created_at,
           q.client_id, q.request_id, q.message, q.notes, q.move_time, q.inventory,
           q.subtotal, q.discount, q.tax, q.deposit, q.sent_at,
           trim(c.first_name || ' ' || c.last_name) as client_name,
           c.email as client_email,
           coalesce(c.phone, '') as client_phone,
           coalesce(c.title, '') as client_title,
           co.name as company_name,
           ca.address_line as client_address_line,
           ca.city as client_city,
           ca.postcode as client_postcode,
           r.number as request_number,
           r.needs_packing_service, r.needs_packing_materials,
           pl.address as pickup,
           pl.postcode as pickup_postcode, pl.floor as pickup_floor,
           pl.has_lift as pickup_has_lift, pl.parking_restrictions as pickup_parking,
           pl.bedrooms as pickup_bedrooms,
           dl.address as delivery_address, dl.postcode as delivery_postcode,
           dl.floor as delivery_floor, dl.has_lift as delivery_has_lift,
           dl.parking_restrictions as delivery_parking, dl.bedrooms as delivery_bedrooms
    from quotes q
    join clients c on c.id = q.client_id
    join companies co on co.id = q.company_id
    left join lateral (
      select address_line, city, postcode
      from client_addresses
      where client_id = c.id
      order by is_primary desc, created_at asc
      limit 1
    ) ca on true
    left join requests r on r.id = q.request_id
    left join request_locations pl on pl.request_id = r.id and pl.kind = 'pickup'
    left join request_locations dl on dl.request_id = r.id and dl.kind = 'delivery'
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
  const place = [row.client_city, row.client_postcode].filter(Boolean).join(" ");
  const street = row.client_address_line?.trim() ?? "";
  const clientAddress = street && place ? `${street} / ${place}` : street || place;
  return {
    ...row,
    client_address: clientAddress,
    lines,
    collection: toStop({
      address: row.pickup,
      postcode: row.pickup_postcode,
      floor: row.pickup_floor,
      hasLift: row.pickup_has_lift,
      parking: row.pickup_parking,
      bedrooms: row.pickup_bedrooms,
    }),
    delivery: toStop({
      address: row.delivery_address,
      postcode: row.delivery_postcode,
      floor: row.delivery_floor,
      hasLift: row.delivery_has_lift,
      parking: row.delivery_parking,
      bedrooms: row.delivery_bedrooms,
    }),
    packing: toPacking(row.needs_packing_service, row.needs_packing_materials),
  };
}

export async function listRequestInventoryFiles(
  requestId: string,
): Promise<QuoteInventoryFile[]> {
  return sql<QuoteInventoryFile[]>`
    select id, file_name, mime_type
    from request_attachments
    where request_id = ${requestId}
    order by created_at
  `;
}

export async function getQuotePrefillFromRequest(
  requestId: string,
  service?: QuoteServiceChoice,
): Promise<QuotePrefill | null> {
  const req = await sql<
    {
      client_id: string;
      client_name: string;
      inventory_description: string;
      move_date: string | null;
      move_time: string | null;
      needs_packing_service: boolean;
      needs_packing_materials: boolean;
      estimated_hours: string[];
      pickup_address: string | null;
      pickup_postcode: string | null;
      pickup_floor: string | null;
      pickup_has_lift: boolean | null;
      pickup_parking: string | null;
      pickup_bedrooms: number | null;
      delivery_address: string | null;
      delivery_postcode: string | null;
      delivery_floor: string | null;
      delivery_has_lift: boolean | null;
      delivery_parking: string | null;
      delivery_bedrooms: number | null;
    }[]
  >`
    select r.client_id,
           trim(c.first_name || ' ' || c.last_name) as client_name,
           r.inventory_description,
           r.move_date::text as move_date, r.move_time,
           r.needs_packing_service, r.needs_packing_materials, r.estimated_hours,
           pl.address as pickup_address, pl.postcode as pickup_postcode,
           pl.floor as pickup_floor, pl.has_lift as pickup_has_lift,
           pl.parking_restrictions as pickup_parking, pl.bedrooms as pickup_bedrooms,
           dl.address as delivery_address, dl.postcode as delivery_postcode,
           dl.floor as delivery_floor, dl.has_lift as delivery_has_lift,
           dl.parking_restrictions as delivery_parking, dl.bedrooms as delivery_bedrooms
    from requests r
    join clients c on c.id = r.client_id
    left join request_locations pl on pl.request_id = r.id and pl.kind = 'pickup'
    left join request_locations dl on dl.request_id = r.id and dl.kind = 'delivery'
    where r.id = ${requestId}
    limit 1
  `;
  const row = req[0];
  if (!row) return null;
  const services = await sql<{ name: string }[]>`
    select s.name from request_services rs
    join services s on s.id = rs.service_id
    where rs.request_id = ${requestId} order by s.sort
  `;
  const requestNames = services.map((s) => s.name);
  const names = service ? [service.name] : requestNames;
  const builtSummary = buildServiceSummary({
    services: names,
    hours: row.estimated_hours ?? [],
    needsPacking: row.needs_packing_service,
    needsMaterials: row.needs_packing_materials,
    pickup: {
      address: row.pickup_address,
      postcode: row.pickup_postcode,
      floor: row.pickup_floor,
      hasLift: row.pickup_has_lift,
      parking: row.pickup_parking,
      bedrooms: row.pickup_bedrooms,
    },
    delivery: {
      address: row.delivery_address,
      postcode: row.delivery_postcode,
      floor: row.delivery_floor,
      hasLift: row.delivery_has_lift,
      parking: row.delivery_parking,
      bedrooms: row.delivery_bedrooms,
    },
  });
  const summary = service
    ? service.description.trim() || describeService(service.name)
    : builtSummary;
  const qty = hoursToQty(row.estimated_hours ?? []);
  const lines =
    names.length > 0
      ? names.map((name, i) => ({
          name,
          description: i === 0 ? summary : "",
          qty: i === 0 ? qty : "1",
          unitPrice: i === 0 && service ? service.unitPrice : "",
        }))
      : [
          {
            name: "Removal service",
            description: summary,
            qty,
            unitPrice: "",
          },
        ];
  return {
    requestId,
    clientId: row.client_id,
    title: service?.name ?? names[0] ?? "",
    moveDate: row.move_date ? String(row.move_date).slice(0, 10) : "",
    moveTime: row.move_time?.trim() ?? "",
    inventory: row.inventory_description ?? "",
    files: await listRequestInventoryFiles(requestId),
    collection: toStop({
      address: row.pickup_address,
      postcode: row.pickup_postcode,
      floor: row.pickup_floor,
      hasLift: row.pickup_has_lift,
      parking: row.pickup_parking,
      bedrooms: row.pickup_bedrooms,
    }),
    delivery: toStop({
      address: row.delivery_address,
      postcode: row.delivery_postcode,
      floor: row.delivery_floor,
      hasLift: row.delivery_has_lift,
      parking: row.delivery_parking,
      bedrooms: row.delivery_bedrooms,
    }),
    packing: toPacking(row.needs_packing_service, row.needs_packing_materials),
    lines,
  };
}

export async function getQuotePrefillForClient(
  clientId: string,
  companyId: string,
  service?: QuoteServiceChoice,
): Promise<QuotePrefill | null> {
  const rows = await sql<{ id: string }[]>`
    select r.id
    from requests r
    where r.client_id = ${clientId}
      and r.company_id = ${companyId}
    order by r.submitted_at desc
    limit 1
  `;
  const requestId = rows[0]?.id;
  if (!requestId) return null;
  return getQuotePrefillFromRequest(requestId, service);
}
