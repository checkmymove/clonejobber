"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui";
import { CardTitle } from "@/components/funnel/document-cards";
import { Avatar, LiveClock, TimeEntryForm } from "@/components/team/team-ui";
import { formatDateNumericLondon } from "@/lib/format";
import { deleteTimeEntryAction } from "@/lib/team/actions";
import type { JobLabour } from "@/lib/team/queries";
import { formatHoursMinutes } from "@/lib/team/time";

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
        {labour.byMember.map((m) => (
          <div key={m.id} className="flex items-center gap-2">
            <Avatar id={m.id} name={m.name} size={26} />
            <div className="leading-tight">
              <p className="text-[13px] font-bold text-ink">{m.name}</p>
              <p className="text-xs text-ink-soft">{formatHoursMinutes(m.seconds)}</p>
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
                <th className="py-2 pr-4 font-semibold">Notes</th>
                <th className="py-2 pr-4 text-right font-semibold">Duration</th>
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
                  <td data-label="Notes" className="py-3 pr-4 text-ink-soft">{e.notes || "—"}</td>
                  <td data-label="Duration" className="py-3 pr-4 text-right font-semibold text-ink">
                    {e.ended_at ? (
                      formatHoursMinutes(e.seconds)
                    ) : (
                      <LiveClock seconds={e.seconds} runningSince={e.started_at} serverNow={serverNow} />
                    )}
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
