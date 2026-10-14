import Link from "next/link";
import { ClickableRow } from "@/components/clickable-row";
import { formatDateNumericLondon, formatGBP, formatPounds } from "@/lib/format";
import { invoiceKpis, listInvoices, type InvoiceRow } from "@/lib/invoices/queries";
import {
  INVOICE_STATUS_META,
  INVOICE_STATUS_ORDER,
  type InvoiceListStatus,
} from "@/lib/invoices/status";
import { COMPANY_SLUG } from "@/lib/company";
import { EmptyState } from "@/components/ui";
import {
  FilterBar,
  KpiCard,
  OverviewCard,
  SortTh,
  StatusDot,
  listHref,
} from "@/components/funnel/list-kit";
import { rangeBounds } from "@/lib/payments/queries";

export const dynamic = "force-dynamic";

type Params = { q?: string; status?: string; due?: string; sort?: string; dir?: string };

function sortInvoices(rows: InvoiceRow[], sort: string | undefined, dir: string | undefined): InvoiceRow[] {
  const sign = dir === "desc" ? -1 : 1;
  const rank = (s: InvoiceListStatus) => INVOICE_STATUS_ORDER.indexOf(s);
  const num = (n: string) => Number(n.replace(/\D/g, "")) || 0;
  const by: Record<string, (a: InvoiceRow, b: InvoiceRow) => number> = {
    client: (a, b) => a.client_name.localeCompare(b.client_name),
    number: (a, b) => num(a.number) - num(b.number),
    due: (a, b) => a.due_on.localeCompare(b.due_on),
    status: (a, b) => rank(a.list_status) - rank(b.list_status) || num(b.number) - num(a.number),
    total: (a, b) => a.total - b.total,
    balance: (a, b) => a.balance - b.balance,
  };
  const cmp = by[sort ?? "status"] ?? by.status;
  return [...rows].sort((a, b) => sign * cmp(a, b));
}

export default async function FaturasPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const all = await listInvoices(COMPANY_SLUG, params.q ?? "");
  const kpis = invoiceKpis(all);
  const counts = Object.fromEntries(
    INVOICE_STATUS_ORDER.map((s) => [s, all.filter((i) => i.list_status === s).length]),
  ) as Record<InvoiceListStatus, number>;
  const bounds = rangeBounds(params.due);
  const filtered = all.filter(
    (i) =>
      (!params.status || i.list_status === params.status) &&
      (!bounds || (i.due_on >= bounds[0] && i.due_on <= bounds[1])),
  );
  const rows = sortInvoices(filtered, params.sort, params.dir);
  const filtering = Boolean(params.status || params.q || params.due);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Invoices</h1>
        <Link
          href="/faturas/novo"
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-bold text-white hover:opacity-90"
        >
          + New invoice
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OverviewCard
          items={(["past_due", "awaiting_payment", "draft"] as const).map((s) => ({
            key: s,
            label: s === "awaiting_payment" ? "Sent but not due" : INVOICE_STATUS_META[s].label,
            dot: INVOICE_STATUS_META[s].dot,
            count: kpis.overview[s].count,
            amount: formatGBP(kpis.overview[s].balance),
            href: listHref("/faturas", {}, { status: s }),
          }))}
        />
        <KpiCard
          title="Issued"
          period="Past 30 days"
          hint="Invoices issued in the last 30 days, excluding today, and their total."
          value={String(kpis.issuedCount)}
          trend={kpis.issuedTrend}
          sub={formatGBP(kpis.issuedTotal)}
        />
        <KpiCard
          title="Average invoice"
          period="Past 30 days"
          hint="Average total of the invoices issued in the last 30 days, excluding today."
          value={formatGBP(kpis.averageInvoice)}
          trend={kpis.averageTrend}
        />
        <KpiCard
          title="Invoice payment time"
          period="Paid in the past 7 days"
          hint="Average number of days from issued to paid, for invoices paid in the last 7 days."
          value={kpis.avgDaysToPaid == null ? "—" : `${Math.round(kpis.avgDaysToPaid)} days`}
        />
      </div>

      <div className="mt-6 mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-ink">
          {filtering ? "Filtered invoices" : "All invoices"}{" "}
          <span className="font-medium text-ink-mute">({rows.length} results)</span>
        </h2>
      </div>
      <FilterBar
        params={params}
        placeholder="Search invoices..."
        selects={[
          {
            name: "status",
            label: "Status",
            options: INVOICE_STATUS_ORDER.map((s) => ({
              value: s,
              label: `${INVOICE_STATUS_META[s].label} (${counts[s]})`,
            })),
          },
          {
            name: "due",
            label: "Due date",
            options: [
              { value: "month", label: "This month" },
              { value: "last_month", label: "Last month" },
              { value: "year", label: "This year" },
            ],
          },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState>
          {filtering ? "No invoices match these filters." : "No invoices yet. Create one from a job, or add one directly."}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-card">
          <table className="w-full min-w-[800px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[19%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[21%]" />
              <col className="w-[14%]" />
              <col className="w-[11%]" />
              <col className="w-[11%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-line text-xs font-semibold text-ink-mute">
                <SortTh label="Client" sortKey="client" base="/faturas" params={params} />
                <SortTh label="Invoice number" sortKey="number" base="/faturas" params={params} />
                <SortTh label="Due date" sortKey="due" base="/faturas" params={params} />
                <th className="px-4 py-3 font-semibold">Subject</th>
                <SortTh label="Status" sortKey="status" base="/faturas" params={params} />
                <SortTh label="Total" sortKey="total" base="/faturas" params={params} align="right" />
                <SortTh label="Balance" sortKey="balance" base="/faturas" params={params} align="right" />
              </tr>
            </thead>
            <tbody>
              {rows.map((inv) => {
                const href = `/faturas/${inv.id}`;
                const meta = INVOICE_STATUS_META[inv.list_status];
                return (
                  <ClickableRow key={inv.id} href={href}>
                    <td className="px-4 py-3.5 font-semibold break-words text-ink">
                      <Link href={href} className="hover:underline">
                        {inv.client_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5">
                      <Link href={href} className="font-semibold text-accent hover:underline">
                        {inv.number}
                      </Link>
                      {inv.job_number ? <p className="text-xs text-ink-mute">{inv.job_number}</p> : null}
                    </td>
                    <td className="px-4 py-3.5 text-ink-soft">
                      {inv.status === "draft" ? "—" : formatDateNumericLondon(inv.due_on)}
                    </td>
                    <td className="px-4 py-3.5 text-[13px] break-words text-ink-soft">{inv.subject}</td>
                    <td className="px-4 py-3.5">
                      <StatusDot dot={meta.dot} label={meta.label} />
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold text-ink">
                      {formatPounds(inv.total / 100)}
                    </td>
                    <td className="px-4 py-3.5 text-right text-ink">{formatPounds(inv.balance / 100)}</td>
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
