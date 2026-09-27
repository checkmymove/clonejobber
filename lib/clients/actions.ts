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
        (company_id, first_name, last_name, company_name, email, phone)
      values
        (${cid}, ${input.firstName.trim()}, ${input.lastName.trim()},
         ${input.companyName.trim() || null}, ${input.email.trim()},
         ${input.phone.trim()})
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
