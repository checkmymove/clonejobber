import { ClickableRow } from "@/components/clickable-row";
import Link from "next/link";
import { Archive } from "lucide-react";
import { formatGBP, formatPounds } from "@/lib/format";
import { listQuotes } from "@/lib/quotes/queries";
import {
  OVERVIEW_STATUSES,
  QUOTE_FILTERS,
  normalizeQuoteFilter,
  quoteMatchesFilter,
  quoteFilterTally,
  quoteListStatus,
  quoteWindowStats,
} from "@/lib/quotes/metrics";
import { archiveStaleQuotes, QUOTE_REPLY_DAYS } from "@/lib/quotes/auto-archive";
import { COMPANY_SLUG } from "@/lib/company";
import { Card, EmptyState } from "@/components/ui";
import { ConvertedToggle, FilterBar, KpiCard, OverviewCard, listHref } from "@/components/funnel/list-kit";

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

type Params = { q?: string; view?: string; status?: string };

export default async function CotacoesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const { q = "" } = params;
  // Quotes still awaiting a reply 5 days after they were sent are archived on the 6th day.
  await archiveStaleQuotes(COMPANY_SLUG);
  const [everything, all] = await Promise.all([
    listQuotes(COMPANY_SLUG, q, { includeArchived: true }),
    q.trim() ? listQuotes(COMPANY_SLUG, "", { includeArchived: true }) : null,
  ]);
  const every = all ?? everything;
  const listed = everything.filter((quote) => !quote.archived_at);
  // A quote that became a job moved on to Jobs and leaves the list; ?view=all shows it again.
  const waiting = listed.filter((quote) => !quote.converted_at);
  const wanted = normalizeQuoteFilter(params.status);
  const status = QUOTE_FILTERS.some((f) => f.key === wanted) ? wanted : undefined;
  const visible = status
    ? everything.filter((quote) => quoteMatchesFilter(quote, status))
    : params.view === "all"
      ? listed
      : waiting;
  const stats = quoteWindowStats(every);
  const tally = quoteFilterTally(every);
  const count = (key: string) => tally[key]?.n ?? 0;
  const base = "/cotacoes";
  const statusLabel = QUOTE_FILTERS.find((f) => f.key === status)?.label;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Quotes</h1>
        <Link
          href="/cotacoes/novo"
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-bold text-white hover:opacity-90"
        >
          + New quote
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OverviewCard
          items={OVERVIEW_STATUSES.map((s) => ({
            key: s.key,
            label: s.label,
            dot: s.dot,
            count: count(s.key),
            href: listHref(base, {}, { status: s.key }),
          }))}
        />
        <KpiCard
          title="Conversion rate"
          period="Past 30 days"
          hint="Quotes converted to a job in the past 30 days, divided by quotes sent in the past 30 days."
          value={formatRate(stats.conversionRate)}
          trend={stats.conversionTrend}
          href={listHref(base, {}, { status: "converted" })}
        />
        <KpiCard
          title="Sent"
          period="Past 30 days"
          hint="Quotes sent to the client in the past 30 days. The amount is their total after discount and tax."
          value={String(stats.sentCount)}
          trend={stats.sentTrend}
          sub={formatGBP(stats.sentTotal)}
          href={listHref(base, {}, { status: "awaiting" })}
        />
        <KpiCard
          title="Converted"
          period="Past 30 days"
          hint="Quotes that became a job in the past 30 days. The amount is their total after discount and tax."
          value={String(stats.convertedCount)}
          trend={stats.convertedTrend}
          sub={formatGBP(stats.convertedTotal)}
          href={listHref(base, {}, { status: "converted" })}
        />
      </div>

      <div className="mt-6 mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-ink">
          {status === "archived"
            ? "Archived quotes"
            : status || q.trim()
              ? "Filtered quotes"
              : params.view === "all"
                ? "All quotes"
                : "Quotes"}{" "}
          <span className="font-medium text-ink-mute">({visible.length} results)</span>
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          {status ? null : (
            <ConvertedToggle base={base} params={params} hidden={listed.length - waiting.length} />
          )}
          {status ? (
            <Link href={listHref(base, { q: params.q }, {})} className="text-sm font-semibold text-accent hover:underline">
              Back to quotes
            </Link>
          ) : null}
          {status === "archived" ? null : (
            <Link
              href={listHref(base, {}, { status: "archived" })}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-card px-3 text-sm font-semibold text-ink hover:bg-cream"
            >
              <Archive size={15} aria-hidden />
              Archived ({count("archived")})
            </Link>
          )}
        </div>
      </div>
      {status === "archived" ? (
        <p className="mb-3 rounded-lg bg-cream px-3 py-2 text-sm text-ink-soft">
          Quotes sent to the client with no reply after {QUOTE_REPLY_DAYS} days are archived on day {QUOTE_REPLY_DAYS + 1}.
          Open one and choose More › Unarchive to bring it back.
        </p>
      ) : null}

      <Card className="p-4">
        <FilterBar
          params={params}
          placeholder="Search quotes..."
          clearHref={listHref(base, { q: params.q }, {})}
          selects={[
            {
              name: "status",
              label: "Status",
              options: QUOTE_FILTERS.map((f) => ({ value: f.key, label: `${f.label} (${count(f.key)})` })),
            },
          ]}
        />
        {visible.length === 0 ? (
          <EmptyState>
            {status === "approved"
              ? listed.length > waiting.length
                ? "No approved quotes waiting for a job. The approved ones were already converted to jobs (filter Converted)."
                : "No approved quotes waiting for a job."
              : status
              ? `No ${statusLabel?.toLowerCase()} quotes.`
              : q.trim()
              ? "No quotes match that search."
              : listed.length > 0
                ? "All quotes were converted to jobs."
                : "No quotes yet. Create one from a request, or add one directly."}
          </EmptyState>
        ) : (
          <div className="-mx-4 overflow-x-auto max-md:px-4">
            <table className="w-full fit-table table-fixed text-left text-sm">
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
                  const status = quoteListStatus(quote.status, quote.converted_at, quote.archived_at);
                  const href = `/cotacoes/${quote.id}`;
                  return (
                    <ClickableRow key={quote.id} href={href}>
                      <td className="px-4 py-3.5 font-semibold break-words text-ink">
                        <Link href={href} className="hover:underline">
                          {quote.client_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5">
                        <Link href={href} className="font-semibold text-accent hover:underline">
                          {quote.number}
                        </Link>
                        {quote.service_name ? (
                          <p className="text-xs text-ink-mute">{quote.service_name}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3.5 text-[13px] break-words text-ink-soft">
                        <Link href={href} className="hover:underline">
                          {quote.property || "—"}
                        </Link>
                      </td>
                      <td data-label="Created" className="px-4 py-3.5 text-ink-soft">
                        <Link href={href}>{formatCreated(quote.created_at)}</Link>
                      </td>
                      <td className="px-4 py-3.5">
                        <Link href={href} className="inline-flex items-center gap-2 text-ink">
                          <span className={`size-2 shrink-0 rounded-full ${status.dot}`} />
                          {status.label}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold text-ink">
                        <Link href={href}>{formatPounds(quote.total / 100)}</Link>
                      </td>
                    </ClickableRow>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
