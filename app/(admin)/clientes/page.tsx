import Link from "next/link";
import { formatDateLondon } from "@/lib/format";
import { listClients } from "@/lib/clients/queries";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const rows = await listClients("moving-london", q);

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle={`${rows.length} cliente(s) · busca por nome, e-mail ou telefone`}
        action={
          <Link
            href="/clientes/novo"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-bold text-white hover:opacity-90"
          >
            + Novo cliente
          </Link>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <Card className="p-4">
          <form method="get" className="flex gap-2">
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Pesquisar por nome, e-mail ou telefone"
              aria-label="Pesquisar clientes"
              className="h-10 w-full rounded-xl border border-line bg-card px-3 text-sm text-ink outline-none focus:border-accent"
            />
            <button
              type="submit"
              className="h-10 shrink-0 rounded-xl bg-ink px-4 text-sm font-bold text-white hover:opacity-90"
            >
              Buscar
            </button>
          </form>

          {rows.length === 0 ? (
            <div className="mt-3">
              <EmptyState>
                {q
                  ? `Nenhum cliente para “${q}”.`
                  : "Nenhum cliente ainda — envie o formulário público ou cadastre manualmente."}
              </EmptyState>
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-mute">
                    <th className="py-2 pr-3 font-bold">Cliente</th>
                    <th className="py-2 pr-3 font-bold">Contato</th>
                    <th className="py-2 pr-3 font-bold">Funil</th>
                    <th className="py-2 text-right font-bold">Desde</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id} className="border-b border-line last:border-0">
                      <td className="py-3 pr-3">
                        <Link
                          href={`/clientes/${c.id}`}
                          className="font-bold text-ink hover:underline"
                        >
                          {c.first_name} {c.last_name}
                        </Link>
                        {c.company_name ? (
                          <p className="text-xs text-ink-mute">{c.company_name}</p>
                        ) : null}
                      </td>
                      <td className="py-3 pr-3 text-[13px] text-ink-soft">
                        <p className="truncate">{c.email}</p>
                        <p>{c.phone}</p>
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex flex-wrap gap-1">
                          <Badge tone="review">{c.requests_count} sol.</Badge>
                          <Badge tone="draft">{c.quotes_count} cot.</Badge>
                          <Badge tone="scheduled">{c.jobs_count} serv.</Badge>
                          <Badge tone="sent">{c.invoices_count} fat.</Badge>
                        </div>
                      </td>
                      <td className="py-3 text-right text-[13px] text-ink-soft">
                        {formatDateLondon(c.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="h-fit p-4">
          <h2 className="font-extrabold text-ink">Últimos clientes</h2>
          <div className="mt-3 space-y-3">
            {rows.slice(0, 5).map((c) => (
              <Link
                key={c.id}
                href={`/clientes/${c.id}`}
                className="flex items-center gap-3"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cream text-xs font-black text-ink">
                  {c.first_name.charAt(0)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">
                    {c.first_name} {c.last_name}
                  </p>
                  <p className="text-xs text-ink-mute">
                    {formatDateLondon(c.created_at)}
                  </p>
                </div>
              </Link>
            ))}
            {rows.length === 0 ? (
              <p className="text-sm text-ink-mute">Nada por aqui ainda.</p>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
