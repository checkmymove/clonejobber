"use client";

import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { PageHeader } from "@/components/ui";

type ShellHeaderContextValue = {
  /** Spot in the top bar, between the search box and the bell. */
  slot: HTMLElement | null;
  /** Tells the shell a page header sits in the top bar; returns the cleanup. */
  register: () => () => void;
};

const ShellHeaderContext = createContext<ShellHeaderContextValue | null>(null);
export const ShellHeaderProvider = ShellHeaderContext.Provider;

// Same as Tailwind's `xl`: below it the top bar has no room, so the header stays in the page.
const WIDE_QUERY = "(min-width: 1280px)";

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
 * and the buttons (More and the ones beside it) go into the top bar, next to the
 * search, bell and user; on narrow screens it is the usual PageHeader.
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
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[19px] font-bold leading-tight tracking-tight text-ink" title={title}>
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-0.5 truncate text-xs text-ink-soft" title={subtitle}>
              {subtitle}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2 [&>*]:flex-nowrap">{children}</div>
      </div>,
      slot,
    );
  }

  // `xl:hidden` keeps a wide screen from flashing the in-page header before it moves up.
  return (
    <div className="xl:hidden">
      <PageHeader title={title} subtitle={subtitle} action={children} />
    </div>
  );
}
