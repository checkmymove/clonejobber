import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/session";
import { COMPANY_SLUG } from "@/lib/company";
import { getNotifications } from "@/lib/notifications";
import { getShellAlerts } from "@/lib/shell";

export const dynamic = "force-dynamic";

/** The bell's feed and attention counts, polled by the top bar. */
export async function GET() {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  const [notifications, alerts] = await Promise.all([getNotifications(COMPANY_SLUG), getShellAlerts(COMPANY_SLUG)]);
  return NextResponse.json({ ok: true, notifications, alerts });
}
