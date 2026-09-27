import "server-only";
import postgres from "postgres";

// App traffic uses the pooler (DATABASE_URL); migrations use DIRECT_URL.
// prepare:false is required on the Supabase pooler (transaction mode).
const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error("Missing DATABASE_URL env var");
}

declare global {
  // eslint-disable-next-line no-var
  var __opero_sql: ReturnType<typeof postgres> | undefined;
}

export const sql =
  globalThis.__opero_sql ??
  (globalThis.__opero_sql = postgres(url, {
    prepare: false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 15,
  }));
