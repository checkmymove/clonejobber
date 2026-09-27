"use server";

import { requireAdmin } from "@/lib/auth/session";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { MAX_FILE_SIZE_BYTES } from "@/lib/requests/constants";
import { sniffImageMime } from "@/lib/requests/validation";
import {
  validateAppointment,
  validateContactInput,
  validateMessage,
  validateNote,
  validateProfile,
  validateProperty,
  validateTag,
  validateNewClient,
  type AppointmentInput,
  type ContactInput,
  type FullPropertyInput,
  type MessageInput,
  type NewClientPayload,
  type ProfileInput,
  type PropertyInput,
} from "@/lib/clients/crm-validation";

export interface ActionResult {
  ok: boolean;
  errors?: Record<string, string>;
  message?: string;
}

async function mustOwn(clientId: string): Promise<string | null> {
  const rows = await sql<{ company_id: string }[]>`
    select company_id from clients where id = ${clientId} limit 1
  `;
  return rows[0]?.company_id ?? null;
}

const revalidate = (clientId: string) => {
  revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/clientes");
};

// ---------------------------------------------------------------- profile
export async function updateProfile(
  clientId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const input: ProfileInput = {
    title: String(formData.get("title") ?? ""),
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    companyName: String(formData.get("companyName") ?? ""),
    clientType: String(formData.get("clientType") ?? "individual"),
    status: String(formData.get("status") ?? "active"),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    phoneMobile: String(formData.get("phoneMobile") ?? ""),
    paymentTerms: String(formData.get("paymentTerms") ?? "due_on_receipt"),
    paymentTermsCustom: String(formData.get("paymentTermsCustom") ?? ""),
    askForReview: formData.get("askForReview") === "on",
  };
  const errors = validateProfile(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const companyId = await mustOwn(clientId);
  if (!companyId) return { ok: false, message: "Client not found." };

  try {
    await sql`
      update clients set
        title = ${input.title.trim()},
        first_name = ${input.firstName.trim()},
        last_name = ${input.lastName.trim()},
        company_name = ${input.companyName.trim() || null},
        client_type = ${input.clientType},
        status = ${input.status},
        email = ${input.email.trim()},
        phone = ${input.phone.trim()},
        phone_mobile = ${input.phoneMobile.trim()},
        payment_terms = ${input.paymentTerms},
        payment_terms_custom = ${input.paymentTerms === "custom" ? input.paymentTermsCustom.trim() : null},
        ask_for_review = ${input.askForReview},
        updated_at = now()
      where id = ${clientId}
    `;
    await sql`
      insert into activity_log (company_id, actor, action, entity, entity_id, summary)
      values (${companyId}, 'admin', 'client.updated', 'client', ${clientId}, 'Client profile updated')
    `;
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "code" in e && e.code === "23505") {
      return { ok: false, errors: { email: "A client with this email already exists" } };
    }
    throw e;
  }
  revalidate(clientId);
  return { ok: true };
}

// --------------------------------------------------------------- properties
export async function addProperty(
  clientId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const input: PropertyInput = {
    label: String(formData.get("label") ?? "Other"),
    addressLine: String(formData.get("addressLine") ?? ""),
    city: String(formData.get("city") ?? ""),
    postcode: String(formData.get("postcode") ?? ""),
    instructions: String(formData.get("instructions") ?? ""),
    isPrimary: formData.get("isPrimary") === "on",
    isBilling: formData.get("isBilling") === "on",
  };
  const street2 = String(formData.get("street2") ?? "");
  const county = String(formData.get("county") ?? "");
  const country = String(formData.get("country") ?? "United Kingdom");
  const taxRate = String(formData.get("taxRate") ?? "");
  const errors = validateProperty(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  if (!(await mustOwn(clientId))) return { ok: false, message: "Client not found." };

  await sql.begin(async (tx) => {
    if (input.isPrimary) {
      await tx`update client_addresses set is_primary = false where client_id = ${clientId}`;
    }
    const count = await tx<{ n: number }[]>`
      select count(*)::int as n from client_addresses where client_id = ${clientId}`;
    await tx`
      insert into client_addresses
        (client_id, label, address_line, street_2, city, county, postcode,
         country, tax_rate, instructions, is_primary, is_billing)
      values (${clientId}, ${input.label}, ${input.addressLine.trim()},
              ${street2.trim()}, ${input.city.trim()}, ${county.trim()},
              ${input.postcode.trim()}, ${country.trim() || "United Kingdom"},
              ${taxRate.trim() || null}, ${input.instructions.trim()},
              ${input.isPrimary || count[0].n === 0}, ${input.isBilling})
    `;
  });
  revalidate(clientId);
  return { ok: true };
}

export async function deleteProperty(
  clientId: string,
  propertyId: string,
): Promise<void> {
  await requireAdmin();
  await sql`
    delete from client_addresses where id = ${propertyId} and client_id = ${clientId}`;
  // Keep exactly one primary while any property exists.
  await sql`
    update client_addresses set is_primary = true
    where id = (select id from client_addresses
                where client_id = ${clientId} order by created_at limit 1)
      and not exists (select 1 from client_addresses
                      where client_id = ${clientId} and is_primary = true)
  `;
  revalidate(clientId);
}

// ----------------------------------------------------------------- contacts
export async function addContact(
  clientId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const input: ContactInput = {
    name: String(formData.get("name") ?? ""),
    role: String(formData.get("role") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
  const errors = validateContactInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  if (!(await mustOwn(clientId))) return { ok: false, message: "Client not found." };

  const count = await sql<{ n: number }[]>`
    select count(*)::int as n from client_contacts where client_id = ${clientId}`;
  await sql`
    insert into client_contacts (client_id, name, role, phone, email, is_primary, notes)
    values (${clientId}, ${input.name.trim()}, ${input.role.trim()},
            ${input.phone.trim()}, ${input.email.trim()},
            ${count[0].n === 0}, ${input.notes.trim()})
  `;
  revalidate(clientId);
  return { ok: true };
}

export async function deleteContact(
  clientId: string,
  contactId: string,
): Promise<void> {
  await requireAdmin();
  await sql`
    delete from client_contacts where id = ${contactId} and client_id = ${clientId}`;
  revalidate(clientId);
}

// -------------------------------------------------------------------- notes
export async function addNote(
  clientId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const content = String(formData.get("content") ?? "");
  const errors = validateNote(content);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  if (!(await mustOwn(clientId))) return { ok: false, message: "Client not found." };
  await sql`
    insert into client_notes (client_id, author, content)
    values (${clientId}, 'admin', ${content.trim()})
  `;
  revalidate(clientId);
  return { ok: true };
}

export async function deleteNote(
  clientId: string,
  noteId: string,
): Promise<void> {
  await requireAdmin();
  await sql`
    delete from client_notes where id = ${noteId} and client_id = ${clientId}`;
  revalidate(clientId);
}

// --------------------------------------------------------------------- tags
export async function addTag(
  clientId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const errors = validateTag(name);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const companyId = await mustOwn(clientId);
  if (!companyId) return { ok: false, message: "Client not found." };

  const tag = await sql<{ id: string }[]>`
    insert into tags (company_id, name)
    values (${companyId}, ${name})
    on conflict (company_id, name) do update set name = excluded.name
    returning id
  `;
  await sql`
    insert into client_tags (client_id, tag_id)
    values (${clientId}, ${tag[0].id})
    on conflict do nothing
  `;
  revalidate(clientId);
  return { ok: true };
}

export async function removeTag(
  clientId: string,
  tagId: string,
): Promise<void> {
  await requireAdmin();
  await sql`
    delete from client_tags where client_id = ${clientId} and tag_id = ${tagId}`;
  revalidate(clientId);
}

// ----------------------------------------------------------- communications
export async function logMessage(
  clientId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const input: MessageInput = {
    channel: String(formData.get("channel") ?? "email"),
    subject: String(formData.get("subject") ?? ""),
    body: String(formData.get("body") ?? ""),
  };
  const errors = validateMessage(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const companyId = await mustOwn(clientId);
  if (!companyId) return { ok: false, message: "Client not found." };

  // Recorded as a communication row (status 'logged'). Actual provider
  // delivery (SMTP/SMS/WhatsApp) lands with the email integration phase.
  await sql`
    insert into communications
      (company_id, client_id, channel, direction, subject, body, status, sent_at)
    values
      (${companyId}, ${clientId}, ${input.channel}, 'outbound',
       ${input.subject.trim()}, ${input.body.trim()}, 'logged', now())
  `;
  revalidate(clientId);
  return { ok: true };
}

// -------------------------------------------------------------------- files
const MANUAL_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export async function uploadClientFile(
  clientId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const entry = formData.get("file");
  if (!(entry instanceof File) || entry.size === 0) {
    return { ok: false, message: "Choose a file." };
  }
  if (entry.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, message: "File must be up to 8 MB." };
  }
  const buf = Buffer.from(await entry.arrayBuffer());
  const isPdf =
    buf.length >= 5 &&
    buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 &&
    buf[3] === 0x46 && buf[4] === 0x2d;
  const sniffed = sniffImageMime(new Uint8Array(buf));
  const mime = isPdf ? "application/pdf" : sniffed;
  if (!mime || !(MANUAL_MIME as readonly string[]).includes(mime)) {
    return { ok: false, message: "Only JPG, PNG, WEBP or PDF files are allowed." };
  }
  if (!(await mustOwn(clientId))) return { ok: false, message: "Client not found." };
  await sql`
    insert into client_files (client_id, file_name, mime_type, file_size, data)
    values (${clientId}, ${entry.name.slice(0, 200)}, ${mime}, ${entry.size}, ${buf})
  `;
  revalidate(clientId);
  return { ok: true };
}

export async function deleteClientFile(
  clientId: string,
  fileId: string,
): Promise<void> {
  await requireAdmin();
  await sql`
    delete from client_files where id = ${fileId} and client_id = ${clientId}`;
  revalidate(clientId);
}

// -------------------------------------------------------------- appointments
export async function addAppointment(
  clientId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const input: AppointmentInput = {
    title: String(formData.get("title") ?? ""),
    kind: String(formData.get("kind") ?? "visit"),
    startsAt: String(formData.get("startsAt") ?? ""),
    endsAt: String(formData.get("endsAt") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
  const errors = validateAppointment(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const companyId = await mustOwn(clientId);
  if (!companyId) return { ok: false, message: "Client not found." };
  await sql`
    insert into appointments
      (company_id, client_id, title, kind, starts_at, ends_at, notes)
    values
      (${companyId}, ${clientId}, ${input.title.trim()}, ${input.kind},
       ${input.startsAt}, ${input.endsAt || null}, ${input.notes.trim()})
  `;
  revalidate(clientId);
  return { ok: true };
}

export async function setAppointmentStatus(
  clientId: string,
  appointmentId: string,
  status: string,
): Promise<void> {
  await requireAdmin();
  if (!["scheduled", "done", "cancelled"].includes(status)) return;
  await sql`
    update appointments set status = ${status}
    where id = ${appointmentId} and client_id = ${clientId}`;
  revalidate(clientId);
}

/** Schedule Assessment: creates an assessment linked to client + request. */
export async function createAssessment(
  requestId: string,
): Promise<{ ok: boolean; clientId?: string; message?: string }> {
  await requireAdmin();
  const rows = await sql<{ company_id: string; client_id: string; number: string }[]>`
    select company_id, client_id, number from requests where id = ${requestId} limit 1
  `;
  if (!rows[0]) return { ok: false, message: "Request not found." };
  const starts = new Date(Date.now() + 24 * 3600 * 1000);
  await sql`
    insert into appointments
      (company_id, client_id, request_id, title, kind, starts_at, notes)
    values
      (${rows[0].company_id}, ${rows[0].client_id}, ${requestId},
       ${`On-site assessment · ${rows[0].number}`}, 'assessment',
       ${starts.toISOString()}, 'Created from the request.')
  `;
  await sql`
    insert into activity_log (company_id, actor, action, entity, entity_id, summary)
    values (${rows[0].company_id}, 'admin', 'request.assessment_scheduled',
            'request', ${requestId}, ${`Assessment scheduled for ${rows[0].number}`})
  `;
  revalidatePath(`/solicitacoes/${requestId}`);
  revalidatePath(`/clientes/${rows[0].client_id}`);
  return { ok: true, clientId: rows[0].client_id };
}

// ------------------------------------------------------- full new client
/**
 * Replicates the reference New Client form: profile + lead source +
 * consents + N contacts + N properties in a single transaction.
 * `intent` is "save" (go to ficha) or "another" (back to blank form).
 */
export async function createClientFull(
  formData: FormData,
): Promise<{ ok: boolean; errors?: Record<string, string>; message?: string }> {
  await requireAdmin();
  const intent = String(formData.get("intent") ?? "save");
  const parse = <T>(key: string, fallback: T): T => {
    const raw = formData.get(key);
    if (typeof raw !== "string") return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  };

  const payload: NewClientPayload = {
    profile: parse("profile", {
      title: "",
      firstName: "",
      lastName: "",
      companyName: "",
      clientType: "individual",
      status: "active",
      email: "",
      phone: "",
      phoneMobile: "",
      paymentTerms: "due_on_receipt",
      paymentTermsCustom: "",
      askForReview: true,
    }),
    leadSourceId: String(formData.get("leadSourceId") ?? ""),
    marketingEmail: formData.get("marketingEmail") === "true",
    marketingSms: formData.get("marketingSms") === "true",
    contacts: parse<ContactInput[]>("contacts", []),
    properties: parse<FullPropertyInput[]>("properties", []),
  };

  const company = await sql<{ id: string }[]>`
    select id from companies where slug = 'moving-london' limit 1
  `;
  if (!company[0]) return { ok: false, message: "Company not found." };
  const companyId = company[0].id;

  const sources = await sql<{ id: string }[]>`
    select id from lead_sources where company_id = ${companyId} and active = true
  `;
  const errors = validateNewClient(
    payload,
    sources.map((s) => s.id),
  );
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors, message: "Please review the highlighted fields." };
  }

  const email = payload.profile.email.trim();
  const dup = await sql<{ id: string }[]>`
    select id from clients where company_id = ${companyId} and email = ${email} limit 1
  `;
  if (dup[0]) {
    return { ok: false, errors: { email: "A client with this email already exists" } };
  }

  const p = payload.profile;
  const created = await sql.begin(async (tx) => {
    const [client] = await tx<{ id: string }[]>`
      insert into clients
        (company_id, title, first_name, last_name, company_name, client_type,
         status, email, phone, phone_mobile, payment_terms, payment_terms_custom,
         ask_for_review, marketing_email_consent, marketing_sms_consent, lead_source_id)
      values
        (${companyId}, ${p.title.trim()}, ${p.firstName.trim()}, ${p.lastName.trim()},
         ${p.companyName.trim() || null}, ${p.clientType}, ${p.status},
         ${email}, ${p.phone.trim()}, ${p.phoneMobile.trim()},
         ${p.paymentTerms},
         ${p.paymentTerms === "custom" ? p.paymentTermsCustom.trim() : null},
         ${p.askForReview}, ${payload.marketingEmail}, ${payload.marketingSms},
         ${payload.leadSourceId || null})
      returning id
    `;
    for (let i = 0; i < payload.contacts.length; i++) {
      const ct = payload.contacts[i];
      await tx`
        insert into client_contacts (client_id, name, role, phone, email, is_primary, notes)
        values (${client.id}, ${ct.name.trim()}, ${ct.role.trim()},
                ${ct.phone.trim()}, ${ct.email.trim()}, ${i === 0}, ${ct.notes.trim()})
      `;
    }
    for (let i = 0; i < payload.properties.length; i++) {
      const a = payload.properties[i];
      await tx`
        insert into client_addresses
          (client_id, label, address_line, street_2, city, county, postcode,
           country, tax_rate, instructions, is_primary, is_billing)
        values (${client.id}, ${a.label}, ${a.addressLine.trim()},
                ${a.street2.trim()}, ${a.city.trim()}, ${a.county.trim()},
                ${a.postcode.trim()}, ${a.country.trim() || "United Kingdom"},
                ${a.taxRate.trim() || null}, ${a.instructions.trim()},
                ${i === 0}, ${a.billingSame})
      `;
    }
    await tx`
      insert into activity_log (company_id, actor, action, entity, entity_id, summary)
      values (${companyId}, 'admin', 'client.created', 'client', ${client.id},
              ${`Client ${p.firstName.trim()} ${p.lastName.trim()} created (full form)`})
    `;
    return client.id;
  });

  revalidatePath("/clientes");
  if (intent === "another") redirect("/clientes/novo?created=1");
  redirect(`/clientes/${created}`);
}
