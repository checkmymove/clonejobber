"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Inbox,
  MapPin,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  addDays,
  addMonths,
  BUSINESS_HOURS,
  dayNum,
  formatClock12,
  hourFromOffset,
  hourFromStart,
  HOUR_PX,
  monthGrid,
  monthLabel,
  sameMonth,
  weekDays,
  weekdayShort,
} from "@/lib/schedule/dates";
import {
  KIND_META,
  STATUS_FILTERS,
  TYPE_FILTERS,
  type ScheduleItem,
  type ScheduleKind,
  type ScheduleSettings,
  type ScheduleView,
  type VisitNotifyDraft,
} from "@/lib/schedule/types";
import {
  completeScheduleItem,
  duplicateVisit,
  moveScheduleItem,
  resizeScheduleItem,
  saveScheduleSettings,
} from "@/lib/schedule/actions";
import { ItemChip } from "./item-chip";
import { ItemPopover } from "./item-popover";
import { CreateDialog } from "./create-dialog";
import { NotifyClientDialog } from "./notify-client-dialog";
import { TimedBlock } from "./timed-block";

type Filters = { types: string[]; team: string[]; statuses: string[] };

function visitCount(items: ScheduleItem[]) {
  const n = items.filter((item) => item.kind === "visit").length;
  if (n === 1) return "1 visit";
  if (n > 1) return `${n} visits`;
  return "";
}

function applyFilters(items: ScheduleItem[], filters: Filters, today: string) {
  return items.filter((item) => {
    const typeId = KIND_META[item.kind].filter;
    if (filters.types.length && !filters.types.includes(typeId)) return false;
    if (filters.team.length) {
      const key = item.assignee.trim() || "Unassigned";
      if (!filters.team.includes(key)) return false;
    }
    if (!filters.statuses.length) return true;
    const overdue = item.status === "scheduled" && !!item.date && item.date < today;
    const upcoming = item.status === "scheduled" && (!item.date || item.date >= today);
    const completed = item.status === "done";
    const buckets: string[] = [];
    if (overdue) buckets.push("overdue");
    if (completed) buckets.push("completed");
    if (upcoming) buckets.push("upcoming");
    if (item.confirmed) buckets.push("confirmed");
    return buckets.some((bucket) => filters.statuses.includes(bucket));
  });
}

function readDrop(event: React.DragEvent): { id: string; kind: ScheduleKind } | null {
  const raw = event.dataTransfer.getData("application/x-opero-schedule");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { id: string; kind: ScheduleKind };
  } catch {
    return null;
  }
}

function FilterMenu({
  label,
  value,
  options,
  selected,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-1 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink hover:bg-cream"
      >
        {label} <span className="text-ink-mute">|</span> {value}
        <ChevronDown size={14} />
      </button>
      {open ? (
        <>
          <button type="button" className="fixed inset-0 z-20" onClick={() => setOpen(false)} aria-label="Close" />
          <div className="absolute left-0 top-10 z-30 w-52 rounded-xl border border-line bg-white p-2 shadow-xl">
            <button
              type="button"
              className="w-full rounded-lg px-2 py-1.5 text-left text-sm font-semibold hover:bg-cream"
              onClick={() => {
                onChange([]);
                setOpen(false);
              }}
            >
              Clear
            </button>
            {options.map((option) => {
              const on = selected.includes(option.id);
              return (
                <label key={option.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() =>
                      onChange(on ? selected.filter((id) => id !== option.id) : [...selected, option.id])
                    }
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}

export function ScheduleBoard({
  today,
  initialDate,
  initialView,
  items,
  unscheduled,
  assignees,
  settings,
}: {
  today: string;
  initialDate: string;
  initialView: ScheduleView;
  items: ScheduleItem[];
  unscheduled: ScheduleItem[];
  assignees: string[];
  settings: ScheduleSettings;
}) {
  const router = useRouter();
  const [cursor, setCursor] = useState(initialDate);
  const [view, setView] = useState<ScheduleView>(initialView);
  const [filters, setFilters] = useState<Filters>({ types: [], team: [], statuses: [] });
  const [hideWeekends, setHideWeekends] = useState(settings.hideWeekends);
  const [showUnscheduled, setShowUnscheduled] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [createDate, setCreateDate] = useState<string | null>(null);
  const [openItem, setOpenItem] = useState<ScheduleItem | null>(null);
  const [dayOrientation, setDayOrientation] = useState<"vertical" | "horizontal">(settings.dayOrientation);
  const [notify, setNotify] = useState<VisitNotifyDraft | null>(null);

  const visibleItems = useMemo(() => applyFilters(items, filters, today), [items, filters, today]);
  const visibleUnscheduled = useMemo(
    () => applyFilters(unscheduled, filters, today),
    [unscheduled, filters, today],
  );

  function go(next: string, nextView = view) {
    setCursor(next);
    setView(nextView);
    router.replace(`/agenda?view=${nextView}&date=${next}`, { scroll: false });
  }

  async function persistSettings(next: ScheduleSettings) {
    setHideWeekends(next.hideWeekends);
    setDayOrientation(next.dayOrientation);
    await saveScheduleSettings(next);
  }

  async function handleDrop(event: React.DragEvent, date: string | null, start?: string) {
    event.preventDefault();
    const payload = readDrop(event);
    if (!payload) return;
    const result = await moveScheduleItem(payload.id, payload.kind, date, start);
    router.refresh();
    if (result.notify) setNotify(result.notify);
  }

  async function handleResize(item: ScheduleItem, end: string) {
    const result = await resizeScheduleItem(item.id, item.kind, end);
    router.refresh();
    if (result.notify) setNotify(result.notify);
  }

  const monthCells = monthGrid(cursor);
  const week = weekDays(cursor);
  const weekCols = hideWeekends && view !== "day" ? week.filter((d) => weekdayMon0Safe(d) < 5) : week;
  const monthCols = hideWeekends
    ? monthCells.filter((d) => weekdayMon0Safe(d) < 5)
    : monthCells;

  const teamOptions = [
    { id: "Unassigned", label: "Unassigned" },
    ...assignees.map((name) => ({ id: name, label: name })),
  ];

  const byDay = (day: string) =>
    visibleItems
      .filter((item) => item.date === day)
      .sort((a, b) => (a.start || "99").localeCompare(b.start || "99"));

  return (
    <div className="flex h-[calc(100dvh-4.5rem)] flex-col overflow-hidden rounded-2xl border border-line bg-white">
      <header className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <button
          type="button"
          onClick={() => setCursor((c) => c)}
          className="inline-flex items-center gap-1 text-lg font-extrabold text-ink"
        >
          {monthLabel(cursor)}
        </button>
        <button
          type="button"
          aria-label="Previous"
          onClick={() => go(view === "month" ? addMonths(cursor, -1) : addDays(cursor, view === "week" ? -7 : -1))}
          className="grid h-8 w-8 place-items-center rounded-lg hover:bg-cream"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          aria-label="Next"
          onClick={() => go(view === "month" ? addMonths(cursor, 1) : addDays(cursor, view === "week" ? 7 : 1))}
          className="grid h-8 w-8 place-items-center rounded-lg hover:bg-cream"
        >
          <ChevronRight size={18} />
        </button>
        <button
          type="button"
          onClick={() => go(today, view)}
          className="h-8 rounded-lg border border-line px-3 text-sm font-bold hover:bg-cream"
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => setCreateDate(cursor)}
          className="h-8 rounded-lg bg-[#3d8c45] px-3 text-sm font-bold text-white"
        >
          Create
        </button>
        <FilterMenu
          label="Type"
          value={filters.types.length ? String(filters.types.length) : "All"}
          options={TYPE_FILTERS.map((t) => ({ id: t.id, label: t.label }))}
          selected={filters.types}
          onChange={(types) => setFilters((f) => ({ ...f, types }))}
        />
        <FilterMenu
          label="Team"
          value={filters.team.length ? String(filters.team.length) : "All"}
          options={teamOptions}
          selected={filters.team}
          onChange={(team) => setFilters((f) => ({ ...f, team }))}
        />
        <FilterMenu
          label="Status"
          value={filters.statuses.length ? String(filters.statuses.length) : "All"}
          options={STATUS_FILTERS.map((s) => ({ id: s.id, label: s.label }))}
          selected={filters.statuses}
          onChange={(statuses) => setFilters((f) => ({ ...f, statuses }))}
        />
        <div className="ml-auto flex items-center gap-1">
          {(["month", "week", "day"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => go(cursor, key)}
              className={cn(
                "h-8 rounded-lg px-3 text-sm font-bold capitalize",
                view === key ? "bg-ink text-white" : "text-ink-soft hover:bg-cream",
              )}
            >
              {key}
            </button>
          ))}
          <button
            type="button"
            title="Unscheduled visits"
            aria-label="Unscheduled visits"
            onClick={() => setShowUnscheduled((v) => !v)}
            className={cn(
              "relative grid h-8 w-8 place-items-center rounded-lg hover:bg-cream",
              showUnscheduled && "bg-cream",
            )}
          >
            <Inbox size={16} />
            {visibleUnscheduled.length ? (
              <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#3d8c45] px-1 text-[10px] font-bold text-white">
                {visibleUnscheduled.length}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            title="Map"
            onClick={() => setShowMap((v) => !v)}
            className={cn("grid h-8 w-8 place-items-center rounded-lg hover:bg-cream", showMap && "bg-cream")}
          >
            <MapPin size={16} />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-sm font-bold hover:bg-cream"
            >
              More <MoreHorizontal size={16} />
            </button>
            {moreOpen ? (
              <div className="absolute right-0 top-9 z-30 w-56 rounded-xl border border-line bg-white p-2 shadow-xl">
                <button
                  type="button"
                  className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-cream"
                  onClick={() => {
                    void persistSettings({ hideWeekends: !hideWeekends, dayOrientation });
                    setMoreOpen(false);
                  }}
                >
                  {hideWeekends ? "Show weekends" : "Hide weekends"}
                </button>
                <button
                  type="button"
                  className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-cream"
                  onClick={() => {
                    const next = dayOrientation === "vertical" ? "horizontal" : "vertical";
                    void persistSettings({ hideWeekends, dayOrientation: next });
                    go(cursor, "day");
                    setMoreOpen(false);
                  }}
                >
                  Toggle day view orientation
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-auto">
          {view === "month" ? (
            <MonthGrid
              cells={monthCols}
              hideWeekends={hideWeekends}
              cursor={cursor}
              today={today}
              byDay={byDay}
              onOpen={setOpenItem}
              onCreate={setCreateDate}
              onDrop={handleDrop}
            />
          ) : null}
          {view === "week" ? (
            <WeekGrid
              days={weekCols}
              today={today}
              byDay={byDay}
              onOpen={setOpenItem}
              onCreate={setCreateDate}
              onDrop={handleDrop}
              onResize={handleResize}
            />
          ) : null}
          {view === "day" ? (
            <DayGrid
              day={cursor}
              today={today}
              items={byDay(cursor)}
              orientation={dayOrientation}
              onOpen={setOpenItem}
              onCreate={setCreateDate}
              onDrop={handleDrop}
              onResize={handleResize}
            />
          ) : null}
        </div>

        {showUnscheduled ? (
          <aside
            className="w-72 shrink-0 overflow-y-auto border-l border-line bg-[#fafaf7] p-3"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => handleDrop(event, null)}
          >
            <h2 className="text-sm font-extrabold text-ink">Unscheduled</h2>
            <p className="mt-1 text-xs text-ink-mute">Drag onto a day to schedule. These are jobs still waiting for a date.</p>
            <div className="mt-3 space-y-2">
              {visibleUnscheduled.map((item) => (
                <ItemChip key={`${item.kind}-${item.id}`} item={item} onOpen={setOpenItem} />
              ))}
              {visibleUnscheduled.length === 0 ? (
                <p className="text-sm text-ink-mute">No unscheduled visits.</p>
              ) : null}
            </div>
          </aside>
        ) : null}

        {showMap ? (
          <aside className="w-72 shrink-0 overflow-y-auto border-l border-line p-3">
            <h2 className="text-sm font-extrabold text-ink">Locations</h2>
            <p className="mt-1 text-xs text-ink-mute">Addresses for visits in this view.</p>
            <ul className="mt-3 space-y-2">
              {visibleItems
                .filter((item) => item.address)
                .map((item) => (
                  <li key={`${item.kind}-${item.id}`} className="rounded-lg border border-line p-2 text-xs">
                    <p className="font-bold text-ink">{item.clientName || item.title}</p>
                    <p className="text-ink-soft">{item.address}</p>
                    <p className="text-ink-mute">{item.date}</p>
                  </li>
                ))}
            </ul>
          </aside>
        ) : null}
      </div>

      {openItem ? (
        <ItemPopover
          item={openItem}
          onClose={() => setOpenItem(null)}
          onComplete={async (done) => {
            await completeScheduleItem(openItem.id, openItem.kind, done);
            setOpenItem(null);
            router.refresh();
          }}
          onDuplicate={
            openItem.kind === "visit"
              ? async () => {
                  await duplicateVisit(openItem.id);
                  setOpenItem(null);
                  router.refresh();
                }
              : undefined
          }
        />
      ) : null}
      {createDate ? <CreateDialog date={createDate} onClose={() => setCreateDate(null)} /> : null}
      {notify ? <NotifyClientDialog draft={notify} onClose={() => setNotify(null)} /> : null}
    </div>
  );
}

function weekdayMon0Safe(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

function MonthGrid({
  cells,
  hideWeekends,
  cursor,
  today,
  byDay,
  onOpen,
  onCreate,
  onDrop,
}: {
  cells: string[];
  hideWeekends: boolean;
  cursor: string;
  today: string;
  byDay: (day: string) => ScheduleItem[];
  onOpen: (item: ScheduleItem) => void;
  onCreate: (day: string) => void;
  onDrop: (event: React.DragEvent, date: string) => void;
}) {
  const headers = hideWeekends
    ? ["Mon", "Tue", "Wed", "Thu", "Fri"]
    : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const cols = hideWeekends ? 5 : 7;
  return (
    <div className="grid min-h-full" style={{ gridTemplateRows: "auto 1fr" }}>
      <div className="grid border-b border-line" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {headers.map((label) => (
            <div
              key={label}
              className={cn(
                "px-2 py-2 text-xs font-bold uppercase tracking-wide text-ink-mute",
                label === weekdayShort(today) && "text-[#2f6fed]",
              )}
            >
              {label}
            </div>
        ))}
      </div>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: "minmax(118px, 1fr)" }}>
        {cells.map((day) => {
          const dayItems = byDay(day);
          const inMonth = sameMonth(day, cursor);
          return (
            <div
              key={day}
              onClick={() => onCreate(day)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => onDrop(event, day)}
              className={cn(
                "min-h-[118px] cursor-pointer border-b border-r border-line p-1.5 hover:bg-[#fbfbf8]",
                !inMonth && "bg-[#f7f7f4] text-ink-mute",
                day === today && "bg-[#f3f7ff]",
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={cn(
                    "grid h-6 w-6 place-items-center text-sm font-bold",
                    day === today && "rounded-full bg-[#2f6fed] text-white",
                  )}
                >
                  {dayNum(day)}
                </span>
                <span className="text-[11px] font-semibold text-ink-mute">{visitCount(dayItems)}</span>
              </div>
              <div className="space-y-[3px]">
                {dayItems.slice(0, 6).map((item) => (
                  <ItemChip key={`${item.kind}-${item.id}`} item={item} onOpen={onOpen} compact />
                ))}
                {dayItems.length > 6 ? (
                  <p className="px-1 text-[11px] font-bold text-ink-mute">+{dayItems.length - 6} more</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekGrid({
  days,
  today,
  byDay,
  onOpen,
  onCreate,
  onDrop,
  onResize,
}: {
  days: string[];
  today: string;
  byDay: (day: string) => ScheduleItem[];
  onOpen: (item: ScheduleItem) => void;
  onCreate: (day: string) => void;
  onDrop: (event: React.DragEvent, date: string, start?: string) => void;
  onResize: (item: ScheduleItem, end: string) => void;
}) {
  return (
    <div className="min-w-[720px]">
      <div className="grid border-b border-line" style={{ gridTemplateColumns: `72px repeat(${days.length}, minmax(0, 1fr))` }}>
        <div />
        {days.map((day) => (
          <div key={day} className="px-2 py-2">
            <p className={cn("text-xs font-bold uppercase text-ink-mute", day === today && "text-[#2f6fed]")}>
              {weekdayShort(day)} {dayNum(day)}
            </p>
            <p className="text-[11px] font-semibold text-ink-mute">{visitCount(byDay(day))}</p>
          </div>
        ))}
      </div>
      <div className="grid border-b border-line" style={{ gridTemplateColumns: `72px repeat(${days.length}, minmax(0, 1fr))` }}>
        <div className="px-2 py-2 text-[11px] font-bold uppercase text-ink-mute">Anytime</div>
        {days.map((day) => (
          <div
            key={`any-${day}`}
            className="min-h-16 space-y-1 border-l border-line p-1"
            onClick={() => onCreate(day)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => onDrop(event, day)}
          >
            {byDay(day)
              .filter((item) => item.anytime || !item.start)
              .map((item) => (
                <ItemChip key={`${item.kind}-${item.id}`} item={item} onOpen={onOpen} compact />
              ))}
          </div>
        ))}
      </div>
      <div className="grid" style={{ gridTemplateColumns: `72px repeat(${days.length}, minmax(0, 1fr))` }}>
        <HourLabels />
        {days.map((day) => (
          <HourLane
            key={day}
            day={day}
            today={today}
            items={byDay(day).filter((item) => !item.anytime && item.start)}
            onOpen={onOpen}
            onCreate={onCreate}
            onDrop={onDrop}
            onResize={onResize}
          />
        ))}
      </div>
    </div>
  );
}

function DayGrid({
  day,
  today,
  items,
  orientation,
  onOpen,
  onCreate,
  onDrop,
  onResize,
}: {
  day: string;
  today: string;
  items: ScheduleItem[];
  orientation: "vertical" | "horizontal";
  onOpen: (item: ScheduleItem) => void;
  onCreate: (day: string) => void;
  onDrop: (event: React.DragEvent, date: string, start?: string) => void;
  onResize: (item: ScheduleItem, end: string) => void;
}) {
  const anytime = items.filter((item) => item.anytime || !item.start);
  const teams = [...new Set(items.map((item) => item.assignee.trim() || "Unassigned"))];
  if (orientation === "horizontal") {
    return (
      <div className="min-w-[900px]">
        <div className="grid" style={{ gridTemplateColumns: `140px repeat(${BUSINESS_HOURS.length}, minmax(80px, 1fr))` }}>
          <div className="border-b border-line p-2 text-xs font-bold uppercase text-ink-mute">Team</div>
          {BUSINESS_HOURS.map((hour) => (
            <div key={hour} className="border-b border-l border-line p-2 text-[11px] font-semibold text-ink-mute">
              {formatClock12(`${hour}:00`)}
            </div>
          ))}
          {teams.map((team) => (
            <TeamRow key={team} team={team} items={items} day={day} onOpen={onOpen} onDrop={onDrop} />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="border-b border-line px-3 py-2">
        <p className={cn("text-sm font-extrabold", day === today && "text-[#2f6fed]")}>
          {weekdayShort(day)} {dayNum(day)} · {visitCount(items) || "No visits"}
        </p>
      </div>
      <div className="border-b border-line p-2">
        <p className="mb-1 text-[11px] font-bold uppercase text-ink-mute">Anytime</p>
        <div className="max-w-md space-y-1">
          {anytime.map((item) => (
            <ItemChip key={`${item.kind}-${item.id}`} item={item} onOpen={onOpen} />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-[72px_minmax(0,1fr)]">
        <HourLabels />
        <HourLane
          day={day}
          today={today}
          items={items.filter((item) => !item.anytime && item.start)}
          onOpen={onOpen}
          onCreate={onCreate}
          onDrop={onDrop}
          onResize={onResize}
        />
      </div>
    </div>
  );
}

function HourLabels() {
  return (
    <div className="relative border-b border-line" style={{ height: BUSINESS_HOURS.length * HOUR_PX }}>
      {BUSINESS_HOURS.map((hour, index) => (
        <div
          key={hour}
          className="absolute left-0 right-0 px-2 text-[11px] font-semibold text-ink-mute"
          style={{ top: index * HOUR_PX }}
        >
          {formatClock12(`${hour}:00`)}
        </div>
      ))}
    </div>
  );
}

function HourLane({
  day,
  today,
  items,
  onOpen,
  onCreate,
  onDrop,
  onResize,
}: {
  day: string;
  today: string;
  items: ScheduleItem[];
  onOpen: (item: ScheduleItem) => void;
  onCreate: (day: string) => void;
  onDrop: (event: React.DragEvent, date: string, start?: string) => void;
  onResize: (item: ScheduleItem, end: string) => void;
}) {
  return (
    <div
      className={cn("relative border-b border-l border-line", day === today && "bg-[#f3f7ff]")}
      style={{ height: BUSINESS_HOURS.length * HOUR_PX }}
      onClick={() => onCreate(day)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        onDrop(event, day, hourFromOffset(event.clientY - rect.top));
      }}
    >
      {BUSINESS_HOURS.map((hour, index) => (
        <div
          key={hour}
          className="absolute inset-x-0 border-t border-line/70"
          style={{ top: index * HOUR_PX, height: HOUR_PX }}
        />
      ))}
      {items.map((item) => (
        <TimedBlock key={`${item.kind}-${item.id}`} item={item} onOpen={onOpen} onResize={onResize} />
      ))}
    </div>
  );
}

function TeamRow({
  team,
  items,
  day,
  onOpen,
  onDrop,
}: {
  team: string;
  items: ScheduleItem[];
  day: string;
  onOpen: (item: ScheduleItem) => void;
  onDrop: (event: React.DragEvent, date: string, start?: string) => void;
}) {
  return (
    <>
      <div className="border-b border-line p-2 text-sm font-bold text-ink">{team}</div>
      {BUSINESS_HOURS.map((hour) => (
        <div
          key={`${team}-${hour}`}
          className="min-h-16 space-y-1 border-b border-l border-line p-1"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => onDrop(event, day, `${String(hour).padStart(2, "0")}:00`)}
        >
          {items
            .filter((item) => (item.assignee.trim() || "Unassigned") === team && hourFromStart(item.start) === hour)
            .map((item) => (
              <ItemChip key={`${item.kind}-${item.id}`} item={item} onOpen={onOpen} compact />
            ))}
        </div>
      ))}
    </>
  );
}
