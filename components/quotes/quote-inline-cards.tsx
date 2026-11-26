"use client";

import { openPicker } from "@/components/date-field";
import { TimeField, toTime24 } from "@/components/time-field";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Box, Calculator, CalendarDays, ChevronDown, Clock, FileText } from "lucide-react";
import { CardIcon, CARD_TITLE } from "@/components/card-icon";
import { Card } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatGBP, formatDateLondon, formatDateNumericLondon, penceToInput } from "@/lib/format";
import { DEPOSIT_NOTE } from "@/lib/funnel/deposit";
import { parseGbpToPence } from "@/lib/funnel/money";
import type { QuoteInput } from "@/lib/funnel/validation";
import { paymentMethodLabel } from "@/lib/payments/constants";
import type { QuoteDepositSummary } from "@/lib/payments/queries";
import { saveQuoteInPlace } from "@/lib/quotes/actions";
import { saveRequestInPlace } from "@/lib/requests/actions";
import {
  toAdminRequestInput,
  type RequestEditSnapshot,
} from "@/lib/requests/edit-snapshot";
import {
  Dl,
  Field,
  InlineEditCard,
  inventorySummary,
  InventoryPhotos,
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
type TotalsField = "discount" | "tax" | "total" | "deposit" | "outstanding";

/**
 * Quote totals with no pencil: a click on Discount, Tax, Total, Required deposit or
 * Outstanding deposit turns that value into a field; Enter or leaving the field saves,
 * Esc cancels. Total is reached through the discount (Total = Subtotal − Discount + Tax);
 * Outstanding deposit sets the required deposit to what was collected plus the new amount.
 */
export function QuoteTotalsCard({ snapshot, deposits }: { snapshot: QuoteEditSnapshot; deposits: QuoteDepositSummary }) {
  const router = useRouter();
  const [editing, setEditing] = useState<TotalsField | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const outstanding = Math.max(0, deposits.required - deposits.collected);

  const current: Record<TotalsField, number> = {
    discount: snapshot.discountPence,
    tax: snapshot.taxPence,
    total: snapshot.total,
    deposit: deposits.required,
    outstanding,
  };

  function start(field: TotalsField) {
    if (pending) return;
    setError("");
    setEditing(field);
    setDraft(penceToInput(current[field]));
  }

  async function commit() {
    if (!editing || pending) return;
    const field = editing;
    const pence = parseGbpToPence(draft);
    if (pence == null) {
      setError("Enter an amount in pounds, e.g. 250.00");
      return;
    }
    if (pence === current[field]) {
      setEditing(null);
      return;
    }
    const patch: { discount?: string; tax?: string; deposit?: string } = {};
    if (field === "discount") {
      if (pence > snapshot.subtotal) return setError(`Discount cannot be more than the subtotal (${formatGBP(snapshot.subtotal)}).`);
      patch.discount = penceToInput(pence);
    } else if (field === "tax") {
      patch.tax = penceToInput(pence);
    } else if (field === "total") {
      const discount = snapshot.subtotal + snapshot.taxPence - pence;
      if (discount < 0) {
        return setError(
          `Total cannot be above ${formatGBP(snapshot.subtotal + snapshot.taxPence)}. To charge more, raise the prices in Product / Service.`,
        );
      }
      if (discount > snapshot.subtotal) return setError(`Total cannot be below the tax (${formatGBP(snapshot.taxPence)}).`);
      patch.discount = penceToInput(discount);
    } else if (field === "deposit") {
      patch.deposit = penceToInput(pence);
    } else {
      patch.deposit = penceToInput(deposits.collected + pence);
    }
    setPending(true);
    setError("");
    const result = await saveQuoteInPlace(snapshot.id, toQuoteInput(snapshot, patch));
    setPending(false);
    if (!result.ok) {
      setError(result.message || Object.values(result.errors ?? {})[0] || "Could not save.");
      return;
    }
    setEditing(null);
    router.refresh();
  }

  function value(field: TotalsField, shown: string, strong = false) {
    if (editing === field) {
      return (
        <input
          autoFocus
          inputMode="decimal"
          aria-label={`New ${field}`}
          disabled={pending}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => e.target.select()}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void commit();
            } else if (e.key === "Escape") {
              setEditing(null);
              setError("");
            }
          }}
          className={cn(
            "h-8 w-32 rounded-lg border border-accent bg-white px-2 text-right text-ink outline-none ring-2 ring-accent/20",
            strong ? "text-base font-bold" : "text-sm font-semibold",
          )}
        />
      );
    }
    return <span className={cn("text-ink", strong ? "font-bold" : "font-semibold")}>{shown}</span>;
  }

  /** One clickable row: hover shows it can be edited; a click opens the field. */
  function row(field: TotalsField, label: ReactNode, shown: string, { strong = false } = {}) {
    const isEditing = editing === field;
    return (
      <div
        role={isEditing ? undefined : "button"}
        tabIndex={isEditing ? undefined : 0}
        title={isEditing ? undefined : "Click to edit"}
        onClick={() => !isEditing && start(field)}
        onKeyDown={(e) => {
          if (!isEditing && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            start(field);
          }
        }}
        className={cn(
          "flex min-h-10 items-center justify-between gap-4 rounded-lg px-3 py-1.5 outline-none",
          !isEditing && "cursor-pointer hover:bg-cream focus-visible:ring-2 focus-visible:ring-accent/30",
          strong ? "my-1.5 border-y border-line py-2.5 text-base font-bold text-ink" : "text-ink-soft",
        )}
      >
        <span>{label}</span>
        {value(field, shown, strong)}
      </div>
    );
  }

  return (
    <Card className="h-fit p-5">
      <div className="mb-3 flex items-center gap-3">
        <CardIcon icon={Calculator} tone="blue" />
        <h2 className={CARD_TITLE}>Quote totals</h2>
      </div>
      <div className="text-sm">
        <div
          className="flex min-h-10 items-center justify-between gap-4 px-3 py-1.5 text-ink-soft"
          title="Sum of the lines in Product / Service"
        >
          <span>Subtotal</span>
          <span className="font-semibold text-ink">{formatGBP(snapshot.subtotal)}</span>
        </div>
        {row("discount", "Discount", snapshot.discountPence ? `-${formatGBP(snapshot.discountPence)}` : formatGBP(0))}
        {row("tax", "Tax", formatGBP(snapshot.taxPence))}
        {row("total", "Total", formatGBP(snapshot.total), { strong: true })}
        {row(
          "deposit",
          deposits.required ? (
            <>
              Required deposit
              <span className="block text-xs text-ink-mute">{DEPOSIT_NOTE}</span>
            </>
          ) : (
            "Required deposit"
          ),
          formatGBP(deposits.required),
        )}
        {deposits.deposits.map((d) => (
          <div key={d.id} className="flex min-h-10 items-center justify-between gap-4 px-3 py-1.5 text-ink-soft">
            <Link href={`/pagamentos/${d.id}`} className="text-accent underline">
              Deposit collected · {formatDateNumericLondon(d.paid_on)} · {paymentMethodLabel(d.method)}
            </Link>
            <span className="font-semibold text-ink">-{formatGBP(d.amount)}</span>
          </div>
        ))}
        {row("outstanding", "Outstanding deposit", formatGBP(outstanding))}
      </div>
      {pending ? <p className="mt-2 px-3 text-sm text-ink-mute">Saving…</p> : null}
      {error ? <p className="mt-2 px-3 text-sm font-semibold text-rose-700">{error}</p> : null}
    </Card>
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

/**
 * Splits a description into blocks, keeping its line breaks: lines starting with
 * "-", "•" or "*" become a bulleted list, blank lines separate paragraphs.
 */
function descriptionBlocks(text: string) {
  const blocks: ({ kind: "p"; text: string } | { kind: "ul"; items: string[] })[] = [];
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = line.match(/^[-•*]\s*(.+)$/);
    const last = blocks[blocks.length - 1];
    if (bullet) {
      if (last?.kind === "ul") last.items.push(bullet[1]);
      else blocks.push({ kind: "ul", items: [bullet[1]] });
    } else {
      blocks.push({ kind: "p", text: line });
    }
  }
  return blocks;
}

/** A line's description, broken into lines; about four lines tall until clicked. */
function LineDescription({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const blocks = descriptionBlocks(text);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text]);

  const clickable = open || overflows;
  const toggle = () => clickable && setOpen((v) => !v);
  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      }}
      aria-expanded={clickable ? open : undefined}
      title={clickable ? (open ? "Show less" : "Show all") : undefined}
      className={cn(
        "mt-1 block w-full rounded text-left text-[13px] leading-5 text-ink-soft outline-none focus-visible:ring-2 focus-visible:ring-accent/30",
        clickable ? "cursor-pointer" : "cursor-default",
      )}
    >
      <span className="flex items-center gap-1 font-semibold text-ink">
        Description
        {clickable ? (
          <ChevronDown className={cn("h-3.5 w-3.5 text-ink-mute transition-transform", open && "rotate-180")} aria-hidden />
        ) : null}
      </span>
      <div
        ref={ref}
        className={cn("relative mt-0.5 space-y-1.5", open ? "" : "max-h-[5.25rem] overflow-hidden")}
      >
        {blocks.map((b, i) =>
          b.kind === "ul" ? (
            <ul key={i} className="list-disc space-y-0.5 pl-4">
              {b.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          ) : (
            <p key={i}>{b.text}</p>
          ),
        )}
        {!open && overflows ? (
          <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-white to-transparent" />
        ) : null}
      </div>
    </div>
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
                {line.description ? <LineDescription text={line.description} /> : null}
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
  files = [],
}: {
  snapshot: QuoteEditSnapshot;
  request: RequestEditSnapshot | null;
  /** Photos uploaded on the linked request, inherited by the quote. */
  files?: { id: string; file_name: string }[];
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
      summary={inventorySummary(snapshot.inventory, request ? files.length : 0)}
      onCancel={() => setInventory(snapshot.inventory)}
      onSave={async () => {
        const saved = await saveQuoteInPlace(snapshot.id, toQuoteInput(snapshot, { inventory }));
        if (!saved.ok) return saved;
        if (request) {
          return saveRequestInPlace(request.id, toAdminRequestInput({ ...request, inventory }));
        }
        return saved;
      }}
      view={
        <>
          <p className="whitespace-pre-wrap text-sm text-ink">{snapshot.inventory || "—"}</p>
          {request ? <InventoryPhotos requestId={request.id} files={files} /> : null}
        </>
      }
    >
      <textarea className={inlineArea} value={inventory} onChange={(e) => setInventory(e.target.value)} />
    </InlineEditCard>
  );
}
