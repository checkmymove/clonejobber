import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import {
  consumeOAuthState,
  exchangeGoogleCode,
  googleAccountEmail,
  upsertGoogleTokens,
} from "@/lib/email/google";

export async function GET(request: Request) {
  await requireAdmin();
  const origin = new URL(request.url).origin;
  const settings = (query: string) =>
    NextResponse.redirect(new URL(`/configuracoes/email?${query}`, origin));

  const url = new URL(request.url);
  const err = url.searchParams.get("error");
  if (err) return settings(`error=${encodeURIComponent(err)}`);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return settings("error=invalid_state");

  const companyId = await consumeOAuthState(state);
  if (!companyId) return settings("error=invalid_state");

  try {
    const tokens = await exchangeGoogleCode(code);
    const email = await googleAccountEmail(tokens.access_token);
    await upsertGoogleTokens(companyId, email, tokens);
    return settings("connected=1");
  } catch (e) {
    const message = e instanceof Error ? e.message : "oauth_failed";
    return settings(`error=${encodeURIComponent(message)}`);
  }
}

export const dynamic = "force-dynamic";
