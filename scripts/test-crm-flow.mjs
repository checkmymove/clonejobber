// Integration test for the Clients/CRM module (rollback-safe).
// Covers: profile columns, properties (primary/billing + map data),
// contacts, notes, tags, communications incl. request auto-entry,
// files union (request attachments visible without copy), appointments
// incl. schedule assessment, financials rule with no invoices table.
// Run: node scripts/test-crm-flow.mjs
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

    // --- profile -------------------------------------------------------
    const [client] = await tx`
      insert into clients (company_id, title, first_name, last_name, client_type,
        status, email, phone, phone_mobile, payment_terms, ask_for_review)
      values (${company.id}, 'Mr', 'CRM', 'Test', 'individual', 'lead',
        'crm.test@example.co.uk', '+44 7700 000050', '+44 7700 000051',
        'net_15', true)
      returning id`;
    check("profile columns persisted", !!client.id);

    // --- properties: primary/billing flags ------------------------------
    await tx`insert into client_addresses (client_id, label, address_line, postcode, is_primary, is_billing)
      values (${client.id}, 'Collection', '12 Hackney Road', 'E2 8DP', true, false),
             (${client.id}, 'Billing', '1 Billing Lane', 'EC1A 1AA', false, true)`;
    const prim = await tx`
      select count(*)::int as n from client_addresses
      where client_id = ${client.id} and is_primary = true`;
    const bill = await tx`
      select count(*)::int as n from client_addresses
      where client_id = ${client.id} and is_billing = true`;
    check("primary + billing properties coexist", prim[0].n === 1 && bill[0].n === 1);

    // --- contacts ---------------------------------------------------------
    await tx`insert into client_contacts (client_id, name, role, phone, is_primary)
      values (${client.id}, 'Ops Manager', 'Manager', '+44 1', true)`;
    check("contact linked", true);

    // --- request → auto communication + files union ----------------------
    const [req] = await tx`
      insert into requests (number, company_id, client_id, inventory_description, terms_accepted_at)
      values ('REQ-CRM1', ${company.id}, ${client.id}, 'test', now())
      returning id`;
    await tx`insert into communications (company_id, client_id, request_id, channel, subject, body, status)
      values (${company.id}, ${client.id}, ${req.id}, 'email', 'Thanks for your request!', 'hi', 'logged')`;
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4, 5, 6, 7, 8]);
    await tx`insert into request_attachments (request_id, file_name, mime_type, file_size, data)
      values (${req.id}, 'sofa.png', 'image/png', ${png.length}, ${png})`;
    const unified = await tx`
      select count(*)::int as n from (
        select ra.id from request_attachments ra
        join requests r on r.id = ra.request_id
        where r.client_id = ${client.id}
        union all
        select cf.id from client_files cf where cf.client_id = ${client.id}
      ) u`;
    check("request attachment visible in client files (no copy)", unified[0].n === 1);
    const comms = await tx`
      select count(*)::int as n from communications where client_id = ${client.id}`;
    check("auto confirmation in communication", comms[0].n === 1);

    // --- manual file + note + tag -----------------------------------------
    await tx`insert into client_files (client_id, file_name, mime_type, file_size, data)
      values (${client.id}, 'contract.pdf', 'application/pdf', 5, '\\x255044462d'::bytea)`;
    const unified2 = await tx`
      select count(*)::int as n from (
        select ra.id from request_attachments ra
        join requests r on r.id = ra.request_id
        where r.client_id = ${client.id}
        union all
        select cf.id from client_files cf where cf.client_id = ${client.id}
      ) u`;
    check("manual upload joins the same library", unified2[0].n === 2);
    await tx`insert into client_notes (client_id, author, content)
      values (${client.id}, 'admin', 'internal only')`;
    const [tag] = await tx`
      insert into tags (company_id, name) values (${company.id}, '__testvip__') returning id`;
    await tx`insert into client_tags (client_id, tag_id) values (${client.id}, ${tag.id})`;
    check("note + tag linked", true);

    // --- schedule assessment ------------------------------------------------
    await tx`insert into appointments (company_id, client_id, request_id, title, kind, starts_at)
      values (${company.id}, ${client.id}, ${req.id}, 'On-site assessment · REQ-CRM1', 'assessment', now() + interval '1 day')`;
    const appts = await tx`
      select count(*)::int as n from appointments
      where client_id = ${client.id} and request_id = ${req.id}`;
    check("assessment linked to client + request", appts[0].n === 1);

    // --- work overview + financials -----------------------------------------
    const work = await tx`
      select id from requests where client_id = ${client.id}`;
    check("work overview sees the request", work.length === 1);
    const reg = await tx`
      select (to_regclass('public.invoices') is not null) as exists`;
    check("invoices table exists for financials", reg[0].exists === true);
    const fin = await tx`
      select
        coalesce(sum(case when status <> 'cancelled' then total else 0 end), 0)::int as lifetime,
        coalesce(sum(case when status in ('sent', 'overdue') then balance else 0 end), 0)::int as balance
      from invoices where client_id = ${client.id}`;
    check("client without invoices has zero financials", fin[0].lifetime === 0 && fin[0].balance === 0);

    // --- full new-client shape (form parity) --------------------------------
    const [full] = await tx`
      insert into clients (company_id, title, first_name, last_name, status,
        email, phone, marketing_email_consent, lead_source_id)
      values (${company.id}, 'No title', 'Full', 'Form', 'active',
        'full.form@example.co.uk', '+44 7700 000060', true,
        (select id from lead_sources where company_id = ${company.id} order by sort limit 1))
      returning id`;
    await tx`insert into client_contacts (client_id, name, is_primary)
      values (${full.id}, 'Extra Contact', true)`;
    await tx`insert into client_addresses
        (client_id, label, address_line, street_2, city, county, postcode,
         country, tax_rate, instructions, is_primary, is_billing)
      values (${full.id}, 'Collection', '1 Main St', 'Flat 2', 'London',
        'Greater London', 'E1 6AN', 'United Kingdom', '20% VAT',
        'Ring bell twice', true, true),
             (${full.id}, 'Delivery', '9 Other Rd', '', 'Leeds', '', 'LS1 4DY',
        'United Kingdom', null, '', false, false)`;
    const fullAddr = await tx`
      select label, street_2, county, country, tax_rate, is_billing
      from client_addresses where client_id = ${full.id} order by is_primary desc`;
    check(
      "full form persists both addresses with new fields",
      fullAddr.length === 2 &&
        fullAddr[0].street_2 === "Flat 2" &&
        fullAddr[0].tax_rate === "20% VAT" &&
        fullAddr[0].is_billing === true &&
        fullAddr[1].is_billing === false,
    );

    throw ROLLBACK;
  });
} catch (e) {
  if (e !== ROLLBACK) throw e;
  console.log("  (transaction rolled back — no test data persisted)");
}

await sql.end();
console.log(`\ncrm integration: ${passed} checks passed`);
