import "server-only";
import { sql } from "@/lib/db";
import type { ParsedLine } from "@/lib/funnel/money";

export interface InvoiceRow {
  id: string;
  number: string;
  status: string;
  subject: string;
  total: number;
  balance: number;
  due_on: string;
  issued_on: string;
  client_id: string;
  client_name: string;
  job_number: string | null;
}

export interface InvoiceDetail extends InvoiceRow {
  job_id: string | null;
  quote_id: string | null;
  message: string;
  notes: string;
  payment_terms: string;
  subtotal: number;
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
  client_email: string;
  lines: ParsedLine[];
}

export async function listInvoices(companySlug: string, q = ""): Promise<InvoiceRow[]> {
  const like = `%${q.trim()}%`;
  return sql<InvoiceRow[]>`
    select i.id, i.number,
           case
             when i.status = 'sent' and i.due_on < (timezone('Europe/London', now()))::date
               then 'overdue' else i.status
           end as status,
           i.subject, i.total,
           i.balance, i.due_on, i.issued_on, i.client_id,
           trim(c.first_name || ' ' || c.last_name) as client_name,
           j.number as job_number
    from invoices i
    join companies co on co.id = i.company_id
    join clients c on c.id = i.client_id
    left join jobs j on j.id = i.job_id
    where co.slug = ${companySlug}
      and (${q.trim() === ""}
        or i.number ilike ${like}
        or i.subject ilike ${like}
        or c.first_name ilike ${like}
        or c.last_name ilike ${like})
    order by i.created_at desc
  `;
}

export async function getInvoiceDetail(id: string): Promise<InvoiceDetail | null> {
  const rows = await sql<InvoiceDetail[]>`
    select i.id, i.number,
           case
             when i.status = 'sent' and i.due_on < (timezone('Europe/London', now()))::date
               then 'overdue' else i.status
           end as status,
           i.subject, i.total, i.balance, i.due_on, i.issued_on, i.client_id,
           i.job_id, i.quote_id, i.message, i.notes, i.payment_terms, i.subtotal,
           i.sent_at, i.paid_at, i.created_at,
           trim(c.first_name || ' ' || c.last_name) as client_name,
           c.email as client_email,
           j.number as job_number
    from invoices i
    join clients c on c.id = i.client_id
    left join jobs j on j.id = i.job_id
    where i.id = ${id}
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  const lines = await sql<ParsedLine[]>`
    select name, description, quantity::float as quantity,
           unit_price as "unitPrice", total
    from invoice_line_items where invoice_id = ${id} order by sort
  `;
  return { ...row, lines };
}
