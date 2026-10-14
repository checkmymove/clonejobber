import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Info } from "lucide-react";
import { cn } from "@/lib/cn";

/** Shared pieces of the Jobber-style list pages (Jobs, Invoices, Payments). */

export function Trend({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value == null || !Number.isFinite(value)) return null;
  const up = value >= 0;
  const good = invert ? !up : up;
  return (
    <span
      title="Compared with the previous period"
      className={
        good
          ? "inline-flex items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700"
          : "inline-flex items-center rounded-full bg-rose-50 px-1.5 py-0.5 text-xs font-semibold text-rose-700"
      }
    >
      {up ? "↑" : "↓"} {Math.abs(Math.round(value))}%
    </span>
  );
}

export function KpiCard({
  title,
  period,
  hint,
  value,
  trend,
  invertTrend,
  sub,
  children,
}: {
  title: string;
  period?: string;
  hint?: string;
  value?: string;
  trend?: number | null;
  invertTrend?: boolean;
  sub?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-card px-4 py-3.5">
      <div className="flex items-center gap-1.5">
        <h2 className="text-sm font-bold text-ink">{title}</h2>
        {hint ? (
          <span title={hint} className="text-ink-mute">
            <Info size={14} aria-hidden />
            <span className="sr-only">{hint}</span>
          </span>
        ) : null}
      </div>
      {period ? <p className="text-xs text-ink-mute">{period}</p> : null}
      {value != null ? (
        <div className="mt-3 flex items-center gap-2">
          <p className="text-3xl font-extrabold tracking-tight text-ink">{value}</p>
          {trend !== undefined ? <Trend value={trend} invert={invertTrend} /> : null}
        </div>
      ) : null}
      {sub ? <p className="mt-1 text-sm font-medium text-ink-soft">{sub}</p> : null}
      {children}
    </section>
  );
}

export function OverviewCard({
  title = "Overview",
  period,
  items,
}: {
  title?: string;
  period?: string;
  items: { key: string; label: string; dot: string; count: number; amount?: string; href: string }[];
}) {
  return (
    <section className="rounded-xl border border-line bg-card px-4 py-3.5">
      <h2 className="text-sm font-bold text-ink">{title}</h2>
      {period ? <p className="text-xs text-ink-mute">{period}</p> : null}
      <ul className="mt-3 space-y-1.5">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              className="flex items-center gap-2 text-[13px] whitespace-nowrap text-ink hover:underline"
            >
              <span className={`size-2 shrink-0 rounded-full ${item.dot}`} />
              <span>
                {item.label} <span className="text-ink-soft">({item.count})</span>
              </span>
              {item.amount ? <span className="ml-auto font-semibold text-ink-soft">{item.amount}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function StatusDot({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-ink">
      <span className={`size-2 shrink-0 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

export function StatusPill({ badge, dot, label }: { badge: string; dot: string; label: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", badge)}>
      <span className={`size-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

/** Builds a list URL keeping the current filters and replacing the given keys. */
export function listHref(
  base: string,
  current: Record<string, string | undefined>,
  patch: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, ...patch })) {
    if (v) params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function SortTh({
  label,
  sortKey,
  base,
  params,
  align = "left",
}: {
  label: string;
  sortKey: string;
  base: string;
  params: Record<string, string | undefined>;
  align?: "left" | "right";
}) {
  const active = params.sort === sortKey;
  const nextDir = active && params.dir === "asc" ? "desc" : "asc";
  const Icon = !active ? ArrowUpDown : params.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={cn("px-4 py-3 font-semibold", align === "right" && "text-right")}>
      <Link
        href={listHref(base, params, { sort: sortKey, dir: nextDir })}
        className={cn("inline-flex items-center gap-1 hover:text-ink", active && "text-ink")}
      >
        {label}
        <Icon size={13} aria-hidden />
      </Link>
    </th>
  );
}

/** GET form: status (and other) selects plus the search box, all kept in the URL. */
export function FilterBar({
  params,
  selects,
  placeholder,
}: {
  params: Record<string, string | undefined>;
  selects: { name: string; label: string; options: { value: string; label: string }[] }[];
  placeholder: string;
}) {
  const kept = Object.entries(params).filter(
    ([k, v]) => v && k !== "q" && !selects.some((s) => s.name === k),
  );
  return (
    <form method="get" className="mb-3 flex flex-wrap items-center gap-2">
      {kept.map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {selects.map((s) => (
        <label
          key={s.name}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-[#e9ecea] pl-4 pr-2 text-sm font-semibold text-ink"
        >
          {s.label}
          <span className="h-4 w-px bg-ink-mute/40" />
          <select
            name={s.name}
            defaultValue={params[s.name] ?? ""}
            className="h-8 rounded-full bg-transparent pr-1 text-sm font-semibold text-ink-soft outline-none"
          >
            <option value="">All</option>
            {s.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      <input
        type="search"
        name="q"
        defaultValue={params.q ?? ""}
        placeholder={placeholder}
        aria-label={placeholder}
        className="ml-auto h-10 w-full rounded-xl border border-line bg-card px-3 text-sm text-ink outline-none focus:border-accent sm:w-72"
      />
      <button
        type="submit"
        className="h-10 shrink-0 rounded-xl bg-ink px-4 text-sm font-bold text-white hover:opacity-90"
      >
        Apply
      </button>
    </form>
  );
}
