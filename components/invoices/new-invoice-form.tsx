"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createInvoice, updateInvoice } from "@/lib/invoices/actions";
import { ClientSelect } from "@/components/funnel/client-select";
import { formatPounds } from "@/lib/format";
import {
  ChevronDown,
  Eye,
  FileText,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";

const ink = "text-[#042b3c]";
const line = "border-[#d5dde1]";
const green = "#388623";
const ph = "placeholder:text-[#667880]";
const field = `h-11 w-full rounded-lg border ${line} bg-white px-3 text-[15px] ${ink} outline-none ${ph} focus:border-[#388623] focus:ring-2 focus:ring-[#388623]/20`;

type Line = { id: string; name: string; qty: string; price: string; description: string };

function SectionCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className={`rounded-lg border ${line} bg-white p-4 sm:p-5`}>
      <div className="flex items-start justify-between gap-3">
        <h2 className={`text-[17px] font-bold ${ink}`}>{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function NewInvoiceForm({
  clients,
  jobId,
  quoteId,
  invoiceId,
  initialClientId,
  initialSubject,
  initialMessage,
  initialTerms,
  initialNumber,
  initialNotes,
  initialLines,
}: {
  clients: { id: string; first_name: string; last_name: string; email: string }[];
  jobId?: string;
  quoteId?: string;
  invoiceId?: string;
  initialClientId?: string;
  initialSubject?: string;
  initialMessage?: string;
  initialTerms?: string;
  initialNumber?: string;
  initialNotes?: string;
  initialLines?: { name: string; qty: string; price: string; description: string }[];
}) {
  const [subject, setSubject] = useState(initialSubject ?? "Invoice from Moving London");
  const [clientId, setClientId] = useState(initialClientId ?? "");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [number, setNumber] = useState(initialNumber ?? "554");
  const [terms, setTerms] = useState(initialTerms ?? "due_on_receipt");
  const [askReview, setAskReview] = useState(true);
  const [clientView, setClientView] = useState(false);
  const [lines, setLines] = useState<Line[]>(
    initialLines?.length
      ? initialLines.map((l, i) => ({ id: `line-${i}`, ...l }))
      : [{ id: "line-1", name: "", qty: "1", price: "", description: "" }],
  );
  const [contract, setContract] = useState(
    initialMessage ??
      "Thank you for your business. Please contact us with any questions regarding this invoice.",
  );
  const [showContract, setShowContract] = useState(true);

  const subtotal = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const qty = Number(line.qty.replace(",", ".")) || 0;
        const price = Number(line.price.replace(",", ".")) || 0;
        return sum + qty * price;
      }, 0),
    [lines],
  );

  return (
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        setPending(true);
        const payload = {
          clientId,
          jobId,
          quoteId,
          subject,
          message: contract,
          notes: initialNotes ?? "",
          paymentTerms: terms,
          lines: lines.map((l) => ({
            name: l.name,
            description: l.description,
            qty: l.qty,
            unitPrice: l.price,
          })),
        };
        const result = invoiceId
          ? await updateInvoice(invoiceId, payload)
          : await createInvoice(payload);
        setPending(false);
        if (result && !result.ok) {
          setError(result.message || Object.values(result.errors ?? {})[0] || "Could not save invoice.");
        }
      }}
    >
      <div className="flex items-center gap-2">
        <FileText size={18} style={{ color: green }} />
        <h1 className={`text-[26px] font-bold tracking-tight ${ink}`}>
          {invoiceId ? "Edit invoice" : "New invoice"}
        </h1>
      </div>

      <label className="block">
        <span className="mb-1 block text-[13px] text-[#5d6f78]">Subject</span>
        <input
          aria-label="Subject"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          className={field}
        />
      </label>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <div>
          <ClientSelect
            clients={clients}
            value={clientId}
            onChange={setClientId}
          />
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-[150px_1fr] items-center gap-3">
            <span className="text-sm text-[#5d6f78]">Invoice #</span>
            <input
              aria-label="Invoice"
              value={number}
              disabled={!!invoiceId}
              onChange={(event) => setNumber(event.target.value)}
              className={field}
            />
          </div>
          <div className="grid grid-cols-[150px_1fr] items-center gap-3">
            <span className="text-sm text-[#5d6f78]">Issue date</span>
            <button type="button" className="justify-self-start text-sm font-semibold underline" style={{ color: green }}>
              Date de envio
            </button>
          </div>
          <label className="grid grid-cols-[150px_1fr] items-center gap-3">
            <span className="text-sm text-[#5d6f78]">Payment terms</span>
            <span className="relative block">
              <select
                aria-label="Payment terms"
                value={terms}
                onChange={(event) => setTerms(event.target.value)}
                className={`${field} appearance-none pr-9`}
              >
                <option value="due_on_receipt">Due upon receipt</option>
                <option value="net_7">Net 7</option>
                <option value="net_15">Net 15</option>
                <option value="net_30">Net 30</option>
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
            </span>
          </label>
          <div className="grid grid-cols-[150px_1fr] items-center gap-3">
            <span className="text-sm text-[#5d6f78]">Salesperson</span>
            <button
              type="button"
              className={`h-9 w-fit rounded-full border ${line} bg-white px-3 text-sm text-[#5d6f78]`}
            >
              Salesperson +
            </button>
          </div>
          <div className="grid grid-cols-[150px_1fr] items-center gap-3">
            <span className="text-sm text-[#5d6f78]">Ask for a review</span>
            <button
              type="button"
              role="switch"
              aria-checked={askReview}
              onClick={() => setAskReview((value) => !value)}
              className="inline-flex w-fit items-center gap-2"
            >
              <span
                className="relative h-6 w-11 rounded-full"
                style={{ background: askReview ? green : "#d7dee2" }}
              >
                <span
                  className="absolute top-0.5 grid h-5 w-5 place-items-center rounded-full bg-white text-[10px]"
                  style={{ left: askReview ? 22 : 2, color: green }}
                >
                  {askReview ? "✓" : ""}
                </span>
              </span>
              <span className="text-sm font-semibold" style={{ color: askReview ? green : "#8aa0a8" }}>
                {askReview ? "Yes" : "No"}
              </span>
            </button>
          </div>
          <div className="grid grid-cols-[150px_1fr] items-center gap-3">
            <span className="text-sm text-[#5d6f78]">Customise</span>
            <button
              type="button"
              className="h-8 w-fit whitespace-nowrap rounded-md border px-3 text-sm font-semibold"
              style={{ borderColor: green, color: green }}
            >
              Add field
            </button>
          </div>
        </div>
      </div>

      <SectionCard title="Product / Service">
        <div className="space-y-4">
          {lines.map((line) => {
            const qty = Number(line.qty.replace(",", ".")) || 0;
            const price = Number(line.price.replace(",", ".")) || 0;
            return (
              <div key={line.id} className="space-y-2">
                <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_110px_150px_110px]">
                  <input
                    aria-label="Name"
                    placeholder="Name"
                    value={line.name}
                    onChange={(event) =>
                      setLines((rows) => rows.map((row) => (row.id === line.id ? { ...row, name: event.target.value } : row)))
                    }
                    className={field}
                  />
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-[#8aa0a8]">Quantity</span>
                    <input
                      aria-label="Quantity"
                      value={line.qty}
                      onChange={(event) =>
                        setLines((rows) => rows.map((row) => (row.id === line.id ? { ...row, qty: event.target.value } : row)))
                      }
                      className={field}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-[#8aa0a8]">Unit price</span>
                    <input
                      aria-label="Unit price"
                      placeholder="£ 0,00"
                      value={line.price}
                      onChange={(event) =>
                        setLines((rows) => rows.map((row) => (row.id === line.id ? { ...row, price: event.target.value } : row)))
                      }
                      className={field}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-[#8aa0a8]">Total</span>
                    <div className={`flex h-11 items-center justify-end rounded-lg border ${line} px-3 text-sm ${ink}`}>
                      {formatPounds(qty * price)}
                    </div>
                  </label>
                </div>
                <textarea
                  aria-label="Description"
                  placeholder="Description"
                  value={line.description}
                  onChange={(event) =>
                    setLines((rows) =>
                      rows.map((row) => (row.id === line.id ? { ...row, description: event.target.value } : row)),
                    )
                  }
                  className={`min-h-[88px] w-full resize-y rounded-lg border ${line} px-3 py-2 text-[15px] ${ink} outline-none ${ph}`}
                />
                <button type="button" className="text-sm font-semibold underline" style={{ color: green }}>
                  Add a service date
                </button>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() =>
            setLines((rows) => [
              ...rows,
              { id: `line-${Date.now()}`, name: "", qty: "1", price: "", description: "" },
            ])
          }
          className="mt-4 h-9 rounded-lg px-3 text-sm font-semibold text-white"
          style={{ background: green }}
        >
          Add line item
        </button>

        <div className={`mt-5 grid gap-6 border-t ${line} pt-4 lg:grid-cols-[1fr_280px]`}>
          <div className="flex items-center gap-3 text-sm">
            <button
              type="button"
              onClick={() => setClientView((value) => !value)}
              className="inline-flex items-center gap-2 text-[#5d6f78]"
              aria-pressed={clientView}
            >
              <Eye size={16} />
              Client view
            </button>
            <button type="button" className="font-semibold underline" style={{ color: green }}>
              Mudar
            </button>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between text-[#5d6f78]">
              <span>Subtotal</span>
              <span>{formatPounds(subtotal)}</span>
            </div>
            <div className="flex justify-between text-[#5d6f78]">
              <span>Discount</span>
              <button type="button" className="font-semibold underline" style={{ color: green }}>
                Add discount
              </button>
            </div>
            <div className="flex justify-between text-[#5d6f78]">
              <span>VAT</span>
              <button type="button" className="font-semibold underline" style={{ color: green }}>
                Add tax
              </button>
            </div>
            <div className={`flex justify-between font-bold ${ink}`}>
              <span>Total</span>
              <span>{formatPounds(subtotal)}</span>
            </div>
            <div className="flex justify-between rounded-lg bg-[#f6f7f8] px-3 py-2 text-[#5d6f78]">
              <span>Invoice balance</span>
              <span>{formatPounds(subtotal)}</span>
            </div>
            <div className={`rounded-lg border ${line} px-3 py-3`}>
              <div className="flex items-center justify-between">
                <p className={`text-sm font-bold ${ink}`}>Client hub payments</p>
                <button type="button" aria-label="Edit payments" className="text-[#5d6f78]">
                  <Pencil size={15} />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm text-[#5d6f78]">
                <span>Invoice payments</span>
                <span className="rounded-full bg-[#eef1f2] px-2 py-0.5 text-[11px] font-bold tracking-wide text-[#5d6f78]">
                  DESBLOQUEADO
                </span>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={`inline-flex h-9 items-center gap-1 rounded-lg border ${line} bg-[#f7f8f8] px-3 text-sm text-[#5d6f78]`}>
          <Plus size={14} />
          Add section
        </button>
        <button type="button" className={`h-9 rounded-lg border ${line} bg-[#f7f8f8] px-3 text-sm text-[#5d6f78]`}>
          Client message
        </button>
      </div>

      {showContract ? (
        <SectionCard
          title="Contract / Disclaimer"
          action={
            <button type="button" aria-label="Remove contract" onClick={() => setShowContract(false)} className="text-[#8aa0a8]">
              <Trash2 size={16} />
            </button>
          }
        >
          <label className="block">
            <span className="mb-1 block text-[13px] text-[#8aa0a8]">Message</span>
            <textarea
              aria-label="Contract message"
              value={contract}
              onChange={(event) => setContract(event.target.value)}
              className={`min-h-[88px] w-full resize-y rounded-lg border ${line} px-3 py-2 text-[15px] ${ink} outline-none`}
            />
          </label>
        </SectionCard>
      ) : null}

      <section className="space-y-3">
        <h2 className={`text-[17px] font-bold ${ink}`}>Notes</h2>
        <button
          type="button"
          className={`flex min-h-[150px] w-full flex-col items-center justify-center rounded-lg border border-dashed ${line} bg-white px-6 py-8 text-center`}
        >
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[#f3f5f6] text-[#8aa0a8]">
            <Upload size={18} />
          </span>
          <span className="mt-3 text-sm text-[#7b8e96]">
            Leave an internal note for yourself or a team member.
          </span>
        </button>
      </section>

      {error ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}

      <div className="flex items-center justify-end gap-2">
        <Link
          href={invoiceId ? `/faturas/${invoiceId}` : "/faturas"}
          className={`inline-flex h-10 items-center rounded-lg border ${line} bg-white px-4 text-sm font-semibold ${ink}`}
        >
          Cancel
        </Link>
        <div className="inline-flex overflow-hidden rounded-lg text-white" style={{ background: green }}>
          <button type="submit" disabled={pending} className="h-10 px-4 text-sm font-semibold disabled:opacity-60">
            {pending ? "Saving…" : invoiceId ? "Update invoice" : "Save invoice"}
          </button>
          <button type="button" aria-label="More save options" className="grid h-10 w-9 place-items-center border-l border-white/30">
            <ChevronDown size={16} />
          </button>
        </div>
      </div>
    </form>
  );
}
