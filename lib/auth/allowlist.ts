/** True only for the single administrator configured in ADMIN_EMAIL. */
export function isAllowedAdminEmail(email: string | null | undefined): boolean {
  const admin = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!admin || !email) return false;
  return email.trim().toLowerCase() === admin;
}

/** Relative in-app path. Rejects open redirects. */
export function safeNextPath(value: string | null | undefined): string {
  if (!value) return "/";
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//") || value.startsWith("/\\")) return "/";
  if (value.includes("\\") || value.includes("://")) return "/";
  if (value === "/login" || value.startsWith("/login?")) return "/";
  return value;
}
