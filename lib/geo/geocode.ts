import "server-only";

export type LatLng = { lat: number; lng: number };

// Postcodes never move: keep what this server instance already looked up.
const cache = new Map<string, LatLng | null>();

/** Coordinates for UK postcodes from postcodes.io (free, no key). Missing ones are left out. */
export async function geocodePostcodes(postcodes: string[]): Promise<Map<string, LatLng>> {
  const wanted = [...new Set(postcodes)];
  const missing = wanted.filter((p) => !cache.has(p));
  if (missing.length) {
    try {
      const response = await fetch("https://api.postcodes.io/postcodes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ postcodes: missing.slice(0, 100) }),
        signal: AbortSignal.timeout(2500),
        cache: "no-store",
      });
      if (response.ok) {
        const body = (await response.json()) as {
          result?: { query: string; result: { latitude: number; longitude: number } | null }[];
        };
        for (const row of body.result ?? []) {
          cache.set(
            row.query.toUpperCase(),
            row.result ? { lat: row.result.latitude, lng: row.result.longitude } : null,
          );
        }
      }
    } catch {
      // The map just shows fewer pins; the dashboard never waits on it failing.
    }
  }
  const out = new Map<string, LatLng>();
  for (const p of wanted) {
    const hit = cache.get(p);
    if (hit) out.set(p, hit);
  }
  return out;
}
