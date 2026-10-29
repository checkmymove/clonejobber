// Integration test for team, visit assignments and time entries (0022) against Postgres.
// Seeded team → assign a visit → one running clock per person → manual entry in London time →
// deleting a visit keeps its time on the job. Runs in one transaction, rolled back.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { persistJob } from "../.testbuild/funnel/engine.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(join(root, ".env"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_]+)=(.*)\s*$/);
  if (m && !process.env[m[1]]) {
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
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
const fails = async (tx, work) => {
  try {
    await tx.savepoint(work);
    return false;
  } catch {
    return true;
  }
};

try {
  await sql.begin(async (tx) => {
    const [company] = await tx`select * from companies where slug = 'moving-london' limit 1`;
    const team = await tx`select id, name from team_members where company_id = ${company.id} and active order by sort`;
    check("Jobber's active crew is seeded", ["Andre Campanini", "Everaldo Aquino", "Jailton Bento"].every((n) => team.some((m) => m.name === n)));
    const [everaldo, jailton] = [team.find((m) => m.name === "Everaldo Aquino"), team.find((m) => m.name === "Jailton Bento")];

    const [client] = await tx`
      insert into clients (company_id, first_name, last_name, email, phone)
      values (${company.id}, 'Team', 'Test', 'team.test@example.co.uk', '+44 7700 000077')
      returning id`;
    const job = await persistJob(tx, company.id, {
      clientId: client.id,
      title: "Removal",
      notes: "",
      remindInvoice: false,
      visits: [{ title: "", date: "2026-10-29", later: false, start: "09:00", end: "15:00", anytime: false, assignee: "", instructions: "" }],
      lines: [{ name: "Van + 2", qty: "6", unitPrice: "80" }],
    });
    check("job with a visit", job.ok);
    const [visit] = await tx`select id from job_visits where job_id = ${job.id}`;

    await tx`insert into job_visit_members (visit_id, member_id) values (${visit.id}, ${everaldo.id}), (${visit.id}, ${jailton.id})`;
    check(
      "a visit holds several people",
      (await tx`select count(*)::int as n from job_visit_members where visit_id = ${visit.id}`)[0].n === 2,
    );
    check(
      "the same person can't be assigned twice",
      await fails(tx, (s) => s`insert into job_visit_members (visit_id, member_id) values (${visit.id}, ${everaldo.id})`),
    );

    await tx`
      insert into time_entries (company_id, member_id, job_id, visit_id, started_at)
      values (${company.id}, ${everaldo.id}, ${job.id}, ${visit.id}, now() - interval '30 minutes')`;
    check(
      "one running clock per person",
      await fails(tx, (s) => s`
        insert into time_entries (company_id, member_id, job_id, visit_id, started_at)
        values (${company.id}, ${everaldo.id}, ${job.id}, ${visit.id}, now())`),
    );
    check(
      "an entry can't end before it starts",
      await fails(tx, (s) => s`
        insert into time_entries (company_id, member_id, job_id, started_at, ended_at)
        values (${company.id}, ${jailton.id}, ${job.id}, now(), now() - interval '1 minute')`),
    );

    // Manual entry, as addTimeEntryAction writes it: 09:00 London on a BST day is 08:00 UTC.
    const [manual] = await tx`
      insert into time_entries (company_id, member_id, job_id, visit_id, started_at, ended_at, notes)
      select ${company.id}, ${jailton.id}, ${job.id}, ${visit.id},
             s.at, s.at + make_interval(mins => 150), 'Loading'
      from (select ('2026-10-20'::date + '09:00'::time) at time zone 'Europe/London' as at) s
      returning started_at, ended_at`;
    check("manual entries are stored in London time", manual.started_at.toISOString() === "2026-10-20T08:00:00.000Z");
    check("duration is kept", (manual.ended_at - manual.started_at) / 60000 === 150);

    await tx`update time_entries set ended_at = now() where member_id = ${everaldo.id} and ended_at is null`;
    const [{ minutes }] = await tx`
      select round(sum(extract(epoch from (ended_at - started_at))) / 60)::int as minutes
      from time_entries where job_id = ${job.id}`;
    check("time spent on the job adds every entry", minutes === 180);

    await tx`delete from job_visits where id = ${visit.id}`;
    check(
      "removing a visit drops its assignments",
      (await tx`select count(*)::int as n from job_visit_members where visit_id = ${visit.id}`)[0].n === 0,
    );
    check(
      "removing a visit keeps its time on the job",
      (await tx`select count(*)::int as n from time_entries where job_id = ${job.id} and visit_id is null`)[0].n === 2,
    );

    await tx`delete from jobs where id = ${job.id}`;
    check(
      "deleting the job deletes its time",
      (await tx`select count(*)::int as n from time_entries where job_id = ${job.id}`)[0].n === 0,
    );

    throw new Error("__rollback__");
  });
} catch (e) {
  if (e.message !== "__rollback__") {
    console.error(e);
    process.exit(1);
  }
}

await sql.end();
console.log(`team: ${passed} checks passed (rolled back)`);
