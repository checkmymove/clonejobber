"use client";

import { openPicker } from "@/components/date-field";
import { TimeField, toTime24 } from "@/components/time-field";
import { useEffect, useState } from "react";
import { Box, Calculator, CalendarDays, Clock, FileText } from "lucide-react";
import { CardIcon } from "@/components/card-icon";
import { cn } from "@/lib/cn";
import { formatGBP, formatDateLondon, padMoney } from "@/lib/format";
import type { QuoteInput } from "@/lib/funnel/validation";
import { saveQuoteInPlace } from "@/lib/quotes/actions";
import { saveRequestInPlace } from "@/lib/requests/actions";
import {
  toAdminRequestInput,
  type RequestEditSnapshot,
} from "@/lib/requests/edit-snapshot";
import type { TotalRow } from "@/components/funnel/document-cards";
import {
  Dl,
  Field,
  InlineEditCard,
  inventorySummary,
  LineFields,
  LocationFields,
  newDraftLine,
  YesNoSelect,
  inlineArea,
  inlineField,
  type DraftLine,
  type LocationDraft,
} from "@/components/inline-edit-card";

export type QuoteEditSnapshot = {
  id: string;
  clientId: string;
  requestId?: string;
  title: string;
  message: string;
  notes: string;
  validUntil: string;
  moveTime: string;
  inventory: string;
  discount: string;
  tax: string;
  deposit: string;
  recipient: string;
  source: string;
  subtotal: number;
  total: number;
  depositPence: number;
  discountPence: number;
  taxPence: number;
  lines: DraftLine[];
};

function toQuoteInput(
  snapshot: QuoteEditSnapshot,
  patch: Partial<Omit<QuoteInput, "lines">> & { lines?: DraftLine[] } = {},
): QuoteInput {
  return {
    clientId: snapshot.clientId,
    requestId: snapshot.requestId,
    title: patch.title ?? snapshot.title,
    message: patch.message ?? snapshot.message,
    notes: patch.notes ?? snapshot.notes,
    validUntil: patch.validUntil ?? snapshot.validUntil,
    moveTime: patch.moveTime ?? snapshot.moveTime,
    inventory: patch.inventory ?? snapshot.inventory,
    discount: patch.discount ?? snapshot.discount,
    tax: patch.tax ?? snapshot.tax,
    deposit: patch.deposit ?? snapshot.deposit,
    lines: (patch.lines ?? snapshot.lines).map((line) => ({
      name: line.name,
      description: line.description,
      qty: line.qty,
      unitPrice: line.price,
    })),
  };
}

/** "09:00" → "09:00 AM" as the quote shows it; free text stays as typed. */
function clockLabel(raw: string): string {
  const match = toTime24(raw).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return raw.trim() || "—";
  const hour = Number(match[1]);
  return `${String(hour % 12 === 0 ? 12 : hour % 12).padStart(2, "0")}:${match[2]} ${hour >= 12 ? "PM" : "AM"}`;
}

/** Moving date and time of the quote: two boxes under Collection and Delivery. */
export function QuoteMovingCard({ snapshot }: { snapshot: QuoteEditSnapshot }) {
  const [validUntil, setValidUntil] = useState(snapshot.validUntil);
  const [moveTime, setMoveTime] = useState(toTime24(snapshot.moveTime));
  useEffect(() => {
    setValidUntil(snapshot.validUntil);
    setMoveTime(toTime24(snapshot.moveTime));
  }, [snapshot]);

  return (
    <>
      <InlineEditCard
        layout="stat"
        title="Moving date"
        icon={<CardIcon icon={CalendarDays} tone="blue" boxed />}
        onCancel={() => setValidUntil(snapshot.validUntil)}
        onSave={() => saveQuoteInPlace(snapshot.id, toQuoteInput(snapshot, { validUntil }))}
        view={snapshot.validUntil ? `${formatDateLondon(snapshot.validUntil)} ${snapshot.validUntil.slice(0, 4)}` : "—"}
      >
        <Field label="Moving date">
          <input type="date" onClick={openPicker} className={inlineField} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </Field>
      </InlineEditCard>
      <InlineEditCard
        layout="stat"
        title="Moving time"
        icon={<CardIcon icon={Clock} tone="violet" boxed />}
        onCancel={() => setMoveTime(toTime24(snapshot.moveTime))}
        onSave={() => saveQuoteInPlace(snapshot.id, toQuoteInput(snapshot, { moveTime }))}
        view={clockLabel(snapshot.moveTime)}
      >
        <Field label="Moving time">
          <TimeField ariaLabel="Moving time" className={inlineField} value={moveTime} onChange={setMoveTime} />
        </Field>
      </InlineEditCard>
    </>
  );
}

/** Terms and conditions, collapsed behind its arrow like the Inventory list. */
export function QuoteTermsCard({ snapshot }: { snapshot: QuoteEditSnapshot }) {
  const [message, setMessage] = useState(snapshot.message);
  useEffect(() => setMessage(snapshot.message), [snapshot.message]);
  return (
    <InlineEditCard
      className="h-fit p-5"
      title="Terms and conditions"
      fitContent
      icon={<CardIcon icon={FileText} tone="blue" />}
      collapsible
      summary={snapshot.message ? `${snapshot.message.split(/\s+/).length} words` : "None"}
      onCancel={() => setMessage(snapshot.message)}
      onSave={() => saveQuoteInPlace(snapshot.id, toQuoteInput(snapshot, { message }))}
      view={<p className="max-h-96 overflow-y-auto whitespace-pre-wrap text-sm text-ink">{snapshot.message || "—"}</p>}
    >
      <textarea className={inlineArea} value={message} onChange={(e) => setMessage(e.target.value)} />
    </InlineEditCard>
  );
}

/** Totals with the pencil for discount, tax and the required deposit. */
export function QuoteTotalsCard({ snapshot, totals }: { snapshot: QuoteEditSnapshot; totals: TotalRow[] }) {
  const [discount, setDiscount] = useState(snapshot.discount);
  const [tax, setTax] = useState(snapshot.tax);
  const [deposit, setDeposit] = useState(snapshot.deposit);
  useEffect(() => {
    setDiscount(snapshot.discount);
    setTax(snapshot.tax);
    setDeposit(snapshot.deposit);
  }, [snapshot]);

  return (
    <InlineEditCard
      className="h-fit p-5"
      title="Quote totals"
      fitContent
      icon={<CardIcon icon={Calculator} tone="blue" />}
      onCancel={() => {
        setDiscount(snapshot.discount);
        setTax(snapshot.tax);
        setDeposit(snapshot.deposit);
      }}
      onSave={() => saveQuoteInPlace(snapshot.id, toQuoteInput(snapshot, { discount, tax, deposit }))}
      view={
        <div className="text-sm">
          {totals.map((row, index) =>
            row.strong ? (
              <div key={index} className="my-1.5 flex justify-between gap-4 rounded-lg bg-emerald-50 px-3 py-2.5 text-base font-bold text-ink">
                <span>{row.label}</span>
                <span>{row.value}</span>
              </div>
            ) : (
              <div key={index} className={cn("flex justify-between gap-4 px-3 py-1.5", row.muted ? "text-ink-soft" : "text-ink")}>
                <span>{row.label}</span>
                <span className="font-semibold text-ink">{row.value}</span>
              </div>
            ),
          )}
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Discount">
          <input className={inlineField} value={discount} onChange={(e) => setDiscount(e.target.value)} onBlur={(e) => setDiscount(padMoney(e.target.value))} />
        </Field>
        <Field label="Tax">
          <input className={inlineField} value={tax} onChange={(e) => setTax(e.target.value)} onBlur={(e) => setTax(padMoney(e.target.value))} />
        </Field>
        <Field label="Deposit">
          <input className={inlineField} value={deposit} onChange={(e) => setDeposit(e.target.value)} onBlur={(e) => setDeposit(padMoney(e.target.value))} />
        </Field>
      </div>
    </InlineEditCard>
  );
}

/** A Products & Services catalog entry, for the Add service / Add product buttons. */
export type CatalogItem = { id: string; type: "service" | "product"; name: string; description: string; price: string };

export function QuoteServicesCard({ snapshot, catalog = [] }: { snapshot: QuoteEditSnapshot; catalog?: CatalogItem[] }) {
  const [lines, setLines] = useState(snapshot.lines);
  useEffect(() => setLines(snapshot.lines), [snapshot.lines]);

  return (
    <InlineEditCard
      className="h-fit p-5 xl:col-span-2"
      title="Product / Service"
      icon={<CardIcon icon={Box} tone="blue" boxed />}
      fitContent
      onCancel={() => setLines(snapshot.lines)}
      onSave={() => saveQuoteInPlace(snapshot.id, toQuoteInput(snapshot, { lines }))}
      view={<ServicesView lines={snapshot.lines} />}
      footer={(start) => (
        <AddLineItemButton
          onClick={() => {
            setLines([...snapshot.lines, newDraftLine()]);
            start();
          }}
        />
      )}
    >
      <LineFields lines={lines} onChange={setLines} catalog={catalog} />
    </InlineEditCard>
  );
}

/** Green "Add line item" under the Product / Service lines, as on New quote. */
export function AddLineItemButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-4 h-9 rounded-lg bg-accent px-3 text-sm font-semibold text-white hover:opacity-90"
    >
      Add line item
    </button>
  );
}

/** A line's summary, three lines until clicked. */
function LineSummary({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      aria-expanded={open}
      title={open ? "Show less" : "Show all"}
      className={cn("mt-0.5 block text-left text-[13px] text-ink-soft", open ? "" : "line-clamp-3")}
    >
      <span className="font-semibold text-ink">Summary:</span> {text}
    </button>
  );
}

function ServicesView({ lines }: { lines: QuoteEditSnapshot["lines"] }) {
  if (lines.length === 0) return <p className="text-sm text-ink-mute">No services yet. Add one from the catalog.</p>;
  const pence = (value: string) => Math.round(Number(value || "0") * 100) || 0;
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <table className="fit-table w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line bg-cream/60 text-xs font-medium text-ink-soft">
            <th className="px-4 py-2.5 font-medium">Service</th>
            <th className="w-24 px-3 py-2.5 text-center font-medium">Quantity</th>
            <th className="w-28 px-3 py-2.5 text-right font-medium">Unit price</th>
            <th className="w-28 px-4 py-2.5 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id} className="border-b border-line align-top last:border-0">
              <td className="px-4 py-3">
                <p className="font-bold text-ink">{line.name}</p>
                {line.description ? <LineSummary text={line.description} /> : null}
              </td>
              <td data-label="Qty" className="px-3 py-3 text-center text-ink">
                {line.qty}
              </td>
              <td data-label="Unit price" className="px-3 py-3 text-right text-ink">
                {formatGBP(pence(line.price))}
              </td>
              <td className="px-4 py-3 text-right font-bold text-ink">
                {formatGBP(Math.round(Number(line.qty || "0") * pence(line.price)))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function QuoteInventoryCard({
  snapshot,
  request,
}: {
  snapshot: QuoteEditSnapshot;
  request: RequestEditSnapshot | null;
}) {
  const [inventory, setInventory] = useState(snapshot.inventory);
  useEffect(() => setInventory(snapshot.inventory), [snapshot.inventory]);

  return (
    <InlineEditCard
      className="h-fit p-5"
      title="Inventory list"
      fitContent
      icon={<CardIcon icon={Box} tone="blue" />}
      collapsible
      summary={inventorySummary(snapshot.inventory)}
      onCancel={() => setInventory(snapshot.inventory)}
      onSave={async () => {
        const saved = await saveQuoteInPlace(snapshot.id, toQuoteInput(snapshot, { inventory }));
        if (!saved.ok) return saved;
        if (request) {
          return saveRequestInPlace(request.id, toAdminRequestInput({ ...request, inventory }));
        }
        return saved;
      }}
      view={<p className="whitespace-pre-wrap text-sm text-ink">{snapshot.inventory || "—"}</p>}
    >
      <textarea className={inlineArea} value={inventory} onChange={(e) => setInventory(e.target.value)} />
    </InlineEditCard>
  );
}
