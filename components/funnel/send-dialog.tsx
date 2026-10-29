"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, FileText, Mail, MessageSquare, X } from "lucide-react";
import { documentEmailHtml } from "@/lib/email/templates";
import { prepareSend, sendDocument } from "@/lib/send/actions";
import { SEND_KIND_LABEL, smsSegments, type SendDraft, type SendKind, type SendOutcome } from "@/lib/send/types";

const green = "#388623";
const field =
  "h-11 w-full rounded-lg border border-[#d5dde1] px-3 text-[15px] text-[#042b3c] outline-none focus:border-[#388623]";

type Tab = "email" | "sms";

/** Loads the draft for a saved document and holds it while the dialog is open. */
export function useSendDialog() {
  const [draft, setDraft] = useState<SendDraft | null>(null);
  return {
    draft,
    close: () => setDraft(null),
    open: async (kind: SendKind, id: string): Promise<{ ok: boolean; message?: string }> => {
      const prepared = await prepareSend(kind, id);
      if (!prepared.ok || !prepared.draft) return { ok: false, message: prepared.message || "Could not prepare the message." };
      setDraft(prepared.draft);
      return { ok: true };
    },
    show: setDraft,
  };
}

/**
 * "Send email & text": one dialog, one click. The Email tab composes the email and
 * previews it as the client receives it (with the PDF attached); the Text message tab
 * holds a short SMS version with a phone preview.
 */
export function SendDialog({
  draft,
  onClose,
  onDone,
}: {
  draft: SendDraft;
  onClose: () => void;
  /** After a send that reached the client: close and refresh or navigate. */
  onDone: () => void;
}) {
  const [tab, setTab] = useState<Tab>("email");
  const [useEmail, setUseEmail] = useState(Boolean(draft.email.to));
  const [useSms, setUseSms] = useState(Boolean(draft.sms.to));
  const [to, setTo] = useState(draft.email.to);
  const [subject, setSubject] = useState(draft.email.subject);
  const [message, setMessage] = useState(draft.email.message);
  const [attachPdf, setAttachPdf] = useState(Boolean(draft.attachment));
  const [copy, setCopy] = useState(false);
  const [phone, setPhone] = useState(draft.sms.to);
  const [text, setText] = useState(draft.sms.message);
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<SendOutcome | null>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, pending]);

  const html = useMemo(
    () =>
      documentEmailHtml({
        companyName: draft.companyName,
        logoUrl: draft.logoUrl,
        ...draft.card,
        buttonUrl: draft.viewUrl ?? "#",
        message,
      }),
    [draft, message],
  );
  const segments = smsSegments(text);
  const kind = SEND_KIND_LABEL[draft.kind];
  const sendLabel =
    useEmail && useSms ? "Send email & text" : useEmail ? "Send email" : useSms ? "Send text" : "Send";

  async function send() {
    setPending(true);
    setOutcome(null);
    const result = await sendDocument({
      kind: draft.kind,
      id: draft.id,
      email: useEmail ? { to, subject, message, copyToSender: copy, attachPdf } : null,
      sms: useSms ? { to: phone, message: text } : null,
    });
    setPending(false);
    setOutcome(result);
    if (result.ok && (!result.sms || result.sms.ok)) onDone();
  }

  const tabButton = (value: Tab, label: string, icon: React.ReactNode, on: boolean, setOn: (v: boolean) => void) => (
    <div
      className={`flex items-center gap-2 rounded-t-lg border-b-2 px-3 py-2 ${
        tab === value ? "border-[#388623] bg-[#f2f8f0]" : "border-transparent hover:bg-[#f7f8f8]"
      }`}
    >
      <input
        type="checkbox"
        aria-label={`Include ${label.toLowerCase()}`}
        checked={on}
        onChange={(event) => setOn(event.target.checked)}
        className="size-4 accent-[#388623]"
      />
      <button
        type="button"
        role="tab"
        aria-selected={tab === value}
        onClick={() => setTab(value)}
        className="inline-flex items-center gap-2 text-[15px] font-semibold text-[#042b3c]"
      >
        {icon}
        {label}
      </button>
    </div>
  );

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
        aria-labelledby="send-dialog-title"
        onClick={(event) => event.stopPropagation()}
        className="max-h-[calc(100dvh-2rem)] w-full max-w-[1040px] overflow-y-auto rounded-2xl bg-white px-6 py-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="send-dialog-title" className="text-[22px] font-bold tracking-tight text-[#042b3c]">
            Send {kind} {draft.number} to {draft.clientName}
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

        <div role="tablist" className="mt-4 flex gap-1 border-b border-[#e6ebed]">
          {tabButton("email", "Email", <Mail size={17} />, useEmail, setUseEmail)}
          {tabButton("sms", "Text message", <MessageSquare size={17} />, useSms, setUseSms)}
        </div>

        {tab === "email" ? (
          <div className={`mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] ${useEmail ? "" : "opacity-50"}`}>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-[13px] text-[#5d6f78]">To</span>
                <input aria-label="Email to" value={to} onChange={(e) => setTo(e.target.value)} className={field} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[13px] text-[#5d6f78]">Subject</span>
                <input aria-label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} className={field} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[13px] text-[#5d6f78]">Message</span>
                <textarea
                  aria-label="Message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="min-h-[260px] w-full resize-y rounded-lg border border-[#d5dde1] px-3 py-2 text-[15px] leading-6 text-[#042b3c] outline-none focus:border-[#388623]"
                />
              </label>
              {draft.attachment ? (
                <label className="flex items-center gap-3 rounded-lg border border-[#d5dde1] px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={attachPdf}
                    onChange={(e) => setAttachPdf(e.target.checked)}
                    className="size-4 accent-[#388623]"
                  />
                  <span className="grid h-9 w-9 place-items-center rounded-md bg-rose-50 text-rose-700">
                    <FileText size={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold text-[#042b3c]">{draft.attachment}</span>
                    <span className="block text-[12px] text-[#8aa0a8]">Attach PDF</span>
                  </span>
                </label>
              ) : null}
              <label className="flex items-center gap-2 text-sm text-[#042b3c]">
                <input type="checkbox" checked={copy} onChange={(e) => setCopy(e.target.checked)} className="size-4 accent-[#388623]" />
                Send me a copy
              </label>
            </div>
            <div className="rounded-xl bg-[#f4f6f7] p-3">
              <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[#5d6f78]">Email preview</p>
              <iframe
                title="Email preview"
                srcDoc={html}
                sandbox=""
                className="h-[460px] w-full rounded-lg border border-[#d5dde1] bg-white"
              />
              {draft.attachment && attachPdf ? (
                <p className="mt-2 inline-flex items-center gap-2 rounded-md bg-white px-2.5 py-1.5 text-[13px] font-semibold text-[#042b3c]">
                  <FileText size={14} className="text-rose-700" />
                  {draft.attachment}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className={`mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] ${useSms ? "" : "opacity-50"}`}>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-[13px] text-[#5d6f78]">To</span>
                <input aria-label="Text to" value={phone} onChange={(e) => setPhone(e.target.value)} className={field} />
              </label>
              <label className="block">
                <span className="mb-1 flex justify-between text-[13px] text-[#5d6f78]">
                  <span>Message</span>
                  <span>
                    {segments.length} characters · {segments.segments} SMS
                  </span>
                </span>
                <textarea
                  aria-label="Text message"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="min-h-[180px] w-full resize-y rounded-lg border border-[#d5dde1] px-3 py-2 text-[15px] leading-6 text-[#042b3c] outline-none focus:border-[#388623]"
                />
              </label>
              <p className="text-[13px] text-[#8aa0a8]">
                A short version of the email, sent to the client&apos;s mobile.
              </p>
              {!draft.smsReady ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
                  Text messages aren&apos;t connected yet. The text is saved to the client&apos;s history and the
                  email still goes out.
                </p>
              ) : null}
            </div>
            <div className="mx-auto w-full max-w-[300px] rounded-[36px] border-[10px] border-[#1f2a30] bg-[#f4f6f7] p-3 shadow-inner">
              <p className="pb-2 text-center text-[12px] font-semibold text-[#5d6f78]">{draft.companyName}</p>
              <div className="min-h-[320px]">
                <div className="max-w-[90%] whitespace-pre-wrap break-words rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-[14px] leading-5 text-[#1f2a30] shadow-sm">
                  {text || "…"}
                </div>
              </div>
            </div>
          </div>
        )}

        {outcome ? (
          <div className="mt-5 space-y-1 rounded-lg border border-[#d5dde1] px-4 py-3 text-sm">
            {outcome.email ? (
              <p className={outcome.email.ok ? "text-emerald-700" : "text-rose-700"}>
                {outcome.email.ok ? <Check size={14} className="mr-1 inline" /> : <X size={14} className="mr-1 inline" />}
                Email: {outcome.email.ok ? "sent" : outcome.email.message}
              </p>
            ) : null}
            {outcome.sms ? (
              <p className={outcome.sms.ok ? "text-emerald-700" : "text-amber-800"}>
                {outcome.sms.ok ? <Check size={14} className="mr-1 inline" /> : <X size={14} className="mr-1 inline" />}
                Text: {outcome.sms.ok ? "sent" : outcome.sms.message}
              </p>
            ) : null}
            {!outcome.email && !outcome.sms && outcome.message ? (
              <p className="text-rose-700">{outcome.message}</p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          {outcome?.ok ? (
            <button
              type="button"
              onClick={onDone}
              className="h-10 rounded-lg px-4 text-sm font-semibold text-white"
              style={{ background: green }}
            >
              Done
            </button>
          ) : (
            <>
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
                disabled={pending || (!useEmail && !useSms)}
                onClick={() => void send()}
                className="h-10 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: green }}
              >
                {pending ? "Sending…" : sendLabel}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
