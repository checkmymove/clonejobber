import { penceToInput } from "@/lib/format";

export function invoiceSnapshotFromDetail(inv: {
  id: string;
  client_id: string;
  job_id: string | null;
  quote_id: string | null;
  subject: string;
  message: string;
  notes: string;
  payment_terms: string;
  job_number: string | null;
  client_email: string;
  issued_on: string;
  due_on: string;
  total: number;
  balance: number;
  lines: { name: string; description: string; quantity: number; unitPrice: number }[];
}) {
  return {
    id: inv.id,
    clientId: inv.client_id,
    jobId: inv.job_id ?? undefined,
    quoteId: inv.quote_id ?? undefined,
    subject: inv.subject,
    message: inv.message,
    notes: inv.notes,
    paymentTerms: inv.payment_terms,
    jobNumber: inv.job_number ?? "Direct",
    recipient: inv.client_email,
    issuedOn: inv.issued_on,
    dueOn: inv.due_on,
    total: inv.total,
    balance: inv.balance,
    lines: inv.lines.map((line, index) => ({
      id: `invoice-line-${index}`,
      name: line.name,
      description: line.description,
      qty: String(line.quantity),
      price: penceToInput(line.unitPrice),
    })),
  };
}
