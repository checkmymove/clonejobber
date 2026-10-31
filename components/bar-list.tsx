import { formatGBP } from "@/lib/format";

/**
 * Horizontal bars for a breakdown (expenses by category, revenue by client): one hue,
 * longest first, value as text beside each bar. Hover shows the share.
 */
export function BarList({ items, empty = "Nothing yet." }: { items: { label: string; value: number }[]; empty?: string }) {
  const rows = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const max = rows[0]?.value ?? 0;
  const total = rows.reduce((s, r) => s + r.value, 0);
  if (rows.length === 0) return <p className="text-sm text-ink-mute">{empty}</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label} title={`${r.label}: ${formatGBP(r.value)} · ${Math.round((r.value / total) * 100)}%`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-ink">{r.label}</span>
            <span className="shrink-0 font-semibold text-ink">{formatGBP(r.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-[#2563eb]" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
