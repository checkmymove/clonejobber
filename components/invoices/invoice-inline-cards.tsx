"use client";

import { useEffect, useState } from "react";
import { formatGBP, formatDateLondon } from "@/lib/format";
import type { InvoiceInput } from "@/lib/funnel/validation";
import { saveInvoiceInPlace } from "@/lib/invoices/actions";
import {
  Dl,
  Field,
  InlineEditCard,
  LineFields,
  inlineArea,
  inlineField,
  type DraftLine,
} from "@/components/inline-edit-card";

export type InvoiceEditSnapshot = {
  id: string;
  clientId: string;
  jobId?: string;
  quoteId?: string;
  subject: string;
  message: string;
  notes: string;
  paymentTerms: string;
  jobNumber: string;
  recipient: string;
  issuedOn: string;
  dueOn: string;
  total: number;
  balance: number;
  lines: DraftLine[];
};

function toInvoiceInput(
  snapshot: InvoiceEditSnapshot,
  patch: Partial<Omit<InvoiceInput, "lines">> & { lines?: DraftLine[] } = {},
): InvoiceInput {
  return {
    clientId: snapshot.clientId,
    jobId: snapshot.jobId,
    quoteId: snapshot.quoteId,
    subject: patch.subject ?? snapshot.subject,
    message: patch.message ?? snapshot.message,
    notes: patch.notes ?? snapshot.notes,
    paymentTerms: patch.paymentTerms ?? snapshot.paymentTerms,
    lines: (patch.lines ?? snapshot.lines).map((line) => ({
      name: line.name,
      description: line.description,
      qty: line.qty,
      unitPrice: line.price,
    })),
  };
}

export function InvoiceBillingCard({ snapshot }: { snapshot: InvoiceEditSnapshot }) {
  const [subject, setSubject] = useState(snapshot.subject);
  const [message, setMessage] = useState(snapshot.message);
  const [notes, setNotes] = useState(snapshot.notes);
  const [paymentTerms, setPaymentTerms] = useState(snapshot.paymentTerms);
  useEffect(() => {
    setSubject(snapshot.subject);
    setMessage(snapshot.message);
    setNotes(snapshot.notes);
    setPaymentTerms(snapshot.paymentTerms);
  }, [snapshot]);

  return (
    <InlineEditCard
      title="Billing"
      onCancel={() => {
        setSubject(snapshot.subject);
        setMessage(snapshot.message);
        setNotes(snapshot.notes);
        setPaymentTerms(snapshot.paymentTerms);
      }}
      onSave={() =>
        saveInvoiceInPlace(snapshot.id, toInvoiceInput(snapshot, { subject, message, notes, paymentTerms }))
      }
      view={
        <>
          <Dl
            rows={[
              ["Job", snapshot.jobNumber],
              ["Recipient", snapshot.recipient],
              ["Issued", formatDateLondon(snapshot.issuedOn)],
              ["Due", formatDateLondon(snapshot.dueOn)],
              ["Total", formatGBP(snapshot.total)],
              ["Saldo", formatGBP(snapshot.balance)],
            ]}
          />
          {snapshot.message ? (
            <p className="mt-3 whitespace-pre-wrap text-sm text-ink">{snapshot.message}</p>
          ) : null}
        </>
      }
    >
      <Field label="Subject">
        <input className={inlineField} value={subject} onChange={(e) => setSubject(e.target.value)} />
      </Field>
      <Field label="Payment terms">
        <select className={inlineField} value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)}>
          <option value="due_on_receipt">Due on receipt</option>
          <option value="net_7">Net 7</option>
          <option value="net_15">Net 15</option>
          <option value="net_30">Net 30</option>
        </select>
      </Field>
      <Field label="Message">
        <textarea className={inlineArea} value={message} onChange={(e) => setMessage(e.target.value)} />
      </Field>
      <Field label="Notes">
        <textarea className={inlineArea} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
    </InlineEditCard>
  );
}

export function InvoiceItemsCard({ snapshot }: { snapshot: InvoiceEditSnapshot }) {
  const [lines, setLines] = useState(snapshot.lines);
  useEffect(() => setLines(snapshot.lines), [snapshot.lines]);

  return (
    <InlineEditCard
      title="Items"
      onCancel={() => setLines(snapshot.lines)}
      onSave={() => saveInvoiceInPlace(snapshot.id, toInvoiceInput(snapshot, { lines }))}
      view={
        <>
          {snapshot.lines.map((line) => (
            <div key={line.id} className="flex justify-between gap-3 border-b border-line py-2 text-sm last:border-0">
              <div>
                <p className="font-bold text-ink">{line.name}</p>
                {line.description ? <p className="text-ink-soft">{line.description}</p> : null}
                <p className="text-xs text-ink-mute">{line.qty} × {line.price}</p>
              </div>
            </div>
          ))}
        </>
      }
    >
      <LineFields lines={lines} onChange={setLines} />
    </InlineEditCard>
  );
}
