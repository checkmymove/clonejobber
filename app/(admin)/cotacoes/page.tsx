import Link from "next/link";
import { Info } from "lucide-react";
import { formatGBP, formatPounds } from "@/lib/format";
import { listQuotes } from "@/lib/quotes/queries";
import {
  OVERVIEW_STATUSES,
  quoteListStatus,
  quoteWindowStats,
} from "@/lib/quotes/metrics";
import { COMPANY_SLUG } from "@/lib/company";
import { EmptyState } from "@/components/ui";
import { ListSearch } from "@/components/funnel/list-search";

export const dynamic = "force-dynamic";

function formatCreated(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(date);
}

function formatRate(value: number): string {
  return `${Math.round(value)}%`;
}

function Trend({ value }: { value: number | null }) {
  if (value == null) return null;
  const up = value >= 0;
  const label = `${up ? "+" : ""}${Math.round(value)}%`;
  return (
    <span
      title="Compared with the previous 30 days"
      className={
        up
          ? "inline-flex items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700"
          : "inline-flex items-center rounded-full bg-rose-50 px-1.5 py-0.5 text-xs font-semibold text-rose-700"
      }
    >
      {label}
    </span>
  );
}

function MetricCard({
  title,
  hint,
  value,
  trend,
  amount,
}: {
  title: string;
  hint?: string;
  value: string;
  trend: number | null;
  amount: number;
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
      <p className="text-xs text-ink-mute">Past 30 days</p>
      <div className="mt-3 flex items-center gap-2">
        <p className="text-3xl font-extrabold tracking-tight text-ink">{value}</p>
        <Trend value={trend} />
      </div>
      <p className="mt-1 text-sm font-medium text-ink-soft">{formatGBP(amount)}</p>
    </section>
  );
}

export default async function CotacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const [visible, all] = await Promise.all([
    listQuotes(COMPANY_SLUG, q),
    q.trim() ? listQuotes(COMPANY_SLUG, "") : Promise.resolve(null),
  ]);
  const stats = quoteWindowStats(all ?? visible);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Quotes</h1>
        <Link
          href="/cotacoes/novo"
          className="inline-flex h-9 items-center rounded-lg bg-accent px-3.5 text-sm font-semibold text-white hover:opacity-90"
        >
          New Quote
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <section className="rounded-xl border border-line bg-card px-4 py-3.5">
          <h2 className="text-sm font-bold text-ink">Overview</h2>
          <p className="text-xs text-ink-mute">Past 30 days</p>
          <ul className="mt-3 space-y-1.5">
            {OVERVIEW_STATUSES.map((status) => (
              <li
                key={status.key}
                className="flex items-center gap-2 text-[13px] whitespace-nowrap text-ink"
              >
                <span className={`size-2 shrink-0 rounded-full ${status.dot}`} />
                <span>
                  {status.label}{" "}
                  <span className="text-ink-soft">({stats.overview[status.key]})</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <MetricCard
          title="Conversion rate"
          hint="Quotes converted to a job in the last 30 days, divided by quotes sent in the last 30 days."
          value={formatRate(stats.conversionRate)}
          trend={stats.conversionTrend}
          amount={stats.sentTotal}
        />
        <MetricCard
          title="Sent"
          hint="Quotes with a sent date in the last 30 days. The amount is the total after discount and tax."
          value={String(stats.sentCount)}
          trend={stats.sentTrend}
          amount={stats.sentTotal}
        />
        <MetricCard
          title="Converted"
          hint="Quotes converted to a job in the last 30 days. The amount is the total after discount and tax."
          value={String(stats.convertedCount)}
          trend={stats.convertedTrend}
          amount={stats.convertedTotal}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-ink">
          All quotes{" "}
          <span className="font-medium text-ink-mute">({visible.length} results)</span>
        </h2>
        <ListSearch defaultValue={q} placeholder="Search quotes..." />
      </div>

      {visible.length === 0 ? (
        <EmptyState>
          {q.trim()
            ? "No quotes match that search."
            : "No quotes yet. Create one from a request, or add one directly."}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-card">
          <table className="w-full min-w-[720px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[18%]" />
              <col className="w-[20%]" />
              <col className="w-[24%]" />
              <col className="w-[12%]" />
              <col className="w-[16%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-line text-xs font-semibold text-ink-mute">
                <th className="px-4 py-3 font-semibold">Client</th>
                <th className="px-4 py-3 font-semibold">Quote number</th>
                <th className="px-4 py-3 font-semibold">Property</th>
                <th className="px-4 py-3 font-semibold">Created</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((quote) => {
                const status = quoteListStatus(quote.status, quote.converted_at);
                return (
                  <tr key={quote.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3.5 font-semibold break-words text-ink">
                      <Link href={`/clientes/${quote.client_id}`} className="hover:underline">
                        {quote.client_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5">
                      <Link
                        href={`/cotacoes/${quote.id}`}
                        className="font-semibold text-accent hover:underline"
                      >
                        {quote.number}
                      </Link>
                      {quote.service_name ? (
                        <p className="text-xs text-ink-mute">{quote.service_name}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3.5 text-[13px] break-words text-ink-soft">
                      {quote.property || "—"}
                    </td>
                    <td className="px-4 py-3.5 text-ink-soft">{formatCreated(quote.created_at)}</td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-2 text-ink">
                        <span className={`size-2 shrink-0 rounded-full ${status.dot}`} />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold text-ink">
                      {formatPounds(quote.total / 100)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
