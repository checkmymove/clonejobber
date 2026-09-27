// Integration test for funnel engine (quote → job → invoice) against Postgres.
// Runs inside one transaction that is always rolled back.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import {
  changeInvoiceStatus,
  changeJobStatus,
  changeQuoteStatus,
  convertApprovedQuoteToJob,
  convertCompletedJobToInvoice,
  persistQuote,
  updateInvoiceDocument,
  updateJobDocument,
  updateQuoteDocument,
} from "../.testbuild/funnel/engine.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(join(root, ".env"), "utf8").split("\n")) {
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

const pricedLines = [
  { name: "Van + helper", description: "Luton", qty: "1", unitPrice: "250" },
];

try {
  await sql.begin(async (tx) => {
    const [company] = await tx`select * from companies where slug = 'moving-london' limit 1`;
    check("company exists", !!company);

    const [client] = await tx`
      insert into clients (company_id, first_name, last_name, email, phone)
      values (${company.id}, 'Engine', 'Test', 'engine.test@example.co.uk', '+44 7700 000077')
      returning id`;

    const quoteInput = {
      clientId: client.id,
      title: "Move",
      message: "Hello",
      notes: "internal",
      validUntil: "2026-10-10",
      lines: pricedLines,
    };

    const zero = await persistQuote(tx, company.id, {
      ...quoteInput,
      lines: [{ name: "Van", qty: "1", unitPrice: "0" }],
    });
    check("zero-price quote saved as draft", zero.ok && zero.id);
    const sendZero = await changeQuoteStatus(tx, zero.id, "sent");
    check("cannot send a zero-total quote", !sendZero.ok);

    const convertDraft = await convertApprovedQuoteToJob(tx, company.id, zero.id);
    check("cannot convert a draft quote", !convertDraft.ok);

    const quote = await persistQuote(tx, company.id, quoteInput);
    check("priced quote created", quote.ok && quote.number.startsWith("Q-"));

    const editedQuote = await updateQuoteDocument(tx, company.id, quote.id, {
      ...quoteInput,
      title: "Move (revised)",
      lines: [{ name: "Van + helper", description: "Luton", qty: "1", unitPrice: "300" }],
    });
    check("draft quote can be edited", editedQuote.ok);
    const [editedQuoteRow] = await tx`select title, total from quotes where id = ${quote.id}`;
    check("edited quote stored as 30000 pence", editedQuoteRow.total === 30000 && editedQuoteRow.title === "Move (revised)");
    const [editedLine] = await tx`select count(*)::int as n from quote_line_items where quote_id = ${quote.id}`;
    check("edited quote replaced line items", editedLine.n === 1);

    const sent = await changeQuoteStatus(tx, quote.id, "sent");
    check("quote marked sent", sent.ok);
    const editSent = await updateQuoteDocument(tx, company.id, quote.id, quoteInput);
    check("sent quote cannot be overwritten", !editSent.ok);

    const approved = await changeQuoteStatus(tx, quote.id, "approved");
    check("quote approved", approved.ok);

    const job = await convertApprovedQuoteToJob(tx, company.id, quote.id);
    check("approved quote became a job", job.ok && job.number.startsWith("JOB-"));

    const again = await convertApprovedQuoteToJob(tx, company.id, quote.id);
    check("second convert reuses the job", again.alreadyExisted && again.id === job.id);

    const invoiceTooSoon = await convertCompletedJobToInvoice(tx, company.id, job.id);
    check("cannot invoice an incomplete job", !invoiceTooSoon.ok);

    const jobEdit = await updateJobDocument(tx, company.id, job.id, {
      clientId: client.id,
      title: "Move job",
      notes: "updated",
      remindInvoice: true,
      visits: [
        {
          title: "Unload",
          date: "2026-10-12",
          later: false,
          start: "09:00",
          end: "12:00",
          anytime: false,
          assignee: "",
          instructions: "Call on arrival",
        },
      ],
      lines: [{ name: "Labour", qty: "2", unitPrice: "80" }],
    });
    check("open job can be edited", jobEdit.ok);
    const [jobRow] = await tx`
      select title, total, scheduled_date, window_start from jobs where id = ${job.id}`;
    const scheduled =
      jobRow.scheduled_date instanceof Date
        ? jobRow.scheduled_date.toISOString().slice(0, 10)
        : String(jobRow.scheduled_date).slice(0, 10);
    check(
      "edited job totals and schedule",
      jobRow.title === "Move job" && jobRow.total === 16000 && scheduled === "2026-10-12",
    );

    const started = await changeJobStatus(tx, job.id, "in_progress");
    check("job started", started.ok);
    const done = await changeJobStatus(tx, job.id, "done");
    check("job completed", done.ok);
    const editDone = await updateJobDocument(tx, company.id, job.id, {
      clientId: client.id,
      title: "Move job",
      notes: "",
      remindInvoice: true,
      visits: [
        {
          title: "",
          date: "2026-10-12",
          later: false,
          start: "",
          end: "",
          anytime: false,
          assignee: "",
          instructions: "",
        },
      ],
      lines: [{ name: "Labour", qty: "2", unitPrice: "80" }],
    });
    check("completed job cannot be edited", !editDone.ok);

    const invoice = await convertCompletedJobToInvoice(tx, company.id, job.id);
    check("completed job became an invoice", invoice.ok && invoice.number.startsWith("INV-"));

    const reuse = await convertCompletedJobToInvoice(tx, company.id, job.id);
    check("second invoice convert reuses the invoice", reuse.alreadyExisted && reuse.id === invoice.id);

    const invEdit = await updateInvoiceDocument(tx, company.id, invoice.id, {
      clientId: client.id,
      subject: "Final invoice",
      message: "Thanks",
      notes: "",
      paymentTerms: "net_7",
      lines: [{ name: "Labour", qty: "2", unitPrice: "90" }],
    });
    check("draft invoice can be edited", invEdit.ok);
    const [invRow] = await tx`select subject, total, balance, status from invoices where id = ${invoice.id}`;
    check(
      "edited invoice stored as 18000 pence",
      invRow.subject === "Final invoice" && invRow.total === 18000 && invRow.balance === 18000 && invRow.status === "draft",
    );

    const issued = await changeInvoiceStatus(tx, invoice.id, "sent");
    check("invoice sent", issued.ok);
    const editSentInv = await updateInvoiceDocument(tx, company.id, invoice.id, {
      clientId: client.id,
      subject: "Final invoice",
      message: "Thanks",
      notes: "",
      paymentTerms: "net_7",
      lines: [{ name: "Labour", qty: "2", unitPrice: "90" }],
    });
    check("sent invoice cannot be overwritten", !editSentInv.ok);
    const paid = await changeInvoiceStatus(tx, invoice.id, "paid");
    check("invoice paid", paid.ok);

    const [row] = await tx`
      select status, balance, total from invoices where id = ${invoice.id}`;
    check("paid invoice has zero balance", row.status === "paid" && row.balance === 0);

    const [quoteRow] = await tx`select total from quotes where id = ${quote.id}`;
    check("quote stored as 30000 pence", quoteRow.total === 30000);

    const ids = [quote.id, job.id, invoice.id];
    const [logCount] = await tx`
      select count(*)::int as n from activity_log where entity_id = any(${ids})`;
    check("activity log recorded funnel events", logCount.n >= 6);

    throw new Error("__rollback__");
  });
} catch (e) {
  if (e.message !== "__rollback__") {
    console.error(e);
    process.exit(1);
  }
}

await sql.end();
console.log(`funnel engine: ${passed} checks passed (rolled back)`);
