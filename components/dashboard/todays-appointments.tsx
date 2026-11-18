"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Clock, Play, Plus, Route as RouteIcon, Square, UserPlus, UserX } from "lucide-react";
import { VisitDoneToggle } from "@/components/jobs/job-actions";
import { Avatar, LiveClock, TimeEntryForm } from "@/components/team/team-ui";
import { DashCard, DashTitle } from "@/components/dashboard/kit";
import { cn } from "@/lib/cn";
import { formatGBP } from "@/lib/format";
import { formatClock12 } from "@/lib/schedule/dates";
import { formatRoute } from "@/lib/geo/route-math";
import { assignVisitMembersAction, clockInAction, clockOutAction } from "@/lib/team/actions";
import type { Appointment, TodaysAppointments as Data } from "@/lib/team/queries";
import { formatHoursMinutes } from "@/lib/team/time";

type Filter = "all" | "active" | "remaining" | "completed" | "overdue";

// Columns when the card is wide; narrower cards stack each row as a compact card.
const ROW_GRID = "grid-cols-[92px_minmax(0,1fr)_96px_minmax(132px,168px)_72px_28px] gap-x-3";

/** What the row's pill, bar and filter say about an appointment. */
function phase(a: Appointment): { label: string; pill: string; bar: string } {
  const running = a.people.some((p) => p.runningSince);
  if (a.status === "completed") return { label: "Completed", pill: "bg-slate-100 text-slate-600", bar: "#cbd5e1" };
  if (a.status === "overdue") return { label: "Overdue", pill: "bg-rose-50 text-rose-700", bar: "#e11d48" };
  if (a.status === "active" && running) return { label: "In Progress", pill: "bg-emerald-50 text-emerald-700", bar: "#16a34a" };
  if (a.status === "active") return { label: "Due now", pill: "bg-blue-50 text-blue-700", bar: "#f59e0b" };
  return { label: "Scheduled", pill: "bg-slate-100 text-slate-600", bar: "#64748b" };
}

function startLabel(a: Appointment): string {
  return a.window.anytime ? "Anytime" : formatClock12(a.window.start);
}

/**
 * Dashboard "Today's operations": Jobber's Visit and Employee tabs merged. Each row
 * keeps the visit's checkbox (complete, invoice, close), who is on it with their
 * clock, and assigning people or logging time.
 */
export function TodaysAppointments({ data }: { data: Data }) {
  const [filter, setFilter] = useState<Filter>("all");
  const isToday = data.day === data.today;
  const count = (f: Filter) => (f === "all" ? data.appointments.length : data.appointments.filter((a) => a.status === f).length);
  const tabs: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "In Progress" },
    { key: "remaining", label: "Scheduled" },
    { key: "completed", label: "Completed" },
    ...(count("overdue") ? [{ key: "overdue" as const, label: "Overdue" }] : []),
  ];
  const list = filter === "all" ? data.appointments : data.appointments.filter((a) => a.status === filter);

  return (
    <DashCard className="p-4 sm:p-5">
      <DashTitle
        action={
          <Link
            href={isToday ? "/agenda" : `/agenda?date=${data.day}`}
            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-[#1d4ed8] hover:bg-blue-100"
          >
            View schedule
          </Link>
        }
      >
        {isToday ? "Today’s operations" : "Operations"}
      </DashTitle>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {tabs.map((t) => {
          const on = filter === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setFilter(t.key)}
              aria-pressed={on}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-lg border px-3.5 text-sm font-medium",
                on ? "border-[#13213d] bg-[#13213d] text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
              )}
            >
              {t.label}
              <span
                className={cn(
                  "grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-xs font-semibold",
                  on ? "bg-white text-[#13213d]" : "bg-slate-100 text-slate-700",
                )}
              >
                {count(t.key)}
              </span>
            </button>
          );
        })}
        <span className="ml-auto text-sm text-slate-500">
          {formatGBP(data.revenue.total)} <span className="text-slate-400">total</span>
        </span>
      </div>

      {list.length === 0 ? (
        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">No scheduled events</p>
      ) : (
        <div className="@container mt-3 text-sm">
          <div className={cn("hidden border-b border-slate-200 py-2.5 pl-4 text-xs font-medium text-slate-500 @2xl:grid", ROW_GRID)}>
            <span>Time</span>
            <span>Client / Service / Address</span>
            <span>Status</span>
            <span>Assigned Team</span>
            <span className="text-right">Value</span>
            <span />
          </div>
          {list.map((a) => (
            <OperationRow key={a.id} a={a} data={data} isToday={isToday} />
          ))}
        </div>
      )}
    </DashCard>
  );
}

function OperationRow({ a, data, isToday }: { a: Appointment; data: Data; isToday: boolean }) {
  const router = useRouter();
  const [panel, setPanel] = useState<"assign" | "time" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const p = phase(a);

  const run = async (key: string, work: () => Promise<{ ok: boolean; message?: string }>) => {
    setBusy(key);
    setMessage(null);
    const result = await work();
    setBusy(null);
    if (!result.ok) setMessage(result.message ?? "Something went wrong.");
    else router.refresh();
  };

  return (
    <div className="border-b border-slate-100 last:border-0">
      <div
        onClick={(event) => {
          const target = event.target;
          if (target instanceof Element && target.closest("a,button,input,select,textarea,label")) return;
          router.push(a.href);
        }}
        className={cn(
          "relative grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 py-4 pl-4 hover:bg-slate-50/70",
          "@2xl:grid-cols-[92px_minmax(0,1fr)_96px_minmax(132px,168px)_72px_28px] @2xl:items-start @2xl:gap-y-0",
        )}
      >
        <span className="absolute inset-y-3 left-0 w-[3px] rounded-full" style={{ background: p.bar }} aria-hidden />

        <div className="order-1 flex items-center gap-2.5 whitespace-nowrap">
          {a.trackable ? <VisitDoneToggle visitId={a.id} done={a.status === "completed"} /> : null}
          <span className="font-semibold text-slate-900">{startLabel(a)}</span>
        </div>

        <div className="order-3 col-span-2 min-w-0 @2xl:order-2 @2xl:col-span-1">
          <p className="text-slate-900">
            <Link href={a.clientId ? `/clientes/${a.clientId}` : a.href} className="font-semibold hover:underline">
              {a.clientName || a.title}
            </Link>
            {a.clientName ? <span className="text-slate-500"> — </span> : null}
            {a.clientName ? <span className="text-[13px] font-medium text-slate-700">{a.service}</span> : null}
          </p>
          {a.address ? (
            <p className="mt-0.5 text-[13px] text-slate-500">
              <span className="font-medium text-slate-600">Collection Address:</span> {a.address}
            </p>
          ) : null}
          {a.deliveryAddress ? (
            <p className="mt-0.5 text-[13px] text-slate-500">
              <span className="font-medium text-slate-600">Delivery Address:</span> {a.deliveryAddress}
            </p>
          ) : null}
          {a.route ? (
            <p className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-800">
              <RouteIcon size={12} aria-hidden />
              {formatRoute(a.route)}
            </p>
          ) : null}
          {!a.window.anytime && a.window.end ? (
            <p className="mt-0.5 text-xs text-slate-400">until {formatClock12(a.window.end)}</p>
          ) : null}
        </div>

        <div className="order-4 col-span-2 @2xl:order-3 @2xl:col-span-1">
          <span className={cn("inline-flex whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium", p.pill)}>
            {p.label}
          </span>
        </div>

        <div className="order-5 col-span-2 @2xl:order-4 @2xl:col-span-1">
          {a.trackable ? (
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 @2xl:block @2xl:space-y-1.5">
              {a.people.length === 0 ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700">
                  <UserX size={13} aria-hidden /> Unassigned
                </span>
              ) : (
                a.people.map((person) => (
                  <div key={person.id} className="flex items-center gap-2" title={person.name}>
                    <Avatar id={person.id} name={person.name} size={28} />
                    <span className="min-w-[52px] text-[13px] text-slate-600">
                      {person.runningSince ? (
                        <LiveClock seconds={person.seconds} runningSince={person.runningSince} serverNow={data.now} />
                      ) : person.seconds > 0 ? (
                        formatHoursMinutes(person.seconds)
                      ) : (
                        "-"
                      )}
                    </span>
                    {isToday ? (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() =>
                          run(person.id, () =>
                            person.runningSince ? clockOutAction(person.id) : clockInAction(person.id, a.id),
                          )
                        }
                        aria-label={person.runningSince ? `Clock out ${person.name}` : `Clock in ${person.name}`}
                        title={person.runningSince ? "Clock out" : "Clock in"}
                        className={cn(
                          "grid h-6 w-6 place-items-center rounded-md text-white disabled:opacity-50",
                          person.runningSince ? "bg-rose-600 hover:bg-rose-700" : "bg-[#13213d] hover:bg-[#1e3a5f]",
                        )}
                      >
                        {person.runningSince ? <Square size={10} /> : <Play size={10} />}
                      </button>
                    ) : null}
                  </div>
                ))
              )}
              <div className="flex gap-1.5 @2xl:pt-0.5">
                <button
                  type="button"
                  onClick={() => setPanel(panel === "assign" ? null : "assign")}
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <UserPlus size={13} aria-hidden /> Assign
                </button>
                {a.jobId ? (
                  <button
                    type="button"
                    onClick={() => setPanel(panel === "time" ? null : "time")}
                    className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Plus size={13} aria-hidden /> Time
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <span className="hidden text-slate-400 @2xl:inline">—</span>
          )}
        </div>

        <div className="order-2 flex items-start justify-end gap-1 whitespace-nowrap @2xl:order-5 @2xl:block @2xl:text-right">
          <div className="text-right">
            {a.value ? <span className="font-semibold text-slate-900">{formatGBP(a.value)}</span> : null}
            {a.trackable && a.seconds > 0 ? (
              <span className="mt-1 flex items-center justify-end gap-1 text-xs text-slate-500" title="Time spent on this visit">
                <Clock size={11} aria-hidden />
                {formatHoursMinutes(a.seconds)}
              </span>
            ) : null}
          </div>
          <ChevronRight size={18} className="mt-0.5 text-slate-700 @2xl:hidden" aria-hidden />
        </div>

        <div className="order-6 hidden text-right @2xl:block">
          <Link href={a.href} aria-label={`Open ${a.title}`} className="inline-grid h-7 w-7 place-items-center rounded-md text-slate-700 hover:bg-slate-100">
            <ChevronRight size={18} />
          </Link>
        </div>
      </div>
      {message || panel ? (
        <div className="pb-4 pl-4 pr-2">
          {message ? <p className="text-xs font-semibold text-rose-700">{message}</p> : null}
          {panel === "assign" ? (
            <AssignPanel visitId={a.id} team={data.team} assigned={a.people.map((x) => x.id)} onClose={() => setPanel(null)} />
          ) : null}
          {panel === "time" && a.jobId ? (
            <TimeEntryForm
              jobId={a.jobId}
              visitId={a.id}
              team={data.team.filter((m) => m.active)}
              defaultMemberId={a.people[0]?.id}
              defaultDate={data.day}
              onClose={() => setPanel(null)}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function AssignPanel({
  visitId,
  team,
  assigned,
  onClose,
}: {
  visitId: string;
  team: Data["team"];
  assigned: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(assigned);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const save = async () => {
    setPending(true);
    const result = await assignVisitMembersAction(visitId, selected);
    setPending(false);
    if (!result.ok) {
      setMessage(result.message ?? "Could not save.");
      return;
    }
    router.refresh();
    onClose();
  };

  return (
    <div className="mt-3 rounded-xl border border-line bg-cream/50 p-3">
      <p className="mb-2 text-sm font-extrabold text-ink">Assign team</p>
      {team.length === 0 ? (
        <p className="text-sm text-ink-soft">
          Add people in{" "}
          <Link href="/equipa" className="font-bold text-accent underline">
            Team
          </Link>{" "}
          first.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {team.map((m) => (
            <label key={m.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white">
              <input
                type="checkbox"
                checked={selected.includes(m.id)}
                onChange={(e) =>
                  setSelected((s) => (e.target.checked ? [...s, m.id] : s.filter((id) => id !== m.id)))
                }
                className="size-4 accent-[#388623]"
              />
              <Avatar id={m.id} name={m.name} size={22} />
              <span className="truncate text-sm text-ink">{m.name}</span>
            </label>
          ))}
        </div>
      )}
      {message ? <p className="mt-2 text-xs font-semibold text-rose-700">{message}</p> : null}
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="h-9 rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink hover:bg-cream"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={pending || team.length === 0}
          className="h-9 rounded-xl bg-accent px-4 text-sm font-bold text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
