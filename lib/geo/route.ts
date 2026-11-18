import "server-only";
import { geocodePostcodes, type LatLng } from "@/lib/geo/geocode";
import { extractPostcode } from "@/lib/geo/postcode";
import { estimateFromStraightLine, type RouteEstimate } from "@/lib/geo/route-math";

export type { RouteEstimate };

// London traffic: free-flow road times from the router are too quick for a removal van.
const TRAFFIC_FACTOR = 1.3;
const METRES_PER_MILE = 1609.344;

// Routes between two postcodes do not change: keep what this server already worked out.
const cache = new Map<string, RouteEstimate | null>();

async function roadRoute(a: LatLng, b: LatLng): Promise<RouteEstimate | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=false`;
    const response = await fetch(url, { signal: AbortSignal.timeout(2500), cache: "no-store" });
    if (!response.ok) return null;
    const body = (await response.json()) as { code?: string; routes?: { distance: number; duration: number }[] };
    const route = body.code === "Ok" ? body.routes?.[0] : undefined;
    if (!route) return null;
    return {
      miles: Math.round((route.distance / METRES_PER_MILE) * 10) / 10,
      minutes: Math.max(5, Math.round((route.duration / 60) * TRAFFIC_FACTOR)),
      source: "road",
    };
  } catch {
    return null;
  }
}

/**
 * Miles and drive time between the collection and the delivery address, from their
 * UK postcodes. Uses the road route when the router answers, otherwise the straight
 * line with a road factor. Null when either address has no postcode we can place.
 */
export async function estimateRoute(collection: string, delivery: string): Promise<RouteEstimate | null> {
  const from = extractPostcode(collection);
  const to = extractPostcode(delivery);
  if (!from || !to) return null;
  const key = `${from}|${to}`;
  if (cache.has(key)) return cache.get(key) ?? null;

  const places = await geocodePostcodes([from, to]);
  const a = places.get(from);
  const b = places.get(to);
  if (!a || !b) return null;
  const estimate = (await roadRoute(a, b)) ?? estimateFromStraightLine(a, b);
  cache.set(key, estimate);
  return estimate;
}

/** Several routes at once (dashboard rows), keyed by the caller's id. */
export async function estimateRoutes(
  pairs: { id: string; collection: string; delivery: string }[],
): Promise<Map<string, RouteEstimate>> {
  const out = new Map<string, RouteEstimate>();
  const results = await Promise.all(pairs.map((p) => estimateRoute(p.collection, p.delivery)));
  pairs.forEach((p, i) => {
    const r = results[i];
    if (r) out.set(p.id, r);
  });
  return out;
}
