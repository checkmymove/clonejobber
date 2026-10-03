import "server-only";
import postgres from "postgres";

// App traffic uses the pooler (DATABASE_URL); migrations use DIRECT_URL.
// The pooler is in session mode and only allows 15 clients. One function
// instance must hold a single connection, or a page that runs several
// queries in parallel fills the pool and the next request dies.
// prepare:false is required on the Supabase pooler.
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
    max: 1,
    idle_timeout: 5,
    connect_timeout: 15,
  }));
