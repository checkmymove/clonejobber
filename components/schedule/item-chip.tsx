"use client";

import { Check } from "lucide-react";
import { KIND_META, type ScheduleItem } from "@/lib/schedule/types";
import { cn } from "@/lib/cn";

export function ItemChip({
  item,
  onOpen,
  compact,
}: {
  item: ScheduleItem;
  onOpen: (item: ScheduleItem) => void;
  compact?: boolean;
}) {
  const meta = KIND_META[item.kind];
  const bg = item.status === "done" ? meta.done : meta.color;
  return (
    <button
      type="button"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("application/x-opero-schedule", JSON.stringify({ id: item.id, kind: item.kind }));
        event.dataTransfer.effectAllowed = "move";
      }}
      onClick={(event) => {
        event.stopPropagation();
        onOpen(item);
      }}
      title={item.title}
      className={cn(
        "flex w-full items-start gap-1 rounded-[3px] px-1.5 py-[3px] text-left text-[11px] font-semibold leading-snug text-white shadow-sm",
        item.status === "done" && "opacity-80",
        compact && "text-[10px]",
      )}
      style={{ background: bg }}
    >
      {item.status === "done" ? <Check size={11} className="mt-[1px] shrink-0" /> : null}
      <span className="line-clamp-2">{item.title}</span>
    </button>
  );
}
