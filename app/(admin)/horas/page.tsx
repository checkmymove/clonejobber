import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { DashCard, DashTitle } from "@/components/dashboard/kit";
import { Avatar } from "@/components/team/team-ui";
import { COMPANY_SLUG } from "@/lib/company";
import { formatDateNumericLondon, formatGBP, todayLondonInput } from "@/lib/format";
import { addDays, isIsoDate, weekdayShort } from "@/lib/schedule/dates";
import { getTimesheetWeek } from "@/lib/team/queries";
import { formatHoursMinutes, hoursDecimal } from "@/lib/team/time";

export const dynamic = "force-dynamic";

const clock = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const short = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const dayLabel = (iso: string) => short.format(new Date(`${iso}T12:00:00Z`));

export default async function TimesheetsPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const sp = await searchParams;
  const today = todayLondonInput();
  const day = sp.week && isIsoDate(sp.week) ? sp.week : today;
  const { days, entries, team } = await getTimesheetWeek(COMPANY_SLUG, day);

  const rows = team
    .map((m) => {
      const mine = entries.filter((e) => e.member_id === m.id);
      const perDay = days.map((d) => mine.filter((e) => e.day === d).reduce((s, e) => s + e.seconds, 0));
      return {
        id: m.id,
        name: m.name,
        perDay,
        seconds: perDay.reduce((s, n) => s + n, 0),
        price: mine.reduce((s, e) => s + e.price, 0),
        running: mine.some((e) => !e.ended_at),
      };
    })
    .filter((r) => r.seconds > 0 || team.find((m) => m.id === r.id)?.active);
  const totalSeconds = rows.reduce((s, r) => s + r.seconds, 0);
  const totalPrice = rows.reduce((s, r) => s + r.price, 0);
  const arrow = "grid h-9 w-9 place-items-center rounded-lg text-ink hover:bg-cream";

  return (
    <div>
      <PageHeader
        title="Timesheets"
        subtitle="Hours the team logged on jobs, and what they earned at their hourly rate."
        action={
          <div className="flex h-12 items-center gap-1 rounded-2xl border border-line bg-card px-2 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
            <Link href={`/horas?week=${addDays(days[0], -7)}`} aria-label="Previous week" className={arrow}>
              <ChevronLeft size={18} />
            </Link>
            <span className="min-w-[150px] text-center text-[15px] font-semibold text-ink">
              {dayLabel(days[0])} – {dayLabel(days[6])}
            </span>
            <Link href={`/horas?week=${addDays(days[0], 7)}`} aria-label="Next week" className={arrow}>
              <ChevronRight size={18} />
            </Link>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <DashCard className="p-5">
          <p className="text-sm text-ink-soft">Hours this week</p>
          <p className="mt-1 text-[32px] font-bold leading-none tracking-tight text-ink">{hoursDecimal(totalSeconds) || "0"}h</p>
        </DashCard>
        <DashCard className="p-5">
          <p className="text-sm text-ink-soft">Labour to pay</p>
          <p className="mt-1 text-[32px] font-bold leading-none tracking-tight text-ink">{formatGBP(totalPrice)}</p>
        </DashCard>
        <DashCard className="p-5">
          <p className="text-sm text-ink-soft">Time entries</p>
          <p className="mt-1 text-[32px] font-bold leading-none tracking-tight text-ink">{entries.length}</p>
        </DashCard>
      </div>

      <DashCard className="mb-4 p-4 sm:p-5">
        <DashTitle>Week by person</DashTitle>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm tabular-nums">
            <thead>
              <tr className="border-b border-line text-xs font-medium text-ink-soft">
                <th className="py-2.5 pr-3 font-medium">Team member</th>
                {days.map((d) => (
                  <th key={d} className={`px-2 py-2.5 text-center font-medium ${d === today ? "text-[#1d4ed8]" : ""}`}>
                    {weekdayShort(d)}
                    <span className="block text-[11px] font-normal text-ink-mute">{dayLabel(d)}</span>
                  </th>
                ))}
                <th className="px-2 py-2.5 text-right font-medium">Total</th>
                <th className="py-2.5 pl-2 text-right font-medium">Pay</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="py-2.5 pr-3">
                    <Link href={`/equipa/${r.id}`} className="flex items-center gap-2.5 hover:underline">
                      <span className="relative">
                        <Avatar id={r.id} name={r.name} size={28} />
                        {r.running ? (
                          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" title="Clocked in" />
                        ) : null}
                      </span>
                      <span className="font-medium text-ink">{r.name}</span>
                    </Link>
                  </td>
                  {r.perDay.map((s, i) => (
                    <td key={days[i]} className="px-2 py-2.5 text-center text-ink-soft">
                      {hoursDecimal(s) || <span className="text-ink-mute/60">–</span>}
                    </td>
                  ))}
                  <td className="px-2 py-2.5 text-right font-bold text-ink">{hoursDecimal(r.seconds) || "0"}h</td>
                  <td className="py-2.5 pl-2 text-right font-semibold text-ink">{formatGBP(r.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DashCard>

      <DashCard className="p-4 sm:p-5">
        <DashTitle>Entries</DashTitle>
        {entries.length === 0 ? (
          <p className="mt-4 rounded-xl bg-cream px-4 py-6 text-center text-sm text-ink-soft">
            No time logged this week. Clock in from the dashboard, or add time on a job.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="fit-table w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs font-medium text-ink-soft">
                  <th className="py-2.5 pr-4 font-medium">Employee</th>
                  <th className="py-2.5 pr-4 font-medium">Job</th>
                  <th className="py-2.5 pr-4 font-medium">Date</th>
                  <th className="py-2.5 pr-4 font-medium">Time</th>
                  <th className="py-2.5 pr-4 text-right font-medium">Duration</th>
                  <th className="py-2.5 text-right font-medium">Price</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-line last:border-0">
                    <td className="py-3 pr-4 font-medium text-ink">{e.member_name}</td>
                    <td data-label="Job" className="py-3 pr-4">
                      {e.job_id ? (
                        <Link href={`/servicos/${e.job_id}`} className="font-medium text-[#1d4ed8] hover:underline">
                          {e.job_number}
                          {e.job_client ? <span className="text-ink-soft"> · {e.job_client}</span> : null}
                        </Link>
                      ) : (
                        <span className="text-ink-mute">—</span>
                      )}
                    </td>
                    <td data-label="Date" className="py-3 pr-4 whitespace-nowrap text-ink-soft">{formatDateNumericLondon(e.started_at)}</td>
                    <td data-label="Time" className="py-3 pr-4 whitespace-nowrap text-ink-soft">
                      {clock.format(new Date(e.started_at))} – {e.ended_at ? clock.format(new Date(e.ended_at)) : <span className="font-medium text-emerald-700">running</span>}
                    </td>
                    <td className="py-3 pr-4 text-right font-semibold text-ink">{formatHoursMinutes(e.seconds)}</td>
                    <td className="py-3 text-right text-ink">{e.ended_at ? formatGBP(e.price) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-ink-mute">To change a duration, open the job: its Labour card edits each entry.</p>
      </DashCard>
    </div>
  );
}
