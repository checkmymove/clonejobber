"use server";

import { requireAdmin } from "@/lib/auth/session";
import { isUniqueViolation } from "@/lib/funnel/engine";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { sql } from "@/lib/db";
import {
  getActiveServices,
  getCompanyBySlug,
  getLeadSources,
} from "@/lib/requests/company";
import {
  MAX_FILE_SIZE_BYTES,
  MIN_FORM_SECONDS,
} from "@/lib/requests/constants";
import {
  sniffImageMime,
  validateContact,
  validateFileList,
  validateHours,
  validateInventory,
  validateLocation,
  validatePacking,
  validateServices,
  type ContactStep,
  type Errors,
  type LocationStep,
  type PackingStep,
} from "@/lib/requests/validation";
import { getClientIp } from "@/lib/ratelimit";
import { consumeRateLimit } from "@/lib/requests/submit-limit";

export interface SubmitResult {
  ok: boolean;
  number?: string;
  requestId?: string;
  errors?: Errors;
  message?: string;
}

const VALID_STATUSES = ["new", "review", "quoted", "archived"] as const;

function parseJson<T>(raw: FormDataEntryValue | null, fallback: T): T {
  if (typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function submitRequest(formData: FormData): Promise<SubmitResult> {
  const h = await headers();
  const ip = getClientIp(h);

  // --- anti-spam: rate limit -------------------------------------------
  const rl = await consumeRateLimit(`req-submit:${ip}`, 10, 60 * 60 * 1000);
  if (!rl.ok) {
    return {
      ok: false,
      message: `Too many submissions. Try again in ${rl.retryAfterSec}s.`,
    };
  }

  // --- anti-spam: honeypot (fake success so bots learn nothing) --------
  if (typeof formData.get("website") === "string" && formData.get("website")) {
    return { ok: true, number: "REQ-0000" };
  }

  // --- anti-spam: time trap --------------------------------------------
  const startedAt = Number(formData.get("startedAt") ?? 0);
  if (
    !Number.isFinite(startedAt) ||
    Date.now() - startedAt < MIN_FORM_SECONDS * 1000
  ) {
    return { ok: false, message: "Form submitted too quickly. Try again." };
  }

  const slug = String(formData.get("slug") ?? "");
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "");
  if (!slug || !idempotencyKey) {
    return { ok: false, message: "Invalid submission." };
  }

  // --- resolve company server-side (never trust a client company id) ---
  const company = await getCompanyBySlug(slug);
  if (!company || !company.request_form_active) {
    return { ok: false, message: "This form is not available." };
  }

  const contact = parseJson<ContactStep>(formData.get("contact"), {
    firstName: "",
    lastName: "",
    companyName: "",
    email: "",
    phone: "",
    marketingEmail: false,
    marketingSms: false,
    leadSourceId: "",
    moveDate: "",
    moveTime: "",
  });
  const pickup = parseJson<LocationStep>(formData.get("pickup"), {
    address: "",
    postcode: "",
    floor: "",
    hasLift: null,
    parking: "",
    bedrooms: "",
  });
  const delivery = parseJson<LocationStep>(formData.get("delivery"), {
    address: "",
    postcode: "",
    floor: "",
    hasLift: null,
    parking: "",
    bedrooms: "",
  });
  const packing = parseJson<PackingStep>(formData.get("packing"), {
    needsService: null,
    needsMaterials: null,
  });
  const serviceIds = parseJson<string[]>(formData.get("services"), []);
  const hours = parseJson<string[]>(formData.get("hours"), []);
  const inventory = String(formData.get("inventory") ?? "");
  const termsAccepted = formData.get("termsAccepted") === "true";

  const [leadSources, services] = await Promise.all([
    getLeadSources(company.id),
    getActiveServices(company.id),
  ]);
  const validServiceIds = services.map((s) => s.id);
  const files = formData.getAll("images").filter((f) => f instanceof File);

  // --- full server-side validation --------------------------------------
  const errors: Errors = {
    ...validateContact(contact),
    ...Object.fromEntries(
      Object.entries(validateLocation(pickup)).map(([k, v]) => [`pickup.${k}`, v]),
    ),
    ...Object.fromEntries(
      Object.entries(validateLocation(delivery)).map(([k, v]) => [
        `delivery.${k}`,
        v,
      ]),
    ),
    ...validatePacking(packing),
    ...validateServices(serviceIds, validServiceIds),
    ...validateHours(hours),
    ...validateInventory(inventory),
    ...validateFileList(
      files.map((f) => ({ name: (f as File).name, size: (f as File).size, type: (f as File).type })),
      company.max_request_images,
    ),
  };
  if (!leadSources.some((l) => l.id === contact.leadSourceId)) {
    errors.leadSourceId = "Invalid lead source";
  }
  if (serviceIds.length !== new Set(serviceIds).size) {
    errors.services = "Duplicate services selected";
  }
  if (!termsAccepted) {
    errors.terms = "You must accept the Terms and Conditions";
  }
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors, message: "Please review the highlighted fields." };
  }

  // --- file contents: size + magic bytes ---------------------------------
  const buffers: { name: string; mime: string; size: number; data: Buffer }[] =
    [];
  for (const entry of files) {
    const f = entry as File;
    if (f.size > MAX_FILE_SIZE_BYTES) {
      return { ok: false, message: `Image ${f.name} exceeds 8 MB.` };
    }
    const buf = Buffer.from(await f.arrayBuffer());
    const sniffed = sniffImageMime(new Uint8Array(buf));
    if (!sniffed) {
      return {
        ok: false,
        message: `Image ${f.name} is not a valid JPG, PNG or WEBP file.`,
      };
    }
    buffers.push({ name: f.name.slice(0, 200), mime: sniffed, size: f.size, data: buf });
  }

  // --- idempotency: double-clicking Confirm must not duplicate -----------
  const existing = await sql<{ number: string; id: string }[]>`
    select number, id from requests where idempotency_key = ${idempotencyKey} limit 1
  `;
  if (existing[0]) {
    return { ok: true, number: existing[0].number, requestId: existing[0].id };
  }

  const email = contact.email.trim();
  const phone = contact.phone.trim();

  let result: { number: string; requestId: string };
  try {
    result = await sql.begin(async (tx) => {
    // Match an existing client only by email. A shared phone must not
    // attach this request to someone else's record.
    const found = await tx<{
      id: string;
    }[]>`
      select id from clients
      where company_id = ${company.id}
        and email = ${email}
      limit 1
    `;

    let clientId: string;
    let clientCreated = false;
    if (found[0]) {
      clientId = found[0].id;
      // Fill a missing lead source only. Marketing consent stays as stored.
      await tx`
        update clients set
          lead_source_id = coalesce(lead_source_id, ${contact.leadSourceId}),
          updated_at = now()
        where id = ${clientId}
      `;
    } else {
      const inserted = await tx<{ id: string }[]>`
        insert into clients
          (company_id, first_name, last_name, company_name, email, phone,
           marketing_email_consent, marketing_sms_consent, lead_source_id)
        values
          (${company.id}, ${contact.firstName.trim()}, ${contact.lastName.trim()},
           ${contact.companyName.trim() || null}, ${email}, ${phone},
           ${contact.marketingEmail}, ${contact.marketingSms}, ${contact.leadSourceId})
        returning id
      `;
      clientId = inserted[0].id;
      clientCreated = true;
    }

    const numbered = await tx<{ number: string }[]>`
      select next_request_number(${company.id}) as number
    `;
    const number = numbered[0].number;

    const req = await tx<{ id: string }[]>`
      insert into requests
        (number, company_id, client_id, status, lead_source_id,
         move_date, move_time, needs_packing_service, needs_packing_materials,
         estimated_hours, inventory_description, terms_accepted_at, idempotency_key)
      values
        (${number}, ${company.id}, ${clientId}, 'new', ${contact.leadSourceId},
         ${contact.moveDate || null}, ${contact.moveTime},
         ${packing.needsService === true}, ${packing.needsMaterials === true},
         ${tx.array(hours)}, ${inventory.trim()}, now(), ${idempotencyKey})
      returning id
    `;
    const requestId = req[0].id;

    const loc = async (kind: "pickup" | "delivery", s: LocationStep) => {
      await tx`
        insert into request_locations
          (request_id, kind, address, postcode, floor, has_lift,
           parking_restrictions, bedrooms)
        values
          (${requestId}, ${kind}, ${s.address.trim()}, ${s.postcode.trim()},
           ${s.floor.trim()}, ${s.hasLift === true}, ${s.parking.trim()},
           ${Number(s.bedrooms)})
      `;
    };
    await loc("pickup", pickup);
    await loc("delivery", delivery);

    for (const sid of serviceIds) {
      await tx`
        insert into request_services (request_id, service_id)
        values (${requestId}, ${sid})
      `;
    }

    for (const b of buffers) {
      await tx`
        insert into request_attachments
          (request_id, file_name, mime_type, file_size, data)
        values (${requestId}, ${b.name}, ${b.mime}, ${b.size}, ${b.data})
      `;
    }

    // Auto confirmation entry: visible in the client's Communication tab.
    // Status 'logged' = recorded. Provider delivery lands with email phase.
    await tx`
      insert into communications
        (company_id, client_id, request_id, channel, direction,
         subject, body, status, sent_at)
      values
        (${company.id}, ${clientId}, ${requestId}, 'email', 'outbound',
         'Thanks for your request!',
         ${`Hi ${contact.firstName.trim()}, thanks for your request ${number}. Our team will review it and be in touch shortly.`},
         'logged', now())
    `;

    await tx`
      insert into activity_log
        (company_id, actor, action, entity, entity_id, summary, meta)
      values
        (${company.id}, 'public-form', ${clientCreated ? "client.created" : "client.linked"},
         'client', ${clientId},
         ${clientCreated ? `Client created from public request form` : `Existing client linked to new request`},
         ${tx.json({ email })}),
        (${company.id}, 'public-form', 'request.submitted',
         'request', ${requestId},
         ${`Request ${number} submitted via public form`},
         ${tx.json({ number, services: serviceIds.length, images: buffers.length })})
    `;

    return { number, requestId };
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const again = await sql<{ number: string; id: string }[]>`
      select number, id from requests where idempotency_key = ${idempotencyKey} limit 1
    `;
    if (!again[0]) throw error;
    revalidatePath("/solicitacoes");
    revalidatePath("/clientes");
    return { ok: true, number: again[0].number, requestId: again[0].id };
  }

  revalidatePath("/solicitacoes");
  revalidatePath("/clientes");
  return { ok: true, number: result.number, requestId: result.requestId };
}

export async function updateRequestStatus(
  requestId: string,
  status: string,
): Promise<{ ok: boolean; message?: string }> {
  await requireAdmin();
  if (!(VALID_STATUSES as readonly string[]).includes(status)) {
    return { ok: false, message: "Invalid status" };
  }
  const rows = await sql<{ company_id: string; number: string }[]>`
    select company_id, number from requests where id = ${requestId} limit 1
  `;
  if (!rows[0]) return { ok: false, message: "Request not found" };

  await sql.begin(async (tx) => {
    await tx`
      update requests set status = ${status}, updated_at = now()
      where id = ${requestId}
    `;
    await tx`
      insert into activity_log
        (company_id, actor, action, entity, entity_id, summary)
      values
        (${rows[0].company_id}, 'admin', 'request.status_changed',
         'request', ${requestId}, ${`Status changed to ${status} for ${rows[0].number}`})
    `;
  });

  revalidatePath("/solicitacoes");
  revalidatePath(`/solicitacoes/${requestId}`);
  return { ok: true };
}

export async function createAdminRequest(input: {
  clientId: string;
  title: string;
  moveDate: string;
  moveTime: string;
  pickupAddress: string;
  pickupPostcode: string;
  pickupFloor: string;
  pickupLift: boolean;
  pickupParking: string;
  pickupBedrooms: string;
  deliveryAddress: string;
  deliveryPostcode: string;
  deliveryFloor: string;
  deliveryLift: boolean;
  deliveryParking: string;
  deliveryBedrooms: string;
  needsPacking: boolean;
  needsBoxes: boolean;
  serviceId: string;
  hours: string;
  inventory: string;
  notes?: string;
  images?: { name: string; mime: string; size: number; data: string }[];
}): Promise<SubmitResult> {
  await requireAdmin();
  const { validateAdminRequest } = await import("@/lib/funnel/validation");
  const { getCompanyId } = await import("@/lib/company");
  const errors = validateAdminRequest(input);
  if (Object.keys(errors).length) {
    return { ok: false, errors, message: "Check the highlighted fields." };
  }

  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };

  const client = await sql<{ id: string }[]>`
    select id from clients where id = ${input.clientId} and company_id = ${companyId}
  `;
  if (!client[0]) return { ok: false, message: "Client not found." };

  const pickupBeds = Number(input.pickupBedrooms.trim() || "0");
  const deliveryBeds = Number(input.deliveryBedrooms.trim() || "0");
  const hours = input.hours ? [input.hours] : [];
  const idempotencyKey = crypto.randomUUID();

  // Decode + validate image payloads (base64 from the client file picker).
  const { sniffImageMime } = await import("@/lib/requests/validation");
  const { MAX_FILE_SIZE_BYTES } = await import("@/lib/requests/constants");
  const buffers: { name: string; mime: string; size: number; data: Buffer }[] = [];
  for (const img of input.images ?? []) {
    if (!img?.data) continue;
    const buf = Buffer.from(img.data, "base64");
    if (buf.length === 0 || buf.length > MAX_FILE_SIZE_BYTES) {
      return { ok: false, message: `Image ${img.name} exceeds 8 MB.` };
    }
    const sniffed = sniffImageMime(new Uint8Array(buf));
    if (!sniffed) {
      return { ok: false, message: `Image ${img.name} is not a valid JPG, PNG or WEBP file.` };
    }
    buffers.push({ name: img.name.slice(0, 200), mime: sniffed, size: buf.length, data: buf });
    if (buffers.length >= 10) break;
  }

  let created: { id: string; number: string };
  try {
    created = await sql.begin(async (tx) => {
    const numbered = await tx<{ number: string }[]>`
      select next_request_number(${companyId}) as number
    `;
    const req = await tx<{ id: string }[]>`
      insert into requests
        (number, company_id, client_id, status, move_date, move_time,
         needs_packing_service, needs_packing_materials, estimated_hours,
         inventory_description, terms_accepted_at, idempotency_key)
      values
        (${numbered[0].number}, ${companyId}, ${input.clientId}, 'new',
         ${input.moveDate || null}, ${input.moveTime || null},
         ${input.needsPacking}, ${input.needsBoxes}, ${tx.array(hours)},
         ${input.inventory.trim() || input.title.trim() || "Internal request"},
         now(), ${idempotencyKey})
      returning id
    `;
    const requestId = req[0].id;
    await tx`
      insert into request_locations
        (request_id, kind, address, postcode, floor, has_lift, parking_restrictions, bedrooms)
      values
        (${requestId}, 'pickup', ${input.pickupAddress.trim()}, ${input.pickupPostcode.trim()},
         ${input.pickupFloor.trim() || "—"}, ${input.pickupLift},
         ${input.pickupParking.trim() || "—"}, ${pickupBeds})
    `;
    await tx`
      insert into request_locations
        (request_id, kind, address, postcode, floor, has_lift, parking_restrictions, bedrooms)
      values
        (${requestId}, 'delivery', ${input.deliveryAddress.trim()}, ${input.deliveryPostcode.trim()},
         ${input.deliveryFloor.trim() || "—"}, ${input.deliveryLift},
         ${input.deliveryParking.trim() || "—"}, ${deliveryBeds})
    `;
    if (input.serviceId) {
      await tx`
        insert into request_services (request_id, service_id)
        values (${requestId}, ${input.serviceId})
      `;
    }
    for (const b of buffers) {
      await tx`
        insert into request_attachments
          (request_id, file_name, mime_type, file_size, data)
        values (${requestId}, ${b.name}, ${b.mime}, ${b.size}, ${b.data})
      `;
      // Mirror into client_files so images stay related to the client record.
      await tx`
        insert into client_files (client_id, file_name, mime_type, file_size, data)
        values (${input.clientId}, ${b.name}, ${b.mime}, ${b.size}, ${b.data})
      `;
    }
    if (input.notes?.trim()) {
      await tx`
        insert into client_notes (client_id, author, content)
        values (${input.clientId}, 'admin', ${input.notes.trim()})
      `;
    }
    await tx`
      insert into activity_log (company_id, actor, action, entity, entity_id, summary)
      values (${companyId}, 'admin', 'request.submitted', 'request', ${requestId},
              ${`Request ${numbered[0].number} created internally`})
    `;
    return { id: requestId, number: numbered[0].number };
    });
  } catch (error) {
    console.error("createAdminRequest failed", error);
    return {
      ok: false,
      message: "Could not save the request. Nothing was stored. Try again.",
    };
  }

  revalidatePath("/solicitacoes");
  revalidatePath("/clientes");
  redirect(`/solicitacoes/${created.id}`);
}

type AdminRequestUpdateInput = {
  clientId: string;
  title: string;
  moveDate: string;
  moveTime: string;
  pickupAddress: string;
  pickupPostcode: string;
  pickupFloor: string;
  pickupLift: boolean;
  pickupParking: string;
  pickupBedrooms: string;
  deliveryAddress: string;
  deliveryPostcode: string;
  deliveryFloor: string;
  deliveryLift: boolean;
  deliveryParking: string;
  deliveryBedrooms: string;
  needsPacking: boolean;
  needsBoxes: boolean;
  serviceId: string;
  serviceIds?: string[];
  hours: string;
  inventory: string;
  notes?: string;
  images?: { name: string; mime: string; size: number; data: string }[];
};

async function persistAdminRequest(
  requestId: string,
  input: AdminRequestUpdateInput,
): Promise<SubmitResult> {
  await requireAdmin();
  const { validateAdminRequest } = await import("@/lib/funnel/validation");
  const { getCompanyId } = await import("@/lib/company");
  const errors = validateAdminRequest(input);
  if (Object.keys(errors).length) {
    return { ok: false, errors, message: "Check the highlighted fields." };
  }

  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };

  const existing = await sql<{ id: string; number: string; client_id: string }[]>`
    select id, number, client_id from requests
    where id = ${requestId} and company_id = ${companyId}
    limit 1
  `;
  if (!existing[0]) return { ok: false, message: "Request not found." };

  const client = await sql<{ id: string }[]>`
    select id from clients where id = ${input.clientId} and company_id = ${companyId}
  `;
  if (!client[0]) return { ok: false, message: "Client not found." };

  const pickupBeds = Number(input.pickupBedrooms.trim() || "0");
  const deliveryBeds = Number(input.deliveryBedrooms.trim() || "0");
  const hours = input.hours ? [input.hours] : [];
  const serviceIds = (input.serviceIds?.length ? input.serviceIds : input.serviceId ? [input.serviceId] : [])
    .filter((id, index, all) => id && all.indexOf(id) === index);

  const { sniffImageMime } = await import("@/lib/requests/validation");
  const { MAX_FILE_SIZE_BYTES } = await import("@/lib/requests/constants");
  const buffers: { name: string; mime: string; size: number; data: Buffer }[] = [];
  for (const img of input.images ?? []) {
    if (!img?.data) continue;
    const buf = Buffer.from(img.data, "base64");
    if (buf.length === 0 || buf.length > MAX_FILE_SIZE_BYTES) {
      return { ok: false, message: `Image ${img.name} exceeds 8 MB.` };
    }
    const sniffed = sniffImageMime(new Uint8Array(buf));
    if (!sniffed) {
      return { ok: false, message: `Image ${img.name} is not a valid JPG, PNG or WEBP file.` };
    }
    buffers.push({ name: img.name.slice(0, 200), mime: sniffed, size: buf.length, data: buf });
    if (buffers.length >= 10) break;
  }

  try {
    await sql.begin(async (tx) => {
      await tx`
        update requests set
          client_id = ${input.clientId},
          move_date = ${input.moveDate || null},
          move_time = ${input.moveTime || null},
          needs_packing_service = ${input.needsPacking},
          needs_packing_materials = ${input.needsBoxes},
          estimated_hours = ${tx.array(hours)},
          inventory_description = ${input.inventory.trim() || input.title.trim() || "Internal request"},
          updated_at = now()
        where id = ${requestId}
      `;
      await tx`delete from request_locations where request_id = ${requestId}`;
      await tx`
        insert into request_locations
          (request_id, kind, address, postcode, floor, has_lift, parking_restrictions, bedrooms)
        values
          (${requestId}, 'pickup', ${input.pickupAddress.trim()}, ${input.pickupPostcode.trim()},
           ${input.pickupFloor.trim() || "—"}, ${input.pickupLift},
           ${input.pickupParking.trim() || "—"}, ${pickupBeds})
      `;
      await tx`
        insert into request_locations
          (request_id, kind, address, postcode, floor, has_lift, parking_restrictions, bedrooms)
        values
          (${requestId}, 'delivery', ${input.deliveryAddress.trim()}, ${input.deliveryPostcode.trim()},
           ${input.deliveryFloor.trim() || "—"}, ${input.deliveryLift},
           ${input.deliveryParking.trim() || "—"}, ${deliveryBeds})
      `;
      await tx`delete from request_services where request_id = ${requestId}`;
      for (const serviceId of serviceIds) {
        await tx`
          insert into request_services (request_id, service_id)
          values (${requestId}, ${serviceId})
        `;
      }
      for (const b of buffers) {
        await tx`
          insert into request_attachments
            (request_id, file_name, mime_type, file_size, data)
          values (${requestId}, ${b.name}, ${b.mime}, ${b.size}, ${b.data})
        `;
        await tx`
          insert into client_files (client_id, file_name, mime_type, file_size, data)
          values (${input.clientId}, ${b.name}, ${b.mime}, ${b.size}, ${b.data})
        `;
      }
      if (input.notes?.trim()) {
        await tx`
          insert into client_notes (client_id, author, content)
          values (${input.clientId}, 'admin', ${input.notes.trim()})
        `;
      }
      await tx`
        insert into activity_log (company_id, actor, action, entity, entity_id, summary)
        values (${companyId}, 'admin', 'request.updated', 'request', ${requestId},
                ${`Request ${existing[0].number} updated`})
      `;
    });
  } catch (error) {
    console.error("updateAdminRequest failed", error);
    return {
      ok: false,
      message: "Could not save the request. Nothing was stored. Try again.",
    };
  }

  revalidatePath("/solicitacoes");
  revalidatePath(`/solicitacoes/${requestId}`);
  revalidatePath("/cotacoes", "layout");
  revalidatePath("/clientes");
  return { ok: true, requestId };
}

export async function updateAdminRequest(
  requestId: string,
  input: AdminRequestUpdateInput,
): Promise<SubmitResult> {
  const saved = await persistAdminRequest(requestId, input);
  if (!saved.ok) return saved;
  redirect(`/solicitacoes/${requestId}`);
}

export async function saveRequestInPlace(
  requestId: string,
  input: AdminRequestUpdateInput,
): Promise<SubmitResult> {
  return persistAdminRequest(requestId, input);
}

export async function saveRequestContact(
  clientId: string,
  requestId: string,
  input: {
    firstName: string;
    lastName: string;
    companyName: string;
    email: string;
    phone: string;
    marketingEmail: boolean;
    marketingSms: boolean;
  },
): Promise<SubmitResult> {
  await requireAdmin();
  const { isValidEmail, isValidPhone } = await import("@/lib/requests/validation");
  const errors: Errors = {};
  if (!input.firstName.trim()) errors.firstName = "First name is required";
  if (!input.lastName.trim()) errors.lastName = "Last name is required";
  if (!input.email.trim()) errors.email = "Email is required";
  else if (!isValidEmail(input.email)) errors.email = "Enter a valid email address";
  if (!input.phone.trim()) errors.phone = "Phone is required";
  else if (!isValidPhone(input.phone)) errors.phone = "Enter a valid phone number";
  if (Object.keys(errors).length) {
    return { ok: false, errors, message: "Check the highlighted fields." };
  }

  const { getCompanyId } = await import("@/lib/company");
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };

  const owned = await sql<{ id: string }[]>`
    select id from clients where id = ${clientId} and company_id = ${companyId} limit 1
  `;
  if (!owned[0]) return { ok: false, message: "Client not found." };

  try {
    await sql`
      update clients set
        first_name = ${input.firstName.trim()},
        last_name = ${input.lastName.trim()},
        company_name = ${input.companyName.trim() || null},
        email = ${input.email.trim()},
        phone = ${input.phone.trim()},
        marketing_email_consent = ${input.marketingEmail},
        marketing_sms_consent = ${input.marketingSms},
        updated_at = now()
      where id = ${clientId}
    `;
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, errors: { email: "A client with this email already exists" } };
    }
    throw error;
  }

  revalidatePath("/solicitacoes");
  revalidatePath(`/solicitacoes/${requestId}`);
  revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/clientes");
  return { ok: true };
}
