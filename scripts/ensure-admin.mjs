// Creates the single Supabase Auth administrator and the profiles row.
// Reads ADMIN_EMAIL and ADMIN_PASSWORD from .env. Does not print the password.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
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
}

loadEnv();

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;

if (!email || !password || !supabaseUrl || !serviceKey || !dbUrl) {
  console.error(
    "Need ADMIN_EMAIL, ADMIN_PASSWORD, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DATABASE_URL in .env",
  );
  process.exit(1);
}

// Password login is verified by GoTrue against bcrypt in auth.users.
const sql = postgres(dbUrl, { prepare: false, max: 1 });
const [existing] = await sql`
  select id from auth.users where lower(email) = ${email} limit 1
`;

let userId = existing?.id;
if (!userId) {
  const [created] = await sql`
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change, email_change_token_current,
      reauthentication_token, phone_change_token, email_change_confirm_status,
      is_sso_user, is_anonymous
    ) values (
      '00000000-0000-0000-0000-000000000000', gen_random_uuid(),
      'authenticated', 'authenticated', ${email},
      crypt(${password}, gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(), now(), '', '', '', '', '', '', '', 0, false, false
    )
    returning id
  `;
  userId = created.id;
  console.log("auth user created");
} else {
  console.log("auth user already exists");
}

const identity = { sub: String(userId), email };
await sql`
  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), ${userId},
    ${sql.json(identity)},
    'email', ${String(userId)},
    now(), now(), now()
  )
  on conflict do nothing
`;

await sql`
  insert into profiles (id, email, role)
  values (${userId}, ${email}, 'admin')
  on conflict (id) do update set email = excluded.email
`;
const [row] = await sql`
  select count(*)::int as n from profiles where role = 'admin'
`;
await sql.end();
if (row.n !== 1) {
  console.error("Expected exactly one admin profile");
  process.exit(1);
}
console.log("admin profile ready");
