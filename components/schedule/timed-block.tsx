"use client";

import { useRef, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  addMinutesToClock,
  blockLayout,
  clockFromMinutes,
  DAY_END_HOUR,
  durationMinutes,
  HOUR_PX,
  minutesFromClock,
  snapMinutes,
} from "@/lib/schedule/dates";
import { KIND_META, type ScheduleItem } from "@/lib/schedule/types";

export function TimedBlock({
  item,
  onOpen,
  onResize,
}: {
  item: ScheduleItem;
  onOpen: (item: ScheduleItem) => void;
  onResize: (item: ScheduleItem, end: string) => void;
}) {
  const meta = KIND_META[item.kind];
  const startMin = minutesFromClock(item.start) ?? 9 * 60;
  const [previewEnd, setPreviewEnd] = useState<string | null>(null);
  const resized = useRef(false);
  const fallbackEnd = item.end || addMinutesToClock(item.start, 60);
  const end = previewEnd ?? fallbackEnd;
  const layout = blockLayout(item.start, end);
  const bg = item.status === "done" ? meta.done : meta.color;
  const canResize = item.kind === "visit" || item.kind === "task" || item.kind === "event";

  function beginResize(event: React.PointerEvent<HTMLSpanElement>) {
    if (!canResize) return;
    event.preventDefault();
    event.stopPropagation();
    const origin = minutesFromClock(end) ?? startMin + 60;
    const original = minutesFromClock(item.end) ?? startMin + durationMinutes(item.start, item.end);
    const startY = event.clientY;
    const handle = event.currentTarget;
    let live = origin;
    handle.setPointerCapture(event.pointerId);
    resized.current = false;

    function onMove(move: PointerEvent) {
      const delta = ((move.clientY - startY) / HOUR_PX) * 60;
      live = Math.min(DAY_END_HOUR * 60, Math.max(startMin + 15, snapMinutes(origin + delta)));
      setPreviewEnd(clockFromMinutes(live));
      resized.current = true;
    }

    function onUp(up: PointerEvent) {
      handle.releasePointerCapture(up.pointerId);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      setPreviewEnd(null);
      if (live !== original) onResize(item, clockFromMinutes(live));
    }

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
  }

  return (
    <button
      type="button"
      draggable
      onDragStart={(event) => {
        if (resized.current) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.setData(
          "application/x-opero-schedule",
          JSON.stringify({ id: item.id, kind: item.kind }),
        );
        event.dataTransfer.effectAllowed = "move";
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (resized.current) {
          resized.current = false;
          return;
        }
        onOpen(item);
      }}
      title={`${item.title} · drag to move, pull the bottom edge to resize`}
      className="absolute left-1 right-1 z-10 overflow-hidden rounded-[4px] text-left text-[11px] font-semibold leading-snug text-white shadow-sm"
      style={{ top: layout.top, height: layout.height, background: bg }}
    >
      <span className={cn("flex h-full items-start gap-1 px-1.5 py-1", item.status === "done" && "opacity-80")}>
        {item.status === "done" ? <Check size={11} className="mt-[1px] shrink-0" /> : null}
        <span className="line-clamp-3">{item.title}</span>
      </span>
      {canResize ? (
        <span
          role="separator"
          aria-label="Resize visit"
          onPointerDown={beginResize}
          className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
        />
      ) : null}
    </button>
  );
}
