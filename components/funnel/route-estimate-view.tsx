import { Route } from "lucide-react";
import { CARD_TITLE, CardIcon } from "@/components/card-icon";
import { Card } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatDuration, type RouteEstimate } from "@/lib/geo/route-math";

/** The Route estimate box: miles and drive time between collection and delivery. */
export function RouteEstimateView({
  route,
  loading = false,
  className,
}: {
  route: RouteEstimate | null;
  loading?: boolean;
  className?: string;
}) {
  return (
    <Card className={cn("h-fit px-5 py-4", className)}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex items-center gap-3">
          <CardIcon icon={Route} tone="orange" boxed />
          <h2 className={CARD_TITLE}>Route estimate</h2>
        </div>
        {loading ? (
          <p className="text-sm text-ink-mute">Working out miles and drive time…</p>
        ) : route ? (
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
