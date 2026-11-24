import { estimateRoute } from "@/lib/geo/route";
import { RouteEstimateView } from "@/components/funnel/route-estimate-view";

/**
 * One-line box under Collection and Delivery on the Request, Quote and Job pages (and on
 * the client's quote and job): miles between the two addresses and the estimated drive time.
 */
export async function RouteEstimateCard({
  collection,
  delivery,
  className = "xl:col-span-2",
}: {
  collection: string;
  delivery: string;
  className?: string;
}) {
  if (!collection.trim() || !delivery.trim()) return null;
  const route = await estimateRoute(collection, delivery);
  return <RouteEstimateView route={route} className={className} />;
}
