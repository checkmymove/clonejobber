import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Box, CalendarDays, MapPin, Plus, ReceiptText, UserRound } from "lucide-react";
import { CardIcon } from "@/components/card-icon";
import { CollapsibleSection } from "@/components/collapsible-section";
import { INFO_ICONS, JobInfoStrip } from "@/components/jobs/job-info-strip";
import { ClickableRow } from "@/components/clickable-row";
import { formatDateNumericLondon, formatGBP, penceToInput, todayLondonInput } from "@/lib/format";
import { getJobDetail, type JobVisit } from "@/lib/jobs/queries";
import { JOB_STATUS_META } from "@/lib/jobs/status";
import { INVOICE_STATUS_META, deriveInvoiceStatus } from "@/lib/invoices/status";
import { getQuoteDeposits } from "@/lib/payments/queries";
import { getRequestDetail } from "@/lib/requests/queries";
import { requestSnapshotFromDetail } from "@/lib/requests/edit-snapshot";
import {
  PackingServiceCard,
  RemovalServiceCard,
  RequestInventoryCard,
  RequestLocationCard,
} from "@/components/requests/request-inline-cards";
import { hasRemovalService } from "@/lib/requests/edit-snapshot";
import { ClientContactCard } from "@/components/funnel/client-contact-card";
import { FunnelHistoryCard } from "@/components/funnel/funnel-history-card";
import { getClientContact } from "@/lib/clients/queries";
import { getActiveServices } from "@/lib/requests/company";
import { listDeliveries } from "@/lib/email/send";
import { JobHeaderActions, VisitDoneToggle } from "@/components/jobs/job-actions";
import { NotesCard } from "@/components/funnel/notes-card";
import { SentCard } from "@/components/funnel/sent-card";
import { StatusDot, StatusPill } from "@/components/funnel/list-kit";
import {
  AddressCard,
  CardTitle,
  LineItemsCard,
  dateOrDash,
  depositTotalRows,
  type TotalRow,
} from "@/components/funnel/document-cards";
import { Card, PageHeader, buttonOutline } from "@/components/ui";
import { LabourCard } from "@/components/team/labour-card";
import { LineItemsInlineCard } from "@/components/funnel/line-items-inline-card";
import { listProducts } from "@/lib/products/queries";
import { COMPANY_SLUG, getCompanyId } from "@/lib/company";
import { getJobLabour, getVisitMembers, listTeam } from "@/lib/team/queries";

export const dynamic = "force-dynamic";

function visitState(v: JobVisit, today: string): { label: string; dot: string } {
  if (v.status === "done") return { label: "Completed", dot: "bg-emerald-500" };
  if (v.status === "cancelled") return { label: "Cancelled", dot: "bg-stone-400" };
  if (v.later || !v.visit_date) return { label: "Unscheduled", dot: "bg-amber-400" };
  if (v.visit_date < today) return { label: "Overdue", dot: "bg-rose-500" };
  if (v.visit_date === today) return { label: "Today", dot: "bg-emerald-500" };
  return { label: "Scheduled", dot: "bg-sky-500" };
}

const MONTH = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });

/** Calendar leaf for a visit row: "Oct" over "30". */
function DateLeaf({ date }: { date: string | null }) {
  if (!date) return <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-cream text-xs text-ink-mute">—</span>;
  return (
    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-line bg-white leading-none">
      <span className="text-[11px] font-medium text-ink-soft">{MONTH.format(new Date(`${date}T12:00:00Z`))}</span>
      <span className="text-lg font-bold text-ink">{Number(date.slice(8, 10))}</span>
    </span>
  );
}

function visitTime(v: JobVisit): string {
  if (v.later || !v.visit_date) return "Unscheduled";
  if (v.anytime || !v.start_time) return `${formatDateNumericLondon(v.visit_date)} · Anytime`;
  return `${formatDateNumericLondon(v.visit_date)} · ${v.start_time}${v.end_time ? `–${v.end_time}` : ""}`;
}

export default async function ServicoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const j = await getJobDetail(id);
  if (!j) notFound();

  const today = todayLondonInput();
  const [request, deposits, labour, team, visitMembers, client, companyId, emails] = await Promise.all([
    j.linked_request_id ? getRequestDetail(j.linked_request_id) : null,
    j.quote_id ? getQuoteDeposits(j.quote_id) : null,
    getJobLabour(j.id),
    listTeam(COMPANY_SLUG),
    getVisitMembers(j.visits.map((v) => v.id)),
    getClientContact(j.client_id),
    getCompanyId(),
    listDeliveries("job", j.id).catch(() => []),
  ]);
  if (!client) notFound();
  const services = companyId ? await getActiveServices(companyId) : [];
  const catalog = (companyId ? await listProducts(companyId, "", "name", "asc") : []).map((p) => ({
    id: p.id,
    type: p.item_type,
    name: p.name,
    description: p.description,
    price: penceToInput(p.unit_price),
  }));

  const snapshot = request ? requestSnapshotFromDetail(request) : null;
  const meta = JOB_STATUS_META[j.list_status];
  const closed = j.status === "done" || j.status === "cancelled";

  const totals: TotalRow[] = [
    { label: "Subtotal", value: formatGBP(j.subtotal), muted: true },
    ...(j.discount ? [{ label: "Discount", value: `-${formatGBP(j.discount)}`, muted: true }] : []),
    ...(j.tax ? [{ label: "VAT", value: formatGBP(j.tax), muted: true }] : []),
    { label: "Total price", value: formatGBP(j.total), strong: true },
  ];
  if (deposits && (deposits.required || deposits.collected)) {
    totals.push(...depositTotalRows(deposits));
  }

  const firstVisit = j.visits.find((v) => v.status !== "cancelled" && !v.later && v.visit_date) ?? null;
  const moveLabel = firstVisit
    ? `${formatDateNumericLondon(firstVisit.visit_date as string)}${firstVisit.anytime || !firstVisit.start_time ? " · Anytime" : ` at ${firstVisit.start_time}`}`
    : "Not scheduled";
  const pickup = snapshot
    ? [snapshot.pickupAddress, snapshot.pickupPostcode].filter(Boolean).join(", ")
    : j.pickup_address;
  const delivery = snapshot
    ? [snapshot.deliveryAddress, snapshot.deliveryPostcode].filter(Boolean).join(", ")
    : j.delivery_address;
  const subtitle = [
    j.quote_number ? `From approved quote ${j.quote_number}` : null,
    j.title || null,
    firstVisit ? `Move on ${moveLabel}` : null,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <div>
      <PageHeader
        title={`${j.number} • ${j.client_name}`}
        subtitle={subtitle || "Job"}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <JobHeaderActions
              jobId={j.id}
              clientId={j.client_id}
              quoteId={j.quote_id}
              closed={closed}
              invoiceCount={j.invoice_count}
              sent={emails.some((e) => e.status === "sent")}
            />
            <Link href="/servicos" className={buttonOutline}>
              <ArrowLeft size={17} aria-hidden />
              Back
            </Link>
          </div>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <StatusPill badge={meta.badge} dot={meta.dot} label={meta.label} />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        <JobInfoStrip
          cells={[
            { label: "Client", value: j.client_name, icon: INFO_ICONS.client },
            { label: "Phone", value: client.phone, icon: INFO_ICONS.phone },
            { label: "Email", value: client.email, icon: INFO_ICONS.email },
            j.quote_number
              ? { label: "Quote number", value: j.quote_number, icon: INFO_ICONS.quote }
              : { label: "Job number", value: j.number, icon: INFO_ICONS.quote },
            { label: "Job value", value: formatGBP(j.total), icon: INFO_ICONS.value },
            { label: "Move date & time", value: moveLabel, icon: INFO_ICONS.date },
          ]}
        />

        <Card className="h-fit p-5 xl:col-span-2">
          <CardTitle
            icon={<CardIcon icon={CalendarDays} tone="blue" boxed />}
            action={
              <Link
                href={`/servicos/${j.id}/editar`}
                aria-label="Edit schedule"
                className="grid h-8 w-8 place-items-center rounded-lg border border-line text-ink-soft hover:bg-cream hover:text-ink"
              >
                <Plus size={15} />
              </Link>
            }
          >
            Schedule
          </CardTitle>
          {j.visits.length === 0 ? (
            <p className="text-sm text-ink-mute">No visits. Add one to put this job on the schedule.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full fit-table text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs font-medium text-ink-soft">
                    <th className="w-10 py-2" />
                    <th className="py-2 pr-4 font-medium">Date and time</th>
                    <th className="py-2 pr-4 font-medium">Title and instructions</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 font-medium">Assigned</th>
                  </tr>
                </thead>
                <tbody>
                  {j.visits.map((v) => {
                    const state = visitState(v, today);
                    return (
                      <tr key={v.id} className="border-b border-line align-middle last:border-0">
                        <td className="py-3">
                          <VisitDoneToggle visitId={v.id} done={v.status === "done"} />
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap text-ink">
                          <span className="flex items-center gap-3">
                            <DateLeaf date={v.later ? null : v.visit_date} />
                            <span>
                              {visitTime(v)}
                              {v.confirmed_by_client ? (
                                <span className="block text-xs text-emerald-700">Confirmed by client</span>
                              ) : null}
                            </span>
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <p className="font-semibold text-ink">
                            {v.title || `${j.client_name} - ${j.title || "Job"}`}
                          </p>
                          {v.instructions ? (
                            <p className="line-clamp-2 whitespace-pre-wrap text-ink-soft">{v.instructions}</p>
                          ) : null}
                        </td>
                        <td className="py-3 pr-4">
                          <StatusDot dot={state.dot} label={state.label} />
                        </td>
                        <td data-label="Assigned" className="py-3 text-ink-soft">
                          {visitMembers.get(v.id)?.map((m) => m.name).join(", ") || v.assignee || "Unassigned"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <LabourCard
          jobId={j.id}
          labour={labour}
          team={team}
          visits={j.visits
            .filter((v) => v.status !== "cancelled")
            .map((v) => ({ id: v.id, label: visitTime(v) }))}
          today={today}
          serverNow={new Date().toISOString()}
        />

        <Card className="h-fit p-5 xl:col-span-2">
          <CardTitle
            icon={<CardIcon icon={ReceiptText} tone="emerald" boxed />}
            action={
              <Link
                href={`/faturas/novo?jobId=${j.id}`}
                className="inline-flex h-9 items-center rounded-lg border border-line px-3 text-sm font-semibold text-ink hover:bg-cream"
              >
                New invoice
              </Link>
            }
          >
            Billing
          </CardTitle>
          <p className="mb-3 text-sm text-ink-soft">
            Reminders: {j.remind_invoice ? "when the job is marked closed" : "off"}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full fit-table text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs font-semibold text-ink-mute">
                  <th className="py-2 pr-4 font-semibold">Invoice</th>
                  <th className="py-2 pr-4 font-semibold">Due date</th>
                  <th className="py-2 pr-4 font-semibold">Status</th>
                  <th className="py-2 pr-4 font-semibold">Subject</th>
                  <th className="py-2 pr-4 text-right font-semibold">Total</th>
                  <th className="py-2 text-right font-semibold">Balance</th>
                </tr>
              </thead>
              <tbody>
                {j.invoices.map((inv) => {
                  const s = INVOICE_STATUS_META[deriveInvoiceStatus(inv.status, inv.due_on, today)];
                  const href = `/faturas/${inv.id}`;
                  return (
                    <ClickableRow key={inv.id} href={href}>
                      <td className="py-3 pr-4">
                        <Link href={href} className="font-semibold text-accent hover:underline">
                          {inv.number}
                        </Link>
                      </td>
                      <td data-label="Due" className="py-3 pr-4 text-ink-soft">{dateOrDash(inv.due_on)}</td>
                      <td className="py-3 pr-4">
                        <StatusDot dot={s.dot} label={s.label} />
                      </td>
                      <td className="py-3 pr-4 text-ink">{inv.subject}</td>
                      <td data-label="Total" className="py-3 pr-4 text-right text-ink">{formatGBP(inv.total)}</td>
                      <td className="py-3 text-right font-semibold text-ink">{formatGBP(inv.balance)}</td>
                    </ClickableRow>
                  );
                })}
                {j.invoices.length === 0 && j.remind_invoice ? (
                  <tr>
                    <td className="py-3 pr-4">
                      <Link
                        href={`/faturas/novo?jobId=${j.id}`}
                        className="inline-flex h-8 items-center rounded-lg border border-line px-3 text-xs font-bold text-accent hover:bg-accent-soft"
                      >
                        Create
                      </Link>
                    </td>
                    <td data-label="Due" className="py-3 pr-4 text-ink-soft">—</td>
                    <td className="py-3 pr-4">
                      <StatusDot
                        dot={closed ? "bg-amber-400" : "bg-stone-300"}
                        label={closed ? "Requires invoicing" : "Upcoming"}
                      />
                    </td>
                    <td className="py-3 pr-4 text-ink">For Services Rendered</td>
                    <td data-label="Total" className="py-3 pr-4 text-right text-ink">{formatGBP(j.total)}</td>
                    <td className="py-3 text-right font-semibold text-ink">{formatGBP(j.total)}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {j.invoices.length === 0 && !j.remind_invoice ? (
            <p className="mt-2 text-sm text-ink-mute">No invoices yet.</p>
          ) : null}
        </Card>

        <CollapsibleSection
          id="job-customer"
          title="Customer & Summary"
          icon={<UserRound size={22} strokeWidth={1.6} className="shrink-0 text-[#1d4ed8]" aria-hidden />}
          summary={[j.client_name, client.phone, client.email].filter(Boolean).join(" • ")}
        >
          <ClientContactCard client={client} address={j.pickup_address || j.client_address} />
          <FunnelHistoryCard
            clientId={j.client_id}
            requestId={j.linked_request_id}
            quoteId={j.quote_id}
            jobId={j.id}
            currentId={j.id}
          />
        </CollapsibleSection>

        <CollapsibleSection
          id="job-addresses"
          title="Addresses"
          icon={<MapPin size={22} strokeWidth={1.6} className="shrink-0 text-emerald-600" aria-hidden />}
          summary={
            <>
              {pickup || "—"} <span className="px-1 text-ink">→</span> {delivery || "—"}
            </>
          }
        >
          {snapshot ? (
            <>
              <RequestLocationCard title="Collection Information" snapshot={snapshot} kind="pickup" />
              <RequestLocationCard title="Delivery Information" snapshot={snapshot} kind="delivery" />
            </>
          ) : (
            <>
              <AddressCard title="Collection Information" address={j.pickup_address} />
              <AddressCard title="Delivery Information" address={j.delivery_address} />
            </>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          id="job-services"
          title="Services"
          icon={<Box size={22} strokeWidth={1.6} className="shrink-0 text-[#1d4ed8]" aria-hidden />}
          summary={[
            `${j.lines.length} item${j.lines.length === 1 ? "" : "s"}`,
            ...j.lines.slice(0, 2).map((l) => l.name),
            formatGBP(j.total),
          ].join(" • ")}
        >
          {snapshot && request ? (
            hasRemovalService(snapshot) ? (
              <>
                <RemovalServiceCard snapshot={snapshot} services={services} half />
                <PackingServiceCard snapshot={snapshot} half />
              </>
            ) : (
              <PackingServiceCard snapshot={snapshot} />
            )
          ) : null}
          <LineItemsInlineCard
            kind="job"
            id={j.id}
            lines={j.lines}
            totals={totals}
            catalog={catalog}
            note={
              j.invoices.length
                ? `This job already has ${j.invoices.map((i) => i.number).join(", ")}. Changing the lines here does not change the invoice; edit it on the invoice page too.`
                : undefined
            }
          />
        </CollapsibleSection>

        {snapshot && request ? <RequestInventoryCard snapshot={snapshot} files={request.files} /> : null}
        <NotesCard kind="job" id={j.id} notes={j.notes} />
        <SentCard kind="job" id={j.id} />
      </div>
    </div>
  );
}
