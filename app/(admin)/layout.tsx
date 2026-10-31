import { AppShell } from "@/components/layout/app-shell";
import { requireAdmin } from "@/lib/auth/session";
import { COMPANY_SLUG } from "@/lib/company";
import { getShellAlerts, getShellProfile } from "@/lib/shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();
  const email = user.email ?? "";
  const [profile, alerts] = await Promise.all([getShellProfile(COMPANY_SLUG, email), getShellAlerts(COMPANY_SLUG)]);
  return (
    <AppShell email={email} profile={profile} alerts={alerts}>
      {children}
    </AppShell>
  );
}
