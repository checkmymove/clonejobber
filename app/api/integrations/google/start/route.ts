import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { requireAdmin } from "@/lib/auth/session";
import { getCompanyId } from "@/lib/company";
import { googleAuthUrl } from "@/lib/email/config";
import { saveOAuthState } from "@/lib/email/google";

export async function GET(request: Request) {
  await requireAdmin();
  const origin = new URL(request.url).origin;
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(new URL("/configuracoes/email?error=missing_oauth", origin));
  }

  const companyId = await getCompanyId();
  if (!companyId) {
    return NextResponse.redirect(new URL("/configuracoes/email?error=company", origin));
  }

  const state = randomBytes(16).toString("hex");
  await saveOAuthState(companyId, state);
  return NextResponse.redirect(googleAuthUrl(state));
}
