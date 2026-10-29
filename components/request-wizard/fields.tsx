"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Label text with the REQUIRED tag flowing right after it, even when it wraps. */
function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <span className="mb-1.5 block text-sm font-semibold text-ink">
      {label}
      {required ? (
        <span className="ml-2 whitespace-nowrap text-[11px] font-bold uppercase tracking-wide text-ink-mute">
          Required
        </span>
      ) : null}
    </span>
  );
}

export function Field({
  label,
  required,
  error,
  hint,
  group,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  /** Wraps buttons, not a single input: a <label> would click the first button. */
  group?: boolean;
  children: ReactNode;
}) {
  const Wrapper = group ? "div" : "label";
  return (
    <Wrapper className="block">
      <FieldLabel label={label} required={required} />
      {children}
      {hint ? <span className="mt-1 block text-xs text-ink-soft">{hint}</span> : null}
      {error ? (
        <span className="mt-1 block text-xs font-semibold text-rose-700">
          {error}
        </span>
      ) : null}
    </Wrapper>
  );
}

export function OptionGrid({
  options,
  value,
  onChange,
  invalid,
}: {
  options: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
  invalid?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      className={cn(
        "grid grid-cols-2 gap-2 rounded-xl border p-1 sm:grid-cols-3",
        invalid ? "border-rose-400" : "border-line bg-stone-50",
      )}
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "min-h-10 rounded-lg px-2 py-1.5 text-sm font-bold transition",
            value === o.id
              ? "bg-ink text-white shadow"
              : "bg-white text-ink-soft hover:bg-cream",
          )}
        >
          {o.name}
        </button>
      ))}
    </div>
  );
}

export const inputCls = (invalid?: unknown) =>
  cn(
    "h-11 w-full rounded-xl border bg-white px-3 text-[15px] text-ink outline-none transition focus:ring-2",
    invalid
      ? "border-rose-400 focus:border-rose-500 focus:ring-rose-100"
      : "border-line focus:border-accent focus:ring-emerald-100",
  );

export function YesNo({
  value,
  onChange,
  error,
}: {
  value: boolean | null;
  onChange: (v: boolean) => void;
  error?: string;
}) {
  return (
    <div>
      <div
        role="group"
        className={cn(
          "grid grid-cols-2 gap-2 rounded-xl border p-1",
          error ? "border-rose-400" : "border-line bg-stone-50",
        )}
      >
        {[
          { v: true, label: "Yes" },
          { v: false, label: "No" },
        ].map((o) => (
          <button
            key={o.label}
            type="button"
            aria-pressed={value === o.v}
            onClick={() => onChange(o.v)}
            className={cn(
              "h-10 rounded-lg text-sm font-bold transition",
              value === o.v
                ? "bg-ink text-white shadow"
                : "text-ink-soft hover:bg-white",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {error ? (
        <p className="mt-1 text-xs font-semibold text-rose-700">{error}</p>
      ) : null}
    </div>
  );
}

export function MultiSelect({
  label,
  required,
  options,
  selected,
  onChange,
  placeholder,
  error,
  accent,
}: {
  label: string;
  required?: boolean;
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  placeholder: string;
  error?: string;
  accent?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open ]);

  const names = options
    .filter((o) => selected.includes(o.id))
    .map((o) => o.label);

  const toggle = (id: string) =>
    onChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id],
    );

  return (
    <div ref={ref} className="relative">
      <FieldLabel label={label} required={required} />
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2 text-left text-[15px] outline-none transition",
          error ? "border-rose-400" : "border-line",
          names.length === 0 && "text-ink-mute",
        )}
      >
        <span className="truncate">
          {names.length > 0 ? names.join(", ") : placeholder}
        </span>
        <span aria-hidden className="shrink-0 text-ink-mute">
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-line bg-white p-1.5 shadow-xl">
          {options.map((o) => (
            <label
              key={o.id}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-sm hover:bg-cream"
            >
              <input
                type="checkbox"
                checked={selected.includes(o.id)}
                onChange={() => toggle(o.id)}
                className="h-4 w-4 accent-emerald-700"
              />
              <span className="text-ink">{o.label}</span>
            </label>
          ))}
        </div>
      ) : null}
      {selected.length > 0 ? (
        <span className="mt-1 block text-xs text-ink-soft">
          {selected.length} selected
        </span>
      ) : null}
      {error ? (
        <span className="mt-1 block text-xs font-semibold text-rose-700">
          {error}
        </span>
      ) : null}
      {accent ? <span className="hidden">{accent}</span> : null}
    </div>
  );
}

export function ProgressBar({
  total,
  current,
  color,
}: {
  total: number;
  current: number;
  color: string;
}) {
  return (
    <div
      className="flex gap-1.5"
      role="progressbar"
      aria-valuenow={current + 1}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label={`Step ${current + 1} of ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="h-2 flex-1 rounded-full transition-colors"
          style={{ background: i <= current ? color : "#e5e1d6" }}
        />
      ))}
    </div>
  );
}
