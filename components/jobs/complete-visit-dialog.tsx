"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Clock, FileText, Lock, Send, X } from "lucide-react";
import { SendDialog, useSendDialog } from "@/components/funnel/send-dialog";
import { Avatar } from "@/components/team/team-ui";
import { formatGBP, formatLongDateLondon } from "@/lib/format";
import { completeVisitAction, getVisitCompletionAction } from "@/lib/jobs/actions";
import type { VisitCompletion } from "@/lib/jobs/queries";
import type { JobLabour } from "@/lib/team/queries";
import { visitWindowLabel } from "@/lib/schedule/dates";
import { formatHoursMinutes } from "@/lib/team/time";

type Mode = "done" | "invoice" | "close";

// The visit being completed lives outside the checkbox: on the dashboard a completed
// visit's card moves to another group and remounts, which would drop the dialog and
// the send step that follows it.
let openVisitId: string | null = null;
const listeners = new Set<() => void>();

export function openCompleteVisit(visitId: string | null) {
  openVisitId = visitId;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Mounted once in the app shell, so the dialog survives the page refreshing under it. */
export function CompleteVisitHost() {
  const visitId = useSyncExternalStore(subscribe, () => openVisitId, () => null);
  return visitId ? <CompleteVisitDialog key={visitId} visitId={visitId} onClose={() => openCompleteVisit(null)} /> : null;
}
type Busy = Mode | "send" | null;

/**
 * Opens in front of the page when a visit's checkbox is ticked: shows the team's time
 * on the visit, then completes it with an invoice to send, without one, or closes the
 * job. Cancel leaves everything as it was.
 */
export function CompleteVisitDialog({ visitId, onClose }: { visitId: string; onClose: () => void }) {
  const router = useRouter();
  const sender = useSendDialog();
  const [data, setData] = useState<{ visit: VisitCompletion; labour: JobLabour } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    let live = true;
    getVisitCompletionAction(visitId).then((result) => {
      if (!live) return;
      if (result.ok && result.visit && result.labour) setData({ visit: result.visit, labour: result.labour });
      else setError(result.message ?? "Could not load this visit.");
    });
    return () => {
      live = false;
    };
  }, [visitId]);

  useEffect(() => {
    if (sender.draft) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose, sender.draft]);

  useEffect(() => {
    if (data) panelRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
  }, [data]);

  const finish = () => {
    onClose();
    router.refresh();
  };

  const complete = async (mode: Mode, then: "stay" | "send" | "open") => {
    setBusy(then === "send" ? "send" : mode);
    setError(null);
    const result = await completeVisitAction(visitId, mode);
    if (!result.ok) {
      setBusy(null);
      setError(result.message ?? "Something went wrong.");
      return;
    }
    const invoiceId = result.invoiceId ?? data?.visit.invoice?.id;
    if (then === "send" && invoiceId) {
      const opened = await sender.open("invoice", invoiceId);
      setBusy(null);
      if (opened.ok) return;
      // The visit is done and the invoice exists; only the send could not be prepared.
      setError(opened.message ?? "Could not prepare the invoice email.");
      router.refresh();
      return;
    }
    if (then === "open" && invoiceId) {
      onClose();
      router.push(`/faturas/${invoiceId}`);
      router.refresh();
      return;
    }
    finish();
  };

  if (!mounted) return null;

  if (sender.draft) {
    return createPortal(
      <SendDialog draft={sender.draft} onClose={finish} onDone={finish} />,
      document.body,
    );
  }

  const visit = data?.visit;
  const labour = data?.labour;
  const invoice = visit?.invoice ?? null;
  const lastVisit = visit ? visit.openVisits === 0 : false;
  const running = labour ? labour.entries.filter((e) => !e.ended_at).length : 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-[#123035]/45 p-4"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="complete-visit-title"
        onClick={(event) => event.stopPropagation()}
        className="max-h-[calc(100dvh-2rem)] w-full max-w-[560px] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-mute">Complete visit</p>
            <h2 id="complete-visit-title" className="mt-0.5 text-xl font-extrabold tracking-tight text-ink">
              {visit ? visit.clientName : "Loading…"}
            </h2>
            {visit ? (
              <p className="truncate text-sm text-ink-soft">
                {visit.jobNumber}
                {visit.jobTitle ? ` · ${visit.jobTitle}` : ""}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy !== null}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-soft hover:bg-cream disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {visit ? (
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={15} className="text-ink-mute" aria-hidden />
              {visit.visitDate ? formatLongDateLondon(visit.visitDate) : "Unscheduled"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock size={15} className="text-ink-mute" aria-hidden />
              {visitWindowLabel(visit.start, visit.end, visit.anytime)}
            </span>
          </p>
        ) : null}

        {labour ? (
          <div className="mt-4 rounded-xl border border-line">
            <div className="flex items-center justify-between border-b border-line px-3 py-2 text-xs font-bold uppercase tracking-wide text-ink-soft">
              <span>Team time on this visit</span>
              <span>
                {formatHoursMinutes(labour.seconds)} · {formatGBP(labour.price)}
              </span>
            </div>
            {labour.byMember.length === 0 ? (
              <p className="px-3 py-3 text-sm text-ink-mute">No time logged on this visit.</p>
            ) : (
              <ul className="divide-y divide-line">
                {labour.byMember.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <Avatar id={m.id} name={m.name} size={24} />
                    <span className="min-w-0 flex-1 truncate font-semibold text-ink">{m.name}</span>
                    <span className="tabular-nums text-ink-soft">{formatHoursMinutes(m.seconds)}</span>
                    <span className="w-20 text-right font-semibold tabular-nums text-ink">{formatGBP(m.price)}</span>
                  </li>
                ))}
              </ul>
            )}
            {running > 0 ? (
              <p className="border-t border-line px-3 py-2 text-xs text-ink-soft">
                {running === 1 ? "One clock is" : `${running} clocks are`} still running; completing stops{" "}
                {running === 1 ? "it" : "them"} now.
              </p>
            ) : null}
          </div>
        ) : null}

        {visit && !lastVisit ? (
          <p className="mt-3 text-sm text-ink-soft">
            {visit.openVisits === 1 ? "1 other visit is" : `${visit.openVisits} other visits are`} still open on this
            job. The job closes when the last one is done, or now with “Close job”.
          </p>
        ) : null}

        {error ? <p className="mt-3 text-sm font-semibold text-rose-700">{error}</p> : null}

        {visit ? (
          <div className="mt-5 space-y-2">
            {invoice ? (
              <>
                <button
                  type="button"
                  data-autofocus
                  disabled={busy !== null}
                  onClick={() => complete("done", "send")}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-white disabled:opacity-60"
                >
                  <Send size={16} aria-hidden />
                  {busy === "send" ? "Completing…" : `Complete & resend ${invoice.number}`}
                </button>
                <Link
                  href={`/faturas/${invoice.id}`}
                  onClick={onClose}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-line px-4 text-sm font-bold text-ink hover:bg-cream"
                >
                  <FileText size={16} aria-hidden />
                  View invoice {invoice.number}
                </Link>
              </>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  data-autofocus
                  disabled={busy !== null}
                  onClick={() => complete("invoice", "send")}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-white disabled:opacity-60"
                >
                  <Send size={16} aria-hidden />
                  {busy === "send" ? "Creating…" : "Create & send invoice"}
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => complete("invoice", "open")}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl border border-accent px-4 text-sm font-bold text-accent hover:bg-accent-soft disabled:opacity-60"
                >
                  <FileText size={16} aria-hidden />
                  {busy === "invoice" ? "Creating…" : "Create invoice"}
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
              <div className="flex flex-wrap gap-2">
                {!lastVisit ? (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => complete("done", "stay")}
                    className="h-10 rounded-xl border border-line px-3 text-sm font-bold text-ink hover:bg-cream disabled:opacity-60"
                  >
                    {busy === "done" ? "Saving…" : "Mark visit complete only"}
                  </button>
                ) : null}
                {!visit.jobClosed ? (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => {
                      const prompt = invoice
                        ? "Close this job? Open visits will be marked complete."
                        : "Close this job without an invoice? Open visits will be marked complete.";
                      if (window.confirm(prompt)) void complete("close", "stay");
                    }}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-bold text-ink hover:bg-cream disabled:opacity-60"
                  >
                    <Lock size={14} aria-hidden />
                    {busy === "close" ? "Closing…" : invoice ? "Close job" : "Close job without invoice"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => complete("done", "stay")}
                    className="h-10 rounded-xl border border-line px-3 text-sm font-bold text-ink hover:bg-cream disabled:opacity-60"
                  >
                    {busy === "done" ? "Saving…" : "Mark visit complete"}
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={busy !== null}
                className="h-10 rounded-xl px-3 text-sm font-bold text-ink-soft hover:bg-cream hover:text-ink disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : !error ? (
          <p className="mt-5 text-sm text-ink-mute">Loading visit…</p>
        ) : (
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-xl border border-line px-4 text-sm font-bold text-ink hover:bg-cream"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
