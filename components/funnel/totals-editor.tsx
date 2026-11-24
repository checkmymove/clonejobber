"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatPounds, padMoney } from "@/lib/format";
import { DEPOSIT_NOTE } from "@/lib/funnel/deposit";

const green = "#388623";
const input =
  "h-9 w-28 rounded-lg border border-[#d5dde1] bg-white px-2 text-right text-[#042b3c] outline-none focus:border-[#388623]";

function pounds(raw: string): number {
  const n = Number(raw.replace(/[£\s%]/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function Row({
  label,
  open,
  onToggle,
  addLabel,
  closedValue,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  addLabel: string;
  closedValue: string | null;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-[#5d6f78]">
      {/* The label opens the field and closes it again; the hand cursor says it's clickable. */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        title={open ? `Hide ${label.toLowerCase()}` : `Add ${label.toLowerCase()}`}
        className="cursor-pointer underline decoration-dotted underline-offset-4 hover:text-[#042b3c]"
      >
        {label}
      </button>
      {open ? (
        <span className="flex items-center gap-2">{children}</span>
      ) : closedValue ? (
        <button type="button" onClick={onToggle} className="cursor-pointer font-semibold text-[#042b3c]">
          {closedValue}
        </button>
      ) : (
        <button type="button" onClick={onToggle} className="cursor-pointer font-semibold underline" style={{ color: green }}>
          {addLabel}
        </button>
      )}
    </div>
  );
}

function Clear({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Clear ${label.toLowerCase()}`}
      title={`Clear ${label.toLowerCase()}`}
      onClick={onClick}
      className="grid h-8 w-7 cursor-pointer place-items-center rounded text-[#8aa0a8] hover:bg-white hover:text-[#042b3c]"
    >
      <Trash2 size={16} />
    </button>
  );
}

/**
 * Subtotal / Discount / Tax / Total / Required deposit of the quote, job and invoice
 * forms. Discount, tax and deposit open and close from their label; the bin only clears
 * the value. Discount can be typed in £ or %: the % is turned into pounds, which is what
 * the document stores.
 */
export function TotalsEditor({
  subtotal,
  discount,
  onDiscount,
  tax,
  onTax,
  deposit,
  onDeposit,
  depositFixed,
  taxLabel = "Tax",
  totalLabel = "Total",
  children,
  className,
}: {
  /** In pounds. */
  subtotal: number;
  discount: string;
  onDiscount: (value: string) => void;
  tax: string;
  onTax: (value: string) => void;
  /** Editable required deposit (quote). Leave out to hide the row. */
  deposit?: string;
  onDeposit?: (value: string) => void;
  /** Required deposit set earlier in the funnel, shown read-only (job), in pounds. */
  depositFixed?: number;
  taxLabel?: string;
  totalLabel?: string;
  /** Extra rows under the total (payments, balance). */
  children?: ReactNode;
  className?: string;
}) {
  const [discountOpen, setDiscountOpen] = useState(pounds(discount) > 0);
  const [taxOpen, setTaxOpen] = useState(pounds(tax) > 0);
  const [depositOpen, setDepositOpen] = useState(pounds(deposit ?? "") > 0);
  const [mode, setMode] = useState<"£" | "%">("£");
  const [percent, setPercent] = useState("");

  // In % mode the stored discount follows the subtotal.
  useEffect(() => {
    if (mode !== "%") return;
    const pct = Math.min(100, pounds(percent));
    const amount = pct ? (subtotal * pct) / 100 : 0;
    const next = amount ? amount.toFixed(2) : "";
    if (next !== discount) onDiscount(next);
  }, [mode, percent, subtotal, discount, onDiscount]);

  const discountAmount = Math.min(subtotal, pounds(discount));
  const total = Math.max(0, subtotal - discountAmount + pounds(tax));
  const depositAmount = deposit !== undefined ? pounds(deposit) : depositFixed ?? 0;

  return (
    <div className={cn("w-full max-w-[440px] rounded-xl border border-[#d5dde1] bg-[#f9fafa] p-4", className)}>
      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between text-[#5d6f78]">
          <span>Subtotal</span>
          <span>{formatPounds(subtotal)}</span>
        </div>

        <Row
          label="Discount"
          addLabel="Add Discount"
          open={discountOpen}
          onToggle={() => setDiscountOpen((v) => !v)}
          closedValue={discountAmount ? `-${formatPounds(discountAmount)}` : null}
        >
          <span className="inline-flex overflow-hidden rounded-lg border border-[#d5dde1] bg-white" role="group" aria-label="Discount type">
            {(["£", "%"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                title={m === "%" ? "Percent of the subtotal" : "Pounds"}
                onClick={() => {
                  if (m === mode) return;
                  if (m === "%") {
                    setPercent(subtotal && discountAmount ? String(Math.round((discountAmount / subtotal) * 1000) / 10) : "");
                  }
                  setMode(m);
                }}
                className={cn(
                  "h-9 w-8 cursor-pointer text-sm font-bold",
                  mode === m ? "text-white" : "text-[#5d6f78] hover:bg-[#f4f6f7]",
                )}
                style={mode === m ? { background: green } : undefined}
              >
                {m}
              </button>
            ))}
          </span>
          {mode === "%" ? (
            <input
              aria-label="Discount percent"
              inputMode="decimal"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              placeholder="0 %"
              className={cn(input, "w-20")}
            />
          ) : (
            <input
              aria-label="Discount"
              inputMode="decimal"
              value={discount}
              onChange={(e) => onDiscount(e.target.value)}
              onBlur={(e) => onDiscount(padMoney(e.target.value))}
              placeholder="£0.00"
              className={input}
            />
          )}
          <Clear
            label="Discount"
            onClick={() => {
              setPercent("");
              onDiscount("");
            }}
          />
        </Row>
        {mode === "%" && discountAmount ? (
          <p className="-mt-2 text-right text-xs text-[#8aa0a8]">-{formatPounds(discountAmount)}</p>
        ) : null}

        <Row
          label={taxLabel}
          addLabel={`Add ${taxLabel}`}
          open={taxOpen}
          onToggle={() => setTaxOpen((v) => !v)}
          closedValue={pounds(tax) ? formatPounds(pounds(tax)) : null}
        >
          <input
            aria-label="Tax"
            inputMode="decimal"
            value={tax}
            onChange={(e) => onTax(e.target.value)}
            onBlur={(e) => onTax(padMoney(e.target.value))}
            placeholder="£0.00"
            className={input}
          />
          <Clear label={taxLabel} onClick={() => onTax("")} />
        </Row>

        <div className="flex items-center justify-between border-t border-[#d5dde1] pt-3 text-[15px] font-bold text-[#042b3c]">
          <span>{totalLabel}</span>
          <span>{formatPounds(total)}</span>
        </div>

        {deposit !== undefined && onDeposit ? (
          <>
            <Row
              label="Required Deposit"
              addLabel="Add deposit"
              open={depositOpen}
              onToggle={() => setDepositOpen((v) => !v)}
              closedValue={depositAmount ? formatPounds(depositAmount) : null}
            >
              <input
                aria-label="Required deposit"
                inputMode="decimal"
                value={deposit}
                onChange={(e) => onDeposit(e.target.value)}
                onBlur={(e) => onDeposit(padMoney(e.target.value))}
                placeholder="£0.00"
                className={input}
              />
              <Clear label="Required deposit" onClick={() => onDeposit("")} />
            </Row>
            {depositAmount ? <p className="-mt-1 text-right text-xs text-[#5d6f78]">{DEPOSIT_NOTE}</p> : null}
          </>
        ) : depositFixed ? (
          <>
            <div className="flex items-center justify-between text-[#5d6f78]">
              <span>Required deposit</span>
              <span className="font-semibold text-[#042b3c]">{formatPounds(depositFixed)}</span>
            </div>
            <p className="-mt-1 text-right text-xs text-[#5d6f78]">{DEPOSIT_NOTE}</p>
          </>
        ) : null}

        {children}
      </div>
    </div>
  );
}
