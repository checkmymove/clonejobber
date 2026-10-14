// Integration test for jobs, invoices and payments against Postgres.
// Deposit on a quote → job → invoice applies the deposit → partial and full payments →
// delete payment → close / bad debt / re-open / void. Runs in one transaction, rolled back.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import {
  changeInvoiceStatus,
  changeQuoteStatus,
  convertCompletedJobToInvoice,
  persistJob,
  persistQuote,
  updateJobDocument,
} from "../.testbuild/funnel/engine.js";
import { deletePayment, recordPayment } from "../.testbuild/payments/engine.js";
import {
  closeInvoiceWithoutPayment,
  markInvoiceBadDebt,
  reopenInvoice,
  voidInvoice,
} from "../.testbuild/invoices/lifecycle.js";
import { closeJob, reopenJob, setVisitDone } from "../.testbuild/jobs/lifecycle.js";

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

const invoiceRow = (tx, id) =>
  tx`select status, total, balance, paid_at, closed_at, bad_debt_amount from invoices where id = ${id}`.then(
    (r) => r[0],
  );

try {
  await sql.begin(async (tx) => {
    const [company] = await tx`select * from companies where slug = 'moving-london' limit 1`;
    const [client] = await tx`
      insert into clients (company_id, first_name, last_name, email, phone)
      values (${company.id}, 'Payments', 'Test', 'payments.test@example.co.uk', '+44 7700 000088')
      returning id`;

    const quote = await persistQuote(tx, company.id, {
      clientId: client.id,
      title: "Flat move",
      message: "",
      notes: "",
      validUntil: "2026-11-02",
      moveTime: "9:00 AM",
      discount: "20",
      deposit: "50",
      lines: [{ name: "Van + 2", qty: "3", unitPrice: "100" }],
    });
    check("quote with discount and deposit", quote.ok);

    const deposit = await recordPayment(tx, company.id, {
      clientId: client.id,
      kind: "deposit",
      method: "bank_transfer",
      paidOn: "2026-10-14",
      reference: "DEP-1",
      details: "",
      quoteId: quote.id,
      amount: "50",
      allocations: [],
    });
    check("deposit recorded on the quote", deposit.ok);
    const [dep] = await tx`select kind, amount, details from payments where id = ${deposit.id}`;
    check("deposit stored in pence with default details", dep.amount === 5000 && dep.details.startsWith("Payment applied to Quote"));

    await changeQuoteStatus(tx, quote.id, "sent");
    const approved = await changeQuoteStatus(tx, quote.id, "approved");
    check("approved quote created the job", approved.ok);
    const [job] = await tx`select id, total, discount from jobs where quote_id = ${quote.id}`;
    check("job carries the quote discount", job.discount === 2000 && job.total === 28000);

    const [visit] = await tx`select id from job_visits where job_id = ${job.id}`;
    await setVisitDone(tx, company.id, visit.id, true);
    const edited = await updateJobDocument(tx, company.id, job.id, {
      clientId: client.id,
      quoteId: quote.id,
      title: "Flat move",
      notes: "",
      remindInvoice: true,
      discount: "20",
      tax: "",
      visits: [
        { id: visit.id, title: "", date: "2026-11-02", later: false, start: "09:00", end: "", anytime: false, assignee: "", instructions: "" },
      ],
      lines: [{ name: "Van + 2", qty: "3", unitPrice: "100" }],
    });
    const [kept] = await tx`select id, status from job_visits where job_id = ${job.id}`;
    check("editing a job keeps the visit and its completion", edited.ok && kept.id === visit.id && kept.status === "done");

    const closed = await closeJob(tx, company.id, job.id);
    const [closedJob] = await tx`select status, closed_at from jobs where id = ${job.id}`;
    check("job closed", closed.ok && closedJob.status === "done" && closedJob.closed_at);
    const reopened = await reopenJob(tx, company.id, job.id);
    const [openJob] = await tx`select status, closed_at from jobs where id = ${job.id}`;
    check("job re-opened", reopened.ok && openJob.status === "scheduled" && !openJob.closed_at);

    const invoice = await convertCompletedJobToInvoice(tx, company.id, job.id);
    check("open job can be invoiced", invoice.ok);
    let inv = await invoiceRow(tx, invoice.id);
    check("invoice total keeps the discount", inv.total === 28000);
    check("quote deposit applied to the invoice", inv.balance === 23000 && inv.status === "draft");

    await changeInvoiceStatus(tx, invoice.id, "sent");
    const tooMuch = await recordPayment(tx, company.id, {
      clientId: client.id,
      kind: "payment",
      method: "cash",
      paidOn: "2026-10-15",
      reference: "",
      details: "",
      allocations: [{ invoiceId: invoice.id, amount: "500" }],
    });
    check("payment above the balance is refused", !tooMuch.ok);

    const part = await recordPayment(tx, company.id, {
      clientId: client.id,
      kind: "payment",
      method: "card",
      paidOn: "2026-10-15",
      reference: "",
      details: "",
      allocations: [{ invoiceId: invoice.id, amount: "100" }],
    });
    inv = await invoiceRow(tx, invoice.id);
    check("partial payment leaves the invoice open", part.ok && inv.status === "sent" && inv.balance === 13000);

    const rest = await recordPayment(tx, company.id, {
      clientId: client.id,
      kind: "payment",
      method: "bank_transfer",
      paidOn: "2026-10-16",
      reference: "TRF",
      details: "",
      allocations: [{ invoiceId: invoice.id, amount: "130" }],
    });
    inv = await invoiceRow(tx, invoice.id);
    check("full payment marks the invoice paid", rest.ok && inv.status === "paid" && inv.balance === 0 && inv.paid_at);
    const [reminder] = await tx`select status from schedule_reminders where invoice_id = ${invoice.id}`;
    check("paid invoice completes its reminder", reminder?.status === "done");

    const voidPaid = await voidInvoice(tx, company.id, invoice.id);
    check("an invoice with payments cannot be voided", !voidPaid.ok);

    const removed = await deletePayment(tx, company.id, rest.id);
    inv = await invoiceRow(tx, invoice.id);
    check("deleting a payment re-opens the balance", removed.ok && inv.status === "sent" && inv.balance === 13000 && !inv.paid_at);

    const bad = await markInvoiceBadDebt(tx, company.id, invoice.id);
    inv = await invoiceRow(tx, invoice.id);
    check("bad debt writes off the balance", bad.ok && inv.status === "bad_debt" && inv.balance === 0 && inv.bad_debt_amount === 13000);

    const back = await reopenInvoice(tx, company.id, invoice.id);
    inv = await invoiceRow(tx, invoice.id);
    check("re-opened bad debt gets its balance back", back.ok && inv.status === "sent" && inv.balance === 13000);

    const closedInv = await closeInvoiceWithoutPayment(tx, company.id, invoice.id);
    inv = await invoiceRow(tx, invoice.id);
    check("close without payment is Paid with the balance kept", closedInv.ok && inv.status === "paid" && inv.closed_at && inv.balance === 13000);

    const direct = await persistJob(tx, company.id, {
      clientId: client.id,
      title: "Survey",
      notes: "",
      remindInvoice: false,
      visits: [{ title: "", date: "2026-10-20", later: false, start: "", end: "", anytime: true, assignee: "", instructions: "" }],
      lines: [{ name: "Survey", qty: "1", unitPrice: "40" }],
    });
    const directInv = await convertCompletedJobToInvoice(tx, company.id, direct.id);
    const voided = await voidInvoice(tx, company.id, directInv.id);
    inv = await invoiceRow(tx, directInv.id);
    check("an unpaid invoice can be voided", voided.ok && inv.status === "cancelled" && inv.balance === 0);

    throw new Error("__rollback__");
  });
} catch (e) {
  if (e.message !== "__rollback__") {
    console.error(e);
    process.exit(1);
  }
}

await sql.end();
console.log(`payments: ${passed} checks passed (rolled back)`);
