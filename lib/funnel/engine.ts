import {
  dueOnFromTerms,
  isoDate,
  validateInvoiceInput,
  validateJobInput,
  validateQuoteInput,
  type InvoiceInput,
  type JobInput,
  type QuoteInput,
} from "./validation";
import type { ParsedLine } from "./money";

export type ActionResult = {
  ok: boolean;
  id?: string;
  number?: string;
  errors?: Record<string, string>;
  message?: string;
  alreadyExisted?: boolean;
};

/** postgres.js tagged client (pool or transaction). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export async function persistQuote(
  db: Db,
  companyId: string,
  input: QuoteInput,
): Promise<ActionResult> {
  const { errors, parsed, subtotal, discount, tax, deposit, total } = validateQuoteInput(input);
  if (Object.keys(errors).length) return { ok: false, errors };

  const client = await db`
    select id from clients where id = ${input.clientId} and company_id = ${companyId}
  `;
  if (!client[0]) return { ok: false, errors: { clientId: "Client not found" } };

  let requestId: string | null = input.requestId || null;
  if (requestId) {
    const req = await db`
      select id from requests where id = ${requestId} and client_id = ${input.clientId}
    `;
    if (!req[0]) requestId = null;
  }

  const validUntil = input.validUntil || null;
  const moveTime = input.moveTime?.trim() ?? "";
  const inventory = input.inventory?.trim() ?? "";
  const title = input.title.trim() || "Quote";
  const numbered = await db`select next_quote_number(${companyId}) as number`;
  const rows = await db`
    insert into quotes
      (number, company_id, client_id, request_id, status, title, message, notes,
       valid_until, move_time, inventory, subtotal, discount, tax, deposit, total)
    values
      (${numbered[0].number}, ${companyId}, ${input.clientId}, ${requestId},
       'draft', ${title}, ${input.message.trim()}, ${input.notes.trim()},
       ${validUntil}, ${moveTime}, ${inventory}, ${subtotal}, ${discount}, ${tax}, ${deposit}, ${total})
    returning id, number
  `;
  for (let i = 0; i < parsed.length; i++) {
    const l = parsed[i];
    await db`
      insert into quote_line_items
        (quote_id, name, description, quantity, unit_price, total, sort)
      values
        (${rows[0].id}, ${l.name}, ${l.description}, ${l.quantity},
         ${l.unitPrice}, ${l.total}, ${i})
    `;
  }
  if (requestId) {
    await db`
      update requests set status = 'quoted', updated_at = now()
      where id = ${requestId} and status in ('new', 'review')
    `;
  }
  await db`
    insert into activity_log (company_id, actor, action, entity, entity_id, summary)
    values (${companyId}, 'admin', 'quote.created', 'quote', ${rows[0].id},
            ${`Quote ${rows[0].number} created`})
  `;
  return { ok: true, id: rows[0].id, number: rows[0].number };
}

export async function changeQuoteStatus(
  db: Db,
  quoteId: string,
  status: "sent" | "approved" | "rejected" | "expired" | "draft" | "changes_requested",
  actor = "admin",
): Promise<ActionResult> {
  const rows = await db`
    select company_id, number, status, total from quotes where id = ${quoteId} limit 1
  `;
  if (!rows[0]) return { ok: false, message: "Quote not found" };
  const quoteNext: Record<string, string[]> = {
    draft: ["sent", "approved", "changes_requested"],
    sent: ["approved", "rejected", "changes_requested"],
    changes_requested: ["sent", "approved", "rejected"],
  };
  if (!quoteNext[rows[0].status]?.includes(status)) {
    return { ok: false, message: "This status change is not allowed." };
  }
  if (status === "sent" && rows[0].total <= 0) {
    return { ok: false, message: "Set line item prices before sending." };
  }
  await db`
    update quotes set
      status = ${status},
      sent_at = case when ${status} = 'sent' then now() else sent_at end,
      updated_at = now()
    where id = ${quoteId}
  `;
  await db`
    insert into activity_log (company_id, actor, action, entity, entity_id, summary)
    values (${rows[0].company_id}, ${actor}, 'quote.status_changed', 'quote', ${quoteId},
            ${`Quote ${rows[0].number} → ${status}`})
  `;
  return { ok: true, id: quoteId };
}

export async function archiveQuote(db: Db, quoteId: string, archived: boolean): Promise<ActionResult> {
  const rows = await db`
    select company_id, number, archived_at from quotes where id = ${quoteId} limit 1
  `;
  if (!rows[0]) return { ok: false, message: "Quote not found" };
  const already = Boolean(rows[0].archived_at);
  if (already === archived) return { ok: true, id: quoteId, number: rows[0].number };
  await db`
    update quotes set
      archived_at = case when ${archived} then now() else null end,
      updated_at = now()
    where id = ${quoteId}
  `;
  await db`
    insert into activity_log (company_id, actor, action, entity, entity_id, summary)
    values (${rows[0].company_id}, 'admin', ${archived ? "quote.archived" : "quote.unarchived"},
            'quote', ${quoteId},
            ${`Quote ${rows[0].number} ${archived ? "archived" : "unarchived"}`})
  `;
  return { ok: true, id: quoteId, number: rows[0].number };
}

export async function deleteQuote(db: Db, quoteId: string): Promise<ActionResult> {
  const rows = await db`
    select company_id, number from quotes where id = ${quoteId} limit 1
  `;
  if (!rows[0]) return { ok: false, message: "Quote not found" };
  await db`delete from quotes where id = ${quoteId}`;
  await db`
    insert into activity_log (company_id, actor, action, entity, entity_id, summary)
    values (${rows[0].company_id}, 'admin', 'quote.deleted', 'quote', ${quoteId},
            ${`Quote ${rows[0].number} deleted`})
  `;
  return { ok: true, id: quoteId, number: rows[0].number };
}

export async function persistJob(
  db: Db,
  companyId: string,
  input: JobInput,
): Promise<ActionResult> {
  const { errors, parsed, subtotal } = validateJobInput(input);
  if (Object.keys(errors).length) return { ok: false, errors };

  const client = await db`
    select id from clients where id = ${input.clientId} and company_id = ${companyId}
  `;
  if (!client[0]) return { ok: false, errors: { clientId: "Client not found" } };

  const first = input.visits[0];
  const scheduled = first?.later ? null : first?.date || null;
  const windowStart = first?.anytime || first?.later ? "" : first?.start || "";
  const windowEnd = first?.anytime || first?.later ? "" : first?.end || "";
  const title = input.title.trim() || "Job";

  let pickup = "";
  let delivery = "";
  if (input.requestId) {
    const locs = await db`
      select kind, address, postcode from request_locations where request_id = ${input.requestId}
    `;
    pickup = locs
      .filter((l: { kind: string }) => l.kind === "pickup")
      .map((l: { address: string; postcode: string }) => `${l.address}, ${l.postcode}`)
      .join("");
    delivery = locs
      .filter((l: { kind: string }) => l.kind === "delivery")
      .map((l: { address: string; postcode: string }) => `${l.address}, ${l.postcode}`)
      .join("");
  }

  const numbered = await db`select next_job_number(${companyId}) as number`;
  const rows = await db`
    insert into jobs
      (number, company_id, client_id, quote_id, request_id, status, title, notes,
       scheduled_date, window_start, window_end, anytime, schedule_later,
       remind_invoice, pickup_address, delivery_address, subtotal, total)
    values
      (${numbered[0].number}, ${companyId}, ${input.clientId},
       ${input.quoteId || null}, ${input.requestId || null}, 'scheduled', ${title},
       ${input.notes.trim()}, ${scheduled}, ${windowStart}, ${windowEnd},
       ${!!first?.anytime}, ${!!first?.later}, ${input.remindInvoice},
       ${pickup}, ${delivery}, ${subtotal}, ${subtotal})
    returning id
  `;
  const jobId = rows[0].id;
  for (let i = 0; i < parsed.length; i++) {
    const l = parsed[i];
    await db`
      insert into job_line_items
        (job_id, name, description, quantity, unit_price, total, sort)
      values (${jobId}, ${l.name}, ${l.description}, ${l.quantity},
              ${l.unitPrice}, ${l.total}, ${i})
    `;
  }
  for (let i = 0; i < input.visits.length; i++) {
    const v = input.visits[i];
    await db`
      insert into job_visits
        (job_id, title, visit_date, start_time, end_time, anytime, later,
         assignee, instructions, sort)
      values
        (${jobId}, ${v.title}, ${v.later ? null : v.date || null},
         ${v.start}, ${v.end}, ${v.anytime}, ${v.later}, ${v.assignee},
         ${v.instructions}, ${i})
    `;
  }
  await db`
    insert into activity_log (company_id, actor, action, entity, entity_id, summary)
    values (${companyId}, 'admin', 'job.created', 'job', ${jobId},
            ${`Job ${numbered[0].number} created`})
  `;
  return { ok: true, id: jobId, number: numbered[0].number };
}

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

async function quoteToJob(
  db: Db,
  companyId: string,
  quoteId: string,
  requireApproved: boolean,
): Promise<ActionResult> {
  const q = await db`
    select id, company_id, client_id, request_id, number, title, notes, status, archived_at
    from quotes where id = ${quoteId}
    limit 1
    for update
  `;
  if (!q[0]) return { ok: false, message: "Quote not found" };
  if (q[0].company_id !== companyId) return { ok: false, message: "Quote not found" };
  if (q[0].archived_at) {
    return { ok: false, message: "Unarchive this quote before converting it to a job." };
  }
  if (q[0].status === "rejected" || q[0].status === "expired") {
    return { ok: false, message: "This quote cannot become a job." };
  }
  if (requireApproved && q[0].status !== "approved") {
    return { ok: false, message: "Only an approved quote can become a job." };
  }
  const existing = await db`select id from jobs where quote_id = ${quoteId} limit 1`;
  if (existing[0]) return { ok: true, id: existing[0].id, alreadyExisted: true };

  const lines = (await db`
    select name, description, quantity::float as quantity,
           unit_price as "unitPrice", total
    from quote_line_items where quote_id = ${quoteId} order by sort
  `) as ParsedLine[];
  const req = q[0].request_id
    ? await db`select move_date from requests where id = ${q[0].request_id} limit 1`
    : [];

  const input: JobInput = {
    clientId: q[0].client_id,
    quoteId: q[0].id,
    requestId: q[0].request_id ?? undefined,
    title: q[0].title || `Job from ${q[0].number}`,
    notes: q[0].notes,
    remindInvoice: true,
    visits: [
      {
        title: "",
        date: req[0]?.move_date ?? new Date().toISOString().slice(0, 10),
        later: !req[0]?.move_date,
        start: "",
        end: "",
        anytime: false,
        assignee: "",
        instructions: "",
      },
    ],
    lines: lines.map((l) => ({
      name: l.name,
      description: l.description,
      qty: String(l.quantity),
      unitPrice: (l.unitPrice / 100).toFixed(2),
    })),
  };
  return persistJob(db, companyId, input);
}

export function convertApprovedQuoteToJob(
  db: Db,
  companyId: string,
  quoteId: string,
): Promise<ActionResult> {
  return quoteToJob(db, companyId, quoteId, true);
}

/** Creates a job from a saved quote. Used by Save Quote → Convert to Job. */
export function prepareJobFromQuote(
  db: Db,
  companyId: string,
  quoteId: string,
): Promise<ActionResult> {
  return quoteToJob(db, companyId, quoteId, false);
}

export async function changeJobStatus(
  db: Db,
  jobId: string,
  status: "scheduled" | "in_progress" | "done" | "cancelled",
): Promise<ActionResult> {
  const rows = await db`select company_id, number from jobs where id = ${jobId} limit 1`;
  if (!rows[0]) return { ok: false, message: "Job not found" };
  await db`update jobs set status = ${status}, updated_at = now() where id = ${jobId}`;
  if (status === "done") {
    await db`
      update job_visits set status = 'done' where job_id = ${jobId} and status = 'scheduled'
    `;
  }
  await db`
    insert into activity_log (company_id, actor, action, entity, entity_id, summary)
    values (${rows[0].company_id}, 'admin', 'job.status_changed', 'job', ${jobId},
            ${`Job ${rows[0].number} → ${status}`})
  `;
  return { ok: true, id: jobId };
}

export async function persistInvoice(
  db: Db,
  companyId: string,
  input: InvoiceInput,
): Promise<ActionResult> {
  const { errors, parsed, subtotal } = validateInvoiceInput(input);
  if (Object.keys(errors).length) return { ok: false, errors };

  const client = await db`
    select id from clients where id = ${input.clientId} and company_id = ${companyId}
  `;
  if (!client[0]) return { ok: false, errors: { clientId: "Client not found" } };

  const issued = new Date();
  const due = isoDate(dueOnFromTerms(input.paymentTerms, issued));
  const issuedOn = isoDate(issued);
  const subject = input.subject.trim();
  const numbered = await db`select next_invoice_number(${companyId}) as number`;
  const rows = await db`
    insert into invoices
      (number, company_id, client_id, job_id, quote_id, status, subject, message,
       notes, payment_terms, issued_on, due_on, subtotal, total, balance)
    values
      (${numbered[0].number}, ${companyId}, ${input.clientId},
       ${input.jobId || null}, ${input.quoteId || null}, 'draft', ${subject},
       ${input.message.trim()}, ${input.notes.trim()}, ${input.paymentTerms},
       ${issuedOn}, ${due}, ${subtotal}, ${subtotal}, ${subtotal})
    returning id
  `;
  const invoiceId = rows[0].id;
  for (let i = 0; i < parsed.length; i++) {
    const l = parsed[i];
    await db`
      insert into invoice_line_items
        (invoice_id, name, description, quantity, unit_price, total, sort)
      values (${invoiceId}, ${l.name}, ${l.description}, ${l.quantity},
              ${l.unitPrice}, ${l.total}, ${i})
    `;
  }
  await db`
    insert into activity_log (company_id, actor, action, entity, entity_id, summary)
    values (${companyId}, 'admin', 'invoice.created', 'invoice', ${invoiceId},
            ${`Invoice ${numbered[0].number} created`})
  `;
  return { ok: true, id: invoiceId, number: numbered[0].number };
}

export async function convertCompletedJobToInvoice(
  db: Db,
  companyId: string,
  jobId: string,
): Promise<ActionResult> {
  const job = await db`
    select id, company_id, client_id, quote_id, number, title, notes, status
    from jobs where id = ${jobId}
    limit 1
    for update
  `;
  if (!job[0]) return { ok: false, message: "Job not found" };
  if (job[0].company_id !== companyId) return { ok: false, message: "Job not found" };
  if (job[0].status !== "done") {
    return { ok: false, message: "Complete the job before generating an invoice." };
  }
  const existing = await db`select id from invoices where job_id = ${jobId} limit 1`;
  if (existing[0]) return { ok: true, id: existing[0].id, alreadyExisted: true };

  const lines = (await db`
    select name, description, quantity::float as quantity,
           unit_price as "unitPrice", total
    from job_line_items where job_id = ${jobId} order by sort
  `) as ParsedLine[];
  const terms = await db`select payment_terms from clients where id = ${job[0].client_id} limit 1`;

  return persistInvoice(db, companyId, {
    clientId: job[0].client_id,
    jobId: job[0].id,
    quoteId: job[0].quote_id ?? undefined,
    subject: job[0].title || `Invoice from ${job[0].number}`,
    message:
      "Thank you for your business. Please contact us with any questions regarding this invoice.",
    notes: job[0].notes,
    paymentTerms:
      terms[0]?.payment_terms === "custom"
        ? "due_on_receipt"
        : terms[0]?.payment_terms || "due_on_receipt",
    lines: lines.map((l) => ({
      name: l.name,
      description: l.description,
      qty: String(l.quantity),
      unitPrice: (l.unitPrice / 100).toFixed(2),
    })),
  });
}

export async function changeInvoiceStatus(
  db: Db,
  invoiceId: string,
  status: "draft" | "sent" | "paid" | "cancelled",
): Promise<ActionResult> {
  const rows = await db`
    select company_id, number, status, total from invoices where id = ${invoiceId} limit 1
  `;
  if (!rows[0]) return { ok: false, message: "Invoice not found" };
  const invoiceNext: Record<string, string[]> = {
    draft: ["sent", "cancelled"],
    sent: ["paid", "cancelled"],
    overdue: ["paid", "cancelled"],
  };
  if (!invoiceNext[rows[0].status]?.includes(status)) {
    return { ok: false, message: "This status change is not allowed." };
  }
  const paid = status === "paid";
  await db`
    update invoices set
      status = ${status},
      balance = ${paid ? 0 : rows[0].total},
      sent_at = case when ${status} = 'sent' then coalesce(sent_at, now()) else sent_at end,
      paid_at = case when ${paid} then now() else paid_at end,
      updated_at = now()
    where id = ${invoiceId}
  `;
  await db`
    insert into activity_log (company_id, actor, action, entity, entity_id, summary)
    values (${rows[0].company_id}, 'admin', 'invoice.status_changed', 'invoice', ${invoiceId},
            ${`Invoice ${rows[0].number} → ${status}`})
  `;
  return { ok: true, id: invoiceId };
}

export async function updateQuoteDocument(
  db: Db,
  companyId: string,
  quoteId: string,
  input: QuoteInput,
): Promise<ActionResult> {
  const { errors, parsed, subtotal, discount, tax, deposit, total } = validateQuoteInput(input);
  if (Object.keys(errors).length) return { ok: false, errors };

  const rows = await db`
    select id, company_id, number, status from quotes
    where id = ${quoteId} and company_id = ${companyId} limit 1
  `;
  if (!rows[0]) return { ok: false, message: "Quote not found" };

  const client = await db`
    select id from clients where id = ${input.clientId} and company_id = ${companyId}
  `;
  if (!client[0]) return { ok: false, errors: { clientId: "Client not found" } };

  const title = input.title.trim() || "Quote";
  const validUntil = input.validUntil || null;
  const moveTime = input.moveTime?.trim() ?? "";
  const inventory = input.inventory?.trim() ?? "";
  await db`
    update quotes set
      client_id = ${input.clientId},
      title = ${title},
      message = ${input.message.trim()},
      notes = ${input.notes.trim()},
      valid_until = ${validUntil},
      move_time = ${moveTime},
      inventory = ${inventory},
      subtotal = ${subtotal},
      discount = ${discount},
      tax = ${tax},
      deposit = ${deposit},
      total = ${total},
      updated_at = now()
    where id = ${quoteId}
  `;
  await db`delete from quote_line_items where quote_id = ${quoteId}`;
  for (let i = 0; i < parsed.length; i++) {
    const l = parsed[i];
    await db`
      insert into quote_line_items
        (quote_id, name, description, quantity, unit_price, total, sort)
      values
        (${quoteId}, ${l.name}, ${l.description}, ${l.quantity},
         ${l.unitPrice}, ${l.total}, ${i})
    `;
  }
  await db`
    insert into activity_log (company_id, actor, action, entity, entity_id, summary)
    values (${companyId}, 'admin', 'quote.updated', 'quote', ${quoteId},
            ${`Quote ${rows[0].number} updated`})
  `;
  return { ok: true, id: quoteId, number: rows[0].number };
}

export async function updateJobDocument(
  db: Db,
  companyId: string,
  jobId: string,
  input: JobInput,
): Promise<ActionResult> {
  const { errors, parsed, subtotal } = validateJobInput(input);
  if (Object.keys(errors).length) return { ok: false, errors };

  const rows = await db`
    select id, company_id, number, status, pickup_address, delivery_address from jobs
    where id = ${jobId} and company_id = ${companyId} limit 1
  `;
  if (!rows[0]) return { ok: false, message: "Job not found" };

  const client = await db`
    select id from clients where id = ${input.clientId} and company_id = ${companyId}
  `;
  if (!client[0]) return { ok: false, errors: { clientId: "Client not found" } };

  const first = input.visits[0];
  const scheduled = first?.later ? null : first?.date || null;
  const windowStart = first?.anytime || first?.later ? "" : first?.start || "";
  const windowEnd = first?.anytime || first?.later ? "" : first?.end || "";
  const title = input.title.trim() || "Job";

  await db`
    update jobs set
      client_id = ${input.clientId},
      title = ${title},
      notes = ${input.notes.trim()},
      scheduled_date = ${scheduled},
      window_start = ${windowStart},
      window_end = ${windowEnd},
      anytime = ${!!first?.anytime},
      schedule_later = ${!!first?.later},
      remind_invoice = ${input.remindInvoice},
      pickup_address = ${input.pickupAddress ?? rows[0].pickup_address},
      delivery_address = ${input.deliveryAddress ?? rows[0].delivery_address},
      subtotal = ${subtotal},
      total = ${subtotal},
      updated_at = now()
    where id = ${jobId}
  `;
  await db`delete from job_line_items where job_id = ${jobId}`;
  await db`delete from job_visits where job_id = ${jobId}`;
  for (let i = 0; i < parsed.length; i++) {
    const l = parsed[i];
    await db`
      insert into job_line_items
        (job_id, name, description, quantity, unit_price, total, sort)
      values (${jobId}, ${l.name}, ${l.description}, ${l.quantity},
              ${l.unitPrice}, ${l.total}, ${i})
    `;
  }
  for (let i = 0; i < input.visits.length; i++) {
    const v = input.visits[i];
    await db`
      insert into job_visits
        (job_id, title, visit_date, start_time, end_time, anytime, later,
         assignee, instructions, sort)
      values
        (${jobId}, ${v.title}, ${v.later ? null : v.date || null},
         ${v.start}, ${v.end}, ${v.anytime}, ${v.later}, ${v.assignee},
         ${v.instructions}, ${i})
    `;
  }
  await db`
    insert into activity_log (company_id, actor, action, entity, entity_id, summary)
    values (${companyId}, 'admin', 'job.updated', 'job', ${jobId},
            ${`Job ${rows[0].number} updated`})
  `;
  return { ok: true, id: jobId, number: rows[0].number };
}

export async function updateInvoiceDocument(
  db: Db,
  companyId: string,
  invoiceId: string,
  input: InvoiceInput,
): Promise<ActionResult> {
  const { errors, parsed, subtotal } = validateInvoiceInput(input);
  if (Object.keys(errors).length) return { ok: false, errors };

  const rows = await db`
    select id, company_id, number, status, issued_on from invoices
    where id = ${invoiceId} and company_id = ${companyId} limit 1
  `;
  if (!rows[0]) return { ok: false, message: "Invoice not found" };

  const client = await db`
    select id from clients where id = ${input.clientId} and company_id = ${companyId}
  `;
  if (!client[0]) return { ok: false, errors: { clientId: "Client not found" } };

  const issued = new Date(rows[0].issued_on);
  const due = isoDate(dueOnFromTerms(input.paymentTerms, issued));
  const subject = input.subject.trim();
  const balance = rows[0].status === "paid" ? 0 : subtotal;
  await db`
    update invoices set
      client_id = ${input.clientId},
      subject = ${subject},
      message = ${input.message.trim()},
      notes = ${input.notes.trim()},
      payment_terms = ${input.paymentTerms},
      due_on = ${due},
      subtotal = ${subtotal},
      total = ${subtotal},
      balance = ${balance},
      updated_at = now()
    where id = ${invoiceId}
  `;
  await db`delete from invoice_line_items where invoice_id = ${invoiceId}`;
  for (let i = 0; i < parsed.length; i++) {
    const l = parsed[i];
    await db`
      insert into invoice_line_items
        (invoice_id, name, description, quantity, unit_price, total, sort)
      values (${invoiceId}, ${l.name}, ${l.description}, ${l.quantity},
              ${l.unitPrice}, ${l.total}, ${i})
    `;
  }
  await db`
    insert into activity_log (company_id, actor, action, entity, entity_id, summary)
    values (${companyId}, 'admin', 'invoice.updated', 'invoice', ${invoiceId},
            ${`Invoice ${rows[0].number} updated`})
  `;
  return { ok: true, id: invoiceId, number: rows[0].number };
}
