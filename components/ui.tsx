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
        "rounded-2xl border border-line bg-card shadow-[0_1px_3px_rgba(15,23,42,0.05)]",
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
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3 pt-1">
      <div className="min-w-0">
        <h1 className="text-[26px] font-bold leading-tight tracking-tight text-ink sm:text-[28px]">
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
  converted: "bg-violet-100 text-violet-900",
  rejected: "bg-rose-100 text-rose-900",
  expired: "bg-stone-200 text-stone-500",
  scheduled: "bg-sky-100 text-sky-900",
  in_progress: "bg-amber-100 text-amber-900",
  done: "bg-emerald-100 text-emerald-900",
  paid: "bg-emerald-100 text-emerald-900",
  overdue: "bg-rose-100 text-rose-900",
  cancelled: "bg-stone-200 text-stone-500",
};

export function Badge({ tone, children, size = "sm" }: { tone: string; children: ReactNode; size?: "sm" | "lg" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-semibold",
        size === "lg" ? "h-10 rounded-xl px-4 text-sm" : "rounded-full px-2.5 py-0.5 text-xs",
        badgeTones[tone] ?? "bg-stone-200 text-stone-700",
      )}
    >
      {children}
    </span>
  );
}

/** Header buttons of the detail pages: outlined and dark filled. */
export const buttonOutline =
  "inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-card px-4 text-sm font-semibold text-ink shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:bg-cream";
export const buttonDark =
  "inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(15,23,42,0.08)] hover:opacity-90";

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
