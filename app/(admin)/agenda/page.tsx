import { COMPANY_SLUG } from "@/lib/company";
import { todayLondonInput } from "@/lib/format";
import { isIsoDate, monthGrid, weekDays } from "@/lib/schedule/dates";
import { getScheduleBundle, getScheduleSettings } from "@/lib/schedule/queries";
import type { ScheduleView } from "@/lib/schedule/types";
import { ScheduleBoard } from "@/components/schedule/schedule-board";

export const dynamic = "force-dynamic";

function rangeFor(view: ScheduleView, date: string): { from: string; to: string } {
  if (view === "day") return { from: date, to: date };
  if (view === "week") {
    const days = weekDays(date);
    return { from: days[0], to: days[6] };
  }
  const cells = monthGrid(date);
  return { from: cells[0], to: cells[cells.length - 1] };
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const sp = await searchParams;
  const today = todayLondonInput();
  const view: ScheduleView = sp.view === "week" || sp.view === "day" ? sp.view : "month";
  const date = sp.date && isIsoDate(sp.date) ? sp.date : today;
  const { from, to } = rangeFor(view, date);
  const padded = rangeFor("month", date);
  const windowFrom = from < padded.from ? from : padded.from;
  const windowTo = to > padded.to ? to : padded.to;
  const [bundle, settings] = await Promise.all([
    getScheduleBundle(COMPANY_SLUG, windowFrom, windowTo),
    getScheduleSettings(COMPANY_SLUG),
  ]);

  return (
    <ScheduleBoard
      today={today}
      initialDate={date}
      initialView={view}
      items={bundle.items}
      unscheduled={bundle.unscheduled}
      assignees={bundle.assignees}
      settings={settings}
    />
  );
}
