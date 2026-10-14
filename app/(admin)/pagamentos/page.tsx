import Link from "next/link";
import { ClickableRow } from "@/components/clickable-row";
import { formatDateNumericLondon, formatGBP, formatPounds } from "@/lib/format";
import { getCompanyId } from "@/lib/company";
import { getPaymentMetrics, listPayments, type PaymentRow } from "@/lib/payments/queries";
import {
  PAYMENT_KIND_LABEL,
  PAYMENT_METHODS,
  PAYMENT_STATUS_LABEL,
  paymentMethodLabel,
} from "@/lib/payments/constants";
import { EmptyState } from "@/components/ui";
import { FilterBar, KpiCard, SortTh, StatusDot } from "@/components/funnel/list-kit";

export const dynamic = "force-dynamic";

type Params = { q?: string; method?: string; kind?: string; range?: string; sort?: string; dir?: string };

function trendPct(current: number | null, previous: number | null): number | null {
  if (current == null || !previous) return null;
  return ((current - previous) / previous) * 100;
}

function sortPayments(rows: PaymentRow[], sort: string | undefined, dir: string | undefined): PaymentRow[] {
  if (!sort) return rows;
  const sign = dir === "asc" ? 1 : -1;
  const by: Record<string, (a: PaymentRow, b: PaymentRow) => number> = {
    client: (a, b) => a.client_name.localeCompare(b.client_name),
    date: (a, b) => a.paid_on.localeCompare(b.paid_on),
    method: (a, b) => paymentMethodLabel(a.method).localeCompare(paymentMethodLabel(b.method)),
    amount: (a, b) => a.amount - b.amount,
  };
  const cmp = by[sort];
  return cmp ? [...rows].sort((a, b) => sign * cmp(a, b)) : rows;
}

export default async function PagamentosPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const companyId = await getCompanyId();
  const [rows, metrics] = companyId
    ? await Promise.all([listPayments(companyId, params), getPaymentMetrics(companyId)])
    : [[], null];
  const sorted = sortPayments(rows, params.sort, params.dir);
  const filtering = Boolean(params.q || params.method || params.kind || params.range);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Payments</h1>
        <Link
          href="/pagamentos/novo"
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-bold text-white hover:opacity-90"
        >
          + Record payment
        </Link>
      </div>

      {metrics ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard
            title="Collected"
            period="Past 30 days"
            hint="Payments and deposits recorded with a transaction date in the last 30 days."
            value={formatGBP(metrics.collected30)}
            trend={trendPct(metrics.collected30, metrics.collectedPrev30)}
            sub={`${metrics.count30} payment${metrics.count30 === 1 ? "" : "s"}`}
          />
          <KpiCard
            title="Invoice payment time"
            period="Past 30 days"
            hint="Average days from issued to paid, for invoices paid in the last 30 days."
            value={metrics.avgDaysToPaid == null ? "—" : `${Math.round(metrics.avgDaysToPaid)} days`}
            trend={trendPct(metrics.avgDaysToPaid, metrics.avgDaysToPaidPrev)}
            invertTrend
          />
          <KpiCard
            title="Invoices paid on time"
            period="Last 60 days"
            hint="Share of invoices paid on or before their due date, among invoices paid in the last 60 days."
            value={metrics.paidOnTimeRate == null ? "—" : `${Math.round(metrics.paidOnTimeRate * 100)}%`}
            trend={trendPct(metrics.paidOnTimeRate, metrics.paidOnTimeRatePrev)}
          />
        </div>
      ) : null}

      <div className="mt-6 mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-ink">
          {filtering ? "Filtered payments" : "All payments"}{" "}
          <span className="font-medium text-ink-mute">({sorted.length} results)</span>
        </h2>
      </div>
      <FilterBar
        params={params}
        placeholder="Search payments..."
        selects={[
          {
            name: "kind",
            label: "Type",
            options: [
              { value: "payment", label: "Payment" },
              { value: "deposit", label: "Deposit" },
            ],
          },
          {
            name: "method",
            label: "Method",
            options: PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label })),
          },
          {
            name: "range",
            label: "Date",
            options: [
              { value: "30d", label: "Last 30 days" },
              { value: "month", label: "This month" },
              { value: "last_month", label: "Last month" },
              { value: "year", label: "This year" },
            ],
          },
        ]}
      />

      {sorted.length === 0 ? (
        <EmptyState>
          {filtering
            ? "No payments match these filters."
            : "No payments yet. Collect one from an invoice, or record a deposit on a quote."}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-card">
          <table className="w-full min-w-[760px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[28%]" />
              <col className="w-[14%]" />
              <col className="w-[14%]" />
              <col className="w-[16%]" />
              <col className="w-[14%]" />
              <col className="w-[14%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-line text-xs font-semibold text-ink-mute">
                <SortTh label="Client" sortKey="client" base="/pagamentos" params={params} />
                <SortTh label="Payment date" sortKey="date" base="/pagamentos" params={params} />
                <th className="px-4 py-3 font-semibold">Payment status</th>
                <SortTh label="Method" sortKey="method" base="/pagamentos" params={params} />
                <th className="px-4 py-3 font-semibold">Type</th>
                <SortTh label="Amount" sortKey="amount" base="/pagamentos" params={params} align="right" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => {
                const href = `/pagamentos/${p.id}`;
                return (
                  <ClickableRow key={p.id} href={href}>
                    <td className="px-4 py-3.5">
                      <Link href={href} className="font-semibold break-words text-ink hover:underline">
                        {p.client_name}
                      </Link>
                      <p className="text-xs">
                        {p.quote_id ? (
                          <Link href={`/cotacoes/${p.quote_id}`} className="text-accent underline">
                            Quote {p.quote_number}
                          </Link>
                        ) : null}
                        {p.quote_id && p.invoices.length ? <span className="text-ink-mute"> / </span> : null}
                        {p.invoices.map((inv, i) => (
                          <span key={inv.id}>
                            {i ? <span className="text-ink-mute">, </span> : null}
                            <Link href={`/faturas/${inv.id}`} className="text-accent underline">
                              Invoice {inv.number}
                            </Link>
                          </span>
                        ))}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-ink-soft">{formatDateNumericLondon(p.paid_on)}</td>
                    <td className="px-4 py-3.5">
                      <StatusDot dot="bg-emerald-500" label={PAYMENT_STATUS_LABEL[p.status] ?? p.status} />
                    </td>
                    <td className="px-4 py-3.5 text-ink-soft">{paymentMethodLabel(p.method)}</td>
                    <td className="px-4 py-3.5 text-ink-soft">{PAYMENT_KIND_LABEL[p.kind] ?? p.kind}</td>
                    <td className="px-4 py-3.5 text-right font-semibold text-ink">
                      {formatPounds(p.amount / 100)}
                    </td>
                  </ClickableRow>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
