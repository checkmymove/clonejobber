import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Box, ReceiptText, UserRound } from "lucide-react";
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
import { JobHeaderActions } from "@/components/jobs/job-actions";
import { NotesCard } from "@/components/funnel/notes-card";
import { SentCard } from "@/components/funnel/sent-card";
import { RouteEstimateCard } from "@/components/funnel/route-estimate-card";
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
import { JobExpensesCard } from "@/components/jobs/job-expenses-card";
import { listJobExpenses } from "@/lib/expenses/queries";
import { JobScheduleCard } from "@/components/jobs/job-schedule-card";
import { parseMoveClock } from "@/lib/funnel/engine";
import { LineItemsInlineCard } from "@/components/funnel/line-items-inline-card";
import { listProducts } from "@/lib/products/queries";
import { COMPANY_SLUG, getCompanyId } from "@/lib/company";
import { getJobLabour, getVisitMembers, listTeam } from "@/lib/team/queries";

export const dynamic = "force-dynamic";

function visitTime(v: JobVisit): string {
  if (v.later || !v.visit_date) return "Unscheduled";
  if (v.anytime || !v.start_time) return `${formatDateNumericLondon(v.visit_date)} · Anytime`;
  return `${formatDateNumericLondon(v.visit_date)} · ${v.start_time}${v.end_time ? `–${v.end_time}` : ""}`;
}

/** Estimated duration set on the request ("5" hours → 300 minutes); undefined when none is numeric. */
function estimatedMinutes(hours: string[]): number | undefined {
  const value = hours.map((h) => h.trim()).find((h) => /^\d+(\.\d+)?$/.test(h));
  const minutes = value ? Math.round(Number(value) * 60) : 0;
  return minutes > 0 ? minutes : undefined;
}

export default async function ServicoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const j = await getJobDetail(id);
  if (!j) notFound();

  const today = todayLondonInput();
  const [request, deposits, labour, team, visitMembers, client, companyId, emails, expenses] = await Promise.all([
    j.linked_request_id ? getRequestDetail(j.linked_request_id) : null,
    j.quote_id ? getQuoteDeposits(j.quote_id) : null,
    getJobLabour(j.id),
    listTeam(COMPANY_SLUG),
    getVisitMembers(j.visits.map((v) => v.id)),
    getClientContact(j.client_id),
    getCompanyId(),
    listDeliveries("job", j.id).catch(() => []),
    listJobExpenses(j.id),
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
  // The client approves the job itself (job page link sent by email & text).
  const approved = Boolean(j.approved_at);
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
            { label: "Client", value: j.client_name, icon: INFO_ICONS.client, href: `/clientes/${j.client_id}` },
            { label: "Phone", value: client.phone, icon: INFO_ICONS.phone },
            { label: "Email", value: client.email, icon: INFO_ICONS.email },
            j.quote_number
              ? { label: "Quote number", value: j.quote_number, icon: INFO_ICONS.quote }
              : { label: "Job number", value: j.number, icon: INFO_ICONS.quote },
            {
              label: "Job value",
              value: formatGBP(j.total),
              icon: INFO_ICONS.value,
              // Required deposit set on the quote; it comes off the invoice.
              note: deposits?.required
                ? `Deposit required ${formatGBP(deposits.required)}${
                    deposits.collected ? ` · ${formatGBP(Math.min(deposits.collected, deposits.required))} paid` : ""
                  } · deducted from the invoice`
                : undefined,
            },
            { label: "Move date & time", value: moveLabel, icon: INFO_ICONS.date },
          ]}
        />

        <JobScheduleCard
          jobId={j.id}
          jobLabel={`${j.client_name} - ${j.title || "Job"}`}
          visits={j.visits.map((v) => ({
            id: v.id,
            title: v.title,
            instructions: v.instructions,
            date: v.visit_date,
            start: v.start_time,
            end: v.end_time,
            anytime: v.anytime,
            later: v.later,
            status: v.status,
            confirmed: v.confirmed_by_client,
            memberIds: visitMembers.get(v.id)?.map((m) => m.id) ?? [],
            assigneeText: v.assignee,
          }))}
          team={team.filter((m) => m.active).map((m) => ({ id: m.id, name: m.name }))}
          defaults={{
            date: j.move_date ?? today,
            start: parseMoveClock(j.move_time),
            // Estimated hours from the request (e.g. 5 → end time = start + 5h).
            durationMinutes: estimatedMinutes(request?.estimated_hours ?? []),
          }}
          today={today}
          approved={approved}
        />

        {/* Same as the quote page: collection and delivery side by side, then the route estimate. */}
        {snapshot ? (
          <>
            <RequestLocationCard title="Collection address" snapshot={snapshot} kind="pickup" />
            <RequestLocationCard title="Delivery address" snapshot={snapshot} kind="delivery" />
          </>
        ) : (
          <>
            <AddressCard title="Collection address" address={j.pickup_address} />
            <AddressCard title="Delivery address" address={j.delivery_address} />
          </>
        )}
        <RouteEstimateCard collection={pickup} delivery={delivery} />

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

        <JobExpensesCard jobId={j.id} expenses={expenses} today={today} />

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
