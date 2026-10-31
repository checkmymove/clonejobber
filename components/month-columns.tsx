import { formatGBP } from "@/lib/format";
import type { MonthPoint } from "@/lib/reports/queries";

const MONTH = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });
const MONTH_YEAR = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const at = (month: string) => new Date(`${month}-15T12:00:00Z`);

/**
 * Twelve months as columns, one series in one hue (the title names it, so no legend).
 * Hovering or focusing a column shows its month and value; a table view sits behind
 * the toggle for screen readers and exact figures.
 */
export function MonthColumns({ points, label, color = "#2563eb" }: { points: MonthPoint[]; label: string; color?: string }) {
  const max = Math.max(...points.map((p) => p.value), 0);
  const total = points.reduce((s, p) => s + p.value, 0);
  return (
    <figure>
      <div className="relative">
        <span className="absolute left-0 top-0 text-[11px] text-ink-mute">{max > 0 ? formatGBP(max) : ""}</span>
        <div className="flex h-44 items-end gap-1.5 border-b border-line pt-5 sm:gap-2" role="list" aria-label={label}>
          {points.map((p) => {
            const h = max > 0 ? Math.max(p.value > 0 ? 3 : 0, (p.value / max) * 100) : 0;
            return (
              <div key={p.month} role="listitem" tabIndex={0} className="group relative flex h-full flex-1 items-end outline-none">
                <div
                  className="w-full rounded-t-[4px] transition-opacity group-hover:opacity-80 group-focus:opacity-80"
                  style={{ height: `${h}%`, background: color }}
                />
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#13213d] px-2.5 py-1.5 text-xs text-white shadow-lg group-hover:block group-focus:block">
                  {MONTH_YEAR.format(at(p.month))}: <strong>{formatGBP(p.value)}</strong>
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 flex gap-1.5 sm:gap-2">
          {points.map((p) => (
            <span key={p.month} className="flex-1 text-center text-[11px] text-ink-mute">
              {MONTH.format(at(p.month))}
            </span>
          ))}
        </div>
      </div>
      <figcaption className="mt-2 text-xs text-ink-soft">
        {formatGBP(total)} over the last 12 months
      </figcaption>
      <details className="mt-1 text-xs text-ink-soft">
        <summary className="cursor-pointer select-none text-[#1d4ed8]">Show as table</summary>
        <table className="mt-2 w-full max-w-xs tabular-nums">
          <tbody>
            {points.map((p) => (
              <tr key={p.month} className="border-b border-line last:border-0">
                <td className="py-1">{MONTH_YEAR.format(at(p.month))}</td>
                <td className="py-1 text-right text-ink">{formatGBP(p.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
