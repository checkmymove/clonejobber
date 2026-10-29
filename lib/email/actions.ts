"use server";

import { requireAdmin } from "@/lib/auth/session";

import { revalidatePath } from "next/cache";
import { getCompanyId } from "@/lib/company";
import { deleteGoogleConnection } from "@/lib/email/google";
import type { ActionResult } from "@/lib/funnel/engine";

export async function disconnectGmail(): Promise<ActionResult> {
  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };
  await deleteGoogleConnection(companyId);
  revalidatePath("/configuracoes/email");
  return { ok: true };
}
