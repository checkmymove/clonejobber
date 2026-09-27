"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAllowedAdminEmail, safeNextPath } from "@/lib/auth/allowlist";
import { sql } from "@/lib/db";
import { getClientIp } from "@/lib/ratelimit";
import { consumeRateLimit, rateLimitOpen } from "@/lib/requests/submit-limit";
import { createSupabaseServer } from "@/lib/supabase/server";

const AUTH_FAIL = "Email or password is incorrect.";
const LOGIN_FAIL_LIMIT = 20;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export interface AuthState {
  ok: boolean;
  message?: string;
}

export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? "/"));

  if (!process.env.ADMIN_EMAIL?.trim()) {
    return { ok: false, message: "Administrator access is not configured yet." };
  }

  const ip = getClientIp(await headers());
  const bucket = `login-fail:${ip}`;
  const gate = await rateLimitOpen(bucket, LOGIN_FAIL_LIMIT);
  if (!gate.ok) {
    return {
      ok: false,
      message: `Too many attempts. Try again in ${gate.retryAfterSec}s.`,
    };
  }
  if (!password) {
    return { ok: false, message: "Enter your password." };
  }

  const supabase = await createSupabaseServer();
  const { data, error } = !isAllowedAdminEmail(email)
    ? { data: { user: null }, error: true }
    : await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    await consumeRateLimit(bucket, LOGIN_FAIL_LIMIT, LOGIN_WINDOW_MS);
    return { ok: false, message: AUTH_FAIL };
  }

  await sql`
    insert into profiles (id, email, role)
    values (${data.user.id}, ${email}, 'admin')
    on conflict (id) do update set email = excluded.email
  `;

  redirect(next);
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
