"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { getCompanyId } from "@/lib/company";
import { sql } from "@/lib/db";
import { TEMPLATE_CATALOG, isTemplateKey } from "./catalog";

export type TemplateActionResult = { ok: boolean; message?: string };

export async function saveTemplateAction(input: {
  key: string;
  channel: "email" | "sms";
  subject: string;
  body: string;
}): Promise<TemplateActionResult> {
  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };
  if (!isTemplateKey(input.key)) return { ok: false, message: "Unknown template." };
  if (input.channel !== "email" && input.channel !== "sms") return { ok: false, message: "Unknown channel." };
  if (input.channel === "sms" && TEMPLATE_CATALOG[input.key].sms === null) {
    return { ok: false, message: "This template has no text message." };
  }
  const subject = input.channel === "email" ? input.subject.replace(/[\r\n]+/g, " ").trim() : "";
  const body = input.body.trim();
  if (input.channel === "email" && !subject) return { ok: false, message: "Subject is required." };
  if (!body) return { ok: false, message: "Message is required." };
  if (body.length > 10000) return { ok: false, message: "Message is too long." };

  await sql`
    insert into message_templates (company_id, key, channel, subject, body)
    values (${companyId}, ${input.key}, ${input.channel}, ${subject}, ${body})
    on conflict (company_id, key, channel)
    do update set subject = excluded.subject, body = excluded.body, updated_at = now()
  `;
  revalidatePath("/configuracoes/email");
  return { ok: true };
}

/** Jobber "Reset": back to the default text. */
export async function resetTemplateAction(key: string, channel: "email" | "sms"): Promise<TemplateActionResult> {
  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };
  if (!isTemplateKey(key)) return { ok: false, message: "Unknown template." };
  await sql`
    delete from message_templates where company_id = ${companyId} and key = ${key} and channel = ${channel}
  `;
  revalidatePath("/configuracoes/email");
  return { ok: true };
}
