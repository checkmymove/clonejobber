import "server-only";
import { sql } from "@/lib/db";
import { TEMPLATE_CATALOG, TEMPLATE_KEYS, type TemplateKey } from "./catalog";

export type ResolvedTemplate = {
  key: TemplateKey;
  email: { subject: string; body: string; custom: boolean };
  sms: { body: string; custom: boolean } | null;
};

type Row = { key: string; channel: "email" | "sms"; subject: string; body: string };

function resolve(key: TemplateKey, rows: Row[]): ResolvedTemplate {
  const base = TEMPLATE_CATALOG[key];
  const email = rows.find((r) => r.key === key && r.channel === "email");
  const sms = rows.find((r) => r.key === key && r.channel === "sms");
  return {
    key,
    email: email
      ? { subject: email.subject, body: email.body, custom: true }
      : { ...base.email, custom: false },
    sms: base.sms === null && !sms ? null : sms ? { body: sms.body, custom: true } : { body: base.sms ?? "", custom: false },
  };
}

/** The account's version of every template, falling back to Jobber's default text. */
export async function listTemplates(companyId: string): Promise<ResolvedTemplate[]> {
  const rows = await sql<Row[]>`
    select key, channel, subject, body from message_templates where company_id = ${companyId}
  `;
  return TEMPLATE_KEYS.map((key) => resolve(key, rows));
}

export async function getTemplate(companyId: string, key: TemplateKey): Promise<ResolvedTemplate> {
  const rows = await sql<Row[]>`
    select key, channel, subject, body from message_templates
    where company_id = ${companyId} and key = ${key}
  `.catch(() => [] as Row[]);
  return resolve(key, rows);
}
