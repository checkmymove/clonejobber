"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { isUuid } from "@/lib/funnel/validation";
import { buildSendDraft } from "./drafts";
import { deliverEmail, deliverSms } from "./deliver";
import { sql } from "@/lib/db";
import { getCompanyId } from "@/lib/company";
import {
  ATTACHMENT_FILE_MAX_BYTES,
  ATTACHMENT_TYPES,
  type SendAttachment,
  type SendDraft,
  type SendKind,
  type SendOutcome,
} from "./types";

const KINDS: SendKind[] = ["request", "quote", "job", "invoice"];

const PATHS: Record<SendKind, string> = {
  request: "/solicitacoes",
  quote: "/cotacoes",
  job: "/servicos",
  invoice: "/faturas",
};

export async function prepareSend(
  kind: SendKind,
  id: string,
): Promise<{ ok: boolean; message?: string; draft?: SendDraft }> {
  await requireAdmin();
  if (!KINDS.includes(kind) || !isUuid(id)) return { ok: false, message: "Document not found." };
  return buildSendDraft(kind, id);
}

/** Sends the email (with the PDF) and the text in one click. Each channel reports its own result. */
export async function sendDocument(input: {
  kind: SendKind;
  id: string;
  email: {
    to: string;
    subject: string;
    message: string;
    copyToSender: boolean;
    attachPdf: boolean;
    attachmentIds?: string[];
  } | null;
  sms: { to: string; message: string } | null;
}): Promise<SendOutcome> {
  await requireAdmin();
  if (!KINDS.includes(input.kind) || !isUuid(input.id)) return { ok: false, message: "Document not found." };
  if (!input.email && !input.sms) return { ok: false, message: "Choose email, text or both." };
  const prepared = await buildSendDraft(input.kind, input.id);
  if (!prepared.ok) return { ok: false, message: prepared.message };

  const email = input.email ? await deliverEmail(prepared.draft, input.email) : undefined;
  const sms = input.sms ? await deliverSms(prepared.draft, input.sms) : undefined;

  revalidatePath(PATHS[input.kind]);
  revalidatePath(`${PATHS[input.kind]}/${input.id}`);
  revalidatePath("/clientes");
  revalidatePath("/");
  // The email is what reaches the client today; texts wait for an SMS provider.
  const ok = email ? email.ok : Boolean(sms?.ok);
  return { ok, email, sms, message: ok ? undefined : (email?.message ?? sms?.message) };
}

/** "Attachments › Select or drag files here to upload": one file per call. */
export async function uploadSendAttachment(
  formData: FormData,
): Promise<{ ok: boolean; message?: string; attachment?: SendAttachment }> {
  await requireAdmin();
  const kind = String(formData.get("kind") ?? "") as SendKind;
  const id = String(formData.get("id") ?? "");
  const file = formData.get("file");
  if (!KINDS.includes(kind) || !isUuid(id)) return { ok: false, message: "Document not found." };
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose a file." };
  if (file.size > ATTACHMENT_FILE_MAX_BYTES) return { ok: false, message: `${file.name} is larger than 4 MB.` };
  const type = file.type || "application/octet-stream";
  if (!ATTACHMENT_TYPES.includes(type)) return { ok: false, message: `${file.name}: use a photo, PDF, Word, Excel or text file.` };
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };
  const name = file.name.replace(/[\r\n"]/g, "").slice(0, 180) || "attachment";
  const rows = await sql<{ id: string }[]>`
    insert into send_attachments (company_id, kind, document_id, file_name, mime_type, file_size, data)
    values (${companyId}, ${kind}, ${id}, ${name}, ${type}, ${file.size}, ${Buffer.from(await file.arrayBuffer())})
    returning id
  `;
  return { ok: true, attachment: { id: rows[0].id, name, size: file.size, type } };
}

export async function removeSendAttachment(attachmentId: string): Promise<{ ok: boolean }> {
  await requireAdmin();
  if (!isUuid(attachmentId)) return { ok: false };
  const companyId = await getCompanyId();
  await sql`delete from send_attachments where id = ${attachmentId} and company_id = ${companyId}`;
  return { ok: true };
}

