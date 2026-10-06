"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Archive,
  Check,
  Eye,
  FileDown,
  Hammer,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Send,
  Trash2,
} from "lucide-react";
import { EmailQuoteDialog } from "@/components/quotes/email-quote-dialog";
import { SmsQuoteDialog } from "@/components/quotes/sms-quote-dialog";
import type { QuoteEmailDraft } from "@/lib/email/draft";
import type { QuoteSmsDraft } from "@/lib/sms/draft";
import {
  archiveSavedQuote,
  deleteSavedQuote,
  prepareSavedQuoteEmail,
  prepareSavedQuoteSms,
  updateQuoteStatus,
} from "@/lib/quotes/actions";

const itemClass =
  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[15px] font-semibold text-[#1c3d46] hover:bg-[#f7f8f8] disabled:cursor-not-allowed disabled:opacity-40";

export function QuoteMoreMenu({
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
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [emailDraft, setEmailDraft] = useState<QuoteEmailDraft | null>(null);
  const [smsDraft, setSmsDraft] = useState<QuoteSmsDraft | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

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
          {status === "draft" && !archived ? (
            <button
              type="button"
              role="menuitem"
              disabled={Boolean(pending)}
              onClick={() => void run("sent", () => updateQuoteStatus(quoteId, "sent"))}
              className={itemClass}
            >
              <Send size={18} />
              Mark as sent
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            disabled={Boolean(pending) || archived}
            onClick={() =>
              void run("email", async () => {
                const prepared = await prepareSavedQuoteEmail(quoteId);
                if (!prepared.ok || !prepared.draft) return prepared;
                setEmailDraft(prepared.draft);
              })
            }
            className={itemClass}
          >
            <Mail size={18} />
            Send as Email
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={Boolean(pending) || archived}
            onClick={() =>
              void run("sms", async () => {
                const prepared = await prepareSavedQuoteSms(quoteId);
                if (!prepared.ok || !prepared.draft) return prepared;
                setSmsDraft(prepared.draft);
              })
            }
            className={itemClass}
          >
            <MessageSquare size={18} />
            Send Text Message
          </button>
          {jobId ? (
            <Link href={`/servicos/${jobId}`} role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
              <Hammer size={18} />
              View job
            </Link>
          ) : (
            <Link
              href={`/servicos/novo?quoteId=${quoteId}`}
              role="menuitem"
              className={itemClass}
              onClick={() => setOpen(false)}
            >
              <Hammer size={18} />
              Convert to Job
            </Link>
          )}
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
            <>
              <button
                type="button"
                role="menuitem"
                disabled={Boolean(pending)}
                onClick={() => void run("approved", () => updateQuoteStatus(quoteId, "approved"))}
                className={itemClass}
              >
                <Check size={18} />
                Approve
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={Boolean(pending)}
                onClick={() => void run("rejected", () => updateQuoteStatus(quoteId, "rejected"))}
                className={itemClass}
              >
                Decline
              </button>
            </>
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
      {emailDraft ? <EmailQuoteDialog draft={emailDraft} onClose={() => setEmailDraft(null)} /> : null}
      {smsDraft ? <SmsQuoteDialog draft={smsDraft} onClose={() => setSmsDraft(null)} /> : null}
    </div>
  );
}
