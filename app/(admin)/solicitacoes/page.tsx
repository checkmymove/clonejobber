import { ClickableRow } from "@/components/clickable-row";
import Link from "next/link";
import { formatDateLondon, todayLondonInput } from "@/lib/format";
import { listRequests } from "@/lib/requests/queries";
import {
  REQUEST_STATUS_META,
  isRequestOverdue,
  requestKpis,
  requestListStatus,
  type RequestListStatus,
} from "@/lib/requests/metrics";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import {
  ConvertedToggle,
  FilterBar,
  KpiCard,
  OverviewCard,
  StatusDot,
  listHref,
} from "@/components/funnel/list-kit";

export const dynamic = "force-dynamic";

const COMPANY_SLUG = "moving-london";

type Params = { q?: string; view?: string; status?: string };

const FILTERS: { key: RequestListStatus | "overdue"; label: string; dot: string }[] = [
  { key: "new", ...REQUEST_STATUS_META.new },
  { key: "review", ...REQUEST_STATUS_META.review },
  { key: "overdue", label: "Overdue", dot: "bg-rose-500" },
  { key: "converted", ...REQUEST_STATUS_META.converted },
  { key: "archived", ...REQUEST_STATUS_META.archived },
];

export default async function SolicitacoesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const { q = "" } = params;
  const today = todayLondonInput();
  const [listed, everyRow] = await Promise.all([
    listRequests(COMPANY_SLUG, q),
    q.trim() ? listRequests(COMPANY_SLUG, "") : null,
  ]);
  const every = everyRow ?? listed;
  const match = (key: string) => (r: (typeof every)[number]) =>
    key === "overdue" ? isRequestOverdue(r, today) : requestListStatus(r) === key;
  const count = (key: string) => every.filter(match(key)).length;
  const kpis = requestKpis(every);

  // Only requests still waiting to become a quote; converted and archived ones leave the list.
  const waiting = listed.filter((r) => !r.has_quote && r.status !== "quoted" && r.status !== "archived");
  const status = FILTERS.some((f) => f.key === params.status) ? params.status : undefined;
  const rows = status ? listed.filter(match(status)) : params.view === "all" ? listed : waiting;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const publicUrl = `${appUrl}/r/${COMPANY_SLUG}`;
  const base = "/solicitacoes";

  return (
    <div>
      <PageHeader
        title="Requests"
        subtitle={`${waiting.length} awaiting a quote · live data`}
        action={
          <div className="flex gap-2">
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-card px-4 text-sm font-bold text-ink hover:bg-cream"
              title={publicUrl}
            >
              View public form
            </a>
            <Link
              href="/solicitacoes/novo"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-bold text-white hover:opacity-90"
            >
              + New request
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OverviewCard
          items={FILTERS.filter((f) => f.key !== "converted" && f.key !== "archived").map((f) => ({
            key: f.key,
            label: f.label,
            dot: f.dot,
            count: count(f.key),
            href: listHref(base, {}, { status: f.key }),
          }))}
        />
        <KpiCard
          title="New requests"
          period="Past 30 days"
          hint="Requests received in the past 30 days that are still waiting for a quote."
          value={String(kpis.newCount)}
          trend={kpis.newTrend}
          href={listHref(base, {}, { status: "new" })}
        />
        <KpiCard
          title="Conversion rate"
          period="Past 30 days"
          hint="Of the requests received in the past 30 days, the share already turned into a quote."
          value={`${Math.round(kpis.conversionRate)}%`}
          trend={kpis.conversionTrend}
          href={listHref(base, {}, { status: "converted" })}
        />
        <section className="col-span-2 rounded-xl border border-line bg-cream px-4 py-3.5 lg:col-span-1">
          <h2 className="text-sm font-bold text-ink">Get requests 24/7</h2>
          <p className="mt-1 text-[13px] leading-5 text-ink-soft">
            Share your request form online, so clients can reach out anytime.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex h-9 items-center gap-1 rounded-lg border border-line bg-card pl-3 pr-0.5 text-sm font-semibold text-ink">
              Copy link
              <CopyButton text={publicUrl} label="request form link" />
            </span>
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center rounded-lg border border-line bg-card px-3 text-sm font-semibold text-ink hover:bg-white"
            >
              Open form
            </a>
          </div>
        </section>
      </div>

      <div className="mt-6 mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-ink">
          {status || q.trim() ? "Filtered requests" : params.view === "all" ? "All requests" : "Awaiting a quote"}{" "}
          <span className="font-medium text-ink-mute">({rows.length} results)</span>
        </h2>
        {status ? null : <ConvertedToggle base={base} params={params} hidden={listed.length - waiting.length} />}
      </div>
      <Card className="p-4">
        <FilterBar
          params={params}
          placeholder="Search by client, number or postcode"
          clearHref={listHref(base, { q: params.q }, {})}
          selects={[
            {
              name: "status",
              label: "Status",
              options: FILTERS.map((f) => ({ value: f.key, label: `${f.label} (${count(f.key)})` })),
            },
          ]}
        />
        {rows.length === 0 ? (
          <div className="mt-3">
            <EmptyState>
              {status ? (
                "No requests with this status."
              ) : every.length > 0 ? (
                "No requests waiting for a quote."
              ) : (
                <>
                  No requests yet. Share the public form:{" "}
                  <span className="font-mono font-bold">{publicUrl}</span>
                </>
              )}
            </EmptyState>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full fit-table text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-mute">
                  <th className="py-2 pr-3 font-bold">Client</th>
                  <th className="py-2 pr-3 font-bold">Title</th>
                  <th className="py-2 pr-3 font-bold">Collection</th>
                  <th className="py-2 pr-3 font-bold">Contact</th>
                  <th className="py-2 pr-3 font-bold">Received</th>
                  <th className="py-2 pr-3 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const s = requestListStatus(r);
                  const overdue = isRequestOverdue(r, today);
                  return (
                    <ClickableRow key={r.id} href={`/solicitacoes/${r.id}`}>
                      <td className="py-3 pr-3">
                        <Link href={`/solicitacoes/${r.id}`} className="font-bold text-ink hover:underline">
                          {r.client_name}
                        </Link>
                        <p className="text-xs text-ink-mute">{r.number}</p>
                      </td>
                      <td className="py-3 pr-3 text-[13px] text-ink-soft">
                        {r.services_count} service(s) · {r.images_count} photo(s)
                      </td>
                      <td className="py-3 pr-3 text-[13px] text-ink-soft">
                        {r.pickup_address ? (
                          <>
                            {r.pickup_address}
                            <br />
                            <span className="text-ink-mute">{r.pickup_postcode}</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3 pr-3 text-[13px] text-ink-soft">
                        <p className="truncate">{r.client_email}</p>
                        <p>{r.client_phone}</p>
                      </td>
                      <td data-label="Received" className="py-3 pr-3 text-[13px] text-ink-soft">
                        {formatDateLondon(r.submitted_at)}
                      </td>
                      <td className="py-3 pr-3">
                        <StatusDot
                          dot={overdue ? "bg-rose-500" : REQUEST_STATUS_META[s].dot}
                          label={overdue ? `${REQUEST_STATUS_META[s].label} · Overdue` : REQUEST_STATUS_META[s].label}
                        />
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
