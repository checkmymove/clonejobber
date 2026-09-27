"use server";

import { redirect } from "next/navigation";
import { isAllowedAdminEmail, safeNextPath } from "@/lib/auth/allowlist";
import { sql } from "@/lib/db";
import { createSupabaseServer } from "@/lib/supabase/server";

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
    return { ok: false, message: "O acesso de administrador ainda não está configurado." };
  }
  if (!isAllowedAdminEmail(email)) {
    return { ok: false, message: "Esta conta não tem acesso." };
  }
  if (!password) {
    return { ok: false, message: "Indique a senha." };
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return { ok: false, message: "E-mail ou senha incorretos." };
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
