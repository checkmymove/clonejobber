"use client";

import { openPicker } from "@/components/date-field";
import { TimeField, toTime24 } from "@/components/time-field";
import { useEffect, useState } from "react";
import { formatGBP, formatDateLondon, padMoney } from "@/lib/format";
import type { QuoteInput } from "@/lib/funnel/validation";
import { saveQuoteInPlace } from "@/lib/quotes/actions";
import { saveRequestInPlace } from "@/lib/requests/actions";
import {
  toAdminRequestInput,
  type RequestEditSnapshot,
} from "@/lib/requests/edit-snapshot";
import { TotalsList, type TotalRow } from "@/components/funnel/document-cards";
import {
  Dl,
  Field,
  InlineEditCard,
  inventorySummary,
  LineFields,
  LocationFields,
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

/** Moving date and time of the quote, in its own full-width box under Collection and Delivery. */
export function QuoteMovingCard({ snapshot }: { snapshot: QuoteEditSnapshot }) {
  const [validUntil, setValidUntil] = useState(snapshot.validUntil);
  const [moveTime, setMoveTime] = useState(toTime24(snapshot.moveTime));
  useEffect(() => {
    setValidUntil(snapshot.validUntil);
    setMoveTime(toTime24(snapshot.moveTime));
  }, [snapshot]);

  return (
    <InlineEditCard
      className="h-fit p-5 xl:col-span-2"
      title="Moving date & time"
      onCancel={() => {
        setValidUntil(snapshot.validUntil);
        setMoveTime(toTime24(snapshot.moveTime));
      }}
      onSave={() => saveQuoteInPlace(snapshot.id, toQuoteInput(snapshot, { validUntil, moveTime }))}
      view={
        <Dl
          rows={[
            ["Moving date", snapshot.validUntil ? formatDateLondon(snapshot.validUntil) : "—"],
            ["Moving time", snapshot.moveTime.trim() || "—"],
          ]}
        />
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Moving date">
          <input type="date" onClick={openPicker} className={inlineField} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </Field>
        <Field label="Moving time">
          <TimeField ariaLabel="Moving time" className={inlineField} value={moveTime} onChange={setMoveTime} />
        </Field>
      </div>
    </InlineEditCard>
  );
}

/** Terms and conditions, collapsed behind its arrow like the Inventory list. */
export function QuoteTermsCard({ snapshot }: { snapshot: QuoteEditSnapshot }) {
  const [message, setMessage] = useState(snapshot.message);
  useEffect(() => setMessage(snapshot.message), [snapshot.message]);
  return (
    <InlineEditCard
      className="h-fit p-5 xl:col-span-2"
      title="Terms and conditions"
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
      className="h-fit p-5 xl:col-span-2"
      title="Totals"
      onCancel={() => {
        setDiscount(snapshot.discount);
        setTax(snapshot.tax);
        setDeposit(snapshot.deposit);
      }}
      onSave={() => saveQuoteInPlace(snapshot.id, toQuoteInput(snapshot, { discount, tax, deposit }))}
      view={<TotalsList totals={totals} className="ml-auto max-w-sm" />}
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

export function QuoteServicesCard({ snapshot }: { snapshot: QuoteEditSnapshot }) {
  const [lines, setLines] = useState(snapshot.lines);
  useEffect(() => setLines(snapshot.lines), [snapshot.lines]);

  return (
    <InlineEditCard
      className="h-fit p-5 xl:col-span-2"
      title="Services"
      collapsible
      summary={`${snapshot.lines.length} item${snapshot.lines.length === 1 ? "" : "s"} · ${formatGBP(snapshot.subtotal)}`}
      onCancel={() => setLines(snapshot.lines)}
      onSave={() => saveQuoteInPlace(snapshot.id, toQuoteInput(snapshot, { lines }))}
      view={<ServicesView lines={snapshot.lines} />}
    >
      <LineFields lines={lines} onChange={setLines} />
    </InlineEditCard>
  );
}

function ServicesView({ lines }: { lines: QuoteEditSnapshot["lines"] }) {
  return (
    <div className="space-y-2 text-sm">
      {lines.map((line) => (
        <div key={line.id} className="flex justify-between gap-3 border-b border-line py-2 last:border-0">
          <div>
            <p className="font-bold text-ink">{line.name}</p>
            {line.description ? <p className="text-ink-soft">{line.description}</p> : null}
            <p className="text-xs text-ink-mute">
              {line.qty} × {formatGBP(Math.round(Number(line.price || "0") * 100) || 0)}
            </p>
          </div>
        </div>
      ))}
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
      className="h-fit p-5 xl:col-span-2"
      title="Inventory list"
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
