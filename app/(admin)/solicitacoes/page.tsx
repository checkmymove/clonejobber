import { ClickableRow } from "@/components/clickable-row";
import Link from "next/link";
import { formatDateLondon } from "@/lib/format";
import { listRequests } from "@/lib/requests/queries";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { ListSearch } from "@/components/funnel/list-search";
import { ConvertedToggle } from "@/components/funnel/list-kit";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  review: "Awaiting review",
  quoted: "Quoted",
  archived: "Closed / archived",
};

const COMPANY_SLUG = "moving-london";

export default async function SolicitacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; view?: string }>;
}) {
  const params = await searchParams;
  const { q = "" } = params;
  const all = await listRequests(COMPANY_SLUG, q);
  const countBy = (s: string) => all.filter((r) => r.status === s).length;
  // Only requests still waiting to become a quote; converted and archived ones leave the list.
  const waiting = all.filter((r) => !r.has_quote && r.status !== "quoted" && r.status !== "archived");
  const rows = params.view === "all" ? all : waiting;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const publicUrl = `${appUrl}/r/${COMPANY_SLUG}`;

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

      {/* Overview */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {(
          [
            { key: "new", title: "New" },
            { key: "review", title: "Awaiting review" },
            { key: "quoted", title: "Quoted" },
            { key: "archived", title: "Closed / archived" },
          ] as const
        ).map((c) => (
          <Card key={c.key} className="p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
              {c.title}
            </p>
            <p className="mt-1 text-3xl font-extrabold text-ink">
              {countBy(c.key)}
            </p>
          </Card>
        ))}
      </div>

      <div className="mt-6 mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-ink">
          {params.view === "all" ? "All requests" : "Awaiting a quote"}{" "}
          <span className="font-medium text-ink-mute">({rows.length} results)</span>
        </h2>
        <ConvertedToggle base="/solicitacoes" params={params} hidden={all.length - waiting.length} />
      </div>
      <Card className="p-4">
        <ListSearch defaultValue={q} placeholder="Search by client, number or postcode" keep={{ view: params.view }} />
        {rows.length === 0 ? (
          <div className="mt-3">
            <EmptyState>
              {all.length > 0 ? (
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
                {rows.map((r) => (
                  <ClickableRow key={r.id} href={`/solicitacoes/${r.id}`}>
                    <td className="py-3 pr-3">
                      <Link
                        href={`/solicitacoes/${r.id}`}
                        className="font-bold text-ink hover:underline"
                      >
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
                      <Badge tone={r.status}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </Badge>
                    </td>
                  </ClickableRow>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
