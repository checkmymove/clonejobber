import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Dashboard card: white, soft border and shadow, as in the dashboard design. */
export function DashCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function DashTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-lg font-bold tracking-tight text-slate-900">{children}</h2>
      {action}
    </div>
  );
}
