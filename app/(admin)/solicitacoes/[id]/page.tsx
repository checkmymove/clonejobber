import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDateLondon } from "@/lib/format";
import { updateRequestStatus } from "@/lib/requests/actions";
import { createAssessment } from "@/lib/clients/crm-actions";
import { getRequestDetail } from "@/lib/requests/queries";
import { Badge, Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  new: "Nova",
  review: "Awaiting review",
  quoted: "Cotada",
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

  const contactRows: [string, string][] = [
    ["Name", r.client_name],
    ["Email", r.client_email],
    ["Phone", r.client_phone],
    ["Heard via", r.lead_source ?? "—"],
    ["Marketing email", r.marketing_email ? "Yes" : "No"],
    ["Marketing SMS", r.marketing_sms ? "Yes" : "No"],
  ];
  if (r.company_name) contactRows.splice(1, 0, ["Company", r.company_name]);

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
              Create quote
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
        <Card className="h-fit p-5">
          <SectionTitle>Contact Information</SectionTitle>
          <Dl rows={contactRows} />
        </Card>

        <Card className="h-fit p-5">
          <SectionTitle>Packing Service</SectionTitle>
          <Dl
            rows={[
              ["Packing services", r.needs_packing_service ? "Yes" : "No"],
              ["Packing materials", r.needs_packing_materials ? "Yes" : "No"],
            ]}
          />
          <SectionTitle>Service Details</SectionTitle>
          <ul className="mt-1 space-y-1 text-sm">
            {r.service_names.map((s) => (
              <li key={s} className="flex items-center gap-2 text-ink">
                <span className="font-bold text-emerald-700">✓</span> {s}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-ink-soft">
            Hours: <span className="font-semibold text-ink">{r.estimated_hours.join(", ")}</span>
          </p>
        </Card>

        <Card className="h-fit p-5">
          <SectionTitle>Collection Information</SectionTitle>
          <Dl
            rows={[
              ["Address", `${r.pickup_address}, ${r.pickup_postcode}`],
              ["Floor", r.pickup_floor ?? "—"],
              ["Lift", r.pickup_has_lift ? "Yes" : "No"],
              ["Parking", r.pickup_parking ?? "—"],
              ["Bedrooms", String(r.pickup_bedrooms ?? "—")],
            ]}
          />
        </Card>

        <Card className="h-fit p-5">
          <SectionTitle>Delivery Information</SectionTitle>
          <Dl
            rows={[
              ["Address", `${r.delivery_address}, ${r.delivery_postcode}`],
              ["Floor", r.delivery_floor ?? "—"],
              ["Lift", r.delivery_has_lift ? "Yes" : "No"],
              ["Parking", r.delivery_parking ?? "—"],
              ["Bedrooms", String(r.delivery_bedrooms ?? "—")],
            ]}
          />
        </Card>

        <Card className="h-fit p-5 xl:col-span-2">
          <SectionTitle>Inventory List</SectionTitle>
          <p className="whitespace-pre-wrap text-sm text-ink">
            {r.inventory_description}
          </p>
          {r.files.length > 0 ? (
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {r.files.map((f) => (
                <a
                  key={f.id}
                  href={`/api/requests/${r.id}/files/${f.id}`}
                  target="_blank"
                  rel="noreferrer"
                  title={f.file_name}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/requests/${r.id}/files/${f.id}`}
                    alt={f.file_name}
                    className="aspect-square w-full rounded-lg border border-line object-cover"
                    loading="lazy"
                  />
                </a>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-ink-mute">No images attached.</p>
          )}
        </Card>

        <Card className="h-fit p-5 xl:col-span-2">
          <SectionTitle>Timeline</SectionTitle>
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">
      {children}
    </h2>
  );
}

function Dl({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="text-sm">
      {rows.map(([k, v]) => (
        <p key={k} className="flex justify-between gap-4 py-0.5">
          <dt className="text-ink-soft">{k}</dt>
          <dd className="text-right font-semibold text-ink">{v}</dd>
        </p>
      ))}
    </dl>
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
