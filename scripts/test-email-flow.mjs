// Rollback-safe checks for email_deliveries / oauth tables.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(join(root, ".env"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_]+)=(.*)\s*$/);
  if (m && !process.env[m[1]]) {
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    process.env[m[1]] = v;
  }
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

try {
  await sql.begin(async (tx) => {
    const [company] = await tx`select id from companies where slug = 'moving-london' limit 1`;
    check("company exists", !!company);

    const tables = await tx`
      select count(*)::int as n from information_schema.tables
      where table_schema = 'public'
        and table_name in ('google_oauth_tokens', 'email_deliveries')`;
    check("email tables exist", tables[0].n === 2);

    const [client] = await tx`
      insert into clients (company_id, first_name, last_name, email, phone)
      values (${company.id}, 'Mail', 'Test', 'mail.test@example.co.uk', '+44 7700 000088')
      returning id`;
    const [quote] = await tx`
      insert into quotes (number, company_id, client_id, status, title, subtotal, total)
      values ('Q-MAIL', ${company.id}, ${client.id}, 'draft', 'Mail quote', 10000, 10000)
      returning id`;

    await tx`
      insert into email_deliveries
        (company_id, document_type, document_id, to_email, subject, status, error)
      values (${company.id}, 'quote', ${quote.id}, 'mail.test@example.co.uk',
              'Quote Q-MAIL', 'failed', 'Connect Gmail in Settings before sending.')`;
    const [row] = await tx`
      select status, error from email_deliveries where document_id = ${quote.id}`;
    check("failed delivery can be stored", row.status === "failed" && /Gmail/.test(row.error));

    const tokens = await tx`
      select count(*)::int as n from google_oauth_tokens
      where company_id = ${company.id} and email = 'mail.test@example.co.uk'`;
    check("this transaction did not store oauth tokens", tokens[0].n === 0);

    throw new Error("__rollback__");
  });
} catch (e) {
  if (e.message !== "__rollback__") {
    console.error(e);
    process.exit(1);
  }
}

await sql.end();
console.log(`email: ${passed} checks passed (rolled back)`);
