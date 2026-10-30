"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui";
import { CardTitle } from "@/components/funnel/document-cards";
import { Avatar, LiveClock, TimeEntryForm } from "@/components/team/team-ui";
import { formatDateNumericLondon, formatGBP } from "@/lib/format";
import { deleteTimeEntryAction, updateTimeEntryDurationAction } from "@/lib/team/actions";
import type { JobLabour } from "@/lib/team/queries";
import { formatHoursMinutes, roundDownToHour } from "@/lib/team/time";

const clock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Jobber job page "Labour": time each person logged on this job. */
export function LabourCard({
  jobId,
  labour,
  team,
  visits,
  today,
  serverNow,
}: {
  jobId: string;
  labour: JobLabour;
  team: { id: string; name: string }[];
  visits: { id: string; label: string }[];
  today: string;
  serverNow: string;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const running = labour.entries.filter((e) => !e.ended_at).length;

  const remove = async (id: string) => {
    if (!window.confirm("Delete this time entry?")) return;
    setBusy(id);
    const result = await deleteTimeEntryAction(id);
    setBusy(null);
    if (result.ok) router.refresh();
  };

  return (
    <Card className="h-fit p-5 xl:col-span-2">
      <CardTitle
        action={
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            aria-label="Add time entry"
            className="grid h-7 w-7 place-items-center rounded-lg border border-line text-ink-soft hover:bg-cream hover:text-ink"
          >
            <Plus size={14} />
          </button>
        }
      >
        Labour
      </CardTitle>

      <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <div>
          <p className="text-xs text-ink-mute">Time spent on this job</p>
          <p className="text-2xl font-extrabold text-ink">
            <LiveClock
              seconds={labour.seconds}
              runningSince={running ? serverNow : null}
              serverNow={serverNow}
              rate={running}
            />
          </p>
        </div>
        <div>
          <p className="text-xs text-ink-mute">Labour to pay</p>
          <p className="text-2xl font-extrabold text-ink">{formatGBP(labour.price)}</p>
        </div>
        {labour.byMember.map((m) => (
          <div key={m.id} className="flex items-center gap-2">
            <Avatar id={m.id} name={m.name} size={26} />
            <div className="leading-tight">
              <p className="text-[13px] font-bold text-ink">{m.name}</p>
              <p className="text-xs text-ink-soft">
                {formatHoursMinutes(m.seconds)} · {formatGBP(m.price)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {adding ? (
        <TimeEntryForm
          jobId={jobId}
          visitId={visits.length === 1 ? visits[0].id : null}
          visits={visits}
          team={team}
          defaultDate={today}
          onClose={() => setAdding(false)}
        />
      ) : null}

      {labour.entries.length === 0 ? (
        <p className="text-sm text-ink-mute">
          No time logged yet. Clock in from today’s appointments on the dashboard, or add an entry.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full fit-table text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs font-semibold text-ink-mute">
                <th className="py-2 pr-4 font-semibold">Employee</th>
                <th className="py-2 pr-4 font-semibold">Date</th>
                <th className="py-2 pr-4 font-semibold">Time</th>
                <th className="py-2 pr-4 text-right font-semibold">Duration</th>
                <th className="py-2 pr-4 text-right font-semibold">Price</th>
                <th className="w-10 py-2" />
              </tr>
            </thead>
            <tbody>
              {labour.entries.map((e) => (
                <tr key={e.id} className="border-b border-line align-top last:border-0">
                  <td className="py-3 pr-4 font-semibold text-ink">{e.member_name}</td>
                  <td data-label="Date" className="py-3 pr-4 whitespace-nowrap text-ink-soft">
                    {formatDateNumericLondon(e.started_at)}
                  </td>
                  <td data-label="Time" className="py-3 pr-4 whitespace-nowrap text-ink-soft">
                    {clock.format(new Date(e.started_at))} – {e.ended_at ? clock.format(new Date(e.ended_at)) : "running"}
                  </td>
                  <td data-label="Duration" className="py-3 pr-4 text-right font-semibold text-ink">
                    {e.ended_at ? (
                      <DurationEditor entryId={e.id} seconds={e.seconds} />
                    ) : (
                      <span title="Clock out before editing">
                        <LiveClock seconds={e.seconds} runningSince={e.started_at} serverNow={serverNow} />
                      </span>
                    )}
                  </td>
                  <td
                    data-label="Price"
                    className="py-3 pr-4 text-right whitespace-nowrap text-ink"
                    title={e.hourly_rate > 0 ? `${formatGBP(Math.round(e.hourly_rate * 100))}/h` : "No hourly rate set"}
                  >
                    {e.ended_at ? formatGBP(e.price) : "—"}
                  </td>
                  <td className="py-3 text-right">
                    <button
                      type="button"
                      onClick={() => remove(e.id)}
                      disabled={busy === e.id}
                      aria-label="Delete time entry"
                      className="grid h-7 w-7 place-items-center rounded-lg text-ink-soft hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/** Click the duration to trim it (admin only: the crew has no login). Enter saves, Esc cancels. */
function DurationEditor({ entryId, seconds }: { entryId: string; seconds: number }) {
  const router = useRouter();
  const total = Math.max(0, Math.round(seconds / 60));
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const open = pos !== null;
  const setOpen = (value: boolean) => {
    const rect = buttonRef.current?.getBoundingClientRect();
    setPos(value && rect ? { top: rect.bottom + 4, right: Math.max(8, window.innerWidth - rect.right) } : null);
  };
  const [hours, setHours] = useState(String(Math.floor(total / 60)));
  const [minutes, setMinutes] = useState(String(total % 60));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const hoursRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setHours(String(Math.floor(total / 60)));
    setMinutes(String(total % 60));
    setError(null);
  };

  useEffect(() => {
    if (!open) return;
    hoursRef.current?.select();
    const outside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!boxRef.current?.contains(target) && !buttonRef.current?.contains(target)) setPos(null);
    };
    const close = (event: Event) => {
      if (event.target instanceof Node && boxRef.current?.contains(event.target)) return;
      setPos(null);
    };
    document.addEventListener("mousedown", outside);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", outside);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  const save = async () => {
    setPending(true);
    setError(null);
    const result = await updateTimeEntryDurationAction(entryId, hours, minutes);
    setPending(false);
    if (!result.ok) {
      setError(result.message ?? "Could not save.");
      return;
    }
    setOpen(false);
    router.refresh();
  };

  const roundDown = () => {
    const current = (Number(hours) || 0) * 60 + (Number(minutes) || 0);
    const next = roundDownToHour(current);
    setHours(String(Math.floor(next / 60)));
    setMinutes(String(next % 60));
  };

  const numberField =
    "h-9 w-14 rounded-lg border border-line bg-white px-2 text-right text-sm text-ink outline-none focus:border-accent";

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          reset();
          setOpen(!open);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Edit duration"
        className="rounded-md px-1 font-semibold text-ink underline decoration-dotted underline-offset-4 hover:bg-cream"
      >
        {formatHoursMinutes(seconds)}
      </button>
      {pos
        ? createPortal(
        <div
          ref={boxRef}
          role="dialog"
          aria-label="Edit duration"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              setOpen(false);
            } else if (event.key === "Enter") {
              event.preventDefault();
              if (!pending) void save();
            }
          }}
          style={{ top: pos.top, right: pos.right }}
          className="fixed z-[70] w-64 rounded-xl border border-line bg-white p-3 text-left text-sm font-normal shadow-xl"
        >
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Duration</p>
          <div className="flex items-center gap-1.5 text-sm text-ink">
            <input
              ref={hoursRef}
              aria-label="Hours"
              inputMode="numeric"
              className={numberField}
              value={hours}
              onChange={(e) => setHours(e.target.value.replace(/\D/g, ""))}
            />
            h
            <input
              aria-label="Minutes"
              inputMode="numeric"
              className={numberField}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ""))}
            />
            m
          </div>
          <button
            type="button"
            onClick={roundDown}
            className="mt-2 text-xs font-bold text-accent hover:underline"
          >
            Round down to full hours
          </button>
          {error ? <p className="mt-2 text-xs font-semibold text-rose-700">{error}</p> : null}
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-8 rounded-lg border border-line px-3 text-xs font-bold text-ink hover:bg-cream"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="h-8 rounded-lg bg-accent px-3 text-xs font-bold text-white disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>,
            document.body,
          )
        : null}
    </>
  );
}
