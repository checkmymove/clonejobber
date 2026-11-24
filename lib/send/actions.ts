"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { isUuid } from "@/lib/funnel/validation";
import { buildSendDraft } from "./drafts";
import { deliverEmail, deliverSms } from "./deliver";
import { sql } from "@/lib/db";
import { getCompanyId } from "@/lib/company";
import {
  ATTACHMENT_CHUNK_BYTES,
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
/**
 * Uploads one attachment in chunks of up to 3 MB (Vercel caps a request body at 4.5 MB).
 * The first chunk creates the row with the file's declared size; the next ones
 * (with `attachmentId`) append to it, never past that size.
 */
export async function uploadSendAttachment(
  formData: FormData,
): Promise<{ ok: boolean; message?: string; attachment?: SendAttachment }> {
  await requireAdmin();
  const chunk = formData.get("chunk") ?? formData.get("file");
  if (!(chunk instanceof Blob) || chunk.size === 0) return { ok: false, message: "Choose a file." };
  if (chunk.size > ATTACHMENT_CHUNK_BYTES + 1024) return { ok: false, message: "Upload chunk too large." };
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };
  const bytes = Buffer.from(await chunk.arrayBuffer());

  const attachmentId = String(formData.get("attachmentId") ?? "");
  if (attachmentId) {
    if (!isUuid(attachmentId)) return { ok: false, message: "Attachment not found." };
    const rows = await sql<{ id: string; file_name: string; mime_type: string; file_size: number }[]>`
      update send_attachments set data = data || ${bytes}
      where id = ${attachmentId} and company_id = ${companyId}
        and octet_length(data) + ${bytes.length} <= file_size
      returning id, file_name, mime_type, file_size
    `;
    if (!rows[0]) return { ok: false, message: "Could not finish the upload. Try again." };
    return { ok: true, attachment: { id: rows[0].id, name: rows[0].file_name, size: rows[0].file_size, type: rows[0].mime_type } };
  }

  const kind = String(formData.get("kind") ?? "") as SendKind;
  const id = String(formData.get("id") ?? "");
  if (!KINDS.includes(kind) || !isUuid(id)) return { ok: false, message: "Document not found." };
  const fileName = String(formData.get("name") ?? (chunk instanceof File ? chunk.name : "")) || "attachment";
  const size = Number(formData.get("size") ?? bytes.length);
  if (!Number.isFinite(size) || size < bytes.length) return { ok: false, message: "Choose a file." };
  if (size > ATTACHMENT_FILE_MAX_BYTES) return { ok: false, message: `${fileName} is larger than 20 MB.` };
  const type = String(formData.get("type") ?? "") || chunk.type || "application/octet-stream";
  if (!ATTACHMENT_TYPES.includes(type)) return { ok: false, message: `${fileName}: use a photo, PDF, Word, Excel or text file.` };
  const name = fileName.replace(/[\r\n"]/g, "").slice(0, 180) || "attachment";
  const rows = await sql<{ id: string }[]>`
    insert into send_attachments (company_id, kind, document_id, file_name, mime_type, file_size, data)
    values (${companyId}, ${kind}, ${id}, ${name}, ${type}, ${size}, ${bytes})
    returning id
  `;
  return { ok: true, attachment: { id: rows[0].id, name, size, type } };
}

export async function removeSendAttachment(attachmentId: string): Promise<{ ok: boolean }> {
  await requireAdmin();
  if (!isUuid(attachmentId)) return { ok: false };
  const companyId = await getCompanyId();
  await sql`delete from send_attachments where id = ${attachmentId} and company_id = ${companyId}`;
  return { ok: true };
}

