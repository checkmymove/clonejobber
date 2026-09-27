import "server-only";
import { sql } from "@/lib/db";
import { GOOGLE_SCOPES, googleRedirectUri } from "./config";

export type GoogleTokens = {
  company_id: string;
  email: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  scope: string;
};

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

export async function getGoogleConnection(
  companyId: string,
): Promise<{ email: string; expires_at: string } | null> {
  const rows = await sql<{ email: string; expires_at: string }[]>`
    select email, expires_at from google_oauth_tokens
    where company_id = ${companyId} limit 1
  `;
  return rows[0] ?? null;
}

export async function deleteGoogleConnection(companyId: string): Promise<void> {
  await sql`delete from google_oauth_tokens where company_id = ${companyId}`;
}

export async function saveOAuthState(companyId: string, state: string): Promise<void> {
  await sql`delete from google_oauth_states where created_at < now() - interval '10 minutes'`;
  await sql`
    insert into google_oauth_states (state, company_id)
    values (${state}, ${companyId})
  `;
}

export async function consumeOAuthState(state: string): Promise<string | null> {
  const rows = await sql<{ company_id: string }[]>`
    delete from google_oauth_states
    where state = ${state}
      and created_at > now() - interval '10 minutes'
    returning company_id
  `;
  return rows[0]?.company_id ?? null;
}

export async function exchangeGoogleCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_at: Date;
  scope: string;
}> {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
    redirect_uri: googleRedirectUri(),
    grant_type: "authorization_code",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as TokenResponse;
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || "Token exchange failed");
  }
  if (!json.refresh_token) {
    throw new Error("Google did not return a refresh token. Disconnect and connect again.");
  }
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: new Date(Date.now() + (json.expires_in ?? 3600) * 1000),
    scope: json.scope || GOOGLE_SCOPES,
  };
}

async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_at: Date;
  scope?: string;
}> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as TokenResponse;
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || "Token refresh failed");
  }
  return {
    access_token: json.access_token,
    expires_at: new Date(Date.now() + (json.expires_in ?? 3600) * 1000),
    scope: json.scope,
  };
}

export async function upsertGoogleTokens(
  companyId: string,
  email: string,
  tokens: {
    access_token: string;
    refresh_token: string;
    expires_at: Date;
    scope: string;
  },
): Promise<void> {
  await sql`
    insert into google_oauth_tokens
      (company_id, email, access_token, refresh_token, expires_at, scope, updated_at)
    values
      (${companyId}, ${email}, ${tokens.access_token}, ${tokens.refresh_token},
       ${tokens.expires_at.toISOString()}, ${tokens.scope}, now())
    on conflict (company_id) do update set
      email = excluded.email,
      access_token = excluded.access_token,
      refresh_token = excluded.refresh_token,
      expires_at = excluded.expires_at,
      scope = excluded.scope,
      updated_at = now()
  `;
}

export async function getValidAccessToken(companyId: string): Promise<{
  access_token: string;
  email: string;
} | null> {
  const rows = await sql<GoogleTokens[]>`
    select company_id, email, access_token, refresh_token, expires_at, scope
    from google_oauth_tokens where company_id = ${companyId} limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  const exp = new Date(row.expires_at).getTime();
  if (exp - Date.now() > 60_000) {
    return { access_token: row.access_token, email: row.email };
  }
  const refreshed = await refreshAccessToken(row.refresh_token);
  await sql`
    update google_oauth_tokens set
      access_token = ${refreshed.access_token},
      expires_at = ${refreshed.expires_at.toISOString()},
      scope = coalesce(${refreshed.scope ?? null}, scope),
      updated_at = now()
    where company_id = ${companyId}
  `;
  return { access_token: refreshed.access_token, email: row.email };
}

export async function googleAccountEmail(accessToken: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const json = (await res.json()) as { email?: string; error?: { message?: string } };
  if (!res.ok || !json.email) {
    throw new Error(json.error?.message || "Could not read Google account email");
  }
  return json.email;
}
