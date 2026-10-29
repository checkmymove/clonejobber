"use client";

import { openPicker } from "@/components/date-field";
import { TimeField } from "@/components/time-field";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createJob, saveJobAndConvert, saveJobAndPrepareSend, updateJob } from "@/lib/jobs/actions";
import { SendDialog, useSendDialog } from "@/components/funnel/send-dialog";
import { ClientSelect } from "@/components/funnel/client-select";
import { StickySaveBar } from "@/components/forms/sticky-save-bar";
import { formatPounds, padMoney } from "@/lib/format";
import { addMinutesToClock } from "@/lib/schedule/dates";
import {
  Banknote,
  Calendar,
  Check,
  ChevronDown,
  FileText,
  Flag,
  Mail,
  MoreHorizontal,
} from "lucide-react";

const ink = "text-[#042b3c]";
const line = "border-[#d5dde1]";
const green = "#388623";
const ph = "placeholder:text-[#667880]";
const field = `h-11 w-full rounded-lg border ${line} bg-white px-3 text-[15px] ${ink} outline-none ${ph} focus:border-[#388623] focus:ring-2 focus:ring-[#388623]/20 disabled:bg-[#f7f8f8] disabled:text-[#8aa0a8]`;
const picker =
  "relative [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-8 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0";

type Visit = {
  id: string;
  title: string;
  date: string;
  later: boolean;
  start: string;
  end: string;
  anytime: boolean;
  assignee: string;
  instructions: string;
};

type Line = { id: string; name: string; qty: string; price: string; description: string };

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function monthDay(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return { month: "—", day: "—" };
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return { month: "—", day: "—" };
  return { month, day: String(Number(match[3])) };
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-lg border ${line} bg-white p-4 sm:p-5`}>
      <h2 className={`text-[17px] font-bold ${ink}`}>{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function NewJobForm({
  clients,
  quoteId,
  requestId,
  jobId,
  initialClientId,
  initialTitle,
  initialJobNumber,
  initialNotes,
  initialRemindInvoice,
  initialVisits,
  initialLines,
  initialDiscount,
  initialTax,
  today,
  team = [],
}: {
  clients: { id: string; first_name: string; last_name: string; email: string }[];
  quoteId?: string;
  requestId?: string;
  jobId?: string;
  initialClientId?: string;
  initialTitle?: string;
  initialJobNumber?: string;
  initialNotes?: string;
  initialRemindInvoice?: boolean;
  initialVisits?: Visit[];
  initialLines?: { name: string; qty: string; price: string; description?: string }[];
  initialDiscount?: string;
  initialTax?: string;
  today: string;
  /** People from Team, offered in each visit's Assign list. */
  team?: { id: string; name: string }[];
}) {
  const [title] = useState(initialTitle ?? "");
  const [clientId, setClientId] = useState(initialClientId ?? "");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [jobNumber, setJobNumber] = useState(initialJobNumber ?? "682");
  const [salesperson, setSalesperson] = useState("");
  const [visits, setVisits] = useState<Visit[]>(
    initialVisits?.length
      ? initialVisits
      : [
          {
            id: "visit-1",
            title: "",
            date: today,
            later: false,
            start: "",
            end: "",
            anytime: false,
            assignee: "",
            instructions: "",
          },
        ],
  );
  // Billing and Notes boxes are gone from this form; their values are kept as they were.
  const remindInvoice = initialRemindInvoice ?? true;
  const notes = initialNotes ?? "";
  const [discount, setDiscount] = useState(Number(initialDiscount) ? initialDiscount! : "");
  const [tax, setTax] = useState(Number(initialTax) ? initialTax! : "");
  const [discountOpen, setDiscountOpen] = useState(Boolean(Number(initialDiscount)));
  const [taxOpen, setTaxOpen] = useState(Boolean(Number(initialTax)));
  const [lines, setLines] = useState<Line[]>(
    initialLines?.length
      ? initialLines.map((l, i) => ({
          id: `line-${i}`,
          name: l.name,
          qty: l.qty,
          price: l.price,
          description: l.description ?? "",
        }))
      : [{ id: "line-1", name: "", qty: "1", price: "", description: "" }],
  );

  const patchVisit = (id: string, patch: Partial<Visit>) =>
    setVisits((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  const subtotal = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const qty = Number(line.qty.replace(",", ".")) || 0;
        const price = Number(line.price.replace(",", ".")) || 0;
        return sum + qty * price;
      }, 0),
    [lines],
  );

  const [savedJobId, setSavedJobId] = useState(jobId);
  const sender = useSendDialog();
  const router = useRouter();

  async function submit(followUp?: "invoice" | "send") {
    setError("");
    setPending(true);
    const payload = {
      clientId,
      quoteId,
      requestId,
      title,
      notes,
      remindInvoice,
      discount,
      tax,
      visits: visits.map((v) => ({
        id: v.id,
        title: v.title,
        date: v.date,
        // "Schedule later" and "Anytime" boxes were removed: a visit without a start time is Anytime.
        later: false,
        start: v.start,
        end: v.end,
        anytime: !v.start.trim(),
        assignee: v.assignee,
        instructions: v.instructions,
      })),
      lines: lines.map((l) => ({
        name: l.name,
        description: l.description,
        qty: l.qty,
        unitPrice: l.price,
      })),
    };
    const currentId = savedJobId;
    if (followUp === "send") {
      const prepared = await saveJobAndPrepareSend(currentId, payload);
      setPending(false);
      if (prepared.id) setSavedJobId(prepared.id);
      if (!prepared.ok || !prepared.draft) {
        setError(prepared.message || Object.values(prepared.errors ?? {})[0] || "Could not prepare the message.");
        return;
      }
      sender.show(prepared.draft);
      return;
    }
    const result =
      followUp === "invoice"
        ? await saveJobAndConvert(currentId, payload)
        : currentId
          ? await updateJob(currentId, payload)
          : await createJob(payload);
    setPending(false);
    if (result && !result.ok) {
      setError(result.message || Object.values(result.errors ?? {})[0] || "Could not save job.");
    }
  }

  return (
    <>
    <form
      className="space-y-5 pb-24"
      onSubmit={async (event) => {
        event.preventDefault();
        await submit();
      }}
    >
      <div className="flex items-center gap-2">
        <Flag size={18} style={{ color: green }} />
        <h1 className={`text-[26px] font-bold tracking-tight ${ink}`}>
          {jobId ? "Edit job" : "New job"}
        </h1>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        {initialClientId ? (
          // The client comes from the quote or the saved job and can't be swapped here.
          <div className={`rounded-lg border ${line} bg-white p-4`}>
            <p className="text-[13px] text-[#5d6f78]">Client</p>
            <p className={`mt-0.5 text-[17px] font-bold ${ink}`}>
              {(() => {
                const c = clients.find((x) => x.id === clientId);
                return c ? `${c.first_name} ${c.last_name}`.trim() : "—";
              })()}
            </p>
          </div>
        ) : (
          <ClientSelect clients={clients} value={clientId} onChange={setClientId} />
        )}
        <div className="space-y-3">
          <div className="grid grid-cols-[88px_1fr] items-center gap-3">
            <span className="text-sm text-[#5d6f78]">Job #</span>
            <input
              aria-label="Job"
              value={jobNumber}
              disabled={!!jobId}
              onChange={(event) => setJobNumber(event.target.value)}
              className={field}
            />
          </div>
          <label className="grid grid-cols-[88px_1fr] items-center gap-3">
            <span className="text-sm text-[#5d6f78]">Salesperson</span>
            <span className="relative block">
              <select
                aria-label="Salesperson"
                value={salesperson}
                onChange={(event) => setSalesperson(event.target.value)}
                className={`${field} appearance-none pr-9 ${salesperson ? "" : "text-[#667880]"}`}
              >
                <option value="">Select a salesperson</option>
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
            </span>
          </label>
          <div className="flex items-center justify-between pl-[100px]">
            <span className="text-sm text-[#5d6f78]">Customise</span>
            <button
              type="button"
              className="h-8 rounded-md border px-3 text-sm font-semibold"
              style={{ borderColor: green, color: green }}
            >
              Add field
            </button>
          </div>
        </div>
      </div>

      <SectionCard title="Schedule">
        <div className="space-y-4">
          {visits.map((visit) => {
            const when = monthDay(visit.date);
            return (
              <div key={visit.id} className={`rounded-lg border ${line} p-4`}>
                <div className="flex gap-4">
                  <div className="w-16 shrink-0 pt-1 text-center">
                    <p className="text-xs text-[#8aa0a8]">{when.month}</p>
                    <p className={`text-2xl font-bold leading-none ${ink}`}>{when.day}</p>
                  </div>
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex items-start gap-2">
                      <label className="relative block min-w-0 flex-1">
                        <select
                          aria-label="Visit title"
                          value={visit.title}
                          onChange={(event) => patchVisit(visit.id, { title: event.target.value })}
                          className={`${field} appearance-none pr-9 ${visit.title ? "" : "text-[#667880]"}`}
                        >
                          <option value="">Title</option>
                        </select>
                        <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                      </label>
                      <button type="button" aria-label="More options" className="grid h-11 w-9 place-items-center text-[#5d6f78]">
                        <MoreHorizontal size={18} />
                      </button>
                    </div>
                    <p className="text-[13px] text-[#7b8e96]">
                      Leave blank to use the default title.{" "}
                      <button type="button" className="font-semibold underline" style={{ color: green }}>
                        Settings
                      </button>
                    </p>
                    <label className="block">
                      <span className="mb-1 block text-[13px] text-[#5d6f78]">Date</span>
                      <span className="relative block">
                        <input
                          aria-label="Visit date"
                          type="date"
                          onClick={openPicker}
                          value={visit.date}
                          suppressHydrationWarning
                          onChange={(event) => patchVisit(visit.id, { date: event.target.value })}
                          className={`${field} ${picker} pr-10`}
                        />
                        <Calendar size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#5d6f78]" />
                      </span>
                    </label>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="relative block">
                        <span className="mb-1 block text-[13px] text-[#5d6f78]">Start time</span>
                        <TimeField
                          ariaLabel="Start time"
                          value={visit.start}
                          onChange={(value) =>
                            // Moves are booked in 3-hour slots: the end follows the start.
                            patchVisit(visit.id, {
                              start: value,
                              end: /^\d{2}:\d{2}$/.test(value) ? addMinutesToClock(value, 180) : visit.end,
                            })
                          }
                          className={field}
                        />
                      </label>
                      <label className="relative block">
                        <span className="mb-1 block text-[13px] text-[#5d6f78]">End time</span>
                        <TimeField
                          ariaLabel="End time"
                          value={visit.end}
                          onChange={(value) => patchVisit(visit.id, { end: value })}
                          className={field}
                        />
                      </label>
                    </div>
                    <AssignPicker
                      team={team}
                      value={visit.assignee}
                      onChange={(assignee) => patchVisit(visit.id, { assignee })}
                    />
                    <textarea
                      aria-label="Access instructions"
                      placeholder="Access instructions"
                      value={visit.instructions}
                      onChange={(event) => patchVisit(visit.id, { instructions: event.target.value })}
                      className={`min-h-[72px] w-full resize-y rounded-lg border ${line} px-3 py-2 text-[15px] ${ink} outline-none ${ph}`}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </SectionCard>

      <SectionCard title="Product / Service">
        <div className="space-y-3">
          {lines.map((line, index) => {
            const qty = Number(line.qty.replace(",", ".")) || 0;
            const price = Number(line.price.replace(",", ".")) || 0;
            return (
              // A rule between items, so Packing Service sits apart from Driver + Helper.
              <div key={line.id} className={`space-y-2 ${index > 0 ? "border-t border-[#d5dde1] pt-4" : ""}`}>
                <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_110px_150px_110px_auto]">
                  <input
                    aria-label="Name"
                    placeholder="Name"
                    value={line.name}
                    onChange={(event) =>
                      setLines((rows) =>
                        rows.map((row) => (row.id === line.id ? { ...row, name: event.target.value } : row)),
                      )
                    }
                    className={field}
                  />
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-[#8aa0a8]">Quantity</span>
                    <input
                      aria-label="Quantity"
                      value={line.qty}
                      onChange={(event) =>
                        setLines((rows) =>
                          rows.map((row) => (row.id === line.id ? { ...row, qty: event.target.value } : row)),
                        )
                      }
                      className={field}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-[#8aa0a8]">Unit price</span>
                    <input
                      aria-label="Unit price"
                      value={line.price}
                      placeholder="£ 0.00"
                      onChange={(event) =>
                        setLines((rows) =>
                          rows.map((row) => (row.id === line.id ? { ...row, price: event.target.value } : row)),
                        )
                      }
                      onBlur={(event) => {
                        const price = padMoney(event.target.value);
                        setLines((rows) => rows.map((row) => (row.id === line.id ? { ...row, price } : row)));
                      }}
                      className={field}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-[#8aa0a8]">Total</span>
                    <div className={`flex h-11 items-center justify-end rounded-lg border ${line} px-3 text-[15px] ${ink}`}>
                      {formatPounds(qty * price)}
                    </div>
                  </label>
                  <button type="button" aria-label="More item options" className="mb-1 grid h-11 w-9 place-items-center text-[#5d6f78]">
                    <MoreHorizontal size={18} />
                  </button>
                </div>
                <textarea
                  aria-label="Description"
                  placeholder="Description"
                  value={line.description}
                  onChange={(event) =>
                    setLines((rows) =>
                      rows.map((row) => (row.id === line.id ? { ...row, description: event.target.value } : row)),
                    )
                  }
                  className={`min-h-[72px] w-full resize-y rounded-lg border ${line} px-3 py-2 text-[15px] ${ink} outline-none ${ph}`}
                />
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() =>
            setLines((rows) => [...rows, { id: `line-${Date.now()}`, name: "", qty: "1", price: "", description: "" }])
          }
          className="mt-4 h-9 rounded-lg px-3 text-sm font-semibold text-white"
          style={{ background: green }}
        >
          Add line item
        </button>
        <div className={`mt-5 space-y-3 border-t ${line} pt-4 text-sm`}>
          <div className="flex justify-end gap-10 text-[#5d6f78]">
            <span className="w-40">Subtotal</span>
            <span className="w-24 text-right">{formatPounds(subtotal)}</span>
          </div>
          <div className="flex items-center justify-end gap-10 text-[#5d6f78]">
            <span className="w-40">Discount</span>
            {discountOpen ? (
              <input
                aria-label="Discount"
                inputMode="decimal"
                placeholder="£ 0.00"
                value={discount}
                onChange={(event) => setDiscount(event.target.value)}
                  onBlur={(event) => setDiscount(padMoney(event.target.value))}
                className={`h-9 w-24 rounded-lg border ${line} px-2 text-right text-sm ${ink} outline-none`}
              />
            ) : (
              <button
                type="button"
                onClick={() => setDiscountOpen(true)}
                className="w-24 text-right font-semibold underline"
                style={{ color: green }}
              >
                Add discount
              </button>
            )}
          </div>
          <div className="flex items-center justify-end gap-10 text-[#5d6f78]">
            <span className="w-40">VAT</span>
            {taxOpen ? (
              <input
                aria-label="Tax"
                inputMode="decimal"
                placeholder="£ 0.00"
                value={tax}
                onChange={(event) => setTax(event.target.value)}
                  onBlur={(event) => setTax(padMoney(event.target.value))}
                className={`h-9 w-24 rounded-lg border ${line} px-2 text-right text-sm ${ink} outline-none`}
              />
            ) : (
              <button
                type="button"
                onClick={() => setTaxOpen(true)}
                className="w-24 text-right font-semibold underline"
                style={{ color: green }}
              >
                Add tax
              </button>
            )}
          </div>
          <div className={`flex justify-end gap-10 font-bold ${ink}`}>
            <span className="w-40">Total price</span>
            <span className="w-24 text-right">
              {formatPounds(
                Math.max(
                  0,
                  subtotal - (Number(discount.replace(",", ".")) || 0) + (Number(tax.replace(",", ".")) || 0),
                ),
              )}
            </span>
          </div>
        </div>
      </SectionCard>

      <StickySaveBar
        cancelHref={savedJobId ? `/servicos/${savedJobId}` : quoteId ? `/cotacoes/${quoteId}` : "/servicos"}
        error={error}
        pending={pending}
        saveLabel={jobId ? "Update job" : "Save job"}
        menuItems={[
          {
            label: "Send email & text",
            icon: <Mail size={18} />,
            onClick: () => void submit("send"),
          },
          ...(quoteId && clientId
            ? [
                {
                  label: "Collect Deposit",
                  icon: <Banknote size={18} />,
                  onClick: () =>
                    router.push(
                      `/pagamentos/novo?${new URLSearchParams({
                        clientId,
                        quoteId,
                        kind: "deposit",
                        returnTo: savedJobId ? `/servicos/${savedJobId}` : `/servicos/novo?quoteId=${quoteId}`,
                      })}`,
                    ),
                },
              ]
            : []),
          {
            label: "Convert to Invoice",
            icon: <FileText size={18} style={{ color: green }} />,
            onClick: () => void submit("invoice"),
          },
        ]}
      />
    </form>
    {sender.draft ? (
      <SendDialog
        draft={sender.draft}
        onClose={sender.close}
        onDone={() => router.push(`/servicos/${sender.draft?.id}`)}
      />
    ) : null}
    </>
  );
}

/** Assign: the people from Team, several per visit. Stored as "Name, Name" and synced to Team on save. */
function AssignPicker({
  team,
  value,
  onChange,
}: {
  team: { id: string; name: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const chosen = value.split(",").map((n) => n.trim()).filter(Boolean);
  const toggle = (name: string) =>
    onChange((chosen.includes(name) ? chosen.filter((n) => n !== name) : [...chosen, name]).join(", "));
  if (team.length === 0) {
    return (
      <p className="text-[13px] text-[#7b8e96]">
        Assign: add people in{" "}
        <a href="/equipa" className="font-semibold underline" style={{ color: green }}>
          Team
        </a>{" "}
        to assign them here.
      </p>
    );
  }
  return (
    <div>
      <p className="mb-1.5 text-[13px] text-[#5d6f78]">Assign</p>
      <div className="flex flex-wrap gap-2">
        {team.map((m) => {
          const on = chosen.includes(m.name);
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(m.name)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold ${
                on ? "text-white" : `${line} bg-white ${ink}`
              }`}
              style={on ? { background: green, borderColor: green } : undefined}
            >
              {on ? <Check size={14} /> : null}
              {m.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
