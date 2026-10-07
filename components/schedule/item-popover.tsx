"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { formatGBP } from "@/lib/format";
import { cn } from "@/lib/cn";
import { formatClock12, formatDaySlash } from "@/lib/schedule/dates";
import { KIND_META, type ScheduleItem, type ScheduleLine } from "@/lib/schedule/types";

function qtyLabel(quantity: number): string {
  if (Number.isInteger(quantity)) return String(quantity);
  return String(quantity).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function TeamChip({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "T";
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-[#f7f7f4] py-1 pl-1 pr-3">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-[#c4a035] text-xs font-extrabold text-white">
        {initial}
      </span>
      <span className="text-sm font-semibold text-ink">{name}</span>
    </span>
  );
}

function LineItems({ lines, total }: { lines: ScheduleLine[]; total: number }) {
  if (!lines.length && !total) return null;
  return (
    <section className="mt-4">
      <h3 className="text-[15px] font-extrabold text-ink">Line items</h3>
      <div className="mt-2 overflow-hidden rounded-xl border border-line">
        {(lines.length ? lines : [{ name: "Total", quantity: 1, total }]).map((line, index) => (
          <div
            key={`${line.name}-${index}`}
            className="flex items-start justify-between gap-3 border-b border-line px-3 py-2 last:border-b-0"
          >
            <p className="text-sm text-ink">
              {qtyLabel(line.quantity)}× {line.name}
            </p>
            <p className="shrink-0 text-sm font-semibold text-ink">{formatGBP(line.total)}</p>
          </div>
        ))}
        <div className="flex justify-end bg-[#fbfbf8] px-3 py-2">
          <p className="text-sm font-extrabold text-ink">Total {formatGBP(total)}</p>
        </div>
      </div>
    </section>
  );
}

export function ItemPopover({
  item,
  onClose,
  onComplete,
  onDuplicate,
}: {
  item: ScheduleItem;
  onClose: () => void;
  onComplete: (done: boolean) => void;
  onDuplicate?: () => void;
}) {
  const meta = KIND_META[item.kind];
  const startDay = item.unscheduled ? "Unscheduled" : item.date ? formatDaySlash(item.date) : "";
  const startClock = item.anytime || !item.start
    ? "Anytime"
    : [formatClock12(item.start), formatClock12(item.end)].filter(Boolean).join(" – ");

  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div
        className="absolute right-6 top-16 max-h-[calc(100dvh-5rem)] w-[min(100%-2rem,400px)] overflow-y-auto rounded-2xl border border-line bg-white p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-extrabold leading-snug text-ink">{item.title.replace(/^\d{1,2}(?::\d{2})?\s*(AM|PM)\s+/i, "")}</p>
            <p className="mt-0.5 text-sm text-ink-mute">{meta.label}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-cream" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-ink">
          <input
            type="checkbox"
            checked={item.status === "done"}
            onChange={(event) => onComplete(event.target.checked)}
            className="h-4 w-4 accent-[#3d8c45]"
          />
          Completed
        </label>

        <section className="mt-4">
          <h3 className="text-[15px] font-extrabold text-ink">Details</h3>
          {item.detailLabel ? (
            <Link href={item.href} className="mt-1 block text-sm font-semibold text-[#1f8a4c] hover:underline">
              {item.detailLabel}
            </Link>
          ) : null}
          {item.summary ? <p className="mt-1 text-sm leading-snug text-ink-soft">{item.summary}</p> : null}
        </section>

        {item.teamLabel ? (
          <section className="mt-4">
            <h3 className="text-[15px] font-extrabold text-ink">Team</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <TeamChip name={item.teamLabel} />
            </div>
          </section>
        ) : null}

        {item.address || item.deliveryAddress ? (
          <section className="mt-4">
            <h3 className="text-[15px] font-extrabold text-ink">Location</h3>
            {item.address ? (
              <div className="mt-1">
                <p className="text-sm font-semibold text-ink">Collection Address</p>
                <p className="text-sm leading-snug text-ink-soft">{item.address}</p>
              </div>
            ) : null}
            {item.deliveryAddress ? (
              <div className="mt-2">
                <p className="text-sm font-semibold text-ink">Delivery Address</p>
                <p className="text-sm leading-snug text-ink-soft">{item.deliveryAddress}</p>
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="mt-4">
          <h3 className="text-[15px] font-extrabold text-ink">Start</h3>
          <p className="mt-1 text-sm font-semibold text-ink">{startDay || "—"}</p>
          <p className="text-sm text-ink-soft">{item.unscheduled ? "" : startClock}</p>
        </section>

        <LineItems lines={item.lines} total={item.linesTotal} />

        <div className={cn("mt-5 grid gap-2", item.editHref ? "grid-cols-2" : "grid-cols-1")}>
          {item.editHref ? (
            <Link
              href={item.editHref}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-line text-sm font-bold text-ink hover:bg-cream"
            >
              Edit
            </Link>
          ) : null}
          <Link
            href={item.href}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-[#2ea043] text-sm font-bold text-white hover:opacity-90"
          >
            Details
          </Link>
        </div>
        {item.kind === "visit" && onDuplicate ? (
          <button
            type="button"
            onClick={onDuplicate}
            className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-xl text-sm font-semibold text-ink-soft hover:bg-cream"
          >
            Duplicate visit
          </button>
        ) : null}
      </div>
    </div>
  );
}
