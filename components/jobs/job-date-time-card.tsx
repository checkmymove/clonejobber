import Link from "next/link";
import { Pencil } from "lucide-react";
import { Card } from "@/components/ui";
import { EqualHeightBody } from "@/components/equal-height";
import { CardTitle } from "@/components/funnel/document-cards";
import { StatusDot } from "@/components/funnel/list-kit";
import { formatLongDateLondon } from "@/lib/format";
import type { JobVisit } from "@/lib/jobs/queries";
import { visitWindowLabel } from "@/lib/schedule/dates";

/** Job page "Date & time": the day and window of each visit, so the move date is in view. */
export function JobDateTimeCard({
  jobId,
  visits,
  stateOf,
  wide = false,
}: {
  jobId: string;
  visits: JobVisit[];
  stateOf: (v: JobVisit) => { label: string; dot: string };
  /** Full row when there is no Packing Service card to sit beside. */
  wide?: boolean;
}) {
  const live = visits.filter((v) => v.status !== "cancelled");
  return (
    <Card className={wide ? "h-fit p-5 xl:col-span-2" : "h-fit p-5"}>
      <CardTitle
        action={
          <Link
            href={`/servicos/${jobId}/editar`}
            aria-label="Edit date and time"
            className="grid h-7 w-7 place-items-center rounded-lg text-ink-soft hover:bg-cream hover:text-ink"
          >
            <Pencil size={14} />
          </Link>
        }
      >
        Date &amp; time
      </CardTitle>
      <EqualHeightBody label="date and time">
        {live.length === 0 ? (
          <p className="text-sm text-ink-mute">Not scheduled yet</p>
        ) : (
          <ul className="divide-y divide-line">
            {live.map((v) => {
              const state = stateOf(v);
              const scheduled = !v.later && v.visit_date;
              return (
                <li key={v.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold text-ink">
                      {scheduled ? formatLongDateLondon(v.visit_date as string) : "Not scheduled yet"}
                    </p>
                    {scheduled ? (
                      <p className="text-sm text-ink-soft">{visitWindowLabel(v.start_time, v.end_time, v.anytime)}</p>
                    ) : null}
                  </div>
                  <StatusDot dot={state.dot} label={state.label} />
                </li>
              );
            })}
          </ul>
        )}
      </EqualHeightBody>
    </Card>
  );
}
