import { CalendarDays, Coins, FileText, Mail, Phone, UserRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";

export type InfoCell = { label: string; value: string; icon: LucideIcon; href?: string; /** Small line under the value. */ note?: string };

/** The job at a glance: who, how to reach them, the quote, the value and when. */
export function JobInfoStrip({ cells }: { cells: InfoCell[] }) {
  return (
    <Card className="p-2 xl:col-span-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        {cells.map((c) => (
          <div key={c.label} className="flex min-w-0 items-center gap-4 rounded-xl px-4 py-3.5">
            <c.icon size={24} strokeWidth={1.6} className="shrink-0 text-[#1d4ed8]" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-ink-soft">{c.label}</p>
              {c.href ? (
                <Link href={c.href} className="block truncate text-[15px] font-semibold text-accent hover:underline" title={c.value}>
                  {c.value || "—"}
                </Link>
              ) : (
                <p className="truncate text-[15px] font-medium text-ink" title={c.value}>
                  {c.value || "—"}
                </p>
              )}
              {c.note ? <p className="truncate text-[12px] text-ink-soft" title={c.note}>{c.note}</p> : null}
            </div>
            <CopyButton text={c.value} label={c.label.toLowerCase()} />
          </div>
        ))}
      </div>
    </Card>
  );
}

export const INFO_ICONS = { client: UserRound, phone: Phone, email: Mail, quote: FileText, value: Coins, date: CalendarDays };
