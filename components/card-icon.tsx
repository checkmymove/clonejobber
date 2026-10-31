import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/** Card titles across the detail pages: uppercase, dark, bold. */
export const CARD_TITLE = "text-[14px] font-bold uppercase tracking-wide text-ink";

const TONES = {
  blue: { text: "text-blue-600", box: "bg-blue-50" },
  violet: { text: "text-violet-600", box: "bg-violet-50" },
  emerald: { text: "text-emerald-600", box: "bg-emerald-50" },
  green: { text: "text-green-700", box: "bg-green-50" },
  rose: { text: "text-rose-600", box: "bg-rose-50" },
  orange: { text: "text-orange-500", box: "bg-orange-50" },
} as const;

export type IconTone = keyof typeof TONES;

/** The coloured icon before a card title; `boxed` sits it in a soft square. */
export function CardIcon({ icon: Icon, tone, boxed = false }: { icon: LucideIcon; tone: IconTone; boxed?: boolean }) {
  const t = TONES[tone];
  const glyph = <Icon size={20} strokeWidth={1.75} className={cn("shrink-0", t.text)} aria-hidden />;
  return boxed ? <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", t.box)}>{glyph}</span> : glyph;
}
