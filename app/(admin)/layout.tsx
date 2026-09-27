import { AppShell } from "@/components/layout/app-shell";
import { requireAdmin } from "@/lib/auth/session";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();
  return <AppShell email={user.email ?? ""}>{children}</AppShell>;
}
