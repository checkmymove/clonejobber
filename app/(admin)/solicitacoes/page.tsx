import Link from "next/link";
import { formatDateLondon } from "@/lib/format";
import { listRequests } from "@/lib/requests/queries";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { ListSearch } from "@/components/funnel/list-search";

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
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const rows = await listRequests(COMPANY_SLUG, q);
  const countBy = (s: string) => rows.filter((r) => r.status === s).length;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const publicUrl = `${appUrl}/r/${COMPANY_SLUG}`;

  return (
    <div>
      <PageHeader
        title="Requests"
        subtitle={`${rows.length} requests · live data`}
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
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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

      <Card className="mt-4 p-4">
        <ListSearch defaultValue={q} placeholder="Search by client, number or postcode" />
        {rows.length === 0 ? (
          <div className="mt-3">
            <EmptyState>
              No requests yet. Share the public form:{" "}
              <span className="font-mono font-bold">{publicUrl}</span>
            </EmptyState>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-mute">
                  <th className="py-2 pr-3 font-bold">Client</th>
                  <th className="py-2 pr-3 font-bold">Title</th>
                  <th className="py-2 pr-3 font-bold">Collection</th>
                  <th className="py-2 pr-3 font-bold">Contact</th>
                  <th className="py-2 pr-3 font-bold">Received</th>
                  <th className="py-2 pr-3 font-bold">Status</th>
                  <th className="py-2 text-right font-bold">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0">
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
                    <td className="py-3 pr-3 text-[13px] text-ink-soft">
                      {formatDateLondon(r.submitted_at)}
                    </td>
                    <td className="py-3 pr-3">
                      <Badge tone={r.status}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </Badge>
                    </td>
                    <td className="py-3 text-right">
                      <Link
                        href={`/solicitacoes/${r.id}`}
                        className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-bold text-accent hover:bg-accent-soft"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
