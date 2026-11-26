// Job To Go · start over with an empty funnel, for testing the app as a new company.
//
// Deletes every client (leads included), request, quote, job, invoice, payment, visit,
// schedule item and the messages/activity about them, and restarts the R-/Q-/J-/I-
// numbers at 1. Keeps the company, users, team, services, Products & Services, lead
// sources, templates, Google/SMS settings and schedule settings.
//
// Before deleting it writes everything it removes to a JSON backup (files as base64)
// outside the repository. Nothing is deleted without --yes.
//
//   node scripts/reset-data.mjs            # counts only
//   node scripts/reset-data.mjs --yes      # backup, then delete
//   BACKUP_DIR=/some/folder node scripts/reset-data.mjs --yes

import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

// Children before parents, so every delete passes the foreign keys.
const WIPE = [
  "payment_allocations",
  "payments",
  "invoice_line_items",
  "schedule_reminders",
  "invoices",
  "time_entries",
  "job_visit_members",
  "job_visits",
  "job_line_items",
  "expenses",
  "jobs",
  "quote_line_items",
  "quote_pdf_exports",
  "sms_deliveries",
  "referrals",
  "quotes",
  "appointments",
  "communications",
  "request_attachments",
  "request_locations",
  "request_services",
  "requests",
  "schedule_tasks",
  "schedule_events",
  "client_addresses",
  "client_contacts",
  "client_files",
  "client_notes",
  "client_tags",
  "clients",
  "email_deliveries",
  "send_attachments",
  "activity_log",
  "public_submit_limits",
];
const SEQUENCES = ["request_number_seq", "quote_number_seq", "job_number_seq", "invoice_number_seq"];

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set (source .env first).");
  process.exit(1);
}
const confirmed = process.argv.includes("--yes");
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

const counts = {};
for (const table of WIPE) {
  const [{ n }] = await sql.unsafe(`select count(*)::int as n from public."${table}"`);
  counts[table] = n;
}
console.table(counts);

if (!confirmed) {
  console.log("Dry run. Run again with --yes to back up and delete these rows.");
  await sql.end();
  process.exit(0);
}

// --- backup ---------------------------------------------------------------
const backupDir = process.env.BACKUP_DIR || path.resolve(process.cwd(), "..", "backups");
fs.mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupFile = path.join(backupDir, `jobtogo-before-reset-${stamp}.json`);
const backup = { createdAt: new Date().toISOString(), tables: {}, sequences: {} };
for (const table of [...WIPE].reverse()) {
  const rows = await sql.unsafe(`select * from public."${table}"`);
  backup.tables[table] = rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k, Buffer.isBuffer(v) ? { base64: v.toString("base64") } : v]),
    ),
  );
}
for (const seq of SEQUENCES) backup.sequences[seq] = await sql.unsafe(`select * from public."${seq}"`);
fs.writeFileSync(backupFile, JSON.stringify(backup));
const written = JSON.parse(fs.readFileSync(backupFile, "utf8"));
for (const table of WIPE) {
  if (written.tables[table]?.length !== counts[table]) {
    console.error(`Backup check failed for ${table}; nothing was deleted.`);
    await sql.end();
    process.exit(1);
  }
}
console.log(`Backup: ${backupFile} (${(fs.statSync(backupFile).size / 1048576).toFixed(1)} MB)`);

// --- delete, all or nothing ---------------------------------------------
await sql.begin(async (tx) => {
  for (const table of WIPE) await tx.unsafe(`delete from public."${table}"`);
  for (const seq of SEQUENCES) await tx.unsafe(`update public."${seq}" set last_number = 0`);
});

for (const table of WIPE) {
  const [{ n }] = await sql.unsafe(`select count(*)::int as n from public."${table}"`);
  if (n !== 0) console.error(`${table} still has ${n} rows`);
}
console.log("Done: funnel data deleted, numbers restart at 1.");
await sql.end();
