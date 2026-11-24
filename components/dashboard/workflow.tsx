import Link from "next/link";
import { ChevronRight, FileText, Hammer, Inbox, type LucideIcon, Quote } from "lucide-react";
import { cn } from "@/lib/cn";

export type WorkflowStage = {
  key: "requests" | "quotes" | "jobs" | "invoices";
  label: string;
  /** Big number and what it counts ("New", "Approved"…), opening the list with that filter. */
  count: number;
  amount?: string;
  status: string;
  href: string;
  /** The two smaller rows under it, each opening its own filter. */
  lines: { text: string; count: number; amount?: string; href: string; tone?: "danger" }[];
};

const STAGE: Record<WorkflowStage["key"], { icon: LucideIcon; bar: string; tint: string }> = {
  requests: { icon: Inbox, bar: "bg-[#c0660f]", tint: "text-[#c0660f]" },
  quotes: { icon: Quote, bar: "bg-[#a3354f]", tint: "text-[#a3354f]" },
  jobs: { icon: Hammer, bar: "bg-[#4f8a1f]", tint: "text-[#4f8a1f]" },
  invoices: { icon: FileText, bar: "bg-[#2f5f9e]", tint: "text-[#2f5f9e]" },
};

/**
 * Jobber's Home "Workflow": Requests → Quotes → Jobs → Invoices, each with the number that
 * needs action now (new requests, approved quotes, jobs to invoice, unpaid invoices) and
 * two rows below. Every part is a link to the list, filtered to exactly those rows.
 */
export function Workflow({ stages }: { stages: WorkflowStage[] }) {
  return (
    <section>
      <h2 className="mb-3 text-[22px] font-bold tracking-tight text-slate-900">Workflow</h2>
      <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)] sm:grid-cols-2 xl:grid-cols-4">
        {stages.map((s, i) => {
          const meta = STAGE[s.key];
          const Icon = meta.icon;
          return (
            <div
              key={s.key}
              className={cn(
                "relative flex min-w-0 flex-col border-slate-200/80",
                i > 0 && "border-t sm:border-t-0",
                i % 2 === 1 && "sm:border-l",
                i >= 2 && "sm:border-t xl:border-t-0",
                i > 0 && "xl:border-l",
              )}
            >
              <span className={cn("h-1.5 w-full", meta.bar)} aria-hidden />
              {i > 0 ? (
                <span
                  className="absolute -left-[11px] top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 place-items-center rounded-full border border-slate-200 bg-white text-slate-400 xl:grid"
                  aria-hidden
                >
                  <ChevronRight size={13} />
                </span>
              ) : null}
              <Link href={s.href} className="group block px-5 pb-2 pt-4 hover:bg-slate-50">
                <p className="flex items-center gap-2 text-[13px] font-medium text-slate-600">
                  <Icon size={17} className={meta.tint} aria-hidden />
                  {s.label}
                </p>
                <p className="mt-2 flex items-baseline gap-2">
                  <span className="text-[34px] font-extrabold leading-none tracking-tight text-slate-900">{s.count}</span>
                  {s.amount ? <span className="text-sm font-medium text-slate-600">{s.amount}</span> : null}
                </p>
                <p className="mt-2 text-[15px] font-bold text-slate-900 group-hover:underline">{s.status}</p>
              </Link>
              <ul className="space-y-0.5 px-2 pb-4">
                {s.lines.map((line) => (
                  <li key={line.text}>
                    <Link
                      href={line.href}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-lg px-3 py-1 text-sm hover:bg-slate-50 hover:underline",
                        line.tone === "danger" && line.count > 0 ? "text-rose-700" : "text-slate-700",
                      )}
                    >
                      <span>
                        {line.text} ({line.count})
                      </span>
                      {line.amount ? <span className="shrink-0 text-slate-600">{line.amount}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
