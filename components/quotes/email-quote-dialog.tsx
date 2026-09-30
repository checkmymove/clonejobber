"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { sendPreparedQuoteEmail } from "@/lib/quotes/actions";
import type { QuoteEmailDraft } from "@/lib/email/draft";

const green = "#388623";

export function EmailQuoteDialog({
  draft,
  onClose,
}: {
  draft: QuoteEmailDraft;
  onClose: () => void;
}) {
  const [to, setTo] = useState(draft.to);
  const [editingTo, setEditingTo] = useState(!draft.to);
  const [subject, setSubject] = useState(draft.subject);
  const [message, setMessage] = useState(draft.message);
  const [copy, setCopy] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, pending]);

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-[#123035]/45 p-4"
      onClick={() => {
        if (!pending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-quote-title"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !(event.target instanceof HTMLTextAreaElement)) {
            event.preventDefault();
          }
        }}
        className="max-h-[calc(100dvh-2rem)] w-full max-w-[920px] overflow-y-auto rounded-2xl bg-white px-6 py-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="email-quote-title" className="text-[22px] font-bold tracking-tight text-[#042b3c]">
            Email quote {draft.number} to {draft.clientName}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-lg text-[#5d6f78] hover:bg-[#f4f6f7]"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-[13px] text-[#5d6f78]">To</span>
              <div className="flex min-h-11 items-center rounded-lg border border-[#d5dde1] px-2">
                {to && !editingTo ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#eef2f3] px-3 py-1 text-sm text-[#042b3c]">
                    {to}
                    <button
                      type="button"
                      aria-label="Remove recipient"
                      onClick={() => {
                        setTo("");
                        setEditingTo(true);
                      }}
                      className="text-[#5d6f78]"
                    >
                      <X size={14} />
                    </button>
                  </span>
                ) : (
                  <input
                    aria-label="To"
                    value={to}
                    onChange={(event) => setTo(event.target.value)}
                    onBlur={() => {
                      if (to.trim()) setEditingTo(false);
                    }}
                    placeholder="client@email.com"
                    className="h-9 w-full bg-transparent px-2 text-[15px] text-[#042b3c] outline-none"
                  />
                )}
              </div>
            </label>

            <label className="block">
              <span className="mb-1 block text-[13px] text-[#5d6f78]">Subject</span>
              <input
                aria-label="Subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                className="h-11 w-full rounded-lg border border-[#d5dde1] px-3 text-[15px] text-[#042b3c] outline-none focus:border-[#388623]"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[13px] text-[#5d6f78]">Message</span>
              <textarea
                aria-label="Message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="min-h-[280px] w-full resize-y rounded-lg border border-[#d5dde1] px-3 py-2 text-[15px] leading-6 text-[#042b3c] outline-none focus:border-[#388623]"
              />
            </label>

            <label className="flex items-center gap-2 text-sm text-[#042b3c]">
              <input
                type="checkbox"
                checked={copy}
                onChange={(event) => setCopy(event.target.checked)}
              />
              Send me a copy
            </label>
            <p className="text-[13px] text-[#8aa0a8]">
              The client receives this message at the address above.
            </p>
          </div>

          <aside>
            <h3 className="text-[15px] font-bold text-[#042b3c]">Attachments</h3>
            <div className="mt-3 grid min-h-[140px] place-items-center rounded-lg border border-dashed border-[#d5dde1] px-4 py-6 text-center">
              <div>
                <span
                  className="inline-flex h-8 items-center rounded-lg border border-[#d5dde1] px-3 text-sm font-semibold"
                  style={{ color: green }}
                >
                  Select
                </span>
                <p className="mt-2 text-[13px] text-[#8aa0a8]">Select or drag files here to upload</p>
              </div>
            </div>
            <p className="mt-3 text-[13px] text-[#8aa0a8]">You&apos;ve attached 0.00 MB of the 10.00 MB limit.</p>
          </aside>
        </div>

        {error ? <p className="mt-4 text-sm font-semibold text-rose-700">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="h-10 rounded-lg border border-[#d5dde1] bg-white px-4 text-sm font-semibold text-[#042b3c]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={async () => {
              setError("");
              setPending(true);
              const result = await sendPreparedQuoteEmail({
                quoteId: draft.quoteId,
                to,
                subject,
                message,
                copyToSender: copy,
              });
              setPending(false);
              if (result && !result.ok) {
                setError(result.message || "Could not send the email.");
              }
            }}
            className="h-10 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: green }}
          >
            {pending ? "Sending…" : "Send Email"}
          </button>
        </div>
      </div>
    </div>
  );
}
