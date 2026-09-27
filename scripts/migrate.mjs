// Applies SQL migration files in order using the direct Postgres connection.
// Usage: node scripts/migrate.mjs
// Reads connection string from .env (DATABASE_URL pooler preferred; DIRECT_URL fallback).
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");

for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_]+)=(.*)\s*$/);
  if (m && !process.env[m[1]]) {
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    process.env[m[1]] = v;
  }
}

const url = process.env.DATABASE_URL || process.env.DIRECT_URL;
if (!url) {
  console.error("Missing DIRECT_URL / DATABASE_URL in .env");
  process.exit(1);
}

const dir = join(root, "supabase", "migrations");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const sql = postgres(url, { prepare: false, max: 1 });

for (const f of files) {
  const contents = readFileSync(join(dir, f), "utf8");
  console.log(`→ applying ${f} ...`);
  await sql.unsafe(contents);
  console.log(`  done ${f}`);
}

await sql.end();
console.log("migrations applied");
