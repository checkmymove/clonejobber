"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, MessageSquare, X } from "lucide-react";
import { Card } from "@/components/ui";
import { documentEmailHtml } from "@/lib/email/templates";
import { resetTemplateAction, saveTemplateAction } from "@/lib/templates/actions";
import {
  SAMPLE_VARIABLES,
  TEMPLATE_CATALOG,
  TEMPLATE_STAGES,
  TEMPLATE_VARIABLES,
  renderLetter,
  type TemplateKey,
} from "@/lib/templates/catalog";
import type { ResolvedTemplate } from "@/lib/templates/queries";

/** Where each template is used today, so the list says what actually sends it. */
const USED_BY: Partial<Record<TemplateKey, string>> = {
  request_submitted: "Used by Send email & text on a request",
  quote_sent: "Used by Send email & text on a quote",
  quote_approved: "Sent automatically when the client approves a quote",
  job_booking: "Used by Send email & text on a job",
  invoice_sent: "Used by Send email & text on an invoice",
  invoice_followup: "Used by Send payment reminder on a sent, unpaid invoice",
  payment_receipt: "Used by Save and Email Receipt on a payment",
};

/** Jobber Settings › Emails & Text Messages: templates for every stage of the funnel. */
export function TemplatesManager({ templates }: { templates: ResolvedTemplate[] }) {
  const [editing, setEditing] = useState<ResolvedTemplate | null>(null);
  return (
    <div className="space-y-4">
      {TEMPLATE_STAGES.map((stage) => (
        <Card key={stage.key} className="p-5">
          <h2 className="mb-1 text-lg font-extrabold text-ink">{stage.label}</h2>
          <div className="divide-y divide-line">
            {templates
              .filter((t) => TEMPLATE_CATALOG[t.key].stage === stage.key)
              .map((t) => {
                const meta = TEMPLATE_CATALOG[t.key];
                const custom = t.email.custom || Boolean(t.sms?.custom);
                return (
                  <div key={t.key} className="flex flex-wrap items-start justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-ink">
                        {meta.label}
                        {custom ? (
                          <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent">
                            Customised
                          </span>
                        ) : null}
                      </p>
                      <p className="text-sm text-ink-soft">{meta.description}</p>
                      <p className="mt-0.5 text-xs text-ink-mute">
                        {USED_BY[t.key] ?? "Saved for when this message is sent"} · Email{t.sms ? " and text message" : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditing(t)}
                      className="h-9 rounded-xl border border-line px-4 text-sm font-bold text-accent hover:bg-accent-soft"
                    >
                      Edit
                    </button>
                  </div>
                );
              })}
          </div>
        </Card>
      ))}
      {editing ? <TemplateEditor template={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function TemplateEditor({ template, onClose }: { template: ResolvedTemplate; onClose: () => void }) {
  const router = useRouter();
  const meta = TEMPLATE_CATALOG[template.key];
  const [tab, setTab] = useState<"email" | "sms">("email");
  const [subject, setSubject] = useState(template.email.subject);
  const [body, setBody] = useState(template.email.body);
  const [sms, setSms] = useState(template.sms?.body ?? "");
  const [menu, setMenu] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const smsRef = useRef<HTMLTextAreaElement>(null);
  const lastFocus = useRef<"subject" | "body" | "sms">("body");

  const preview = useMemo(
    () =>
      documentEmailHtml({
        companyName: SAMPLE_VARIABLES.COMPANY_NAME,
        heading: meta.label,
        message: renderLetter(body, SAMPLE_VARIABLES),
      }),
    [body, meta.label],
  );

  function insert(name: string) {
    const token = `{{${name}}}`;
    const target = tab === "sms" ? "sms" : lastFocus.current === "subject" ? "subject" : "body";
    const el = target === "subject" ? subjectRef.current : target === "sms" ? smsRef.current : bodyRef.current;
    const value = target === "subject" ? subject : target === "sms" ? sms : body;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    if (target === "subject") setSubject(next);
    else if (target === "sms") setSms(next);
    else setBody(next);
    setMenu(false);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function save() {
    setPending(true);
    setMessage(null);
    const results = [
      await saveTemplateAction({ key: template.key, channel: "email", subject, body }),
      ...(template.sms ? [await saveTemplateAction({ key: template.key, channel: "sms", subject: "", body: sms })] : []),
    ];
    setPending(false);
    const failed = results.find((r) => !r.ok);
    if (failed) {
      setMessage(failed.message ?? "Could not save.");
      return;
    }
    router.refresh();
    onClose();
  }

  async function reset() {
    if (!window.confirm("Reset this template to the default text?")) return;
    setPending(true);
    await resetTemplateAction(template.key, tab);
    setPending(false);
    if (tab === "email") {
      setSubject(meta.email.subject);
      setBody(meta.email.body);
    } else {
      setSms(meta.sms ?? "");
    }
    router.refresh();
  }

  const field =
    "w-full rounded-lg border border-[#d5dde1] px-3 text-[15px] text-[#042b3c] outline-none focus:border-[#388623]";

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-[#123035]/45 p-4" onClick={() => !pending && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[calc(100dvh-2rem)] w-full max-w-[1040px] overflow-y-auto rounded-2xl bg-white px-6 py-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="template-title" className="text-[22px] font-bold tracking-tight text-[#042b3c]">
            Edit {meta.label} Template
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-lg text-[#5d6f78] hover:bg-[#f4f6f7]">
            <X size={20} />
          </button>
        </div>

        <div role="tablist" className="mt-4 flex gap-1 border-b border-[#e6ebed]">
          {(["email", "sms"] as const)
            .filter((t) => t === "email" || template.sms)
            .map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`inline-flex items-center gap-2 border-b-2 px-3 py-2 text-[15px] font-semibold text-[#042b3c] ${
                  tab === t ? "border-[#388623]" : "border-transparent"
                }`}
              >
                {t === "email" ? <Mail size={16} /> : <MessageSquare size={16} />}
                {t === "email" ? "Email" : "Text Message"}
              </button>
            ))}
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            {tab === "email" ? (
              <>
                <label className="block">
                  <span className="mb-1 block text-[13px] text-[#5d6f78]">Subject</span>
                  <input
                    ref={subjectRef}
                    value={subject}
                    onFocus={() => (lastFocus.current = "subject")}
                    onChange={(e) => setSubject(e.target.value)}
                    className={`${field} h-11`}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[13px] text-[#5d6f78]">Message</span>
                  <textarea
                    ref={bodyRef}
                    value={body}
                    onFocus={() => (lastFocus.current = "body")}
                    onChange={(e) => setBody(e.target.value)}
                    className={`${field} min-h-[320px] resize-y py-2 leading-6`}
                  />
                </label>
              </>
            ) : (
              <label className="block">
                <span className="mb-1 block text-[13px] text-[#5d6f78]">Message</span>
                <textarea
                  ref={smsRef}
                  value={sms}
                  onFocus={() => (lastFocus.current = "sms")}
                  onChange={(e) => setSms(e.target.value)}
                  className={`${field} min-h-[200px] resize-y py-2 leading-6`}
                />
              </label>
            )}
            <div className="relative flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => void reset()}
                disabled={pending}
                className="h-9 rounded-lg border border-[#d5dde1] px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setMenu((v) => !v)}
                className="h-9 rounded-lg border border-[#d5dde1] px-3 text-sm font-semibold text-[#388623] hover:bg-[#f2f8f0]"
              >
                Insert Variable
              </button>
              {menu ? (
                <div className="absolute bottom-11 right-0 z-10 max-h-80 w-64 overflow-y-auto rounded-xl border border-[#d5dde1] bg-white p-1.5 shadow-xl">
                  {TEMPLATE_VARIABLES.map((section) => (
                    <div key={section.section} className="py-1">
                      <p className="px-2 py-1 text-[12px] text-[#8aa0a8]">{section.section}</p>
                      {section.items.map((v) => (
                        <button
                          key={v.name}
                          type="button"
                          onClick={() => insert(v.name)}
                          className="block w-full rounded-lg px-2 py-1.5 text-left text-sm font-semibold text-[#042b3c] hover:bg-[#f4f6f7]"
                        >
                          {v.label}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl bg-[#f4f6f7] p-3">
            <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[#5d6f78]">Preview</p>
            {tab === "email" ? (
              <>
                <p className="mb-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-[#042b3c]">
                  {renderLetter(subject, SAMPLE_VARIABLES)}
                </p>
                <iframe title="Email preview" srcDoc={preview} sandbox="" className="h-[420px] w-full rounded-lg border border-[#d5dde1] bg-white" />
              </>
            ) : (
              <div className="mx-auto w-full max-w-[300px] rounded-[36px] border-[10px] border-[#1f2a30] bg-[#f4f6f7] p-3">
                <div className="min-h-[260px]">
                  <div className="max-w-[90%] whitespace-pre-wrap break-words rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-[14px] leading-5 text-[#1f2a30] shadow-sm">
                    {renderLetter(sms, SAMPLE_VARIABLES) || "…"}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {message ? <p className="mt-3 text-sm font-semibold text-rose-700">{message}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={pending} className="h-10 rounded-lg border border-[#d5dde1] bg-white px-4 text-sm font-semibold text-[#042b3c]">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={pending}
            className="h-10 rounded-lg bg-[#388623] px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
