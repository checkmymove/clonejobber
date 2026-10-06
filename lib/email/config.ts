const GMAIL_SEND = "https://www.googleapis.com/auth/gmail.send";
const USER_EMAIL = "https://www.googleapis.com/auth/userinfo.email";
const GOOGLE_SCOPES = `${GMAIL_SEND} ${USER_EMAIL}`;

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
}

export function clientQuoteUrl(quoteId: string): string {
  return `${appUrl()}/q/${quoteId}`;
}

export function googleRedirectUri(): string {
  return (
    process.env.GOOGLE_REDIRECT_URI ||
    `${appUrl()}/api/integrations/google/callback`
  );
}

export function googleAuthUrl(state: string): string {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id) throw new Error("Missing GOOGLE_CLIENT_ID");
  const params = new URLSearchParams({
    client_id: id,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export { GMAIL_SEND, GOOGLE_SCOPES };
