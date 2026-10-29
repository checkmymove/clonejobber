"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { openPicker } from "@/components/date-field";
import { TimeField } from "@/components/time-field";
import { cn } from "@/lib/cn";
import { addTimeEntryAction } from "@/lib/team/actions";
import { formatClock, initials } from "@/lib/team/time";

const AVATAR_COLORS = ["#2f7d3b", "#245d8a", "#a4445c", "#c07a1a", "#5b4a9e", "#1f7a7a"];

function colorFor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function Avatar({ id, name, size = 28 }: { id: string; name: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.38, background: colorFor(id) }}
    >
      {initials(name)}
    </span>
  );
}

/** Jobber's 00:00:00 clock; ticks while `runningSince` is set. */
export function LiveClock({
  seconds,
  runningSince,
  serverNow,
  rate = 1,
  className,
}: {
  seconds: number;
  runningSince: string | null;
  serverNow: string;
  /** Clocks running at once (a visit total with two people counts twice as fast). */
  rate?: number;
  className?: string;
}) {
  const [extra, setExtra] = useState(0);
  useEffect(() => {
    if (!runningSince) return;
    // The server counted up to serverNow; add what has passed since, ignoring local clock skew.
    const loadedAt = Date.now();
    const tick = () => setExtra(Math.floor(((Date.now() - loadedAt) / 1000) * rate));
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [runningSince, serverNow, rate]);
  return (
    <span className={cn("tabular-nums", runningSince && "text-emerald-700", className)}>
      {formatClock(seconds + extra)}
    </span>
  );
}

const field =
  "h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-emerald-100";

/** Jobber "Create Timesheet Entry": employee, start, then end time or hours and minutes. */
export function TimeEntryForm({
  jobId,
  visitId,
  visits,
  team,
  defaultMemberId,
  defaultDate,
  onClose,
}: {
  jobId: string;
  visitId: string | null;
  /** On the job page the visit can be chosen; on a visit card it is fixed. */
  visits?: { id: string; label: string }[];
  team: { id: string; name: string }[];
  defaultMemberId?: string;
  defaultDate: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [memberId, setMemberId] = useState(defaultMemberId ?? team[0]?.id ?? "");
  const [visit, setVisit] = useState(visitId ?? "");
  const [date, setDate] = useState(defaultDate);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const save = async () => {
    setPending(true);
    setMessage(null);
    const result = await addTimeEntryAction({
      memberId,
      jobId,
      visitId: visit || null,
      date,
      start,
      end,
      hours,
      minutes,
      notes,
    });
    setPending(false);
    if (!result.ok) {
      setMessage(result.message ?? "Could not save the entry.");
      return;
    }
    router.refresh();
    onClose();
  };

  return (
    <div className="mt-3 rounded-xl border border-line bg-cream/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-extrabold text-ink">Add time entry</p>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 hover:bg-cream">
          <X size={16} />
        </button>
      </div>
      {team.length === 0 ? (
        <p className="text-sm text-ink-soft">
          Add people in <a href="/equipa" className="font-bold text-accent underline">Team</a> first.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="text-xs font-semibold text-ink-mute">
            Employee
            <select value={memberId} onChange={(e) => setMemberId(e.target.value)} className={cn(field, "mt-1")}>
              {team.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          {visits ? (
            <label className="text-xs font-semibold text-ink-mute">
              Visit
              <select value={visit} onChange={(e) => setVisit(e.target.value)} className={cn(field, "mt-1")}>
                <option value="">Whole job</option>
                {visits.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="text-xs font-semibold text-ink-mute">
            Start date
            <input
              type="date"
              value={date}
              onClick={openPicker}
              onChange={(e) => setDate(e.target.value)}
              className={cn(field, "mt-1")}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div className="text-xs font-semibold text-ink-mute">
              Start time
              <TimeField ariaLabel="Start time" value={start} onChange={setStart} className={cn(field, "mt-1")} />
            </div>
            <div className="text-xs font-semibold text-ink-mute">
              End time
              <TimeField ariaLabel="End time" value={end} onChange={setEnd} className={cn(field, "mt-1")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:col-span-2">
            <label className="text-xs font-semibold text-ink-mute">
              Hours
              <input
                type="number"
                min={0}
                max={24}
                value={hours}
                disabled={Boolean(end)}
                onChange={(e) => setHours(e.target.value)}
                className={cn(field, "mt-1 disabled:bg-stone-100")}
                placeholder="or end time"
              />
            </label>
            <label className="text-xs font-semibold text-ink-mute">
              Minutes
              <input
                type="number"
                min={0}
                max={59}
                value={minutes}
                disabled={Boolean(end)}
                onChange={(e) => setMinutes(e.target.value)}
                className={cn(field, "mt-1 disabled:bg-stone-100")}
              />
            </label>
          </div>
          <label className="text-xs font-semibold text-ink-mute sm:col-span-2">
            Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
          </label>
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
