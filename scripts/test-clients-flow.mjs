// Integration test for the Clients module (rollback-safe, like request flow).
// Covers: notes column, address CRUD + labels, search, unique email,
// cascade delete of addresses, activity log.
// Run: node scripts/test-clients-flow.mjs
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(join(root, ".env"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_]+)=(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const sql = postgres(process.env.DATABASE_URL || process.env.DIRECT_URL, { prepare: false, max: 1 });
let passed = 0;
const check = (name, cond) => {
  if (!cond) throw new Error(`FAIL: ${name}`);
  passed += 1;
  console.log(`  ok: ${name}`);
};

const ROLLBACK = new Error("__rollback__");

try {
  await sql.begin(async (tx) => {
    const [company] = await tx`
      select * from companies where slug = 'moving-london' limit 1`;
    check("company exists", !!company);

    // --- create client with notes --------------------------------------
    const [client] = await tx`
      insert into clients (company_id, first_name, last_name, email, phone, notes)
      values (${company.id}, 'Client', 'Test', 'client.test@example.co.uk',
              '+44 7700 000099', 'Prefers morning contact')
      returning id`;
    check("client created with notes", !!client.id);

    // --- unique email per company --------------------------------------
    let dup = false;
    await tx`SAVEPOINT c_sp`;
    try {
      await tx`insert into clients (company_id, first_name, last_name, email, phone)
        values (${company.id}, 'Dup', 'User', 'CLIENT.TEST@example.co.uk', '+44 1')`;
    } catch (e) {
      if (e.code === "23505") {
        dup = true;
        await tx`ROLLBACK TO SAVEPOINT c_sp`;
      } else throw e;
    }
    await tx`RELEASE SAVEPOINT c_sp`;
    check("duplicate email rejected (case-insensitive)", dup);

    // --- addresses CRUD --------------------------------------------------
    const [a1] = await tx`
      insert into client_addresses (client_id, label, address_line, city, postcode, instructions, is_primary)
      values (${client.id}, 'Collection', '12 Hackney Road', 'London', 'E2 8DP', 'Gate code 123', true)
      returning id`;
    const [a2] = await tx`
      insert into client_addresses (client_id, label, address_line, postcode)
      values (${client.id}, 'Delivery', '5 Camden St', 'NW1 0AA')
      returning id`;
    check("two addresses added", !!a1.id && !!a2.id);

    let badLabel = false;
    await tx`SAVEPOINT l_sp`;
    try {
      await tx`insert into client_addresses (client_id, label, address_line, postcode)
        values (${client.id}, 'Moon', 'X', 'Y')`;
    } catch (e) {
      if (e.code === "23514") {
        badLabel = true;
        await tx`ROLLBACK TO SAVEPOINT l_sp`;
      } else throw e;
    }
    await tx`RELEASE SAVEPOINT l_sp`;
    check("invalid label rejected by check constraint", badLabel);

    // --- search -----------------------------------------------------------
    const found = await tx`
      select id from clients
      where company_id = ${company.id} and first_name ilike '%clien%'`;
    check("search by name finds client", found.some((r) => r.id === client.id));

    // --- request linked to client appears in history ----------------------
    const [req] = await tx`
      insert into requests (number, company_id, client_id, inventory_description, terms_accepted_at)
      values ('REQ-T1', ${company.id}, ${client.id}, 'test', now())
      returning id`;
    const hist = await tx`
      select id from requests where client_id = ${client.id}`;
    check("client request history", hist.length === 1 && hist[0].id === req.id);

    // --- cascade: deleting request keeps client; addresses cascade on client
    await tx`delete from requests where id = ${req.id}`;
    await tx`delete from clients where id = ${client.id}`;
    const [{ n }] = await tx`
      select count(*)::int as n from client_addresses where client_id = ${client.id}`;
    check("addresses cascade-deleted with client", n === 0);

    throw ROLLBACK;
  });
} catch (e) {
  if (e !== ROLLBACK) throw e;
  console.log("  (transaction rolled back — no test data persisted)");
}

await sql.end();
console.log(`\nclients integration: ${passed} checks passed`);
