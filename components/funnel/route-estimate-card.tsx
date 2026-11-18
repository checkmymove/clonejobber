import { Route } from "lucide-react";
import { CARD_TITLE, CardIcon } from "@/components/card-icon";
import { Card } from "@/components/ui";
import { estimateRoute } from "@/lib/geo/route";
import { formatDuration } from "@/lib/geo/route-math";

/**
 * One-line box under Collection and Delivery on the Request, Quote and Job pages:
 * miles between the two addresses and the estimated drive time.
 */
export async function RouteEstimateCard({ collection, delivery }: { collection: string; delivery: string }) {
  if (!collection.trim() || !delivery.trim()) return null;
  const route = await estimateRoute(collection, delivery);

  return (
    <Card className="h-fit px-5 py-4 xl:col-span-2">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex items-center gap-3">
          <CardIcon icon={Route} tone="orange" boxed />
          <h2 className={CARD_TITLE}>Route estimate</h2>
        </div>
        {route ? (
          <>
            <p className="text-sm text-ink-soft">
              Distance <span className="ml-1 text-base font-bold text-ink">{route.miles} miles</span>
            </p>
            <p className="text-sm text-ink-soft">
              Est. drive time <span className="ml-1 text-base font-bold text-ink">{formatDuration(route.minutes)}</span>
            </p>
            <p className="text-xs text-ink-mute">
              {route.source === "road" ? "By road, with London traffic" : "Approximate, from the postcodes"}
            </p>
          </>
        ) : (
          <p className="text-sm text-ink-mute">Add a UK postcode to both addresses to estimate miles and time.</p>
        )}
      </div>
    </Card>
  );
}
