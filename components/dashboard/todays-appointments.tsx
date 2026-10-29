"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Play, Plus, Square, UserPlus, UserX } from "lucide-react";
import { Card } from "@/components/ui";
import { VisitDoneToggle } from "@/components/jobs/job-actions";
import { Avatar, LiveClock, TimeEntryForm } from "@/components/team/team-ui";
import { cn } from "@/lib/cn";
import { formatGBP } from "@/lib/format";
import { formatClock12 } from "@/lib/schedule/dates";
import { assignVisitMembersAction, clockInAction, clockOutAction } from "@/lib/team/actions";
import type { Appointment, TodaysAppointments as Data } from "@/lib/team/queries";
import { APPOINTMENT_GROUPS } from "@/lib/team/time";

function windowLabel(a: Appointment): string {
  if (a.window.anytime) return "Anytime";
  const start = formatClock12(a.window.start);
  return a.window.end ? `${start} – ${formatClock12(a.window.end)}` : start;
}

/**
 * Jobber Home "Today's appointments" with its Visit and Employee tabs merged:
 * the visit list keeps Jobber's buckets and value, and each visit carries what the
 * Employee tab showed (who is on it, their clock, Unassigned), plus the time spent.
 */
export function TodaysAppointments({ data }: { data: Data }) {
  const stats = [
    { label: "Total", value: data.revenue.total, big: true },
    { label: "Active", value: data.revenue.active },
    { label: "Completed", value: data.revenue.completed },
    { label: "Overdue", value: data.revenue.overdue },
    { label: "Remaining", value: data.revenue.remaining },
  ];

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="text-xs text-ink-mute">{s.label}</p>
            <p className={cn("font-extrabold text-ink", s.big ? "text-3xl" : "text-xl")}>{formatGBP(s.value)}</p>
          </div>
        ))}
        <Link
          href="/agenda"
          className="ml-auto rounded-xl border border-line px-3 py-2 text-sm font-bold text-accent hover:bg-accent-soft"
        >
          View schedule
        </Link>
      </div>

      <TeamStrip data={data} />

      <div className="mt-5 space-y-5">
        {APPOINTMENT_GROUPS.map((g) => {
          const list = data.appointments.filter((a) => a.status === g.key);
          return (
            <section key={g.key}>
              <h3 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-ink">
                {list.length} {g.label}
              </h3>
              {list.length === 0 ? (
                <p className="rounded-xl bg-cream/70 px-4 py-4 text-sm text-ink-soft">No scheduled events</p>
              ) : (
                <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                  {list.map((a) => (
                    <AppointmentCard key={a.id} a={a} data={data} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </Card>
  );
}

/** The Employee tab's header row for each person: their clock for the day. */
function TeamStrip({ data }: { data: Data }) {
  if (data.employees.length === 0 && data.unassigned === 0) {
    return (
      <p className="mt-4 text-sm text-ink-soft">
        Add your crew in{" "}
        <Link href="/equipa" className="font-bold text-accent underline">
          Team
        </Link>{" "}
        to assign visits and track time.
      </p>
    );
  }
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {data.employees.map((e) => (
        <div
          key={e.id}
          className={cn(
            "flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-1.5",
            e.runningSince ? "border-emerald-300 bg-emerald-50" : "border-line bg-white",
          )}
        >
          <Avatar id={e.id} name={e.name} size={26} />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[13px] font-bold text-ink">{e.name}</p>
            <p className="flex items-center gap-1 text-xs text-ink-soft">
              <Clock size={12} aria-hidden />
              <LiveClock seconds={e.seconds} runningSince={e.runningSince} serverNow={data.now} />
              <span className="text-ink-mute">· {e.appointments} today</span>
            </p>
          </div>
        </div>
      ))}
      {data.unassigned > 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[13px] font-bold text-rose-800">
          <UserX size={16} aria-hidden />
          Unassigned · {data.unassigned}
        </div>
      ) : null}
    </div>
  );
}

function AppointmentCard({ a, data }: { a: Appointment; data: Data }) {
  const router = useRouter();
  const [panel, setPanel] = useState<"assign" | "time" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const run = async (key: string, work: () => Promise<{ ok: boolean; message?: string }>) => {
    setBusy(key);
    setMessage(null);
    const result = await work();
    setBusy(null);
    if (!result.ok) setMessage(result.message ?? "Something went wrong.");
    else router.refresh();
  };

  const runningCount = a.people.filter((p) => p.runningSince).length;
  const running = runningCount > 0;

  return (
    <div className="flex gap-3 bg-white p-3">
      <span className="w-1.5 shrink-0 rounded-full" style={{ background: a.color }} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-3">
          {a.trackable ? (
            <span className="pt-0.5">
              <VisitDoneToggle visitId={a.id} done={a.status === "completed"} />
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <Link href={a.href} className="block truncate text-sm font-bold text-ink hover:underline">
              {a.title}
            </Link>
            <p className="text-xs text-ink-soft">{windowLabel(a)}</p>
          </div>
          <div className="shrink-0 text-right">
            {a.value ? <p className="text-sm font-bold text-ink">{formatGBP(a.value)}</p> : null}
            {a.trackable ? (
              <p
                className={cn(
                  "mt-0.5 flex items-center justify-end gap-1 text-xs",
                  running ? "text-emerald-700" : "text-ink-soft",
                )}
                title="Time spent on this visit"
              >
                <Clock size={12} aria-hidden />
                <LiveClock
                  seconds={a.seconds}
                  runningSince={running ? data.now : null}
                  serverNow={data.now}
                  rate={runningCount}
                />
              </p>
            ) : null}
          </div>
        </div>

        {a.trackable ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {a.people.length === 0 ? (
              <span className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2 py-1 text-xs font-bold text-rose-800">
                <UserX size={13} aria-hidden /> Unassigned
              </span>
            ) : (
              a.people.map((p) => (
                <span
                  key={p.id}
                  className={cn(
                    "inline-flex max-w-full items-center gap-1.5 rounded-lg border py-0.5 pl-0.5 pr-1",
                    p.runningSince ? "border-emerald-300 bg-emerald-50" : "border-line bg-cream/40",
                  )}
                >
                  <Avatar id={p.id} name={p.name} size={22} />
                  <span className="truncate text-xs font-semibold text-ink">{p.name}</span>
                  <LiveClock
                    seconds={p.seconds}
                    runningSince={p.runningSince}
                    serverNow={data.now}
                    className="text-xs text-ink-soft"
                  />
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() =>
                      run(p.id, () => (p.runningSince ? clockOutAction(p.id) : clockInAction(p.id, a.id)))
                    }
                    aria-label={p.runningSince ? `Clock out ${p.name}` : `Clock in ${p.name}`}
                    title={p.runningSince ? "Clock out" : "Clock in"}
                    className={cn(
                      "grid h-6 w-6 place-items-center rounded-md text-white disabled:opacity-50",
                      p.runningSince ? "bg-rose-600 hover:bg-rose-700" : "bg-accent hover:opacity-90",
                    )}
                  >
                    {p.runningSince ? <Square size={11} /> : <Play size={11} />}
                  </button>
                </span>
              ))
            )}
            <button
              type="button"
              onClick={() => setPanel(panel === "assign" ? null : "assign")}
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-line px-2 text-xs font-bold text-ink hover:bg-cream"
            >
              <UserPlus size={13} aria-hidden /> Assign
            </button>
            {a.jobId ? (
              <button
                type="button"
                onClick={() => setPanel(panel === "time" ? null : "time")}
                className="inline-flex h-7 items-center gap-1 rounded-lg border border-line px-2 text-xs font-bold text-ink hover:bg-cream"
              >
                <Plus size={13} aria-hidden /> Time
              </button>
            ) : null}
          </div>
        ) : null}

        {message ? <p className="mt-2 text-xs font-semibold text-rose-700">{message}</p> : null}

        {panel === "assign" ? (
          <AssignPanel
            visitId={a.id}
            team={data.team}
            assigned={a.people.map((p) => p.id)}
            onClose={() => setPanel(null)}
          />
        ) : null}
        {panel === "time" && a.jobId ? (
          <TimeEntryForm
            jobId={a.jobId}
            visitId={a.id}
            team={data.team.filter((m) => m.active)}
            defaultMemberId={a.people[0]?.id}
            defaultDate={data.today}
            onClose={() => setPanel(null)}
          />
        ) : null}
      </div>
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
