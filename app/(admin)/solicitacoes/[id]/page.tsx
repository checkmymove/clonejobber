import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, FileText } from "lucide-react";
import { CARD_TITLE, CardIcon } from "@/components/card-icon";
import { formatDateLondon } from "@/lib/format";
import { COMPANY_SLUG, getCompanyId } from "@/lib/company";
import { sql } from "@/lib/db";
import { updateRequestStatus } from "@/lib/requests/actions";
import { getRequestDetail } from "@/lib/requests/queries";
import { requestSnapshotFromDetail } from "@/lib/requests/edit-snapshot";
import { getActiveServices } from "@/lib/requests/company";
import {
  PackingServiceCard,
  RemovalServiceCard,
  RequestContactCard,
  RequestInventoryCard,
  RequestLocationCard,
  RequestMovingCard,
} from "@/components/requests/request-inline-cards";
import { hasRemovalService } from "@/lib/requests/edit-snapshot";
import { FunnelHistoryCard } from "@/components/funnel/funnel-history-card";
import { RequestMoreMenu } from "@/components/requests/request-actions";
import { SentCard } from "@/components/funnel/sent-card";
import { RouteEstimateCard } from "@/components/funnel/route-estimate-card";
import { Badge, Card, buttonDark, buttonOutline } from "@/components/ui";
import { ShellPageHeader } from "@/components/layout/shell-header";

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
  const requestQuote = await sql<{ id: string }[]>`
    select id from quotes where request_id = ${r.id} order by created_at desc limit 1
  `;
  const snapshot = requestSnapshotFromDetail(r);

  return (
    <div>
      <ShellPageHeader
        title={`${r.number} · ${r.client_name}`}
        subtitle={`Received on ${formatDateLondon(r.submitted_at)}${r.move_date ? ` · Move on ${formatDateLondon(r.move_date)}${r.move_time ? ` at ${r.move_time}` : ""}` : " · No date set"}`}
      >
        <div className="flex flex-wrap gap-2">
          <RequestMoreMenu requestId={r.id} clientId={r.client_id} quoteId={requestQuote[0]?.id ?? null} />
          <Link href={`/cotacoes/novo?requestId=${r.id}`} className={buttonDark}>
            <FileText size={17} aria-hidden />
            Convert to Quote
          </Link>
          <Link href="/solicitacoes" className={buttonOutline}>
            <ArrowLeft size={17} aria-hidden />
            Back
          </Link>
        </div>
      </ShellPageHeader>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Badge tone={r.status} size="lg">
          {STATUS_LABEL[r.status] ?? r.status}
        </Badge>
        <StatusChanger id={r.id} current={r.status} />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
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
        <FunnelHistoryCard clientId={r.client_id} requestId={r.id} currentId={r.id} />
        <RequestLocationCard title="Collection Information" snapshot={snapshot} kind="pickup" />
        <RequestLocationCard title="Delivery Information" snapshot={snapshot} kind="delivery" />
        <RouteEstimateCard
          collection={[snapshot.pickupAddress, snapshot.pickupPostcode].filter(Boolean).join(", ")}
          delivery={[snapshot.deliveryAddress, snapshot.deliveryPostcode].filter(Boolean).join(", ")}
        />
        <RequestMovingCard snapshot={snapshot} />
        {hasRemovalService(snapshot) ? (
          <>
            <RemovalServiceCard snapshot={snapshot} services={services} half />
            <PackingServiceCard snapshot={snapshot} half />
          </>
        ) : (
          <PackingServiceCard snapshot={snapshot} />
        )}
        <RequestInventoryCard snapshot={snapshot} files={r.files} />
        <SentCard kind="request" id={r.id} />

        <Card className="h-fit p-5 xl:col-span-2">
          <div className="flex items-center gap-3">
            <CardIcon icon={Clock} tone="violet" boxed />
            <h2 className={CARD_TITLE}>Timeline</h2>
          </div>
          <ol className="mt-4 pl-4">
            {r.timeline.map((t, i) => (
              <li key={i} className="relative flex justify-between gap-4 pb-4 pl-6 text-sm last:pb-0">
                {i < r.timeline.length - 1 ? (
                  <span aria-hidden className="absolute left-[5px] top-4 h-full w-px bg-line" />
                ) : null}
                <span aria-hidden className="absolute left-0 top-1.5 h-[11px] w-[11px] rounded-full bg-blue-600" />
                <span className="text-ink">{t.summary}</span>
                <span className="shrink-0 text-ink-soft">{formatDateLondon(t.created_at)}</span>
              </li>
            ))}
          </ol>
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
        className="h-10 min-w-[160px] rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-[#1d4ed8]"
        aria-label="Change status"
      >
        {Object.entries(STATUS_LABEL).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <button type="submit" className={buttonDark}>
        Save status
      </button>
    </form>
  );
}
