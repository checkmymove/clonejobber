"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, Pencil, Plus } from "lucide-react";
import { CARD_TITLE, CardIcon } from "@/components/card-icon";
import { openPicker } from "@/components/date-field";
import { inlineField } from "@/components/inline-edit-card";
import { StatusDot } from "@/components/funnel/list-kit";
import { VisitDoneToggle } from "@/components/jobs/job-actions";
import { Avatar } from "@/components/team/team-ui";
import { TimeField } from "@/components/time-field";
import { Card } from "@/components/ui";
import { cn } from "@/lib/cn";
import { addDays, addMinutesToClock } from "@/lib/schedule/dates";
import { COLLECTION_VISIT_TITLE, PACKING_VISIT_TITLE, isPackingVisit } from "@/lib/jobs/visit-kinds";
import { saveJobVisitAction } from "@/lib/jobs/visit-actions";

export type ScheduleVisit = {
  id: string;
  title: string;
  instructions: string;
  date: string | null;
  start: string;
  end: string;
  anytime: boolean;
  later: boolean;
  status: string;
  confirmed: boolean;
  memberIds: string[];
  assigneeText: string;
};

type Member = { id: string; name: string };

/** Saves of the Schedule editors open on the page (packing and collection on a job with packing). */
const pendingScheduleSaves = new Set<() => Promise<{ ok: boolean; message?: string }>>();

/**
 * Called by Send Job Confirmation: saves what is in every open Schedule editor (date, times,
 * team) and creates those visits, so the confirmations carry them. Nothing open → nothing to do.
 */
export async function savePendingSchedule(): Promise<{ ok: boolean; message?: string }> {
  for (const save of [...pendingScheduleSaves]) {
    const result = await save();
    if (!result.ok) return result;
  }
  return { ok: true };
}

/** Date and start time inherited from the funnel, plus the estimated duration set on the request. */
export type ScheduleDefaults = { date: string; start: string; durationMinutes?: number };

const MONTH = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });

function dmy(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function visitState(v: ScheduleVisit, today: string): { label: string; dot: string } {
  if (v.status === "done") return { label: "Completed", dot: "bg-emerald-500" };
  if (v.status === "cancelled") return { label: "Cancelled", dot: "bg-stone-400" };
  if (v.later || !v.date) return { label: "Unscheduled", dot: "bg-amber-400" };
  if (v.date < today) return { label: "Overdue", dot: "bg-rose-500" };
  if (v.date === today) return { label: "Today", dot: "bg-emerald-500" };
  return { label: "Scheduled", dot: "bg-sky-500" };
}

function visitTime(v: ScheduleVisit): string {
  if (v.later || !v.date) return "Unscheduled";
  if (v.anytime || !v.start) return `${dmy(v.date)} · Anytime`;
  return `${dmy(v.date)} · ${v.start}${v.end ? `–${v.end}` : ""}`;
}

function DateLeaf({ date }: { date: string | null }) {
  if (!date) return <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-cream text-xs text-ink-mute">—</span>;
  return (
    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-line bg-white leading-none">
      <span className="text-[11px] font-medium text-ink-soft">{MONTH.format(new Date(`${date}T12:00:00Z`))}</span>
      <span className="text-lg font-bold text-ink">{Number(date.slice(8, 10))}</span>
    </span>
  );
}

/** Date, start, end and team for one visit, saved straight from the Schedule box. */
function VisitEditor({
  jobId,
  visit,
  team,
  defaults,
  newTitle,
  onDone,
  onCancel,
}: {
  jobId: string;
  visit: ScheduleVisit | null;
  team: Member[];
  defaults: ScheduleDefaults;
  /** Title given to a new visit ("Packing service" / "Collection" on a job with packing). */
  newTitle?: string;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const durationMin = defaults.durationMinutes ?? 0;
  const endFrom = (s: string) => (s && durationMin > 0 ? addMinutesToClock(s, durationMin) : "");
  const [date, setDate] = useState(visit?.date ?? defaults.date);
  const [start, setStartRaw] = useState(visit ? (visit.anytime ? "" : visit.start) : defaults.start);
  const [end, setEndRaw] = useState(() => {
    if (visit && !visit.anytime && visit.end) return visit.end;
    return endFrom(visit ? (visit.anytime ? "" : visit.start) : defaults.start);
  });
  // End follows start (start + estimated duration from the request) until the user sets it by hand.
  const [endTouched, setEndTouched] = useState(Boolean(visit && !visit.anytime && visit.end));
  const setStart = (value: string) => {
    setStartRaw(value);
    if (!value) setEndRaw("");
    else if (!endTouched) setEndRaw(endFrom(value));
  };
  const setEnd = (value: string) => {
    setEndRaw(value);
    setEndTouched(true);
  };
  const [members, setMembers] = useState<string[]>(visit?.memberIds ?? []);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const save = async (): Promise<{ ok: boolean; message?: string }> => {
    if (!date) {
      const failed = { ok: false, message: "Choose a date in Schedule." };
      setMessage(failed.message);
      return failed;
    }
    setPending(true);
    setMessage(null);
    const result = await saveJobVisitAction(jobId, {
      visitId: visit?.id ?? null,
      date,
      start,
      end,
      memberIds: members,
      title: visit ? undefined : newTitle,
    });
    setPending(false);
    if (!result.ok) {
      setMessage(result.message ?? "Could not save.");
      return { ok: false, message: result.message ?? "Could not save the schedule." };
    }
    onDone();
    return { ok: true };
  };

  // While this editor is open, Send Job Confirmation saves it first (and creates the visit).
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    const flush = () => saveRef.current();
    pendingScheduleSaves.add(flush);
    return () => {
      pendingScheduleSaves.delete(flush);
    };
  }, []);

  return (
    <div className="rounded-xl border border-line bg-cream/40 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-[13px] text-ink-soft">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} onClick={openPicker} className={inlineField} />
        </label>
        <div>
          <span className="mb-1 block text-[13px] text-ink-soft">Start time</span>
          <TimeField value={start} onChange={setStart} className={inlineField} ariaLabel="Start time" placeholder="Anytime" />
        </div>
        <div>
          <span className="mb-1 block text-[13px] text-ink-soft">End time</span>
          <TimeField value={end} onChange={setEnd} disabled={!start} className={inlineField} ariaLabel="End time" />
        </div>
      </div>

      <p className="mb-1.5 mt-4 text-[13px] text-ink-soft">Team</p>
      {team.length === 0 ? (
        <p className="text-sm text-ink-mute">Add people in Team first.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {team.map((m) => {
            const on = members.includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={on}
                onClick={() => setMembers((list) => (on ? list.filter((id) => id !== m.id) : [...list, m.id]))}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-full border pl-1 pr-3 text-sm font-medium",
                  on ? "border-[#13213d] bg-[#13213d] text-white" : "border-line bg-white text-ink hover:bg-cream",
                )}
              >
                <Avatar id={m.id} name={m.name} size={26} />
                {m.name}
                {on ? <Check size={14} aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      )}

      {message ? <p className="mt-3 text-sm font-semibold text-rose-700">{message}</p> : null}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="h-10 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink hover:bg-cream"
          >
            Cancel
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void save()}
          disabled={pending || !date}
          className="h-10 rounded-xl bg-[#13213d] px-5 text-sm font-semibold text-white hover:bg-[#1e3a5f] disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

/** One list of visits with its own editor: the whole box, or Packing / Collection on a job with packing. */
function ScheduleSection({
  jobId,
  jobLabel,
  visits,
  team,
  defaults,
  today,
  heading,
  lead,
  newTitle,
}: {
  jobId: string;
  jobLabel: string;
  visits: ScheduleVisit[];
  team: Member[];
  defaults: ScheduleDefaults;
  today: string;
  /** Packing / Collection chip on a job with packing. */
  heading?: { label: string; tone: string; note?: string };
  /** Left side of the header row instead of a chip (the box title on a job without packing). */
  lead?: ReactNode;
  newTitle?: string;
}) {
  const router = useRouter();
  // With no visit yet the editor is already open: pick the time and the team, then save.
  const [editing, setEditing] = useState<string | null>(visits.length === 0 ? "new" : null);
  const names = new Map(team.map((m) => [m.id, m.name]));
  const done = () => {
    setEditing(null);
    router.refresh();
  };
  const addButton =
    editing === null ? (
      <button
        type="button"
        onClick={() => setEditing("new")}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-semibold text-ink hover:bg-cream"
      >
        <Plus size={15} aria-hidden /> Add visit
      </button>
    ) : null;

  return (
    <section className={heading ? "rounded-xl border border-line p-4" : undefined}>
      <div className={cn("flex items-center justify-between gap-2", heading ? "mb-3" : "mb-4")}>
        {lead ?? (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", heading?.tone)}>{heading?.label}</span>
            {heading?.note ? <span className="text-xs text-ink-mute">{heading.note}</span> : null}
          </div>
        )}
        {addButton}
      </div>

      {editing === "new" ? (
        <div className={visits.length ? "mb-4" : undefined}>
          <VisitEditor
            jobId={jobId}
            visit={null}
            team={team}
            defaults={defaults}
            newTitle={newTitle}
            onDone={done}
            onCancel={visits.length ? () => setEditing(null) : undefined}
          />
        </div>
      ) : null}

      {visits.length ? (
        <div className="overflow-x-auto">
          <table className="w-full fit-table text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs font-medium text-ink-soft">
                <th className="w-10 py-2" />
                <th className="py-2 pr-4 font-medium">Date and time</th>
                <th className="py-2 pr-4 font-medium">Title and instructions</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Assigned</th>
                <th className="w-10 py-2" />
              </tr>
            </thead>
            <tbody>
              {visits.map((v) => {
                const state = visitState(v, today);
                const assigned = v.memberIds.map((id) => names.get(id)).filter(Boolean).join(", ") || v.assigneeText;
                if (editing === v.id) {
                  return (
                    <tr key={v.id} className="border-b border-line last:border-0">
                      <td colSpan={6} className="py-3">
                        <VisitEditor jobId={jobId} visit={v} team={team} defaults={defaults} onDone={done} onCancel={() => setEditing(null)} />
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={v.id} className="border-b border-line align-middle last:border-0">
                    <td className="py-3">
                      <VisitDoneToggle visitId={v.id} done={v.status === "done"} />
                    </td>
                    <td className="whitespace-nowrap py-3 pr-4 text-ink">
                      <span className="flex items-center gap-3">
                        <DateLeaf date={v.later ? null : v.date} />
                        <span>
                          {visitTime(v)}
                          {v.confirmed ? <span className="block text-xs text-emerald-700">Confirmed by client</span> : null}
                        </span>
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-ink">{v.title || jobLabel}</p>
                      {v.instructions ? <p className="line-clamp-2 whitespace-pre-wrap text-ink-soft">{v.instructions}</p> : null}
                    </td>
                    <td className="py-3 pr-4">
                      <StatusDot dot={state.dot} label={state.label} />
                    </td>
                    <td data-label="Assigned" className="py-3 pr-4 text-ink-soft">
                      {assigned || <span className="text-rose-700">Unassigned</span>}
                    </td>
                    <td className="py-3 text-right">
                      {v.status !== "done" && v.status !== "cancelled" ? (
                        <button
                          type="button"
                          onClick={() => setEditing(v.id)}
                          aria-label="Change date, time or team"
                          title="Change date, time or team"
                          className="grid h-8 w-8 place-items-center rounded-lg border border-line text-ink-soft hover:bg-cream hover:text-ink"
                        >
                          <Pencil size={14} />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Job page Schedule box. A visit is set here directly: date, start and end time and the
 * team, saved in one step. On a job with packing there are two schedules, each with its
 * own date and team: Packing (by default the day before the request date) and Collection.
 */
export function JobScheduleCard({
  jobId,
  jobLabel,
  visits,
  team,
  defaults,
  today,
  approved,
  packing = false,
}: {
  jobId: string;
  jobLabel: string;
  visits: ScheduleVisit[];
  team: Member[];
  defaults: ScheduleDefaults;
  today: string;
  approved: boolean;
  /** The client asked for packing on the request: Packing and Collection schedules. */
  packing?: boolean;
}) {
  const common = { jobId, jobLabel, team, today };
  const title = (
    <div className="flex min-w-0 items-center gap-3">
      <CardIcon icon={CalendarDays} tone="blue" boxed />
      <h2 className={CARD_TITLE}>Schedule</h2>
      {approved ? (
        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Approved by client</span>
      ) : null}
    </div>
  );

  return (
    <Card className="h-fit p-5 xl:col-span-2">
      {packing ? (
        <>
          <div className="mb-4">{title}</div>
          <div className="space-y-4">
            <ScheduleSection
              {...common}
              visits={visits.filter((v) => isPackingVisit(v.title))}
              defaults={{ date: defaults.date ? addDays(defaults.date, -1) : defaults.date, start: defaults.start }}
              heading={{ label: "Packing", tone: "bg-orange-50 text-orange-800", note: "By default the day before the collection" }}
              newTitle={PACKING_VISIT_TITLE}
            />
            <ScheduleSection
              {...common}
              visits={visits.filter((v) => !isPackingVisit(v.title))}
              defaults={defaults}
              heading={{ label: "Collection", tone: "bg-emerald-50 text-emerald-800" }}
              newTitle={COLLECTION_VISIT_TITLE}
            />
          </div>
        </>
      ) : (
        <ScheduleSection {...common} visits={visits} defaults={defaults} lead={title} />
      )}
    </Card>
  );
}
