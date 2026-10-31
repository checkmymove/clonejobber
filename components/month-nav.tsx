import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** "October 2026" with links to the months either side; `param` names the query string key. */
export function MonthNav({ path, month, param = "month" }: { path: string; month: string; param?: string }) {
  const [y, m] = month.split("-").map(Number);
  const shift = (delta: number) => {
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  const label = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
  const arrow = "grid h-9 w-9 place-items-center rounded-lg text-ink hover:bg-cream";
  return (
    <div className="flex h-12 items-center gap-1 rounded-2xl border border-line bg-card px-2 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
      <Link href={`${path}?${param}=${shift(-1)}`} aria-label="Previous month" className={arrow}>
        <ChevronLeft size={18} />
      </Link>
      <span className="min-w-[140px] text-center text-[15px] font-semibold text-ink">{label}</span>
      <Link href={`${path}?${param}=${shift(1)}`} aria-label="Next month" className={arrow}>
        <ChevronRight size={18} />
      </Link>
    </div>
  );
}
