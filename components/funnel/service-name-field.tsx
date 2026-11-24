"use client";

import { useEffect, useRef, useState } from "react";
import { formatGBP } from "@/lib/format";
import type { CatalogItem } from "@/components/quotes/quote-inline-cards";

/**
 * The Service box of a line item. Clicking it lists what's in Products & Services;
 * picking one fills the name, description and unit price. Typing filters the list,
 * and anything typed that isn't in the list stays as a custom line.
 */
export function ServiceNameField({
  value,
  onChange,
  catalog,
  onPick,
  className,
  ariaLabel = "Service",
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  catalog: CatalogItem[];
  onPick: (item: CatalogItem) => void;
  className: string;
  ariaLabel?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const esc = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const query = typed ? value.trim().toLowerCase() : "";
  const items = catalog.filter((c) => !query || c.name.toLowerCase().includes(query));
  const groups = [
    { label: "Services", rows: items.filter((c) => c.type === "service") },
    { label: "Products", rows: items.filter((c) => c.type === "product") },
  ].filter((g) => g.rows.length);

  return (
    <div ref={root} className="relative">
      <input
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-autocomplete="list"
        role="combobox"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onFocus={() => {
          setTyped(false);
          setOpen(true);
        }}
        onClick={() => setOpen(true)}
        onChange={(e) => {
          setTyped(true);
          setOpen(true);
          onChange(e.target.value);
        }}
        className={className}
      />
      {open && catalog.length ? (
        <div
          role="listbox"
          className="absolute left-0 right-0 z-40 mt-1 max-h-72 overflow-y-auto rounded-xl border border-[#d5dde1] bg-white p-1.5 shadow-xl"
        >
          {groups.map((g) => (
            <div key={g.label}>
              <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-[#8aa0a8]">{g.label}</p>
              {g.rows.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={item.name === value}
                  onClick={() => {
                    onPick(item);
                    setOpen(false);
                  }}
                  className="flex w-full cursor-pointer items-start justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-[#f2f8f0]"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold text-[#042b3c]">{item.name}</span>
                    {item.description ? (
                      <span className="line-clamp-1 text-xs text-[#5d6f78]">{item.description}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-[#5d6f78]">{formatGBP(Math.round(Number(item.price || "0") * 100))}</span>
                </button>
              ))}
            </div>
          ))}
          {groups.length === 0 ? (
            <p className="px-3 py-2 text-sm text-[#5d6f78]">Nothing matches. Keep typing for a custom line.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
