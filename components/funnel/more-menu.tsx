"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";

export const moreItemClass =
  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[15px] font-semibold text-[#1c3d46] hover:bg-[#f7f8f8] disabled:cursor-not-allowed disabled:opacity-40";

export type MoreMenuItem =
  | {
      kind: "link";
      label: string;
      icon: ReactNode;
      href: string;
      hidden?: boolean;
      /** Plain <a> opened in a new tab (PDFs, client previews). */
      file?: boolean;
    }
  | {
      kind: "action";
      label: string;
      icon: ReactNode;
      run: () => Promise<{ ok: boolean; message?: string } | void>;
      /** Asked with window.confirm before running. */
      confirm?: string;
      danger?: boolean;
      hidden?: boolean;
    }
  | { kind: "separator"; hidden?: boolean };

/** Jobber-style "More" dropdown used on job, invoice and payment pages. */
export function MoreMenu({ items, label = "More" }: { items: MoreMenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (rootRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const visible = items.filter((item) => !item.hidden);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-card px-3 text-sm font-bold text-ink hover:bg-cream"
      >
        <MoreHorizontal size={16} />
        {label}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute left-0 z-30 mt-2 w-64 rounded-xl border border-[#d5dde1] bg-white p-2 shadow-xl sm:left-auto sm:right-0"
        >
          {visible.map((item, index) => {
            if (item.kind === "separator") {
              return <hr key={`sep-${index}`} className="my-1 border-line" />;
            }
            if (item.kind === "link" && item.file) {
              return (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  role="menuitem"
                  className={moreItemClass}
                  onClick={() => setOpen(false)}
                >
                  {item.icon}
                  {item.label}
                </a>
              );
            }
            if (item.kind === "link") {
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  role="menuitem"
                  className={moreItemClass}
                  onClick={() => setOpen(false)}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            }
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={pending}
                className={`${moreItemClass} ${item.danger ? "text-rose-700" : ""}`}
                onClick={async () => {
                  if (item.confirm && !window.confirm(item.confirm)) return;
                  setError("");
                  setPending(true);
                  const result = await item.run();
                  setPending(false);
                  setOpen(false);
                  if (result && !result.ok) setError(result.message || "Could not complete that action.");
                }}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="absolute right-0 top-12 z-20 w-72 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** A single primary action button (Close job, Collect payment…) that runs a server action. */
export function ActionButton({
  label,
  icon,
  run,
  confirm,
  variant = "primary",
}: {
  label: string;
  icon?: ReactNode;
  run: () => Promise<{ ok: boolean; message?: string } | void>;
  confirm?: string;
  variant?: "primary" | "secondary";
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="relative">
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          if (confirm && !window.confirm(confirm)) return;
          setError("");
          setPending(true);
          const result = await run();
          setPending(false);
          if (result && !result.ok) setError(result.message || "Could not complete that action.");
        }}
        className={
          variant === "primary"
            ? "inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
            : "inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-card px-4 text-sm font-bold text-ink hover:bg-cream disabled:opacity-60"
        }
      >
        {icon}
        {pending ? "Working…" : label}
      </button>
      {error ? (
        <p role="alert" className="absolute right-0 top-12 z-20 w-72 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
