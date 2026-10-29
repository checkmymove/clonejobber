"use server";

import { requireAdmin } from "@/lib/auth/session";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import {
  validateClientInput,
  type ClientInput,
  type Errors,
} from "@/lib/clients/validation";

const COMPANY_SLUG = "moving-london";

async function companyId(): Promise<string | null> {
  const rows = await sql<{ id: string }[]>`
    select id from companies where slug = ${COMPANY_SLUG} limit 1
  `;
  return rows[0]?.id ?? null;
}

export interface ActionResult {
  ok: boolean;
  errors?: Errors;
  message?: string;
}

/** Manual client creation. Internal notes live in client_notes (Notes card). */
export async function createClient(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const input: ClientInput = {
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    companyName: String(formData.get("companyName") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    notes: "",
  };
  const errors = validateClientInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const cid = await companyId();
  if (!cid) return { ok: false, message: "Company not found." };

  try {
    const rows = await sql<{ id: string }[]>`
      insert into clients
        (company_id, first_name, last_name, company_name, email, phone,
         marketing_email_consent, marketing_sms_consent)
      values
        (${cid}, ${input.firstName.trim()}, ${input.lastName.trim()},
         ${input.companyName.trim() || null}, ${input.email.trim()},
         ${input.phone.trim()}, true, true)
      returning id
    `;
    await sql`
      insert into activity_log (company_id, actor, action, entity, entity_id, summary)
      values (${cid}, 'admin', 'client.created', 'client', ${rows[0].id},
              ${`Client ${input.firstName.trim()} ${input.lastName.trim()} created manually`})
    `;
    revalidatePath("/clientes");
    redirect(`/clientes/${rows[0].id}`);
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "code" in e && e.code === "23505") {
      return {
        ok: false,
        errors: { email: "A client with this email already exists" },
      };
    }
    throw e;
  }
}

export type ClientContactInput = {
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  phone: string;
};

/** Pencil on the client box of a quote, job or invoice: updates the client everywhere. */
export async function saveClientContact(clientId: string, input: ClientContactInput): Promise<ActionResult> {
  await requireAdmin();
  const { isValidEmail, isValidPhone } = await import("@/lib/requests/validation");
  const errors: Errors = {};
  if (!input.firstName.trim()) errors.firstName = "First name is required";
  if (!input.lastName.trim()) errors.lastName = "Last name is required";
  if (!input.email.trim()) errors.email = "Email is required";
  else if (!isValidEmail(input.email)) errors.email = "Enter a valid email address";
  if (!input.phone.trim()) errors.phone = "Phone is required";
  else if (!isValidPhone(input.phone)) errors.phone = "Enter a valid phone number";
  if (Object.keys(errors).length) return { ok: false, errors, message: "Check the highlighted fields." };

  const company = await companyId();
  if (!company) return { ok: false, message: "Company not found." };
  const rows = await sql`
    update clients set
      first_name = ${input.firstName.trim()},
      last_name = ${input.lastName.trim()},
      company_name = ${input.companyName.trim() || null},
      email = ${input.email.trim()},
      phone = ${input.phone.trim()},
      updated_at = now()
    where id = ${clientId} and company_id = ${company}
    returning id
  `;
  if (!rows[0]) return { ok: false, message: "Client not found." };
  // The client's name and contact show on every funnel page.
  revalidatePath("/", "layout");
  return { ok: true };
}
