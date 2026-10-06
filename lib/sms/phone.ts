/** Normalize a phone number for SMS. Keeps a leading + and digits only. */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const plus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  return plus ? `+${digits}` : digits;
}

export function isValidMobile(raw: string): boolean {
  const digits = normalizePhone(raw).replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}
