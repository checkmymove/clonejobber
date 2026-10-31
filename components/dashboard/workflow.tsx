import { Fragment } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

export type WorkflowStage = {
  key: string;
  href: string;
  label: string;
  count: number;
  lines: { text: string; tone?: "warn" | "danger" }[];
};

/** Requests → Quotes → Jobs → Invoices, one card per stage of the funnel. */
export function Workflow({ stages }: { stages: WorkflowStage[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:flex lg:items-stretch lg:gap-0">
      {stages.map((s, i) => (
        <Fragment key={s.key}>
          {i > 0 ? (
            <span className="hidden w-8 shrink-0 place-items-center text-slate-700 lg:grid" aria-hidden>
              <ArrowRight size={18} />
            </span>
          ) : null}
          <Link
            href={s.href}
            className="group block min-w-0 flex-1 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition hover:border-slate-300 hover:shadow-md"
          >
            <p className="text-[15px] font-semibold text-slate-900">{s.label}</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[32px] font-bold leading-none tracking-tight text-slate-900">{s.count}</span>
              <ChevronRight
                size={20}
                className="shrink-0 text-slate-700 transition group-hover:translate-x-0.5"
                aria-hidden
              />
            </div>
            <div className="mt-3 space-y-0.5">
              {s.lines.map((line) => (
                <p
                  key={line.text}
                  className={cn(
                    "text-sm",
                    line.tone === "danger" ? "font-medium text-rose-600" : line.tone === "warn" ? "font-medium text-amber-700" : "text-slate-500",
                  )}
                >
                  {line.text}
                </p>
              ))}
            </div>
          </Link>
        </Fragment>
      ))}
    </div>
  );
}
