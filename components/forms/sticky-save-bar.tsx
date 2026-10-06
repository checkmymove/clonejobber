"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

const ink = "text-[#042b3c]";
const line = "border-[#d5dde1]";
const green = "#388623";

export type StickySaveAction = {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
};

export function StickySaveBar({
  cancelHref,
  error,
  pending = false,
  saveLabel,
  menuItems,
  maxWidthClass = "max-w-[860px]",
}: {
  cancelHref: string;
  error?: string;
  pending?: boolean;
  saveLabel: string;
  menuItems?: StickySaveAction[];
  maxWidthClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const hasMenu = Boolean(menuItems?.length);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#d5dde1] bg-white/95 px-4 py-3 backdrop-blur">
      <div className={`mx-auto flex ${maxWidthClass} flex-wrap items-center justify-end gap-2`}>
        {error ? <p className="mr-auto text-sm font-semibold text-rose-700">{error}</p> : null}
        <Link
          href={cancelHref}
          className={`inline-flex h-10 items-center rounded-lg border ${line} bg-white px-4 text-sm font-semibold ${ink}`}
        >
          Cancel
        </Link>
        {hasMenu ? (
          <div ref={menuRef} className="relative">
            <div
              className="inline-flex h-10 overflow-hidden rounded-lg text-sm font-semibold text-white"
              style={{ background: green }}
            >
              <button type="submit" disabled={pending} className="px-4 disabled:opacity-60">
                {pending ? "Saving…" : saveLabel}
              </button>
              <button
                type="button"
                aria-label="Save and..."
                aria-expanded={open}
                disabled={pending}
                onClick={() => setOpen((value) => !value)}
                className="grid w-9 place-items-center border-l border-white/30 disabled:opacity-60"
              >
                <ChevronDown size={16} />
              </button>
            </div>
            {open ? (
              <div
                role="menu"
                className="absolute bottom-12 right-0 z-20 w-56 rounded-xl border border-[#d5dde1] bg-white p-2 shadow-xl"
              >
                <p className="px-3 py-2 text-sm text-[#5d6f78]">Save and...</p>
                {menuItems?.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      item.onClick();
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[15px] font-semibold ${ink} hover:bg-[#f7f8f8]`}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <button
            type="submit"
            disabled={pending}
            className="h-10 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: green }}
          >
            {pending ? "Saving…" : saveLabel}
          </button>
        )}
      </div>
    </div>
  );
}
