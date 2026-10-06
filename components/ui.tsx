import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({
  children,
  className,
  accent,
}: {
  children: ReactNode;
  className?: string;
  accent?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-card shadow-[0_1px_2px_rgba(18,48,53,0.06)]",
        className,
      )}
      style={accent ? { borderTop: `3px solid ${accent}` } : undefined}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

const badgeTones: Record<string, string> = {
  new: "bg-amber-100 text-amber-900",
  review: "bg-amber-100 text-amber-900",
  quoted: "bg-emerald-100 text-emerald-900",
  archived: "bg-stone-200 text-stone-600",
  draft: "bg-stone-200 text-stone-700",
  sent: "bg-sky-100 text-sky-900",
  changes_requested: "bg-sky-100 text-sky-900",
  viewed: "bg-sky-100 text-sky-900",
  approved: "bg-emerald-100 text-emerald-900",
  rejected: "bg-rose-100 text-rose-900",
  expired: "bg-stone-200 text-stone-500",
  scheduled: "bg-sky-100 text-sky-900",
  in_progress: "bg-amber-100 text-amber-900",
  done: "bg-emerald-100 text-emerald-900",
  paid: "bg-emerald-100 text-emerald-900",
  overdue: "bg-rose-100 text-rose-900",
  cancelled: "bg-stone-200 text-stone-500",
};

export function Badge({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        badgeTones[tone] ?? "bg-stone-200 text-stone-700",
      )}
    >
      {children}
    </span>
  );
}

export function SearchInput({
  placeholder,
  wide,
}: {
  placeholder: string;
  wide?: boolean;
}) {
  return (
    <input
      type="search"
      placeholder={placeholder}
      aria-label={placeholder}
      className={cn(
        "h-10 rounded-xl border border-line bg-card px-3 text-sm text-ink outline-none focus:border-accent",
        wide ? "w-full sm:max-w-sm" : "w-full sm:w-64",
      )}
    />
  );
}

export function PrimaryButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-bold text-white hover:opacity-90"
    >
      {children}
    </button>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl bg-cream px-4 py-6 text-sm text-ink-soft">
      {children}
    </div>
  );
}
