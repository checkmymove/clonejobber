// Confirms RLS locks anon and non-admin JWTs, and lets the admin profile through.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(join(root, ".env"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)=(.*)\s*$/);
  if (!m || process.env[m[1]]) continue;
  let v = m[2].trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  process.env[m[1]] = v;
}

const url = process.env.DATABASE_URL || process.env.DIRECT_URL;
if (!url) {
  console.error("Missing DATABASE_URL / DIRECT_URL");
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1 });
let passed = 0;
const check = (name, cond) => {
  if (!cond) throw new Error(`FAIL: ${name}`);
  passed += 1;
  console.log(`  ok: ${name}`);
};

const LOCKED = [
  "google_oauth_tokens",
  "google_oauth_states",
  "public_submit_limits",
  "sms_settings",
];

async function rolledBack(fn) {
  try {
    await sql.begin(async (tx) => {
      await fn(tx);
      throw new Error("__rollback__");
    });
  } catch (error) {
    if (error.message !== "__rollback__") throw error;
  }
}

try {
  await rolledBack(async (tx) => {
    const tables = await tx`
      select c.relname as name, c.relrowsecurity as rls
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
      order by 1
    `;
    check("public tables exist", tables.length > 10);
    check(
      "RLS enabled on every public table",
      tables.every((t) => t.rls === true),
    );

    const policies = await tx`
      select tablename, policyname
      from pg_policies
      where schemaname = 'public'
    `;
    const policyTables = new Set(policies.map((p) => p.tablename));
    for (const table of tables) {
      if (LOCKED.includes(table.name)) {
        check(`${table.name} has no policy`, !policyTables.has(table.name));
      } else {
        check(
          `${table.name} has admin_all`,
          policies.some((p) => p.tablename === table.name && p.policyname === "admin_all"),
        );
      }
    }

    const anonGrants = await tx`
      select count(*)::int as n
      from information_schema.role_table_grants
      where table_schema = 'public' and grantee = 'anon'
    `;
    check("anon has no table grants", anonGrants[0].n === 0);

    const [admin] = await tx`
      select id::text as id from profiles where role = 'admin' limit 1
    `;
    check("one admin profile", Boolean(admin?.id));

    await tx`
      select
        set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true),
        set_config('request.jwt.claim.role', 'authenticated', true),
        set_config(
          'request.jwt.claims',
          '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',
          true
        )
    `;
    await tx`set local role authenticated`;
    const [stranger] = await tx`select count(*)::int as n from clients`;
    check("non-admin JWT sees no clients", stranger.n === 0);
  });

  const denied = async (role, statement) => {
    try {
      await sql.begin(async (tx) => {
        await tx.unsafe(`set local role ${role}`);
        await tx.unsafe(statement);
      });
      return false;
    } catch (error) {
      return error.code === "42501";
    }
  };

  check(
    "authenticated cannot read oauth tokens",
    await denied("authenticated", "select count(*) from google_oauth_tokens"),
  );
  check(
    "authenticated cannot read sms settings",
    await denied("authenticated", "select count(*) from sms_settings"),
  );
  check(
    "anon cannot select clients",
    await denied("anon", "select count(*) from clients"),
  );

  await rolledBack(async (tx) => {
    const [admin] = await tx`select id::text as id from profiles where role = 'admin' limit 1`;
    const [asOwner] = await tx`select count(*)::int as n from clients`;
    await tx`select set_config('request.jwt.claim.sub', ${admin.id}, true)`;
    await tx`select set_config('request.jwt.claim.role', 'authenticated', true)`;
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({
      sub: admin.id,
      role: "authenticated",
    })}, true)`;
    await tx`set local role authenticated`;
    const [asAdmin] = await tx`select count(*)::int as n from clients`;
    check("admin JWT sees the same clients as the owner", asAdmin.n === asOwner.n);
  });
} catch (error) {
  if (error.message !== "__rollback__") {
    console.error(error);
    process.exit(1);
  }
}

await sql.end();
console.log(`auth rls: ${passed} checks passed (rolled back)`);
