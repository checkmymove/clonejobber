import Link from "next/link";
import { notFound } from "next/navigation";
import { formatGBP, formatDateLondon } from "@/lib/format";
import { getJobDetail } from "@/lib/jobs/queries";
import { updateJobStatus } from "@/lib/jobs/actions";
import { convertJobToInvoice } from "@/lib/invoices/actions";
import { Badge, Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = {
  scheduled: "Agendado",
  in_progress: "Em andamento",
  done: "Concluído",
  cancelled: "Cancelado",
};

export default async function ServicoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const j = await getJobDetail(id);
  if (!j) notFound();

  const window =
    j.anytime ? "Anytime" : `${j.window_start || "—"} – ${j.window_end || "—"}`;

  return (
    <div>
      <PageHeader
        title={`${j.number} · ${j.client_name}`}
        subtitle={j.title || "Serviço"}
        action={
          <Link
            href="/servicos"
            className="inline-flex h-10 items-center rounded-xl border border-line bg-card px-4 text-sm font-bold text-ink hover:bg-cream"
          >
            ← Voltar
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={j.status}>{LABELS[j.status] ?? j.status}</Badge>
        {j.status !== "cancelled" && j.status !== "done" ? (
          <Link
            href={`/servicos/${id}/editar`}
            className="h-9 rounded-xl border border-line bg-card px-3 text-sm font-bold leading-9 text-ink hover:bg-cream"
          >
            Editar
          </Link>
        ) : null}
        {j.status === "scheduled" ? (
          <StatusForm id={id} status="in_progress" label="Iniciar" />
        ) : null}
        {j.status === "scheduled" || j.status === "in_progress" ? (
          <StatusForm id={id} status="done" label="Concluir" />
        ) : null}
        {j.status !== "cancelled" && j.status !== "done" ? (
          <StatusForm id={id} status="cancelled" label="Cancelar" />
        ) : null}
        {j.status === "done" ? (
          <form
            action={async () => {
              "use server";
              await convertJobToInvoice(id);
            }}
          >
            <button type="submit" className="h-9 rounded-xl bg-ink px-3 text-sm font-bold text-white hover:opacity-90">
              Gerar fatura
            </button>
          </form>
        ) : null}
        <Link
          href={`/clientes/${j.client_id}`}
          className="h-9 rounded-xl border border-line px-3 text-sm font-bold leading-9 text-accent hover:bg-accent-soft"
        >
          Ver cliente
        </Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="h-fit p-5">
          <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">Agenda</h2>
          <dl className="text-sm">
            <Row k="Data" v={j.scheduled_date ? formatDateLondon(j.scheduled_date) : "Agendar mais tarde"} />
            <Row k="Janela" v={window} />
            <Row k="Coleta" v={j.pickup_address || "—"} />
            <Row k="Entrega" v={j.delivery_address || "—"} />
            <Row k="Cotação" v={j.quote_number ?? "Direta"} />
            <Row k="Total" v={formatGBP(j.total)} />
          </dl>
        </Card>
        <Card className="h-fit p-5">
          <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">Visitas</h2>
          <div className="space-y-2 text-sm">
            {j.visits.map((v) => (
              <p key={v.id} className="rounded-xl border border-line p-3">
                <span className="font-bold text-ink">{v.visit_date ? formatDateLondon(v.visit_date) : "Sem data"}</span>
                <span className="text-ink-soft">
                  {" "}
                  · {v.anytime ? "Anytime" : `${v.start_time || "—"}–${v.end_time || "—"}`}
                </span>
                {v.instructions ? <span className="mt-1 block text-ink-soft">{v.instructions}</span> : null}
              </p>
            ))}
          </div>
        </Card>
        <Card className="h-fit p-5 xl:col-span-2">
          <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">Itens</h2>
          {j.lines.map((l, i) => (
            <div key={i} className="flex justify-between gap-3 border-b border-line py-2 text-sm last:border-0">
              <div>
                <p className="font-bold text-ink">{l.name}</p>
                <p className="text-xs text-ink-mute">
                  {l.quantity} × {formatGBP(l.unitPrice)}
                </p>
              </div>
              <p className="font-bold text-ink">{formatGBP(l.total)}</p>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <p className="flex justify-between gap-4 py-0.5">
      <span className="text-ink-soft">{k}</span>
      <span className="text-right font-semibold text-ink">{v}</span>
    </p>
  );
}

function StatusForm({
  id,
  status,
  label,
}: {
  id: string;
  status: "scheduled" | "in_progress" | "done" | "cancelled";
  label: string;
}) {
  return (
    <form
      action={async () => {
        "use server";
        await updateJobStatus(id, status);
      }}
    >
      <button type="submit" className="h-9 rounded-xl border border-line bg-card px-3 text-sm font-bold text-ink hover:bg-cream">
        {label}
      </button>
    </form>
  );
}
