import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDateLondon } from "@/lib/format";
import { COMPANY_SLUG, getCompanyId } from "@/lib/company";
import { updateRequestStatus } from "@/lib/requests/actions";
import { createAssessment } from "@/lib/clients/crm-actions";
import { getRequestDetail } from "@/lib/requests/queries";
import { requestSnapshotFromDetail } from "@/lib/requests/edit-snapshot";
import { getActiveServices } from "@/lib/requests/company";
import {
  RequestContactCard,
  RequestInventoryCard,
  RequestLocationCard,
  RequestPackingCard,
} from "@/components/requests/request-inline-cards";
import { Badge, Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  review: "Awaiting review",
  quoted: "Quoted",
  archived: "Closed / archived",
};

export default async function SolicitacaoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const r = await getRequestDetail(id);
  if (!r) notFound();
  const companyId = await getCompanyId(COMPANY_SLUG);
  const services = companyId ? await getActiveServices(companyId) : [];
  const snapshot = requestSnapshotFromDetail(r);

  return (
    <div>
      <PageHeader
        title={`${r.number} · ${r.client_name}`}
        subtitle={`Received on ${formatDateLondon(r.submitted_at)}${r.move_date ? ` · move on ${formatDateLondon(r.move_date)}${r.move_time ? ` at ${r.move_time}` : ""}` : " · no date set"}`}
        action={
          <div className="flex gap-2">
            <Link
              href={`/cotacoes/novo?requestId=${r.id}`}
              className="inline-flex h-10 items-center rounded-xl bg-ink px-4 text-sm font-bold text-white hover:opacity-90"
            >
              Convert to Quote
            </Link>
            <Link
              href={`/clientes/${r.client_id}`}
              className="inline-flex h-10 items-center rounded-xl border border-line bg-card px-4 text-sm font-bold text-accent hover:bg-accent-soft"
            >
              View client
            </Link>
            <Link
              href="/solicitacoes"
              className="inline-flex h-10 items-center rounded-xl border border-line bg-card px-4 text-sm font-bold text-ink hover:bg-cream"
            >
              ← Voltar
            </Link>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={r.status}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
        <form
          action={async () => {
            "use server";
            await createAssessment(id);
          }}
        >
          <button
            type="submit"
            className="h-9 rounded-xl bg-accent px-3 text-sm font-bold text-white hover:opacity-90"
            title="Creates an on-site assessment linked to the client and the request"
          >
            Schedule Assessment
          </button>
        </form>
        <StatusChanger id={r.id} current={r.status} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <RequestContactCard
          requestId={r.id}
          clientId={r.client_id}
          firstName={r.client_first_name}
          lastName={r.client_last_name}
          companyName={r.company_name ?? ""}
          email={r.client_email}
          phone={r.client_phone}
          leadSource={r.lead_source ?? "—"}
          marketingEmail={r.marketing_email}
          marketingSms={r.marketing_sms}
        />
        <RequestPackingCard snapshot={snapshot} services={services} />
        <RequestLocationCard title="Collection Information" snapshot={snapshot} kind="pickup" />
        <RequestLocationCard title="Delivery Information" snapshot={snapshot} kind="delivery" />
        <RequestInventoryCard snapshot={snapshot} files={r.files} />

        <Card className="h-fit p-5 xl:col-span-2">
          <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">
            Timeline
          </h2>
          <div className="space-y-2 text-sm">
            {r.timeline.map((t, i) => (
              <p key={i} className="flex justify-between gap-4">
                <span className="text-ink">{t.summary}</span>
                <span className="shrink-0 text-xs text-ink-mute">
                  {formatDateLondon(t.created_at)}
                </span>
              </p>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatusChanger({ id, current }: { id: string; current: string }) {
  return (
    <form
      action={async (fd: FormData) => {
        "use server";
        const status = String(fd.get("status") ?? "");
        await updateRequestStatus(id, status);
      }}
      className="flex items-center gap-2"
    >
      <select
        name="status"
        defaultValue={current}
        className="h-9 rounded-xl border border-line bg-white px-2 text-sm font-semibold text-ink"
        aria-label="Change status"
      >
        {Object.entries(STATUS_LABEL).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="h-9 rounded-xl bg-ink px-3 text-sm font-bold text-white hover:opacity-90"
      >
        Save status
      </button>
    </form>
  );
}
