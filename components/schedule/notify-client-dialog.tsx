"use client";

import { useState } from "react";
import { X } from "lucide-react";
import {
  sendVisitRescheduleEmail,
  sendVisitRescheduleSms,
} from "@/lib/schedule/actions";
import type { VisitNotifyDraft } from "@/lib/schedule/types";

export function NotifyClientDialog({
  draft,
  onClose,
}: {
  draft: VisitNotifyDraft;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState(draft.subject);
  const [message, setMessage] = useState(draft.message);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<"email" | "sms" | null>(null);
  const canEmail = Boolean(draft.toEmail.trim());
  const canSms = Boolean(draft.toPhone.trim());

  async function sendEmail() {
    setPending("email");
    setError("");
    const result = await sendVisitRescheduleEmail({
      visitId: draft.visitId,
      toEmail: draft.toEmail,
      subject,
      message,
    });
    setPending(null);
    if (!result.ok) {
      setError(result.message ?? "Could not send email.");
      return;
    }
    onClose();
  }

  async function sendSms() {
    setPending("sms");
    setError("");
    const result = await sendVisitRescheduleSms({
      visitId: draft.visitId,
      toPhone: draft.toPhone,
      message,
    });
    setPending(null);
    if (!result.ok) {
      setError(result.message ?? "Could not send text.");
      return;
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-ink">Notify the client?</h2>
            <p className="mt-1 text-sm text-ink-soft">
              {draft.clientName} · visit moved to {draft.nextLabel}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-cream" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-ink-mute">
          Subject
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className="mt-1 h-10 w-full rounded-xl border border-line px-3 text-sm font-semibold text-ink"
          />
        </label>
        <label className="mt-3 block text-xs font-bold uppercase tracking-wide text-ink-mute">
          Message
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={8}
            className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm text-ink"
          />
        </label>
        {draft.toEmail ? (
          <p className="mt-2 text-xs text-ink-mute">Email: {draft.toEmail}</p>
        ) : (
          <p className="mt-2 text-xs text-ink-mute">No email on this client.</p>
        )}
        {draft.toPhone ? (
          <p className="text-xs text-ink-mute">Mobile: {draft.toPhone}</p>
        ) : (
          <p className="text-xs text-ink-mute">No mobile number on this client.</p>
        )}
        {error ? <p className="mt-2 text-sm font-semibold text-red-700">{error}</p> : null}

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-xl border border-line px-3 text-sm font-bold hover:bg-cream"
          >
            Skip
          </button>
          <button
            type="button"
            disabled={!canSms || pending !== null}
            onClick={sendSms}
            className="h-9 rounded-xl border border-line px-3 text-sm font-bold hover:bg-cream disabled:opacity-50"
          >
            {pending === "sms" ? "Sending…" : "Text"}
          </button>
          <button
            type="button"
            disabled={!canEmail || pending !== null}
            onClick={sendEmail}
            className="h-9 rounded-xl bg-ink px-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {pending === "email" ? "Sending…" : "Email"}
          </button>
        </div>
      </div>
    </div>
  );
}
