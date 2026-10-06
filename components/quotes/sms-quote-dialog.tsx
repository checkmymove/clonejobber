"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { sendPreparedQuoteSms } from "@/lib/quotes/actions";
import type { QuoteSmsDraft } from "@/lib/sms/draft";

const green = "#388623";

export function SmsQuoteDialog({
  draft,
  onClose,
}: {
  draft: QuoteSmsDraft;
  onClose: () => void;
}) {
  const [to, setTo] = useState(draft.to);
  const [message, setMessage] = useState(draft.message);
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
        aria-labelledby="sms-quote-title"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-[560px] rounded-2xl bg-white px-6 py-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="sms-quote-title" className="text-[22px] font-bold tracking-tight text-[#042b3c]">
            Text quote {draft.number} to {draft.clientName}
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

        <div className="mt-5 space-y-3">
          <label className="block">
            <span className="mb-1 block text-[13px] text-[#5d6f78]">Mobile number</span>
            <input
              aria-label="Mobile number"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              placeholder="+447700900123"
              className="h-11 w-full rounded-lg border border-[#d5dde1] px-3 text-[15px] text-[#042b3c] outline-none focus:border-[#388623]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] text-[#5d6f78]">Message</span>
            <textarea
              aria-label="Message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="min-h-[160px] w-full resize-y rounded-lg border border-[#d5dde1] px-3 py-2 text-[15px] leading-6 text-[#042b3c] outline-none focus:border-[#388623]"
            />
          </label>
          <p className="text-[13px] text-[#8aa0a8]">
            Sending a text will be connected when the SMS provider is configured. The shortcut and
            delivery log are already in place.
          </p>
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
              const result = await sendPreparedQuoteSms({
                quoteId: draft.quoteId,
                to,
                message,
              });
              setPending(false);
              if (result && !result.ok) {
                setError(result.message || "Could not send the text message.");
                return;
              }
              onClose();
            }}
            className="h-10 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: green }}
          >
            {pending ? "Sending…" : "Send Text Message"}
          </button>
        </div>
      </div>
    </div>
  );
}
