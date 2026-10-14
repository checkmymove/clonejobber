"use server";

import { requireAdmin } from "@/lib/auth/session";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { getCompanyId } from "@/lib/company";
import {
  deletePayment,
  recordPayment,
  updatePaymentDetails,
  type PaymentInput,
  type PaymentResult,
} from "@/lib/payments/engine";
import { sendPaymentReceipt } from "@/lib/payments/receipt";

function refresh(paymentId?: string) {
  revalidatePath("/pagamentos");
  if (paymentId) revalidatePath(`/pagamentos/${paymentId}`);
  revalidatePath("/faturas", "layout");
  revalidatePath("/servicos", "layout");
  revalidatePath("/clientes", "layout");
  revalidatePath("/agenda");
  revalidatePath("/");
}

/** Only internal paths are allowed as the page to return to after saving. */
function safeReturn(path: string | undefined): string | null {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return null;
  return path;
}

export async function createPayment(
  input: PaymentInput,
  options: { emailReceipt?: boolean; returnTo?: string } = {},
): Promise<PaymentResult> {
  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const saved = await sql.begin((tx: any) => recordPayment(tx, companyId, input));
  if (!saved.ok || !saved.id) return saved;
  refresh(saved.id);

  if (options.emailReceipt) {
    const sent = await sendPaymentReceipt(companyId, saved.id);
    if (!sent.ok) {
      return { ok: false, id: saved.id, message: `Payment saved. Receipt not sent: ${sent.message}` };
    }
  }
  redirect(safeReturn(options.returnTo) ?? `/pagamentos/${saved.id}`);
}

export async function updatePayment(
  paymentId: string,
  input: { method: string; paidOn: string; reference: string; details: string },
): Promise<PaymentResult> {
  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };
  const result = await updatePaymentDetails(sql, companyId, paymentId, input);
  if (result.ok) refresh(paymentId);
  return result;
}

export async function removePayment(paymentId: string): Promise<PaymentResult> {
  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await sql.begin((tx: any) => deletePayment(tx, companyId, paymentId));
  if (!result.ok) return result;
  refresh(paymentId);
  redirect("/pagamentos");
}

export async function emailPaymentReceipt(paymentId: string): Promise<PaymentResult> {
  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };
  const sent = await sendPaymentReceipt(companyId, paymentId);
  if (sent.ok) refresh(paymentId);
  return { ok: sent.ok, id: paymentId, message: sent.message };
}
