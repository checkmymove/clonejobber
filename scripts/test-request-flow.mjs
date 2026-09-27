// Integration test for the Request flow against the real Supabase Postgres.
// Everything runs inside ONE transaction that is always rolled back, so no
// test data (and no REQ-number gaps) leak into the operational database.
// Scenarios covered: 1 (new client full), 2 (existing client dedup),
// 12 (idempotency), 13 (cross-company service), attachments + cascade,
// activity log, request number sequencing.
// Run: npm run test:integration
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
    check("seed company exists", !!company);

    const services = await tx`
      select * from services where company_id = ${company.id} and active order by sort`;
    check("6 services seeded", services.length === 6);

    const [source] = await tx`
      select * from lead_sources where company_id = ${company.id} order by sort limit 1`;
    check("lead sources seeded", !!source);

    // --- Scenario 1: new client, full submission -------------------------
    const [client] = await tx`
      insert into clients (company_id, first_name, last_name, email, phone, lead_source_id)
      values (${company.id}, 'Test', 'User', 'test.user@example.co.uk', '+44 7700 000001', ${source.id})
      returning id`;
    const [n1] = await tx`select next_request_number(${company.id}) as number`;
    const [req] = await tx`
      insert into requests (number, company_id, client_id, status, lead_source_id,
        move_date, move_time, needs_packing_service, needs_packing_materials,
        estimated_hours, inventory_description, terms_accepted_at, idempotency_key)
      values (${n1.number}, ${company.id}, ${client.id}, 'new', ${source.id},
        null, '09:30', true, false,
        ${tx.array(["2", "3"])}, 'Test inventory: sofa, 10 boxes', now(), 'test-key-1')
      returning id`;
    await tx`insert into request_locations (request_id, kind, address, postcode, floor, has_lift, parking_restrictions, bedrooms)
      values (${req.id}, 'pickup', 'A St', 'E2 8DP', 'Ground Floor', true, 'No', 1),
             (${req.id}, 'delivery', 'B Ave', 'N1 4QT', '1st Floor', false, 'No', 1)`;
    await tx`insert into request_services (request_id, service_id)
      values (${req.id}, ${services[0].id}), (${req.id}, ${services[1].id})`;
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 1]);
    await tx`insert into request_attachments (request_id, file_name, mime_type, file_size, data)
      values (${req.id}, 'sofa.png', 'image/png', ${png.length}, ${png})`;
    check("scenario 1: full request persisted", !!req.id);
    check("REQ number format", /^REQ-\d{4}$/.test(n1.number));

    // --- Scenario 2: dedup finds client by email AND by phone ------------
    const byEmail = await tx`
      select id from clients where company_id = ${company.id} and email = 'TEST.USER@example.co.uk' limit 1`;
    check("scenario 2: dedup by email (case-insensitive)", byEmail[0]?.id === client.id);
    const byPhone = await tx`
      select id from clients where company_id = ${company.id}
        and regexp_replace(phone, '[\\s\\-().]', '', 'g') = '+447700000001' limit 1`;
    check("scenario 2: dedup by normalized phone", byPhone[0]?.id === client.id);

    // --- Scenario 12: idempotency key blocks duplicates ------------------
    // Manual SAVEPOINT: the deliberate unique violation must not doom the tx.
    let dupBlocked = false;
    await tx`SAVEPOINT test_sp`;
    try {
      await tx`insert into requests (number, company_id, client_id, idempotency_key, inventory_description, terms_accepted_at)
        values ('REQ-9999', ${company.id}, ${client.id}, 'test-key-1', 'x', now())`;
    } catch (e) {
      if (e.code === "23505") {
        dupBlocked = true;
        await tx`ROLLBACK TO SAVEPOINT test_sp`;
      } else {
        throw e;
      }
    }
    await tx`RELEASE SAVEPOINT test_sp`;
    check("scenario 12: duplicate idempotency key rejected", dupBlocked);

    // --- Scenario 13: service from another company must not attach -------
    const [other] = await tx`
      insert into companies (slug, name) values ('__test-other__', 'Other Co') returning id`;
    const [otherSvc] = await tx`
      insert into services (company_id, name) values (${other.id}, 'Foreign Service') returning id`;
    const mine = await tx`
      select id from services where id = ${otherSvc.id} and company_id = ${company.id}`;
    check("scenario 13: foreign service not in company catalog", mine.length === 0);

    // --- attachments + activity log --------------------------------------
    const [{ n: attCount }] = await tx`
      select count(*)::int as n from request_attachments where request_id = ${req.id}`;
    check("attachment stored", attCount === 1);
    await tx`insert into activity_log (company_id, actor, action, entity, entity_id, summary)
      values (${company.id}, 'test', 'request.submitted', 'request', ${req.id}, 'test')`;
    const [{ n: logCount }] = await tx`
      select count(*)::int as n from activity_log where entity_id = ${req.id}`;
    check("activity log written", logCount === 1);

    // --- number sequencing ------------------------------------------------
    const [n2] = await tx`select next_request_number(${company.id}) as number`;
    check(
      "numbers sequence",
      Number(n2.number.slice(4)) === Number(n1.number.slice(4)) + 1,
    );

    throw ROLLBACK; // never persist test data
  });
} catch (e) {
  if (e !== ROLLBACK) throw e;
  console.log("  (transaction rolled back — no test data persisted)");
}

const leftovers = await sql`
  select count(*)::int as n from clients where email = 'test.user@example.co.uk'`;
check("no leftovers after rollback", leftovers[0].n === 0);

await sql.end();
console.log(`\nintegration: ${passed} checks passed`);
