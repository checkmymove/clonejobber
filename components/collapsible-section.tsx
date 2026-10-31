"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * A full-width row that opens to show the cards inside it (job page: Customer &
 * Summary, Addresses, Services). Each viewer's open/closed choice is remembered.
 */
export function CollapsibleSection({
  id,
  title,
  icon,
  summary,
  defaultOpen = false,
  children,
}: {
  id: string;
  title: string;
  icon: ReactNode;
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const key = `section:${id}`;
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) setOpen(saved === "1");
    } catch {
      // Storage unavailable: keep the default.
    }
  }, [key]);
  const toggle = () =>
    setOpen((value) => {
      try {
        localStorage.setItem(key, value ? "0" : "1");
      } catch {
        // Not remembered this time.
      }
      return !value;
    });

  return (
    <section className="rounded-2xl border border-line bg-card shadow-[0_1px_3px_rgba(15,23,42,0.05)] xl:col-span-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={toggle}
        className="flex w-full min-w-0 items-center gap-4 rounded-2xl px-5 py-4 text-left hover:bg-cream/40"
      >
        {icon}
        <h2 className="shrink-0 text-[15px] font-bold text-ink">{title}</h2>
        {summary ? <span className="hidden min-w-0 truncate text-sm text-ink-soft sm:block">{summary}</span> : null}
        <ChevronDown
          size={20}
          aria-hidden
          className={`ml-auto shrink-0 text-ink-soft transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div className="grid grid-cols-1 items-start gap-4 rounded-b-2xl border-t border-line bg-canvas/70 p-4 xl:grid-cols-2">
          {children}
        </div>
      ) : null}
    </section>
  );
}
