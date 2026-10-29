"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { isUuid } from "@/lib/funnel/validation";
import { buildSendDraft } from "./drafts";
import { deliverEmail, deliverSms } from "./deliver";
import type { SendDraft, SendKind, SendOutcome } from "./types";

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
  email: { to: string; subject: string; message: string; copyToSender: boolean; attachPdf: boolean } | null;
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
