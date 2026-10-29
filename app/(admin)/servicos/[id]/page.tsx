import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { ClickableRow } from "@/components/clickable-row";
import { formatDateNumericLondon, formatGBP, todayLondonInput } from "@/lib/format";
import { getJobDetail, type JobVisit } from "@/lib/jobs/queries";
import { JOB_STATUS_META } from "@/lib/jobs/status";
import { INVOICE_STATUS_META, deriveInvoiceStatus } from "@/lib/invoices/status";
import { getQuoteDeposits } from "@/lib/payments/queries";
import { getRequestDetail } from "@/lib/requests/queries";
import { requestSnapshotFromDetail } from "@/lib/requests/edit-snapshot";
import {
  RequestInventoryCard,
  RequestLocationCard,
} from "@/components/requests/request-inline-cards";
import { JobHeaderActions, VisitDoneToggle } from "@/components/jobs/job-actions";
import { NotesCard } from "@/components/funnel/notes-card";
import { SentCard } from "@/components/funnel/sent-card";
import { StatusDot, StatusPill } from "@/components/funnel/list-kit";
import {
  AddressCard,
  CardTitle,
  ClientBox,
  DetailRows,
  LineItemsCard,
  dateOrDash,
  depositTotalRows,
  type TotalRow,
} from "@/components/funnel/document-cards";
import { Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

function visitState(v: JobVisit, today: string): { label: string; dot: string } {
  if (v.status === "done") return { label: "Completed", dot: "bg-emerald-500" };
  if (v.status === "cancelled") return { label: "Cancelled", dot: "bg-stone-400" };
  if (v.later || !v.visit_date) return { label: "Unscheduled", dot: "bg-amber-400" };
  if (v.visit_date < today) return { label: "Overdue", dot: "bg-rose-500" };
  if (v.visit_date === today) return { label: "Today", dot: "bg-emerald-500" };
  return { label: "Scheduled", dot: "bg-sky-500" };
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
  const [request, deposits] = await Promise.all([
    j.linked_request_id ? getRequestDetail(j.linked_request_id) : null,
    j.quote_id ? getQuoteDeposits(j.quote_id) : null,
  ]);
  const snapshot = request ? requestSnapshotFromDetail(request) : null;
  const meta = JOB_STATUS_META[j.list_status];
  const closed = j.status === "done" || j.status === "cancelled";
  const dated = j.visits.filter((v) => v.visit_date && !v.later).map((v) => v.visit_date as string).sort();

  const totals: TotalRow[] = [
    { label: "Subtotal", value: formatGBP(j.subtotal), muted: true },
    ...(j.discount ? [{ label: "Discount", value: `-${formatGBP(j.discount)}`, muted: true }] : []),
    ...(j.tax ? [{ label: "VAT", value: formatGBP(j.tax), muted: true }] : []),
    { label: "Total price", value: formatGBP(j.total), strong: true },
  ];
  if (deposits && (deposits.required || deposits.collected)) {
    totals.push(...depositTotalRows(deposits));
  }

  return (
    <div>
      <PageHeader
        title={`${j.number} · ${j.client_name}`}
        subtitle={j.title || "Job"}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/servicos"
              className="inline-flex h-10 items-center rounded-xl border border-line bg-card px-4 text-sm font-bold text-ink hover:bg-cream"
            >
              ← Back
            </Link>
            <JobHeaderActions
              jobId={j.id}
              clientId={j.client_id}
              quoteId={j.quote_id}
              closed={closed}
              invoiceCount={j.invoice_count}
            />
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusPill badge={meta.badge} dot={meta.dot} label={meta.label} />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <ClientBox
          clientId={j.client_id}
          name={j.client_name}
          address={j.pickup_address || j.client_address}
          phone={j.client_phone}
          email={j.client_email}
        />
        <DetailRows
          title="Job details"
          rows={[
            ["Job #", j.number],
            ["Job type", "One-off job"],
            ["Started on", dateOrDash(dated[0])],
            ["Ends on", dateOrDash(dated[dated.length - 1])],
            ["Billing frequency", "Upon job completion"],
            ["Invoice reminder", j.remind_invoice ? "When the job is marked closed" : "Off"],
            ...(j.closed_at ? ([["Marked closed", dateOrDash(j.closed_at)]] as [string, string][]) : []),
            [
              "From quote",
              j.quote_id ? (
                <Link href={`/cotacoes/${j.quote_id}`} className="text-accent underline">
                  {j.quote_number}
                </Link>
              ) : (
                "—"
              ),
            ],
            [
              "From request",
              j.linked_request_id ? (
                <Link href={`/solicitacoes/${j.linked_request_id}`} className="text-accent underline">
                  {j.request_number}
                  {j.request_submitted_at ? ` · ${formatDateNumericLondon(j.request_submitted_at)}` : ""}
                </Link>
              ) : (
                "—"
              ),
            ],
          ]}
        />

        {snapshot && request ? (
          <>
            <RequestLocationCard title="Collection Information" snapshot={snapshot} kind="pickup" />
            <RequestLocationCard title="Delivery Information" snapshot={snapshot} kind="delivery" />
            <RequestInventoryCard snapshot={snapshot} files={request.files} />
          </>
        ) : (
          <>
            <AddressCard title="Collection Information" address={j.pickup_address} />
            <AddressCard title="Delivery Information" address={j.delivery_address} />
          </>
        )}

        <LineItemsCard
          lines={j.lines}
          totals={totals}
          action={
            <Link
              href={`/servicos/${j.id}/editar`}
              aria-label="Edit line items"
              className="grid h-7 w-7 place-items-center rounded-lg text-ink-soft hover:bg-cream hover:text-ink"
            >
              <Pencil size={14} />
            </Link>
          }
        />

        <Card className="h-fit p-5 xl:col-span-2">
          <CardTitle
            action={
              <Link
                href={`/servicos/${j.id}/editar`}
                aria-label="Add or edit visits"
                className="grid h-7 w-7 place-items-center rounded-lg border border-line text-ink-soft hover:bg-cream hover:text-ink"
              >
                <Plus size={14} />
              </Link>
            }
          >
            Visits
          </CardTitle>
          {j.visits.length === 0 ? (
            <p className="text-sm text-ink-mute">No visits. Add one to put this job on the schedule.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs font-semibold text-ink-mute">
                    <th className="w-10 py-2" />
                    <th className="py-2 pr-4 font-semibold">Date and time</th>
                    <th className="py-2 pr-4 font-semibold">Title and instructions</th>
                    <th className="py-2 pr-4 font-semibold">Status</th>
                    <th className="py-2 font-semibold">Assigned</th>
                  </tr>
                </thead>
                <tbody>
                  {j.visits.map((v) => {
                    const state = visitState(v, today);
                    return (
                      <tr key={v.id} className="border-b border-line align-top last:border-0">
                        <td className="py-3">
                          <VisitDoneToggle visitId={v.id} done={v.status === "done"} />
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap text-ink">
                          {visitTime(v)}
                          {v.confirmed_by_client ? (
                            <span className="block text-xs text-emerald-700">Confirmed by client</span>
                          ) : null}
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
                        <td className="py-3 text-ink-soft">{v.assignee || "Unassigned"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="h-fit p-5 xl:col-span-2">
          <CardTitle
            action={
              <Link
                href={`/faturas/novo?jobId=${j.id}`}
                className="inline-flex h-8 items-center rounded-lg border border-line px-3 text-xs font-bold text-ink hover:bg-cream"
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
            <table className="w-full min-w-[640px] text-left text-sm">
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
                      <td className="py-3 pr-4 text-ink-soft">{dateOrDash(inv.due_on)}</td>
                      <td className="py-3 pr-4">
                        <StatusDot dot={s.dot} label={s.label} />
                      </td>
                      <td className="py-3 pr-4 text-ink">{inv.subject}</td>
                      <td className="py-3 pr-4 text-right text-ink">{formatGBP(inv.total)}</td>
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
                    <td className="py-3 pr-4 text-ink-soft">—</td>
                    <td className="py-3 pr-4">
                      <StatusDot
                        dot={closed ? "bg-amber-400" : "bg-stone-300"}
                        label={closed ? "Requires invoicing" : "Upcoming"}
                      />
                    </td>
                    <td className="py-3 pr-4 text-ink">For Services Rendered</td>
                    <td className="py-3 pr-4 text-right text-ink">{formatGBP(j.total)}</td>
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

        <SentCard kind="job" id={j.id} />

        <NotesCard kind="job" id={j.id} notes={j.notes} />
      </div>
    </div>
  );
}
