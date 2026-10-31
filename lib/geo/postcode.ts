// UK postcodes in free-text addresses. Pure: unit tests import it without a network.

const POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/i;

/** "Flat 2, Kings Road, GU21 5HU" → "GU21 5HU"; null when the address has none. */
export function extractPostcode(address: string): string | null {
  const match = address.match(POSTCODE);
  return match ? `${match[1]} ${match[2]}`.toUpperCase() : null;
}
