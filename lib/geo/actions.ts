"use server";

import { requireAdmin } from "@/lib/auth/session";
import { estimateRoute, type RouteEstimate } from "@/lib/geo/route";

/** Route estimate for forms that change the addresses in the browser (New quote). */
export async function estimateRouteAction(collection: string, delivery: string): Promise<RouteEstimate | null> {
  await requireAdmin();
  if (!collection.trim() || !delivery.trim()) return null;
  return estimateRoute(collection.slice(0, 300), delivery.slice(0, 300));
}
