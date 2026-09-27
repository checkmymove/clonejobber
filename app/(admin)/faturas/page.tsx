import Link from "next/link";
import { formatGBP, formatDateLondon } from "@/lib/format";
import { listInvoices } from "@/lib/invoices/queries";
import { COMPANY_SLUG } from "@/lib/company";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { ListSearch } from "@/components/funnel/list-search";

export const dynamic = "force-dynamic";

const STAGES = ["draft", "sent", "paid", "overdue"] as const;
const LABELS: Record<string, string> = {
  draft: "Rascunho",
  sent: "Enviada",
  paid: "Paga",
  overdue: "Vencida",
  cancelled: "Cancelada",
};

export default async function FaturasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const invoices = await listInvoices(COMPANY_SLUG, q);
  const pending = invoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((s, i) => s + i.balance, 0);
  const overdue = invoices.filter((i) => i.status === "overdue");

  return (
    <div>
      <PageHeader
        title="Faturas"
        subtitle="Rascunhos, enviadas, pagas e vencidas · saldo a receber"
        action={
          <Link
            href="/faturas/novo"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-bold text-white hover:opacity-90"
          >
            + Nova fatura
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {STAGES.map((s) => {
          const items = invoices.filter((i) => i.status === s);
          const sum = items.reduce((acc, i) => acc + i.total, 0);
          return (
            <Card key={s} accent={s === "overdue" ? "#b3354a" : undefined} className="p-3">
              <Badge tone={s}>{LABELS[s]}</Badge>
              <p className="mt-2 text-xl font-extrabold text-ink">{items.length}</p>
              <p className="text-xs font-semibold text-ink-soft">{formatGBP(sum)}</p>
            </Card>
          );
        })}
      </div>

      <Card accent="#b3354a" className="mt-4 border-rose-200 bg-rose-50/50 p-4">
        <p className="text-sm font-extrabold text-ink">
          {formatGBP(pending)} a receber · {overdue.length} vencida{overdue.length === 1 ? "" : "s"}
        </p>
        <p className="mt-1 text-[13px] text-ink-soft">
          {overdue.map((i) => `${i.number} · ${i.client_name}`).join(" · ") || "Nada vencido."}
        </p>
      </Card>

      <Card className="mt-4 p-4">
        <ListSearch defaultValue={q} placeholder="Pesquisar por cliente ou número" />
        {invoices.length === 0 ? (
          <EmptyState>Nenhuma fatura ainda. Gere a partir de um serviço concluído ou crie diretamente.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-mute">
                  <th className="py-2 pr-3 font-bold">Fatura</th>
                  <th className="py-2 pr-3 font-bold">Cliente</th>
                  <th className="py-2 pr-3 font-bold">Origem</th>
                  <th className="py-2 pr-3 font-bold">Vencimento</th>
                  <th className="py-2 pr-3 font-bold">Status</th>
                  <th className="py-2 text-right font-bold">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id} className="border-b border-line last:border-0">
                    <td className="py-3 pr-3 font-bold text-ink">
                      <Link href={`/faturas/${i.id}`} className="hover:underline">
                        {i.number}
                      </Link>
                    </td>
                    <td className="py-3 pr-3 text-ink-soft">{i.client_name}</td>
                    <td className="py-3 pr-3 text-[13px] text-ink-mute">{i.job_number ?? "Direta"}</td>
                    <td className="py-3 pr-3 text-[13px] text-ink-soft">{formatDateLondon(i.due_on)}</td>
                    <td className="py-3 pr-3">
                      <Badge tone={i.status}>{LABELS[i.status] ?? i.status}</Badge>
                    </td>
                    <td className="py-3 text-right font-bold text-ink">{formatGBP(i.total)}</td>
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
