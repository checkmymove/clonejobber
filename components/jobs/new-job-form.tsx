"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createJob, updateJob } from "@/lib/jobs/actions";
import { ClientSelect } from "@/components/funnel/client-select";
import {
  Calendar,
  ChevronDown,
  Clock,
  Flag,
  MoreHorizontal,
  Plus,
  Upload,
  X,
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

type Line = { id: string; name: string; qty: string; price: string };

const emptyVisit = (): Visit => ({
  id: `visit-${Date.now()}`,
  title: "",
  date: "2026-09-14",
  later: false,
  start: "",
  end: "",
  anytime: false,
  assignee: "",
  instructions: "",
});

function money(value: number) {
  return `£${value.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function monthDay(iso: string) {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return { month: "—", day: "—" };
  const month = date.toLocaleDateString("pt-PT", { month: "long" });
  return { month: month.charAt(0).toUpperCase() + month.slice(1), day: String(date.getDate()) };
}

function GreenCheck({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[4px] border"
      style={
        checked
          ? { background: green, borderColor: green }
          : { background: "#fff", borderColor: "#c5ced3" }
      }
    >
      {checked ? (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M2.2 6.2 4.7 8.7 9.8 3.4"
            stroke="#fff"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </span>
  );
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
  initialLines?: { name: string; qty: string; price: string }[];
}) {
  const [title, setTitle] = useState(initialTitle ?? "");
  const [clientId, setClientId] = useState(initialClientId ?? "");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [jobNumber, setJobNumber] = useState(initialJobNumber ?? "682");
  const [salesperson, setSalesperson] = useState("");
  const [schedule, setSchedule] = useState<"once" | "repeat">("once");
  const [visits, setVisits] = useState<Visit[]>(
    initialVisits?.length
      ? initialVisits
      : [
          {
            id: "visit-1",
            title: "",
            date: "2026-09-14",
            later: false,
            start: "",
            end: "",
            anytime: false,
            assignee: "",
            instructions: "",
          },
        ],
  );
  const [checklist, setChecklist] = useState(true);
  const [remindInvoice, setRemindInvoice] = useState(initialRemindInvoice ?? true);
  const [splitInvoices, setSplitInvoices] = useState(false);
  const [lines, setLines] = useState<Line[]>(
    initialLines?.length
      ? initialLines.map((l, i) => ({ id: `line-${i}`, ...l }))
      : [{ id: "line-1", name: "", qty: "1", price: "" }],
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

  return (
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        setPending(true);
        const payload = {
          clientId,
          quoteId,
          requestId,
          title,
          notes: initialNotes ?? "",
          remindInvoice,
          visits: visits.map((v) => ({
            title: v.title,
            date: v.date,
            later: v.later,
            start: v.start,
            end: v.end,
            anytime: v.anytime,
            assignee: v.assignee,
            instructions: v.instructions,
          })),
          lines: lines.map((l) => ({
            name: l.name,
            qty: l.qty,
            unitPrice: l.price,
          })),
        };
        const result = jobId ? await updateJob(jobId, payload) : await createJob(payload);
        setPending(false);
        if (result && !result.ok) {
          setError(result.message || Object.values(result.errors ?? {})[0] || "Could not save job.");
        }
      }}
    >
      <div className="flex items-center gap-2">
        <Flag size={18} style={{ color: green }} />
        <h1 className={`text-[26px] font-bold tracking-tight ${ink}`}>
          {jobId ? "Edit job" : "New job"}
        </h1>
      </div>

      <input
        aria-label="Title"
        placeholder="Title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        className={field}
      />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <ClientSelect clients={clients} value={clientId} onChange={setClientId} disabled={!!jobId} />
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
            <span className="text-sm text-[#5d6f78]">Personalizar</span>
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

      <SectionCard title="Visitas">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[11px] font-bold tracking-wide text-[#8aa0a8]">AGENDAR</span>
            <div className="inline-flex rounded-lg border border-[#d5dde1] p-0.5">
              <button
                type="button"
                onClick={() => setSchedule("once")}
                className="h-8 rounded-md px-3 text-sm font-semibold"
                style={
                  schedule === "once"
                    ? { border: `1px solid ${green}`, color: green }
                    : { color: "#5d6f78" }
                }
              >
                One-off
              </button>
              <button
                type="button"
                onClick={() => setSchedule("repeat")}
                className="h-8 rounded-md px-3 text-sm font-semibold"
                style={
                  schedule === "repeat"
                    ? { border: `1px solid ${green}`, color: green }
                    : { color: "#5d6f78" }
                }
              >
                Recorrente
              </button>
            </div>
            <span className="text-sm text-[#5d6f78]">
              {visits.length} {visits.length === 1 ? "visita" : "visitas"}
            </span>
          </div>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-white"
            style={{ background: green }}
          >
            <Plus size={15} />
            Create visits
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {visits.map((visit) => {
            const when = monthDay(visit.date);
            const timesOff = visit.later || visit.anytime;
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
                          value={visit.date}
                          disabled={visit.later}
                          onChange={(event) => patchVisit(visit.id, { date: event.target.value })}
                          className={`${field} ${picker} pr-10`}
                        />
                        <Calendar size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#5d6f78]" />
                      </span>
                    </label>
                    <label className={`flex cursor-pointer items-center gap-2 text-sm ${ink}`}>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={visit.later}
                        onChange={(event) => patchVisit(visit.id, { later: event.target.checked })}
                      />
                      <GreenCheck checked={visit.later} />
                      Schedule mais tarde
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="relative block">
                        <span className="mb-1 block text-[13px] text-[#5d6f78]">Start time</span>
                        <input
                          aria-label="Start time"
                          type="time"
                          value={visit.start}
                          disabled={timesOff}
                          onChange={(event) => patchVisit(visit.id, { start: event.target.value })}
                          className={`${field} ${picker} pr-10`}
                        />
                        <Clock size={16} className="pointer-events-none absolute bottom-3.5 right-3 text-[#8aa0a8]" />
                      </label>
                      <label className="relative block">
                        <span className="mb-1 block text-[13px] text-[#5d6f78]">End time</span>
                        <input
                          aria-label="End time"
                          type="time"
                          value={visit.end}
                          disabled={timesOff}
                          onChange={(event) => patchVisit(visit.id, { end: event.target.value })}
                          className={`${field} ${picker} pr-10`}
                        />
                        <Clock size={16} className="pointer-events-none absolute bottom-3.5 right-3 text-[#8aa0a8]" />
                      </label>
                    </div>
                    <label className={`flex cursor-pointer items-center gap-2 text-sm ${ink}`}>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={visit.anytime}
                        onChange={(event) => patchVisit(visit.id, { anytime: event.target.checked })}
                      />
                      <GreenCheck checked={visit.anytime} />
                      A qualquer momento
                    </label>
                    <label className="relative block">
                      <select
                        aria-label="Assign"
                        value={visit.assignee}
                        onChange={(event) => patchVisit(visit.id, { assignee: event.target.value })}
                        className={`${field} appearance-none pr-9 ${visit.assignee ? "" : "text-[#667880]"}`}
                      >
                        <option value="">Assign</option>
                      </select>
                      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                    </label>
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

        <div className="mt-4">
          <p className="mb-1.5 text-[13px] text-[#5d6f78]">Checklist lines</p>
          <div className={`flex min-h-11 items-center justify-between rounded-lg border ${line} px-3`}>
            {checklist ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-[#eef1f2] px-2 py-1 text-sm text-[#1c3d46]">
                Removals service
                <button type="button" aria-label="Remove checklist line" onClick={() => setChecklist(false)}>
                  <X size={14} />
                </button>
              </span>
            ) : (
              <span className="text-sm text-[#8aa0a8]">Add checklist line</span>
            )}
            <ChevronDown size={16} className="text-[#5d6f78]" />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setVisits((rows) => [...rows, emptyVisit()])}
            className={`h-9 rounded-lg border ${line} bg-white px-3 text-sm font-semibold ${ink}`}
          >
            Add a visit
          </button>
          <button
            type="button"
            onClick={() =>
              setVisits((rows) => (rows.length > 1 ? rows.slice(0, -1) : rows))
            }
            className={`h-9 rounded-lg border ${line} bg-white px-3 text-sm font-semibold ${ink}`}
          >
            Remove
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Billing">
        <div className="space-y-3">
          <label className={`flex cursor-pointer items-center gap-2 text-sm ${ink}`}>
            <input
              type="checkbox"
              className="sr-only"
              checked={remindInvoice}
              onChange={(event) => setRemindInvoice(event.target.checked)}
            />
            <GreenCheck checked={remindInvoice} />
            Remind me to send the invoice when I complete the job.
          </label>
          <label className={`flex cursor-pointer items-center gap-2 border-t ${line} pt-3 text-sm ${ink}`}>
            <input
              type="checkbox"
              className="sr-only"
              checked={splitInvoices}
              onChange={(event) => setSplitInvoices(event.target.checked)}
            />
            <GreenCheck checked={splitInvoices} />
            Split into several invoices with a payment schedule
          </label>
        </div>
      </SectionCard>

      <SectionCard title="Product / Service">
        <div className="space-y-3">
          {lines.map((line) => {
            const qty = Number(line.qty.replace(",", ".")) || 0;
            const price = Number(line.price.replace(",", ".")) || 0;
            return (
              <div key={line.id} className="space-y-2">
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
                      placeholder="£ 0,00"
                      onChange={(event) =>
                        setLines((rows) =>
                          rows.map((row) => (row.id === line.id ? { ...row, price: event.target.value } : row)),
                        )
                      }
                      className={field}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-[#8aa0a8]">Total</span>
                    <div className={`flex h-11 items-center justify-end rounded-lg border ${line} px-3 text-sm ${ink}`}>
                      {money(qty * price)}
                    </div>
                  </label>
                  <button type="button" aria-label="More item options" className="mb-1 grid h-11 w-9 place-items-center text-[#5d6f78]">
                    <MoreHorizontal size={18} />
                  </button>
                </div>
                <textarea
                  aria-label="Description"
                  placeholder="Description"
                  className={`min-h-[72px] w-full resize-y rounded-lg border ${line} px-3 py-2 text-[15px] ${ink} outline-none ${ph}`}
                />
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() =>
            setLines((rows) => [...rows, { id: `line-${Date.now()}`, name: "", qty: "1", price: "" }])
          }
          className="mt-4 h-9 rounded-lg px-3 text-sm font-semibold text-white"
          style={{ background: green }}
        >
          Add line item
        </button>
        <div className={`mt-5 space-y-3 border-t ${line} pt-4 text-sm`}>
          <div className="flex justify-end gap-10 text-[#5d6f78]">
            <span className="w-40">Subtotal</span>
            <span className="w-24 text-right">{money(subtotal)}</span>
          </div>
          <div className="flex justify-end gap-10 text-[#5d6f78]">
            <span className="w-40">Desconto</span>
            <button type="button" className="w-24 text-right font-semibold underline" style={{ color: green }}>
              Add discount
            </button>
          </div>
          <div className="flex justify-end gap-10 text-[#5d6f78]">
            <span className="w-40">Imposto</span>
            <button type="button" className="w-24 text-right font-semibold underline" style={{ color: green }}>
              Add tax
            </button>
          </div>
          <div className={`flex justify-end gap-10 font-bold ${ink}`}>
            <span className="w-40">Total price</span>
            <span className="w-24 text-right">{money(subtotal)}</span>
          </div>
        </div>
      </SectionCard>

      <section className="space-y-3">
        <h2 className={`text-[17px] font-bold ${ink}`}>Notas</h2>
        <button
          type="button"
          className={`flex min-h-[150px] w-full flex-col items-center justify-center rounded-lg border border-dashed ${line} bg-white px-6 py-8 text-center`}
        >
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[#f3f5f6] text-[#8aa0a8]">
            <Upload size={18} />
          </span>
          <span className="mt-3 text-sm text-[#7b8e96]">
            Leave an internal note for yourself or a team member.
          </span>
        </button>
      </section>

      {error ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}

      <div className="flex items-center justify-end gap-2">
        <Link
          href={jobId ? `/servicos/${jobId}` : "/servicos"}
          className={`inline-flex h-10 items-center rounded-lg border ${line} bg-white px-4 text-sm font-semibold ${ink}`}
        >
          Cancel
        </Link>
        <div className="inline-flex overflow-hidden rounded-lg text-white" style={{ background: green }}>
          <button type="submit" disabled={pending} className="h-10 px-4 text-sm font-semibold disabled:opacity-60">
            {pending ? "Saving…" : jobId ? "Update job" : "Save job"}
          </button>
          <button type="button" aria-label="More save options" className="grid h-10 w-9 place-items-center border-l border-white/30">
            <ChevronDown size={16} />
          </button>
        </div>
      </div>
    </form>
  );
}
