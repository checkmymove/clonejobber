"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { approvePublicQuote, requestPublicQuoteChanges } from "@/lib/quotes/public-actions";

export function PublicQuoteActions({
  quoteId,
  status,
  archived,
  converted,
}: {
  quoteId: string;
  status: string;
  archived: boolean;
  converted: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending]);

  if (archived) {
    return <p className="mt-4 text-sm font-semibold text-ink-soft">This quote has been archived.</p>;
  }
  if (converted || status === "approved") {
    return <p className="mt-4 text-sm font-semibold text-accent">This quote has been approved.</p>;
  }
  if (status === "rejected") {
    return <p className="mt-4 text-sm font-semibold text-rose-700">This quote was declined.</p>;
  }
  if (status === "expired") {
    return <p className="mt-4 text-sm font-semibold text-ink-soft">This quote has expired.</p>;
  }
  if (status === "changes_requested") {
    return (
      <p className="mt-4 text-sm font-semibold text-ink-soft">
        Change request sent. We will be in touch.
      </p>
    );
  }

  return (
    <div className="mt-5 space-y-3">
      {error ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}
      <button
        type="button"
        disabled={Boolean(pending)}
        onClick={async () => {
          setError("");
          setPending("approve");
          const result = await approvePublicQuote(quoteId);
          setPending("");
          if (result && !result.ok) setError(result.message || "Could not approve this quote.");
          else router.refresh();
        }}
        className="flex h-11 w-full items-center justify-center rounded-lg bg-accent text-[15px] font-bold text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending === "approve" ? "Approving…" : "Approve"}
      </button>
      <button
        type="button"
        disabled={Boolean(pending)}
        onClick={() => {
          setError("");
          setOpen(true);
        }}
        className="flex h-11 w-full items-center justify-center rounded-lg border border-line bg-white text-[15px] font-bold text-ink hover:bg-cream disabled:opacity-60"
      >
        Request Changes
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-[#123035]/45 p-4"
          onClick={() => {
            if (!pending) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-changes-title"
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-[520px] rounded-2xl bg-white px-6 py-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <h2 id="request-changes-title" className="text-[20px] font-bold text-ink">
                Request Changes
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={Boolean(pending)}
                aria-label="Close"
                className="grid h-9 w-9 place-items-center rounded-lg text-ink-soft hover:bg-cream"
              >
                <X size={20} />
              </button>
            </div>
            <p className="mt-2 text-sm text-ink-soft">
              Tell us what you would like to change on this quote.
            </p>
            <textarea
              aria-label="Change request"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="mt-4 min-h-[140px] w-full resize-y rounded-lg border border-line px-3 py-2 text-[15px] text-ink outline-none focus:border-accent"
            />
            {error ? <p className="mt-3 text-sm font-semibold text-rose-700">{error}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={Boolean(pending)}
                onClick={() => setOpen(false)}
                className="h-10 rounded-lg border border-line px-4 text-sm font-semibold text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(pending)}
                onClick={async () => {
                  setError("");
                  setPending("changes");
                  const result = await requestPublicQuoteChanges(quoteId, message);
                  setPending("");
                  if (result && !result.ok) {
                    setError(result.message || "Could not send the change request.");
                    return;
                  }
                  setOpen(false);
                  router.refresh();
                }}
                className="h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {pending === "changes" ? "Sending…" : "Send request"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
