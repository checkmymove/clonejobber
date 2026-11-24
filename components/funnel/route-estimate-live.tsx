"use client";

import { useEffect, useState } from "react";
import { estimateRouteAction } from "@/lib/geo/actions";
import type { RouteEstimate } from "@/lib/geo/route-math";
import { RouteEstimateView } from "@/components/funnel/route-estimate-view";

/** Route estimate that follows addresses edited on the page (New quote from a request). */
export function RouteEstimateLive({
  collection,
  delivery,
  className,
}: {
  collection: string;
  delivery: string;
  className?: string;
}) {
  const [route, setRoute] = useState<RouteEstimate | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!collection.trim() || !delivery.trim()) {
      setRoute(null);
      return;
    }
    let live = true;
    setLoading(true);
    estimateRouteAction(collection, delivery)
      .then((r) => live && setRoute(r))
      .catch(() => live && setRoute(null))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [collection, delivery]);

  if (!collection.trim() || !delivery.trim()) return null;
  return <RouteEstimateView route={route} loading={loading} className={className} />;
}
