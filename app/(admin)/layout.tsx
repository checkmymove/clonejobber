import { cookies } from "next/headers";
import { AppShell } from "@/components/layout/app-shell";
import { requireAdmin } from "@/lib/auth/session";
import { COMPANY_SLUG } from "@/lib/company";
import { getNotifications, NOTIFICATIONS_SEEN_COOKIE } from "@/lib/notifications";
import { getShellAlerts, getShellProfile } from "@/lib/shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();
  const email = user.email ?? "";
  const [profile, alerts, notifications, jar] = await Promise.all([
    getShellProfile(COMPANY_SLUG, email),
    getShellAlerts(COMPANY_SLUG),
    getNotifications(COMPANY_SLUG),
    cookies(),
  ]);
  const seenAt = Number(jar.get(NOTIFICATIONS_SEEN_COOKIE)?.value) || 0;
  return (
    <AppShell email={email} profile={profile} alerts={alerts} notifications={notifications} seenAt={seenAt}>
      {children}
    </AppShell>
  );
}
