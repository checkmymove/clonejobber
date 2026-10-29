"use client";

import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

function normalize(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

// Older records keep times as "10:30 AM"; turn them into the 24h "HH:MM" this field edits.
export function toTime24(raw: string | null | undefined): string {
  const text = raw?.trim() ?? "";
  const match = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return text;
  let hour = Number(match[1]);
  const period = match[3]?.toUpperCase();
  if (period === "PM" && hour < 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;
  if (hour > 23) return text;
  return `${String(hour).padStart(2, "0")}:${match[2] ?? "00"}`;
}

// 24h "HH:MM" field: type it, or open the clock to pick hour then minute.
export function TimeField({
  value,
  onChange,
  disabled,
  className,
  ariaLabel,
  placeholder = "HH:MM",
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className: string;
  ariaLabel: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const [hh = "", mm = ""] = value.split(":");

  useEffect(() => {
    if (!open) return;
    function onDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    rootRef.current
      ?.querySelectorAll<HTMLElement>("[data-selected='true']")
      .forEach((el) => el.scrollIntoView({ block: "center" }));
  }, [open]);

  function pickHour(hour: string) {
    onChange(`${hour}:${mm || "00"}`);
  }
  function pickMinute(minute: string) {
    onChange(`${hh || "09"}:${minute}`);
    setOpen(false);
  }

  const option = (selected: boolean) =>
    `block w-full rounded-lg px-3 py-1.5 text-center text-[15px] ${
      selected ? "bg-[#388623] font-bold text-white" : "text-[#1c3d46] hover:bg-[#e7f3e3]"
    }`;

  return (
    <div ref={rootRef} className="relative">
      <input
        aria-label={ariaLabel}
        inputMode="numeric"
        placeholder={placeholder}
        maxLength={5}
        value={value}
        disabled={disabled}
        suppressHydrationWarning
        onClick={() => setOpen(true)}
        onChange={(event) => onChange(normalize(event.target.value))}
        className={`${className} cursor-pointer pr-10`}
      />
      <button
        type="button"
        disabled={disabled}
        aria-label={`Pick ${ariaLabel.toLowerCase()}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="absolute inset-y-0 right-0 grid w-10 place-items-center text-[#8aa0a8] hover:text-[#042b3c] disabled:cursor-not-allowed"
      >
        <Clock size={16} />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-30 mt-1 w-56 rounded-xl border border-[#d5dde1] bg-white p-2 shadow-xl">
          <div className="grid grid-cols-2 gap-2 px-1 pb-1 text-center text-[12px] font-bold uppercase tracking-wide text-[#5d6f78]">
            <span>Hour</span>
            <span>Minute</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="max-h-52 space-y-0.5 overflow-y-auto pr-1">
              {HOURS.map((hour) => (
                <button
                  key={hour}
                  type="button"
                  data-selected={hour === hh}
                  onClick={() => pickHour(hour)}
                  className={option(hour === hh)}
                >
                  {hour}
                </button>
              ))}
            </div>
            <div className="max-h-52 space-y-0.5 overflow-y-auto pr-1">
              {MINUTES.map((minute) => (
                <button
                  key={minute}
                  type="button"
                  data-selected={minute === mm}
                  onClick={() => pickMinute(minute)}
                  className={option(minute === mm)}
                >
                  {minute}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
