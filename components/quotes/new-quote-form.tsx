"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronDown, Hammer, Mail, Pencil, Quote, Trash2, X } from "lucide-react";
import { EmailQuoteDialog } from "@/components/quotes/email-quote-dialog";
import type { QuoteEmailDraft } from "@/lib/email/draft";
import {
  createQuote,
  loadQuotePrefill,
  prepareQuoteEmail,
  saveQuoteAndConvert,
  updateQuote,
} from "@/lib/quotes/actions";
import { QUOTE_TERMS } from "@/lib/quotes/terms";
import type { QuoteInventoryFile, QuotePacking, QuoteServiceChoice, QuoteStop } from "@/lib/quotes/types";
import { ClientSelect } from "@/components/funnel/client-select";
import { formatPounds } from "@/lib/format";

const ink = "text-[#042b3c]";
const line = "border-[#d5dde1]";
const green = "#388623";
const field = `h-11 w-full rounded-lg border ${line} bg-white px-3 text-[15px] ${ink} outline-none placeholder:text-[#667880] focus:border-[#388623] focus:ring-2 focus:ring-[#388623]/20`;
const label = "mb-1 block text-[13px] text-[#5d6f78]";
const datePicker =
  "relative cursor-pointer pr-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0";

type Line = { id: string; name: string; qty: string; price: string; description: string };
type Client = { id: string; first_name: string; last_name: string; email: string };

export function NewQuoteForm({
  clients,
  requestId,
  sourceRequestId,
  quoteId,
  initialClientId,
  initialTitle,
  initialMoveDate,
  initialMoveTime,
  initialMessage,
  initialNotes,
  initialInventory,
  initialFiles,
  initialLines,
  initialCollection,
  initialDelivery,
  initialPacking,
  initialDiscount,
  initialTax,
  initialDeposit,
  service,
}: {
  clients: Client[];
  requestId?: string;
  sourceRequestId?: string;
  quoteId?: string;
  initialClientId?: string;
  initialTitle?: string;
  initialMoveDate?: string;
  initialMoveTime?: string;
  initialMessage?: string;
  initialNotes?: string;
  initialInventory?: string;
  initialFiles?: QuoteInventoryFile[];
  initialLines?: { name: string; description: string; qty: string; unitPrice: string }[];
  initialCollection?: QuoteStop | null;
  initialDelivery?: QuoteStop | null;
  initialPacking?: QuotePacking | null;
  initialDiscount?: string;
  initialTax?: string;
  initialDeposit?: string;
  service?: QuoteServiceChoice;
}) {
  const [clientId, setClientId] = useState(initialClientId ?? "");
  const [linkedRequestId, setLinkedRequestId] = useState(requestId);
  const [loadingClient, setLoadingClient] = useState(false);
  const loadSeq = useRef(0);
  const [title, setTitle] = useState(initialTitle ?? service?.name ?? "");
  const [moveDate, setMoveDate] = useState(initialMoveDate ?? "");
  const [moveTime, setMoveTime] = useState(initialMoveTime ?? "");
  const dateRef = useRef<HTMLInputElement>(null);
  const [message] = useState(initialMessage?.trim() ? initialMessage : QUOTE_TERMS);
  const [termsOpen, setTermsOpen] = useState(false);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [inventory, setInventory] = useState(initialInventory ?? "");
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [files, setFiles] = useState<QuoteInventoryFile[]>(initialFiles ?? []);
  const [collection, setCollection] = useState<QuoteStop | null>(initialCollection ?? null);
  const [delivery, setDelivery] = useState<QuoteStop | null>(initialDelivery ?? null);
  const [packing, setPacking] = useState<QuotePacking | null>(initialPacking ?? null);
  const [discount, setDiscount] = useState(initialDiscount ?? "");
  const [tax, setTax] = useState(initialTax ?? "");
  const [deposit, setDeposit] = useState(initialDeposit ?? "");
  const [discountOpen, setDiscountOpen] = useState(Boolean(initialDiscount));
  const [taxOpen, setTaxOpen] = useState(Boolean(initialTax));
  const [depositOpen, setDepositOpen] = useState(Boolean(initialDeposit));
  const [paymentsOn, setPaymentsOn] = useState(false);
  const [marginOpen, setMarginOpen] = useState(true);
  const [savedQuoteId, setSavedQuoteId] = useState(quoteId);
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const [emailDraft, setEmailDraft] = useState<QuoteEmailDraft | null>(null);
  const saveMenuRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [lines, setLines] = useState<Line[]>(
    initialLines?.length
      ? initialLines.map((l, i) => ({
          id: `line-${i}`,
          name: l.name,
          qty: l.qty,
          price: l.unitPrice,
          description: l.description,
        }))
      : [{ id: "line-1", name: "", qty: "1", price: "", description: "" }],
  );

  async function applyClient(id: string) {
    setClientId(id);
    if (quoteId || !id) return;
    const seq = ++loadSeq.current;
    setLoadingClient(true);
    const next = await loadQuotePrefill({
      clientId: id,
      requestId: sourceRequestId,
      serviceId: service?.id,
    });
    if (seq !== loadSeq.current) return;
    setLoadingClient(false);
    if (!next) {
      setLinkedRequestId(undefined);
      setMoveDate("");
      setMoveTime("");
      setInventory("");
      setFiles([]);
      setCollection(null);
      setDelivery(null);
      setPacking(null);
      if (service) {
        setTitle(service.name);
        setLines((rows) => [
          {
            id: rows[0]?.id ?? "line-1",
            name: service.name,
            qty: "1",
            price: rows[0]?.name === service.name ? rows[0].price : service.unitPrice,
            description: service.description,
          },
        ]);
      } else {
        setTitle("");
        setLines([{ id: "line-1", name: "", qty: "1", price: "", description: "" }]);
      }
      return;
    }
    setLinkedRequestId(next.requestId);
    setTitle(service?.name ?? next.title);
    setMoveDate(next.moveDate);
    setMoveTime(next.moveTime);
    setInventory(next.inventory);
    setFiles(next.files);
    setCollection(next.collection);
    setDelivery(next.delivery);
    setPacking(next.packing);
    setLines((rows) =>
      next.lines.map((line, i) => ({
        id: rows[i]?.id ?? `line-${i}`,
        name: line.name,
        qty: line.qty,
        price: rows[i]?.name === line.name ? rows[i].price : line.unitPrice,
        description: line.description,
      })),
    );
  }

  function money(raw: string) {
    const n = Number(raw.replace(/[£\s]/g, "").replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  const subtotal = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const qty = Number(line.qty.replace(",", ".")) || 0;
        const price = Number(line.price.replace(",", ".")) || 0;
        return sum + qty * price;
      }, 0),
    [lines],
  );
  const discountAmount = money(discount);
  const taxAmount = money(tax);
  const quoteTotal = Math.max(0, subtotal - discountAmount + taxAmount);

  useEffect(() => {
    if (!saveMenuOpen) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (saveMenuRef.current?.contains(target)) return;
      setSaveMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [saveMenuOpen]);

  async function submit(followUp?: "email" | "job") {
    setError("");
    setPending(true);
    setSaveMenuOpen(false);
    const payload = {
      clientId,
      requestId: linkedRequestId,
      title,
      message,
      notes,
      validUntil: moveDate,
      moveTime,
      inventory,
      discount,
      tax,
      deposit,
      lines: lines.map((l) => ({
        name: l.name,
        description: l.description,
        qty: l.qty,
        unitPrice: l.price,
      })),
    };
    const currentId = savedQuoteId;
    if (followUp === "email") {
      const prepared = await prepareQuoteEmail(currentId, payload);
      setPending(false);
      if (prepared.id) setSavedQuoteId(prepared.id);
      if (!prepared.ok || !prepared.draft) {
        setError(prepared.message || Object.values(prepared.errors ?? {})[0] || "Could not prepare the email.");
        return;
      }
      setEmailDraft(prepared.draft);
      return;
    }
    const result =
      followUp === "job"
        ? await saveQuoteAndConvert(currentId, payload)
        : currentId
          ? await updateQuote(currentId, payload)
          : await createQuote(payload);
    setPending(false);
    if (result && !result.ok) {
      if (result.id) setSavedQuoteId(result.id);
      setError(result.message || Object.values(result.errors ?? {})[0] || "Could not save quote.");
    }
  }

  return (
    <>
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        await submit();
      }}
    >
      <div className="flex items-center gap-2">
        <Quote size={18} style={{ color: green }} />
        <h1 className={`text-[26px] font-bold tracking-tight ${ink}`}>
          {quoteId ? "Edit quote" : "New quote"}
        </h1>
      </div>

      <ClientSelect
        clients={clients}
        value={clientId}
        onChange={(id) => {
          void applyClient(id);
        }}
        disabled={loadingClient}
      />
      {loadingClient ? (
        <p className="text-sm text-[#5d6f78]">Loading client and request details…</p>
      ) : null}

      <label className="block">
        <span className={label}>Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="removal service" className={field} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={label}>Moving date</span>
          <span
            className="relative block cursor-pointer"
            onClick={() => {
              try {
                dateRef.current?.showPicker?.();
              } catch {
                dateRef.current?.focus();
              }
            }}
          >
            <input
              ref={dateRef}
              type="date"
              value={moveDate}
              onChange={(e) => setMoveDate(e.target.value)}
              className={`${field} ${datePicker}`}
            />
            <Calendar
              size={16}
              aria-hidden
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#5d6f78]"
            />
          </span>
        </label>
        <label className="block">
          <span className={label}>Moving time</span>
          <input
            value={moveTime}
            onChange={(e) => setMoveTime(e.target.value)}
            placeholder="Moving time"
            className={field}
          />
        </label>
      </div>

      {packing ? (
        <section className={`rounded-lg border ${line} bg-white p-4 sm:p-5`}>
          <h2 className={`text-[17px] font-bold ${ink}`}>Packing service</h2>
          <dl className="mt-3 text-sm">
            <Fact name="Packing services" value={packing.service} />
            <Fact name="Packing materials" value={packing.materials} />
          </dl>
        </section>
      ) : null}

      {collection || delivery ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {collection ? <StopCard title="Collection Information" stop={collection} /> : null}
          {delivery ? <StopCard title="Delivery Information" stop={delivery} /> : null}
        </div>
      ) : null}

      <section className={`rounded-lg border ${line} bg-white p-4 sm:p-5`}>
        <h2 className={`text-[17px] font-bold ${ink}`}>Product / Service</h2>
        <div className="mt-4 space-y-6">
          {lines.map((line) => {
            const qty = Number(line.qty.replace(",", ".")) || 0;
            const price = Number(line.price.replace(",", ".")) || 0;
            return (
              <div key={line.id} className="space-y-3">
                <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_110px_150px_110px]">
                  <label className="block">
                    <span className={label}>Service</span>
                    <input
                      aria-label="Service"
                      value={line.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        setLines((rows) =>
                          rows.map((row) => (row.id === line.id ? { ...row, name } : row)),
                        );
                        if (line.id === lines[0]?.id) {
                          setTitle((current) =>
                            !current.trim() || current === line.name ? name : current,
                          );
                        }
                      }}
                      className={field}
                    />
                  </label>
                  <label className="block">
                    <span className={label}>Quantity</span>
                    <input
                      aria-label="Quantity"
                      value={line.qty}
                      onChange={(e) =>
                        setLines((rows) => rows.map((row) => (row.id === line.id ? { ...row, qty: e.target.value } : row)))
                      }
                      className={field}
                    />
                  </label>
                  <label className="block">
                    <span className={label}>Unit price</span>
                    <input
                      aria-label="Unit price"
                      placeholder="£ 0.00"
                      value={line.price}
                      onChange={(e) =>
                        setLines((rows) => rows.map((row) => (row.id === line.id ? { ...row, price: e.target.value } : row)))
                      }
                      className={field}
                    />
                  </label>
                  <label className="block">
                    <span className={label}>Total</span>
                    <div className={`flex h-11 items-center justify-end rounded-lg border ${line} px-3 text-sm ${ink}`}>
                      {formatPounds(qty * price)}
                    </div>
                  </label>
                </div>
                <label className="block">
                  <span className={label}>Service summary</span>
                  <textarea
                    aria-label="Service summary"
                    value={line.description}
                    onChange={(e) =>
                      setLines((rows) =>
                        rows.map((row) => (row.id === line.id ? { ...row, description: e.target.value } : row)),
                      )
                    }
                    className={`min-h-[180px] w-full resize-y rounded-lg border ${line} px-3 py-2 text-[15px] leading-6 ${ink} outline-none focus:border-[#388623] focus:ring-2 focus:ring-[#388623]/20`}
                  />
                </label>
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
      </section>

      <section className={`overflow-hidden rounded-lg border ${line} bg-white`}>
        <button
          type="button"
          aria-expanded={termsOpen}
          aria-controls="quote-terms"
          onClick={() => setTermsOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <span className={`text-[17px] font-bold ${ink}`}>Terms and conditions</span>
          <ChevronDown
            size={18}
            aria-hidden
            className={`shrink-0 text-[#042b3c] transition-transform ${termsOpen ? "rotate-180" : ""}`}
          />
        </button>
        {termsOpen ? (
          <div
            id="quote-terms"
            className={`max-h-[420px] overflow-y-auto whitespace-pre-wrap border-t ${line} px-4 py-3 text-[14px] leading-6 ${ink}`}
          >
            {message}
          </div>
        ) : null}
      </section>

      <label className="block">
        <span className={label}>Internal notes</span>
        <textarea
          aria-label="Internal notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={`min-h-[72px] w-full resize-y rounded-lg border ${line} px-3 py-2 text-[15px] ${ink} outline-none focus:border-[#388623] focus:ring-2 focus:ring-[#388623]/20`}
        />
      </label>

      <section className={`overflow-hidden rounded-lg border ${line} bg-white`}>
        <button
          type="button"
          aria-expanded={inventoryOpen}
          aria-controls="quote-inventory"
          onClick={() => setInventoryOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <span className={`text-[17px] font-bold ${ink}`}>Inventory list</span>
          <ChevronDown
            size={18}
            aria-hidden
            className={`shrink-0 text-[#042b3c] transition-transform ${inventoryOpen ? "rotate-180" : ""}`}
          />
        </button>
        {inventoryOpen ? (
          <div id="quote-inventory" className={`space-y-3 border-t ${line} px-4 py-3`}>
            <textarea
              aria-label="Inventory list"
              value={inventory}
              onChange={(e) => setInventory(e.target.value)}
              className={`min-h-[140px] w-full resize-y rounded-lg border ${line} px-3 py-2 text-[15px] leading-6 ${ink} outline-none focus:border-[#388623] focus:ring-2 focus:ring-[#388623]/20`}
            />
            {files.length > 0 && linkedRequestId ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {files.map((file) => {
                  const href = `/api/requests/${linkedRequestId}/files/${file.id}`;
                  return (
                    <a
                      key={file.id}
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      title={file.file_name}
                    >
                      {file.mime_type.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={href}
                          alt={file.file_name}
                          className="aspect-square w-full rounded-lg border border-[#d5dde1] object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="grid aspect-square w-full place-items-center rounded-lg border border-[#d5dde1] bg-[#f7f8f8] text-2xl">
                          📄
                        </span>
                      )}
                    </a>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {error ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}

      <div className="flex justify-end">
        <div className="w-full max-w-[440px]">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between text-[#5d6f78]">
              <span>Subtotal</span>
              <span>{formatPounds(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-[#5d6f78]">
              <span>Discount</span>
              {discountOpen ? (
                <input
                  aria-label="Discount"
                  value={discount}
                  onChange={(event) => setDiscount(event.target.value)}
                  placeholder="£0.00"
                  className="h-9 w-28 rounded-lg border border-[#d5dde1] px-2 text-right text-[#042b3c] outline-none focus:border-[#388623]"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setDiscountOpen(true)}
                  className="font-semibold underline"
                  style={{ color: green }}
                >
                  Add Discount
                </button>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 text-[#5d6f78]">
              <span>Tax</span>
              {taxOpen ? (
                <input
                  aria-label="Tax"
                  value={tax}
                  onChange={(event) => setTax(event.target.value)}
                  placeholder="£0.00"
                  className="h-9 w-28 rounded-lg border border-[#d5dde1] px-2 text-right text-[#042b3c] outline-none focus:border-[#388623]"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setTaxOpen(true)}
                  className="font-semibold underline"
                  style={{ color: green }}
                >
                  Add Tax
                </button>
              )}
            </div>
            <div className={`flex items-center justify-between border-t ${line} pt-3 text-[15px] font-bold ${ink}`}>
              <span>Total</span>
              <span>{formatPounds(quoteTotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              {depositOpen ? (
                <span className="font-semibold underline" style={{ color: green }}>
                  Required Deposit
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setDepositOpen(true)}
                  className="font-semibold underline"
                  style={{ color: green }}
                >
                  Required Deposit
                </button>
              )}
              {depositOpen ? (
                <span className="flex items-center gap-2">
                  <input
                    aria-label="Required deposit"
                    value={deposit}
                    onChange={(event) => setDeposit(event.target.value)}
                    placeholder="£0.00"
                    className="h-9 w-28 rounded-lg border border-[#d5dde1] px-2 text-right text-[#042b3c] outline-none focus:border-[#388623]"
                  />
                  <button
                    type="button"
                    aria-label="Remove required deposit"
                    onClick={() => {
                      setDeposit("");
                      setDepositOpen(false);
                    }}
                    className="text-[#8aa0a8] hover:text-[#042b3c]"
                  >
                    <Trash2 size={16} />
                  </button>
                </span>
              ) : null}
            </div>
          </div>

          <div className={`mt-4 rounded-lg border ${line} px-4 py-3`}>
            <div className="flex items-center justify-between">
              <p className={`text-[15px] font-bold ${ink}`}>Client hub payments</p>
              <button type="button" aria-label="Edit payments" className="text-[#5d6f78]">
                <Pencil size={16} />
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between text-sm text-[#5d6f78]">
              <span>Quote payments</span>
              <button
                type="button"
                aria-pressed={paymentsOn}
                onClick={() => setPaymentsOn((on) => !on)}
                className="rounded-full bg-[#eef1f2] px-3 py-1 text-[12px] font-bold tracking-wide text-[#5d6f78]"
              >
                {paymentsOn ? "ON" : "OFF"}
              </button>
            </div>
          </div>

          {marginOpen ? (
            <div className="mt-4 rounded-lg bg-[#f3f1ea] px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <p className={`text-[15px] font-bold ${ink}`}>
                  View your estimated margin{" "}
                  <Pencil size={14} className="inline text-[#5d6f78]" aria-hidden />
                </p>
                <button
                  type="button"
                  aria-label="Dismiss estimated margin"
                  onClick={() => setMarginOpen(false)}
                  className="text-[#5d6f78]"
                >
                  <X size={16} />
                </button>
              </div>
              <p className="mt-1 text-sm leading-5 text-[#5d6f78]">
                Add your costs and markups to quickly view your estimated margin and set the right price on every quote.
              </p>
              <button
                type="button"
                className={`mt-3 h-8 rounded-lg border ${line} bg-white px-3 text-sm font-semibold ${ink}`}
              >
                Learn more
              </button>
            </div>
          ) : null}

          <div className="mt-4 flex justify-end gap-2">
            <Link
              href={quoteId ? `/cotacoes/${quoteId}` : "/cotacoes"}
              className={`inline-flex h-10 items-center rounded-lg border ${line} bg-white px-4 text-sm font-semibold ${ink}`}
            >
              Cancel
            </Link>
            <div ref={saveMenuRef} className="relative">
              <div
                className="inline-flex h-10 overflow-hidden rounded-lg text-sm font-semibold text-white"
                style={{ background: green }}
              >
                <button type="submit" disabled={pending} className="px-4 disabled:opacity-60">
                  {pending ? "Saving…" : "Save Quote"}
                </button>
                <button
                  type="button"
                  aria-label="Save and..."
                  aria-expanded={saveMenuOpen}
                  disabled={pending}
                  onClick={() => setSaveMenuOpen((open) => !open)}
                  className="grid w-9 place-items-center border-l border-white/30 disabled:opacity-60"
                >
                  <ChevronDown size={16} />
                </button>
              </div>
              {saveMenuOpen ? (
                <div
                  role="menu"
                  className="absolute bottom-12 right-0 z-20 w-56 rounded-xl border border-[#d5dde1] bg-white p-2 shadow-xl"
                >
                  <p className="px-3 py-2 text-sm text-[#5d6f78]">Save and...</p>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void submit("email")}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[15px] font-semibold text-[#1c3d46] hover:bg-[#f7f8f8]"
                  >
                    <Mail size={18} />
                    Send as Email
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void submit("job")}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[15px] font-semibold text-[#1c3d46] hover:bg-[#f7f8f8]"
                  >
                    <Hammer size={18} style={{ color: green }} />
                    Convert to Job
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </form>
    {emailDraft ? (
      <EmailQuoteDialog draft={emailDraft} onClose={() => setEmailDraft(null)} />
    ) : null}
    </>
  );
}

function Fact({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-0.5">
      <dt className="text-[#5d6f78]">{name}</dt>
      <dd className={`text-right font-semibold ${ink}`}>{value}</dd>
    </div>
  );
}

function StopCard({ title, stop }: { title: string; stop: QuoteStop }) {
  const rows: [string, string][] = [
    ["Address", stop.address],
    ["Floor", stop.floor],
    ["Lift", stop.lift],
    ["Parking", stop.parking],
    ["Bedrooms", stop.bedrooms],
  ];
  return (
    <section className={`rounded-lg border ${line} bg-white p-4 sm:p-5`}>
      <h2 className={`text-[17px] font-bold ${ink}`}>{title}</h2>
      <dl className="mt-3 text-sm">
        {rows.map(([name, value]) => (
          <Fact key={name} name={name} value={value} />
        ))}
      </dl>
    </section>
  );
}
