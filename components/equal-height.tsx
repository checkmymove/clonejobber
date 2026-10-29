"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

const ARROW = 32; // arrow button + its top margin
const SLACK = 56; // smaller differences are evened out by stretching, not collapsing

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function cardOf(el: HTMLElement): HTMLElement | null {
  return el.closest<HTMLElement>(".rounded-2xl");
}

/** The grid cell holding `card`, i.e. the ancestor whose parent is the grid. */
function cellOf(card: HTMLElement): HTMLElement {
  let cell = card;
  while (cell.parentElement && getComputedStyle(cell.parentElement).display !== "grid") {
    cell = cell.parentElement;
  }
  return cell;
}

/** Height the card would have with its body fully shown and nothing stretched. */
function naturalHeight(card: HTMLElement): number {
  const inner = card.querySelector<HTMLElement>("[data-eq-inner]");
  if (!inner) return card.offsetHeight;
  const style = getComputedStyle(card);
  const bottom = parseFloat(style.paddingBottom) + parseFloat(style.borderBottomWidth);
  return inner.getBoundingClientRect().top - card.getBoundingClientRect().top + inner.offsetHeight + bottom;
}

/**
 * Card body that keeps side-by-side cards the same height. Put one in each card of a
 * pair: the taller card collapses to its neighbour's height and shows an arrow
 * (click anywhere in the box to expand or collapse); a small difference just
 * stretches the shorter card. Cards stacked on narrow screens are left alone.
 */
export function EqualHeightBody({ children, label = "details" }: { children: ReactNode; label?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [box, setBox] = useState<{ maxH: number | null; minH: number | null }>({ maxH: null, minH: null });

  useIsoLayoutEffect(() => {
    const wrap = wrapRef.current;
    const inner = innerRef.current;
    const card = wrap ? cardOf(wrap) : null;
    if (!wrap || !inner || !card) return;

    const measure = () => {
      const cell = cellOf(card);
      const top = card.getBoundingClientRect().top;
      const neighbourCell = Array.from(cell.parentElement?.children ?? []).find(
        (el) => el !== cell && Math.abs(el.getBoundingClientRect().top - top) < 2,
      ) as HTMLElement | undefined;
      const neighbour = neighbourCell
        ? (neighbourCell.matches(".rounded-2xl") ? neighbourCell : neighbourCell.querySelector<HTMLElement>(".rounded-2xl"))
        : null;
      if (!neighbour) {
        setBox((prev) => (prev.maxH === null && prev.minH === null ? prev : { maxH: null, minH: null }));
        return;
      }
      const mine = Math.round(naturalHeight(card));
      const theirs = Math.round(naturalHeight(neighbour));
      const content = inner.offsetHeight;
      let next: { maxH: number | null; minH: number | null } = { maxH: null, minH: null };
      if (mine - theirs > SLACK) next = { maxH: Math.max(content - (mine - theirs) - ARROW, 48), minH: null };
      else if (theirs > mine && theirs - mine <= SLACK) next = { maxH: null, minH: content + (theirs - mine) };
      setBox((prev) => (prev.maxH === next.maxH && prev.minH === next.minH ? prev : next));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(inner);
    const cell = cellOf(card);
    for (const el of Array.from(cell.parentElement?.children ?? [])) {
      if (el !== cell) observer.observe(el);
    }
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const clamped = box.maxH !== null;
  const toggleable = clamped;

  return (
    <div
      ref={wrapRef}
      data-eq-body=""
      className={toggleable ? "cursor-pointer" : undefined}
      onClick={(event) => {
        if (!toggleable) return;
        if ((event.target as HTMLElement).closest("a, button, input, select, textarea")) return;
        if (window.getSelection()?.toString()) return;
        setExpanded((v) => !v);
      }}
    >
      <div
        style={
          clamped && !expanded
            ? { maxHeight: box.maxH ?? undefined }
            : box.minH !== null
              ? { minHeight: box.minH }
              : undefined
        }
        className={`relative ${clamped && !expanded ? "overflow-hidden" : ""}`}
      >
        <div ref={innerRef} data-eq-inner="">
          {children}
        </div>
        {clamped && !expanded ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card to-transparent" />
        ) : null}
      </div>
      {toggleable ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={expanded ? "Show less" : `Show full ${label}`}
          onClick={(event) => {
            event.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="mt-1 grid h-7 w-full place-items-center rounded-lg text-ink-soft hover:bg-cream hover:text-ink"
        >
          <ChevronDown size={18} className={expanded ? "rotate-180" : ""} />
        </button>
      ) : null}
    </div>
  );
}
