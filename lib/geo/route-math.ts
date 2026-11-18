// Route estimate maths. Pure: unit tests and client components can import it.

export type RouteEstimate = {
  miles: number;
  minutes: number;
  /** "road": from a road router; "estimate": straight line with a road factor. */
  source: "road" | "estimate";
};

const EARTH_MILES = 3958.8;
// Roads are longer than the straight line between two postcodes.
const ROAD_FACTOR = 1.3;

export function straightMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_MILES * Math.asin(Math.sqrt(h));
}

/**
 * Van drive time by distance: the first 10 miles at London speed (15 mph), the next
 * 20 at 25 mph, the rest on A-roads and motorways at 45 mph.
 */
export function driveMinutes(miles: number): number {
  const city = Math.min(miles, 10);
  const suburb = Math.min(Math.max(miles - 10, 0), 20);
  const open = Math.max(miles - 30, 0);
  return Math.max(5, Math.round((city / 15 + suburb / 25 + open / 45) * 60));
}

export function estimateFromStraightLine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): RouteEstimate {
  const miles = Math.round(straightMiles(a, b) * ROAD_FACTOR * 10) / 10;
  return { miles, minutes: driveMinutes(miles), source: "estimate" };
}

/** "1 h 25 min", "40 min". */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** "12.4 miles · ≈ 40 min drive". */
export function formatRoute(r: RouteEstimate): string {
  return `${r.miles} ${r.miles === 1 ? "mile" : "miles"} · ≈ ${formatDuration(r.minutes)} drive`;
}
