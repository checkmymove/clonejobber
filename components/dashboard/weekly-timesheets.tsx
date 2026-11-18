import Link from "next/link";
import { DashCard, DashTitle } from "@/components/dashboard/kit";
import { Avatar } from "@/components/team/team-ui";
import { weekdayShort } from "@/lib/schedule/dates";
import type { WeeklyTimesheets as Data } from "@/lib/team/queries";
import { hoursDecimal } from "@/lib/team/time";

/** Hours each person logged per day of the week, Monday to Sunday. */
export function WeeklyTimesheets({ data }: { data: Data }) {
  const shown = data.days.map((d, i) => ({ d, i }));

  return (
    <DashCard className="p-4 sm:p-5">
      <DashTitle
        action={
          <Link href="/horas" className="text-sm font-semibold text-[#1d4ed8] hover:underline">
            View all
          </Link>
        }
      >
        Weekly timesheets
      </DashTitle>
      {data.rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          Add your crew in{" "}
          <Link href="/equipa" className="font-semibold text-[#1d4ed8] underline">
            Team
          </Link>{" "}
          to track their hours.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs tabular-nums">
            <thead>
              <tr className="text-[11px] font-medium text-slate-500">
                <th className="py-2 pr-2 font-medium">Team member</th>
                {shown.map(({ d }) => (
                  <th key={d} className="px-1 py-2 text-center font-medium">
                    {weekdayShort(d)}
                  </th>
                ))}
                <th className="py-2 pl-1 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="py-2 pr-2">
                    <Link href={`/equipa/${r.id}`} className="flex min-w-0 items-center gap-2 hover:underline">
                      <span className="relative">
                        <Avatar id={r.id} name={r.name} size={24} />
                        {r.running ? (
                          <span
                            className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white"
                            title="Clocked in"
                          />
                        ) : null}
                      </span>
                      <span className="truncate text-slate-700">{r.name.split(" ")[0]}</span>
                    </Link>
                  </td>
                  {shown.map(({ d, i }) => (
                    <td key={d} className="px-1 py-2 text-center text-slate-600">
                      {hoursDecimal(r.seconds[i]) || <span className="text-slate-300">–</span>}
                    </td>
                  ))}
                  <td className="py-2 pl-1 text-right font-bold text-slate-900">
                    {hoursDecimal(r.total) ? `${hoursDecimal(r.total)}h` : <span className="font-normal text-slate-300">0h</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashCard>
  );
}
