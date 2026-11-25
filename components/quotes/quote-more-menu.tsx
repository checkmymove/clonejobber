"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Archive,
  Banknote,
  CalendarCheck,
  CheckCircle2,
  Eye,
  FileDown,
  Hammer,
  Mail,
  MoreHorizontal,
  Send,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { SendDialog, useSendDialog } from "@/components/funnel/send-dialog";
import {
  archiveSavedQuote,
  deleteSavedQuote,
  updateQuoteStatus,
} from "@/lib/quotes/actions";

const itemClass =
  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[15px] font-semibold text-[#1c3d46] hover:bg-[#f7f8f8] disabled:cursor-not-allowed disabled:opacity-40";

export function QuoteMoreMenu({
  quoteId,
  clientId,
  status,
  archived,
  jobId,
}: {
  quoteId: string;
  clientId: string;
  status: string;
  archived: boolean;
  jobId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const sender = useSendDialog();
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const convertible = status !== "rejected" && status !== "expired";
  const approvable = ["draft", "sent", "changes_requested"].includes(status);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (rootRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function run(label: string, work: () => Promise<{ ok: boolean; message?: string } | void>) {
    setError("");
    setPending(label);
    const result = await work();
    setPending("");
    setOpen(false);
    if (result && !result.ok) {
      setError(result.message || "Could not complete that action.");
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-card px-3 text-sm font-bold text-ink hover:bg-cream"
      >
        <MoreHorizontal size={16} />
        More
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute left-0 z-30 mt-2 w-64 rounded-xl border border-[#d5dde1] bg-white p-2 shadow-xl sm:left-auto sm:right-0"
        >
          {jobId ? (
            <Link href={`/servicos/${jobId}`} role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
              <Hammer size={18} />
              View job
            </Link>
          ) : null}
          <button
            type="button"
            role="menuitem"
            disabled={Boolean(pending) || archived || !approvable}
            title={status === "approved" ? "This quote is already approved" : undefined}
            onClick={() => void run("approved", () => updateQuoteStatus(quoteId, "approved"))}
            className={status === "approved" ? `${itemClass} disabled:opacity-100 text-emerald-700` : itemClass}
          >
            <ThumbsUp size={18} fill={status === "approved" ? "currentColor" : "none"} />
            <span>
              Approved
              <span className={`block text-xs font-semibold ${status === "approved" ? "text-emerald-700" : "text-sky-700"}`}>
                {status === "approved" ? "Approved" : status === "sent" ? "Sent" : status === "changes_requested" ? "Changes requested" : "Draft"}
              </span>
            </span>
          </button>
          {archived || !convertible ? (
            <button type="button" role="menuitem" disabled className={itemClass}>
              <Banknote size={18} />
              Collect Deposit
            </button>
          ) : (
            <Link
              href={`/pagamentos/novo?${new URLSearchParams({
                clientId,
                quoteId,
                kind: "deposit",
                returnTo: `/cotacoes/${quoteId}`,
              })}`}
              role="menuitem"
              className={itemClass}
              onClick={() => setOpen(false)}
            >
              <Banknote size={18} />
              Collect Deposit
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            disabled={Boolean(pending) || archived || !convertible}
            onClick={() => void run("send", () => sender.open("quote", quoteId))}
            className={itemClass}
          >
            <Mail size={18} />
            Send email &amp; text
          </button>
          {status !== "draft" ? (
            // Once sent, the header's green button is Convert to Job, so Resend lives here.
            <button
              type="button"
              role="menuitem"
              disabled={Boolean(pending) || archived}
              onClick={() => void run("resend", () => sender.open("quote", quoteId))}
              className={itemClass}
            >
              <Send size={18} />
              Resend quote
            </button>
          ) : null}
          <Link
            href={`/q/${quoteId}`}
            role="menuitem"
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            <Eye size={18} />
            Preview as Client
          </Link>
          {status === "sent" && !archived ? (
            <button
              type="button"
              role="menuitem"
              disabled={Boolean(pending)}
              onClick={() => void run("rejected", () => updateQuoteStatus(quoteId, "rejected"))}
              className={itemClass}
            >
              Decline
            </button>
          ) : null}
          <div className="my-1 h-px bg-[#e6ebed]" />
          <button
            type="button"
            role="menuitem"
            disabled={Boolean(pending)}
            onClick={() =>
              void run("delete", async () => {
                if (!window.confirm("Delete this quote? This cannot be undone.")) return { ok: true };
                return deleteSavedQuote(quoteId);
              })
            }
            className={`${itemClass} text-rose-700 hover:bg-rose-50`}
          >
            <Trash2 size={18} />
            Delete
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={Boolean(pending)}
            onClick={() => void run("archive", () => archiveSavedQuote(quoteId, !archived))}
            className={itemClass}
          >
            <Archive size={18} />
            {archived ? "Unarchive" : "Archive"}
          </button>
          <a
            href={`/api/quotes/${quoteId}/pdf`}
            role="menuitem"
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            <FileDown size={18} />
            Save PDF
          </a>
        </div>
      ) : null}
      {error ? <p className="mt-2 text-sm font-semibold text-rose-700">{error}</p> : null}
      {sender.draft ? (
        <SendDialog
          draft={sender.draft}
          onClose={sender.close}
          onDone={() => {
            sender.close();
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

/** Header button that moves the quote to the next stage, like Convert to Quote on a request. */
export function ConvertToJobButton({
  quoteId,
  status,
  archived,
  jobId,
}: {
  quoteId: string;
  status: string;
  archived: boolean;
  jobId: string | null;
}) {
  const green =
    "inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(15,23,42,0.08)] hover:opacity-90";
  if (jobId) {
    return (
      <Link href={`/servicos/${jobId}`} className={green}>
        <Hammer size={16} />
        View Job
      </Link>
    );
  }
  if (archived || status === "rejected" || status === "expired") return null;
  return (
    <Link href={`/servicos/novo?quoteId=${quoteId}`} className={green}>
      <Hammer size={16} />
      Convert to Job
    </Link>
  );
}

function useQuoteSender() {
  const sender = useSendDialog();
  const router = useRouter();
  const [error, setError] = useState("");
  const dialog = sender.draft ? (
    <SendDialog
      draft={sender.draft}
      onClose={sender.close}
      onDone={() => {
        sender.close();
        router.refresh();
      }}
    />
  ) : null;
  const send = async (quoteId: string) => {
    setError("");
    const opened = await sender.open("quote", quoteId);
    if (!opened.ok) setError(opened.message || "Could not prepare the quote email.");
  };
  return { send, dialog, error };
}

/** Green "Send Quote" in the header: the same send dialog as More › Send email & text. */
export function SendQuoteButton({ quoteId, status, archived }: { quoteId: string; status: string; archived: boolean }) {
  const { send, dialog, error } = useQuoteSender();
  const sendable = !archived && status !== "rejected" && status !== "expired";
  return (
    <div className="relative">
      <button
        type="button"
        disabled={!sendable}
        onClick={() => void send(quoteId)}
        className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(15,23,42,0.08)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Send size={16} aria-hidden />
        {status === "draft" ? "Send Quote" : "Resend Quote"}
      </button>
      {error ? <p className="absolute right-0 top-12 z-20 w-64 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p> : null}
      {dialog}
    </div>
  );
}

/** "Next steps" under the totals: send, preview, and move on to the job. */
export function QuoteNextSteps({
  quoteId,
  status,
  archived,
  jobId,
}: {
  quoteId: string;
  status: string;
  archived: boolean;
  jobId: string | null;
}) {
  const { send, dialog, error } = useQuoteSender();
  const open = !archived && status !== "rejected" && status !== "expired";
  const step =
    "inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-3.5 text-sm font-semibold text-ink hover:bg-cream";
  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
        <CheckCircle2 size={18} className="text-accent" aria-hidden />
        Next steps
      </p>
      <div className="flex flex-wrap gap-2">
        {open ? (
          <button
            type="button"
            onClick={() => void send(quoteId)}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-3.5 text-sm font-semibold text-white hover:opacity-90"
          >
            <Send size={15} aria-hidden />
            {status === "draft" ? "Send Quote" : "Resend Quote"}
          </button>
        ) : null}
        <Link href={`/q/${quoteId}`} className={step}>
          <Eye size={15} aria-hidden />
          Preview as client
        </Link>
        {jobId ? (
          <Link href={`/servicos/${jobId}`} className={step}>
            <Hammer size={15} aria-hidden />
            View job
          </Link>
        ) : open ? (
          <Link href={`/servicos/novo?quoteId=${quoteId}`} className={step}>
            <CalendarCheck size={15} aria-hidden />
            Convert to Job
          </Link>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-sm font-semibold text-rose-700">{error}</p> : null}
      {dialog}
    </div>
  );
}
