import "server-only";
import { sql } from "@/lib/db";

/**
 * Shared Postgres counter. One row per bucket, so every Vercel instance
 * sees the same window. The upsert locks the row; concurrent hits cannot
 * both reset it.
 */
/** Reads the current window without counting a new hit. */
export async function rateLimitOpen(
  key: string,
  limit: number,
): Promise<{ ok: boolean; retryAfterSec: number }> {
  const rows = await sql<{ hits: number; reset_at: Date }[]>`
    select hits, reset_at from public_submit_limits
    where bucket = ${key}
    limit 1
  `;
  const row = rows[0];
  if (!row || new Date(row.reset_at).getTime() <= Date.now() || row.hits < limit) {
    return { ok: true, retryAfterSec: 0 };
  }
  const retryAfterSec = Math.max(
    1,
    Math.ceil((new Date(row.reset_at).getTime() - Date.now()) / 1000),
  );
  return { ok: false, retryAfterSec };
}

export async function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ ok: boolean; retryAfterSec: number }> {
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
  const rows = await sql<{ hits: number; reset_at: Date }[]>`
    insert into public_submit_limits (bucket, hits, reset_at)
    values (${key}, 1, now() + make_interval(secs => ${windowSec}))
    on conflict (bucket) do update set
      hits = case
        when public_submit_limits.reset_at <= now() then 1
        else public_submit_limits.hits + 1
      end,
      reset_at = case
        when public_submit_limits.reset_at <= now() then now() + make_interval(secs => ${windowSec})
        else public_submit_limits.reset_at
      end
    returning hits, reset_at
  `;
  const row = rows[0];
  if (!row || row.hits <= limit) return { ok: true, retryAfterSec: 0 };
  const retryAfterSec = Math.max(
    1,
    Math.ceil((new Date(row.reset_at).getTime() - Date.now()) / 1000),
  );
  return { ok: false, retryAfterSec };
}
