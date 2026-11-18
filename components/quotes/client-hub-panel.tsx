"use client";

import { useState } from "react";
import { Check, FileText, Gift, Hammer, Inbox } from "lucide-react";
import type { ClientHub, HubItem } from "@/lib/quotes/client-hub";
import { submitReferral } from "@/lib/quotes/referral-actions";

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function day(iso: string): string {
  return iso ? DAY.format(new Date(`${iso}T12:00:00Z`)) : "";
}

function Group({
  title,
  icon: Icon,
  items,
  currentId,
  empty,
}: {
  title: string;
  icon: typeof Inbox;
  items: HubItem[];
  currentId?: string;
  empty: string;
}) {
  return (
    <section>
      <h3 className="mb-1.5 flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-ink-soft">
        <Icon size={15} aria-hidden /> {title}
      </h3>
      {items.length === 0 ? (
        <p className="px-2 py-1 text-sm text-ink-mute">{empty}</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => {
            const body = (
              <>
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-ink">{item.label}</span>
                  <span className="shrink-0 text-xs text-ink-mute">{item.number}</span>
                </span>
                <span className="flex items-center justify-between gap-2 text-xs text-ink-soft">
                  <span>{day(item.date)}</span>
                  <span>{item.status}</span>
                </span>
              </>
            );
            const current = item.id === currentId;
            return (
              <li key={item.id}>
                {item.href && !current ? (
                  <a href={item.href} className="block rounded-lg px-2 py-1.5 hover:bg-white">
                    {body}
                  </a>
                ) : (
                  <div className={`rounded-lg px-2 py-1.5 ${current ? "bg-white ring-1 ring-line" : ""}`}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ReferralForm({ quoteId }: { quoteId: string }) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const field =
    "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none placeholder:text-ink-mute focus:border-accent";

  return (
    <section className="rounded-xl border border-line bg-white p-3.5">
      <h3 className="flex items-center gap-2 text-[15px] font-extrabold text-ink">
        <Gift size={17} className="text-accent" aria-hidden /> Refer a friend
      </h3>
      <p className="mt-1 text-[13px] leading-5 text-ink-soft">Know someone who is moving? Tell us and we will look after them too.</p>
      {sent ? (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
          <Check size={16} className="mt-0.5 shrink-0" aria-hidden />
          Thank you! We will get in touch with {sent}.
        </p>
      ) : null}
      <form
        className="mt-3 space-y-2"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setError("");
          const result = await submitReferral(quoteId, { name, contact, note });
          setPending(false);
          if (!result.ok) {
            setError(result.message ?? "Something went wrong. Please try again.");
            return;
          }
          setSent(name.trim());
          setName("");
          setContact("");
          setNote("");
        }}
      >
        <input aria-label="Friend's name" placeholder="Friend's name" value={name} onChange={(e) => setName(e.target.value)} className={field} />
        <input
          aria-label="Email or phone"
          placeholder="Email or phone"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          className={field}
        />
        <textarea
          aria-label="Note (optional)"
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="min-h-[64px] w-full resize-y rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-mute focus:border-accent"
        />
        {error ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="h-10 w-full rounded-lg bg-accent text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send referral"}
        </button>
      </form>
    </section>
  );
}

/**
 * Left panel of the client's quote page: a welcome, their requests, quotes and jobs
 * with us, and a referral form.
 */
export function ClientHubPanel({ hub, name, quoteId }: { hub: ClientHub; name: string; quoteId: string }) {
  return (
    <aside className="space-y-5 rounded-2xl border border-line bg-cream/60 p-4 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto">
      <div>
        <p className="text-sm text-ink-soft">Welcome,</p>
        <p className="text-[20px] font-extrabold leading-tight text-ink">{hub.firstName || name}</p>
      </div>
      <Group title="Your requests" icon={Inbox} items={hub.requests} empty="No requests yet." />
      <Group title="Your quotes" icon={FileText} items={hub.quotes} currentId={quoteId} empty="No quotes yet." />
      <Group title="Your jobs" icon={Hammer} items={hub.jobs} empty="No jobs yet." />
      <ReferralForm quoteId={quoteId} />
    </aside>
  );
}
