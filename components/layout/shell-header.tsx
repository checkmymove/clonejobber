"use client";

import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { PageHeader } from "@/components/ui";

type ShellHeaderContextValue = {
  /** Second row of the top bar, under the search, bell and user. */
  slot: HTMLElement | null;
  /** Tells the shell a page header sits in the top bar; returns the cleanup. */
  register: () => () => void;
};

const ShellHeaderContext = createContext<ShellHeaderContextValue | null>(null);
export const ShellHeaderProvider = ShellHeaderContext.Provider;

// Same as Tailwind's `lg` (the sidebar breakpoint): below it the header stays in the page.
const WIDE_QUERY = "(min-width: 1024px)";

function subscribeWide(onChange: () => void) {
  const media = window.matchMedia(WIDE_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function useWide() {
  return useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => false,
  );
}

/**
 * Header of a funnel detail page (request, quote, job). On wide screens the title
 * and the buttons (More and the ones beside it) become a second row of the top bar,
 * under the search, bell and user, so they stay in view while scrolling; on narrow
 * screens it is the usual PageHeader.
 */
export function ShellPageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  const shell = useContext(ShellHeaderContext);
  const wide = useWide();
  const slot = wide ? shell?.slot ?? null : null;
  const register = shell?.register;

  useEffect(() => {
    if (slot && register) return register();
  }, [slot, register]);

  if (slot) {
    return createPortal(
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[24px] font-bold leading-tight tracking-tight text-ink">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-ink-soft">{subtitle}</p> : null}
        </div>
        {children}
      </div>,
      slot,
    );
  }

  // `lg:hidden` keeps a wide screen from flashing the in-page header before it moves up.
  return (
    <div className="lg:hidden">
      <PageHeader title={title} subtitle={subtitle} action={children} />
    </div>
  );
}
