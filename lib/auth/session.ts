import "server-only";
import { redirect } from "next/navigation";
import { isAllowedAdminEmail } from "@/lib/auth/allowlist";
import { createSupabaseServer, supabasePublicKey } from "@/lib/supabase/server";

export async function getAdminUser() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !supabasePublicKey()) return null;
  if (!process.env.ADMIN_EMAIL?.trim()) return null;

  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user || !isAllowedAdminEmail(user.email)) return null;
  return user;
}

/** Sends unauthenticated callers to /login. Use before any owner-connection query. */
export async function requireAdmin() {
  const user = await getAdminUser();
  if (!user) redirect("/login");
  return user;
}
