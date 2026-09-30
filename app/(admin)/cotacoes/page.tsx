import Link from "next/link";
import { formatGBP, formatDateLondon } from "@/lib/format";
import { listQuotes } from "@/lib/quotes/queries";
import { COMPANY_SLUG } from "@/lib/company";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { ListSearch } from "@/components/funnel/list-search";

export const dynamic = "force-dynamic";

const STAGES = ["draft", "sent", "approved", "rejected", "expired"] as const;
const LABELS: Record<(typeof STAGES)[number], string> = {
  draft: "Draft",
  sent: "Sent",
  approved: "Approved",
  rejected: "Declined",
  expired: "Expired",
};

export default async function CotacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const quotes = await listQuotes(COMPANY_SLUG, q);
  const totalPence = quotes
    .filter((q) => q.status === "sent" || q.status === "approved")
    .reduce((s, q) => s + q.total, 0);

  return (
    <div>
      <PageHeader
        title="Quotes"
        subtitle={`Pipeline · ${formatGBP(totalPence)} in sent and approved`}
        action={
          <Link
            href="/cotacoes/novo"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-bold text-white hover:opacity-90"
          >
            + New quote
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {STAGES.map((s) => {
          const items = quotes.filter((q) => q.status === s);
          const sum = items.reduce((acc, q) => acc + q.total, 0);
          return (
            <Card key={s} className="p-3">
              <Badge tone={s}>{LABELS[s]}</Badge>
              <p className="mt-2 text-xl font-extrabold text-ink">{items.length}</p>
              <p className="text-xs font-semibold text-ink-soft">{formatGBP(sum)}</p>
            </Card>
          );
        })}
      </div>

      <Card className="mt-4 p-4">
        <ListSearch defaultValue={q} placeholder="Search by client or number" />
        {quotes.length === 0 ? (
          <EmptyState>No quotes yet. Create one from a request, or add one directly.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-mute">
                  <th className="py-2 pr-3 font-bold">Quote</th>
                  <th className="py-2 pr-3 font-bold">Client</th>
                  <th className="py-2 pr-3 font-bold">Source</th>
                  <th className="py-2 pr-3 font-bold">Moving date</th>
                  <th className="py-2 pr-3 font-bold">Status</th>
                  <th className="py-2 text-right font-bold">Total</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q.id} className="border-b border-line last:border-0">
                    <td className="py-3 pr-3 font-bold text-ink">
                      <Link href={`/cotacoes/${q.id}`} className="hover:underline">
                        {q.number}
                      </Link>
                    </td>
                    <td className="py-3 pr-3 text-ink-soft">{q.client_name}</td>
                    <td className="py-3 pr-3 text-[13px] text-ink-mute">{q.request_number ?? "Direct"}</td>
                    <td className="py-3 pr-3 text-[13px] text-ink-soft">
                      {q.valid_until ? formatDateLondon(q.valid_until) : "—"}
                    </td>
                    <td className="py-3 pr-3">
                      <Badge tone={q.status}>{LABELS[q.status as keyof typeof LABELS] ?? q.status}</Badge>
                    </td>
                    <td className="py-3 text-right font-bold text-ink">{formatGBP(q.total)}</td>
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
