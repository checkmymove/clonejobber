"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { PERFORMANCE_PERIODS, type PerformancePeriod } from "@/lib/funnel/periods";

/** Period dropdown kept in `?period=`; the page's default period leaves the URL clean. */
export function PeriodSelect({
  value,
  defaultValue = "month",
}: {
  value: PerformancePeriod;
  defaultValue?: PerformancePeriod;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">Period</span>
      <select
        value={value}
        onChange={(event) => {
          const sp = new URLSearchParams(params.toString());
          if (event.target.value === defaultValue) sp.delete("period");
          else sp.set("period", event.target.value);
          const qs = sp.toString();
          router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
        }}
        className="h-8 appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 text-xs font-medium text-slate-700 outline-none hover:bg-slate-50 focus:border-[#1d4ed8]"
      >
        {PERFORMANCE_PERIODS.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 text-slate-500" aria-hidden />
    </label>
  );
}
