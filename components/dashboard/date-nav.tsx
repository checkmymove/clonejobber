"use client";

import { useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { formatShortDayLondon } from "@/lib/format";
import { addDays } from "@/lib/schedule/dates";

/** "Fri 30 Oct 2026" with previous / next day; the label opens a calendar. */
export function DateNav({ day, today }: { day: string; today: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const input = useRef<HTMLInputElement>(null);

  const go = (next: string) => {
    const sp = new URLSearchParams(params.toString());
    if (next === today) sp.delete("date");
    else sp.set("date", next);
    const qs = sp.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const arrow =
    "grid h-9 w-9 place-items-center rounded-lg text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-[#1d4ed8]";

  return (
    <div className="flex h-14 shrink-0 items-center gap-1 rounded-2xl border border-slate-200/80 bg-white pl-4 pr-2 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
      <button
        type="button"
        onClick={() => input.current?.showPicker?.()}
        className="relative flex items-center gap-3 rounded-lg py-1.5 pr-2 text-[15px] font-semibold text-slate-900"
        aria-label="Choose a day"
      >
        <CalendarDays size={20} strokeWidth={1.75} className="text-slate-700" aria-hidden />
        {formatShortDayLondon(day)}
        <input
          ref={input}
          type="date"
          value={day}
          onChange={(event) => event.target.value && go(event.target.value)}
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0"
        />
      </button>
      {day !== today ? (
        <button
          type="button"
          onClick={() => go(today)}
          className="rounded-lg px-2 py-1 text-xs font-semibold text-[#1d4ed8] hover:bg-blue-50"
        >
          Today
        </button>
      ) : null}
      <button type="button" onClick={() => go(addDays(day, -1))} aria-label="Previous day" className={arrow}>
        <ChevronLeft size={18} />
      </button>
      <button type="button" onClick={() => go(addDays(day, 1))} aria-label="Next day" className={arrow}>
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
