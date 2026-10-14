"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Mail } from "lucide-react";
import { ClientSelect, type RichClient } from "@/components/funnel/client-select";
import { StickySaveBar } from "@/components/forms/sticky-save-bar";
import { createPayment } from "@/lib/payments/actions";
import { PAYMENT_METHODS, paymentDetailsText } from "@/lib/payments/constants";
import { formatDateNumericLondon, formatPounds } from "@/lib/format";

const ink = "text-[#042b3c]";
const line = "border-[#d5dde1]";
const field = `h-11 w-full rounded-lg border ${line} bg-white px-3 text-[15px] ${ink} outline-none focus:border-[#388623] focus:ring-2 focus:ring-[#388623]/20`;

export type FormInvoice = {
  id: string;
  number: string;
  status: string;
  due_on: string;
  total: number;
  balance: number;
  subject: string;
  pastDue: boolean;
};

export type FormQuote = {
  id: string;
  number: string;
  title: string;
  total: number;
  required: number;
  collected: number;
};

const pounds = (pence: number) => (pence / 100).toFixed(2);
const toPence = (raw: string) => Math.round((Number(raw.replace(/[£\s]/g, "").replace(",", ".")) || 0) * 100);

/** New payment (Jobber "Create a payment record"): against invoices, or a deposit on a quote. */
export function PaymentForm({
  clients,
  clientId,
  invoices,
  quotes,
  initialKind,
  initialInvoiceId,
  initialQuoteId,
  returnTo,
  today,
}: {
  clients: RichClient[];
  clientId: string;
  invoices: FormInvoice[];
  quotes: FormQuote[];
  initialKind: "payment" | "deposit";
  initialInvoiceId?: string;
  initialQuoteId?: string;
  returnTo?: string;
  today: string;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<"payment" | "deposit">(initialKind);
  const [method, setMethod] = useState("bank_transfer");
  const [paidOn, setPaidOn] = useState(today);
  const [reference, setReference] = useState("");
  const [details, setDetails] = useState("");
  const [detailsTouched, setDetailsTouched] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, string>>(() => {
    const pre = invoices.filter((i) => (initialInvoiceId ? i.id === initialInvoiceId : invoices.length === 1));
    return Object.fromEntries(pre.map((i) => [i.id, pounds(i.balance)]));
  });
  const initialQuote = quotes.find((q) => q.id === initialQuoteId) ?? quotes.find((q) => q.required > q.collected);
  const [quoteId, setQuoteId] = useState(initialQuote?.id ?? "");
  const [depositAmount, setDepositAmount] = useState(
    initialQuote ? pounds(Math.max(0, initialQuote.required - initialQuote.collected)) : "",
  );
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const selected = invoices.filter((i) => amounts[i.id] !== undefined);
  const total = kind === "deposit" ? toPence(depositAmount) : selected.reduce((s, i) => s + toPence(amounts[i.id]), 0);
  const quote = quotes.find((q) => q.id === quoteId);
  const autoDetails = useMemo(
    () =>
      paymentDetailsText(
        kind === "deposit"
          ? quote
            ? [`Quote ${quote.number}`]
            : []
          : selected.map((i) => `Invoice ${i.number}`),
      ),
    [kind, quote, selected],
  );
  const shownDetails = detailsTouched ? details : autoDetails;

  function toggle(inv: FormInvoice, on: boolean) {
    setAmounts((prev) => {
      const next = { ...prev };
      if (on) next[inv.id] = pounds(inv.balance);
      else delete next[inv.id];
      return next;
    });
  }

  async function submit(emailReceipt: boolean) {
    setError("");
    setPending(true);
    const result = await createPayment(
      {
        clientId,
        kind,
        method,
        paidOn,
        reference,
        details: shownDetails,
        quoteId: kind === "deposit" ? quoteId : undefined,
        amount: kind === "deposit" ? depositAmount : undefined,
        allocations:
          kind === "payment" ? selected.map((i) => ({ invoiceId: i.id, amount: amounts[i.id] ?? "" })) : [],
      },
      { emailReceipt, returnTo },
    );
    setPending(false);
    if (result && !result.ok) {
      if (result.id) {
        router.push(`/pagamentos/${result.id}`);
        return;
      }
      setError(result.message || Object.values(result.errors ?? {})[0] || "Could not save the payment.");
    }
  }

  const client = clients.find((c) => c.id === clientId);

  return (
    <form
      className="space-y-6 pb-24"
      onSubmit={async (event) => {
        event.preventDefault();
        await submit(false);
      }}
    >
      <div className="flex items-center gap-2">
        <CreditCard size={20} className="text-[#388623]" />
        <h1 className={`text-[26px] font-bold tracking-tight ${ink}`}>
          {client ? `New ${kind === "deposit" ? "Deposit" : "Payment"} from ${client.first_name} ${client.last_name}`.trim() : "New Payment"}
        </h1>
      </div>
      <p className={`text-4xl font-extrabold tracking-tight ${ink}`}>{formatPounds(total / 100)}</p>

      <ClientSelect
        clients={clients}
        value={clientId}
        onChange={(id) => {
          const params = new URLSearchParams({ clientId: id, kind });
          if (returnTo) params.set("returnTo", returnTo);
          router.replace(`/pagamentos/novo?${params.toString()}`);
        }}
      />

      {clientId ? (
        <>
          <div className="inline-flex rounded-lg border border-[#d5dde1] p-1 text-sm font-semibold">
            {(["payment", "deposit"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`rounded-md px-4 py-1.5 ${kind === k ? "bg-[#388623] text-white" : "text-[#5d6f78]"}`}
              >
                {k === "payment" ? "Payment on invoices" : "Deposit on a quote"}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[13px] text-[#5d6f78]">Payment method</span>
              <select aria-label="Payment method" value={method} onChange={(e) => setMethod(e.target.value)} className={field}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[13px] text-[#5d6f78]">Reference #</span>
              <input aria-label="Reference" value={reference} onChange={(e) => setReference(e.target.value)} className={field} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[13px] text-[#5d6f78]">Transaction date</span>
              <input type="date" aria-label="Transaction date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className={field} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[13px] text-[#5d6f78]">Details</span>
              <textarea
                aria-label="Details"
                value={shownDetails}
                onChange={(e) => {
                  setDetailsTouched(true);
                  setDetails(e.target.value);
                }}
                className={`min-h-[44px] w-full resize-y rounded-lg border ${line} bg-white px-3 py-2 text-[15px] ${ink} outline-none`}
              />
            </label>
          </div>

          {kind === "payment" ? (
            <section className={`rounded-lg border ${line} bg-white p-4 sm:p-5`}>
              <h2 className={`text-[17px] font-bold ${ink}`}>Outstanding invoices</h2>
              <p className="mt-1 text-sm text-[#5d6f78]">
                Select the invoices you&apos;re paying and review the amounts before continuing.
              </p>
              {invoices.length === 0 ? (
                <p className="mt-4 text-sm text-[#5d6f78]">
                  This client has no invoices with a balance. Record a deposit on a quote instead.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[620px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#d5dde1] text-xs font-semibold text-[#8aa0a8]">
                        <th className="w-10 py-2" />
                        <th className="py-2 pr-3 font-semibold">Invoice #</th>
                        <th className="py-2 pr-3 font-semibold">Due date</th>
                        <th className="py-2 pr-3 font-semibold">Subject</th>
                        <th className="py-2 pr-3 text-right font-semibold">Total</th>
                        <th className="py-2 pr-3 text-right font-semibold">Balance</th>
                        <th className="w-36 py-2 text-right font-semibold">Enter payment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv) => {
                        const on = amounts[inv.id] !== undefined;
                        return (
                          <tr key={inv.id} className="border-b border-[#eef1f2] last:border-0">
                            <td className="py-2">
                              <input
                                type="checkbox"
                                aria-label={`Pay invoice ${inv.number}`}
                                checked={on}
                                onChange={(e) => toggle(inv, e.target.checked)}
                                className="size-4 accent-[#388623]"
                              />
                            </td>
                            <td className={`py-2 pr-3 font-semibold ${ink}`}>{inv.number}</td>
                            <td className="py-2 pr-3 text-[#5d6f78]">
                              {inv.status === "draft" ? "Draft" : formatDateNumericLondon(inv.due_on)}
                              {inv.pastDue ? <span className="ml-2 text-xs font-semibold text-rose-700">Past due</span> : null}
                            </td>
                            <td className="py-2 pr-3 text-[#5d6f78]">{inv.subject}</td>
                            <td className="py-2 pr-3 text-right text-[#5d6f78]">{formatPounds(inv.total / 100)}</td>
                            <td className={`py-2 pr-3 text-right font-semibold ${ink}`}>{formatPounds(inv.balance / 100)}</td>
                            <td className="py-2 text-right">
                              <input
                                aria-label={`Amount for invoice ${inv.number}`}
                                inputMode="decimal"
                                disabled={!on}
                                value={amounts[inv.id] ?? ""}
                                onChange={(e) => setAmounts((prev) => ({ ...prev, [inv.id]: e.target.value }))}
                                className={`h-10 w-32 rounded-lg border ${line} px-2 text-right text-sm ${ink} outline-none disabled:bg-[#f6f7f8]`}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : (
            <section className={`rounded-lg border ${line} bg-white p-4 sm:p-5`}>
              <h2 className={`text-[17px] font-bold ${ink}`}>Deposit</h2>
              <p className="mt-1 text-sm text-[#5d6f78]">
                The deposit stays on the quote and is applied to the invoice of its job.
              </p>
              {quotes.length === 0 ? (
                <p className="mt-4 text-sm text-[#5d6f78]">This client has no open quotes.</p>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-[13px] text-[#5d6f78]">Quote</span>
                    <select
                      aria-label="Quote"
                      value={quoteId}
                      onChange={(e) => {
                        setQuoteId(e.target.value);
                        const q = quotes.find((x) => x.id === e.target.value);
                        if (q) setDepositAmount(pounds(Math.max(0, q.required - q.collected)));
                      }}
                      className={field}
                    >
                      <option value="">Select a quote</option>
                      {quotes.map((q) => (
                        <option key={q.id} value={q.id}>
                          {q.number} · {q.title || "Quote"} · {formatPounds(q.total / 100)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[13px] text-[#5d6f78]">Deposit amount</span>
                    <input
                      aria-label="Deposit amount"
                      inputMode="decimal"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      className={field}
                    />
                  </label>
                  {quote ? (
                    <p className="text-sm text-[#5d6f78] sm:col-span-2">
                      Required deposit {formatPounds(quote.required / 100)} · already collected{" "}
                      {formatPounds(quote.collected / 100)}
                    </p>
                  ) : null}
                </div>
              )}
            </section>
          )}
        </>
      ) : null}

      <StickySaveBar
        cancelHref={returnTo || "/pagamentos"}
        error={error}
        pending={pending}
        saveLabel="Save"
        menuItems={[
          {
            label: "Save and Email Receipt",
            icon: <Mail size={18} />,
            onClick: () => void submit(true),
          },
        ]}
      />
    </form>
  );
}
