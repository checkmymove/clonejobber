"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createScheduleEvent, createScheduleTask } from "@/lib/schedule/actions";

export function CreateDialog({
  date,
  onClose,
}: {
  date: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<"job" | "task" | "event" | "request">("job");
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("11:00");
  const [anytime, setAnytime] = useState(true);
  const [later, setLater] = useState(false);
  const [assignee, setAssignee] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function save() {
    if (kind === "job") {
      router.push(`/servicos/novo?date=${date}`);
      return;
    }
    if (kind === "request") {
      router.push("/solicitacoes/novo");
      return;
    }
    setPending(true);
    setError("");
    const payload = { title, date, start, end, anytime, later, notes, assignee };
    try {
      const result =
        kind === "task" ? await createScheduleTask(payload) : await createScheduleEvent(payload);
      if (!result.ok) {
        setError(result.message ?? "Could not save.");
        return;
      }
      onClose();
    } catch {
      setError("Could not save. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-ink">Create</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-cream" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-ink-mute">
          Type
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as typeof kind)}
            className="mt-1 h-10 w-full rounded-xl border border-line bg-white px-3 text-sm font-semibold text-ink"
          >
            <option value="job">New job</option>
            <option value="task">New task</option>
            <option value="event">New event</option>
            <option value="request">New request</option>
          </select>
        </label>
        {kind === "task" || kind === "event" ? (
          <>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={kind === "task" ? "Task title" : "Event title"}
              className="mt-3 h-11 w-full rounded-xl border border-line px-3 text-sm"
            />
            {kind === "task" ? (
              <input
                value={assignee}
                onChange={(event) => setAssignee(event.target.value)}
                placeholder="Assign to (optional)"
                className="mt-3 h-11 w-full rounded-xl border border-line px-3 text-sm"
              />
            ) : null}
            <label className="mt-3 flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={later} onChange={(event) => setLater(event.target.checked)} />
              Schedule later
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={anytime}
                disabled={later}
                onChange={(event) => setAnytime(event.target.checked)}
              />
              Anytime
            </label>
            {!anytime && !later ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <input type="time" value={start} onChange={(event) => setStart(event.target.value)} className="h-11 rounded-xl border border-line px-3" />
                <input type="time" value={end} onChange={(event) => setEnd(event.target.value)} className="h-11 rounded-xl border border-line px-3" />
              </div>
            ) : null}
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Notes"
              className="mt-3 h-20 w-full rounded-xl border border-line px-3 py-2 text-sm"
            />
          </>
        ) : (
          <p className="mt-3 text-sm text-ink-soft">
            {kind === "job"
              ? `Opens a new job with a visit on ${date}. Confirmed jobs appear on this schedule.`
              : "Opens a new request. Assessments then show on the schedule."}
          </p>
        )}
        {error ? <p className="mt-3 text-sm font-semibold text-rose-700">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-xl border border-line px-4 text-sm font-bold">
            Cancel
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={save}
            className="h-10 rounded-xl bg-[#3d8c45] px-4 text-sm font-bold text-white disabled:opacity-60"
          >
            {kind === "task" || kind === "event" ? "Save" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
