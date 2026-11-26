import { formatDateLondon } from "@/lib/format";
import { listDeliveries } from "@/lib/email/send";
import { listSmsDeliveries } from "@/lib/sms/send";
import type { SendKind } from "@/lib/send/types";
import { Card } from "@/components/ui";

const formatWhen = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(new Date(iso));

/**
 * Emails and texts sent for a document, newest first. Renders nothing before the first send.
 * `scheduled`: a message that goes out on its own later (job: removal confirmation).
 */
export async function SentCard({
  kind,
  id,
  scheduled,
}: {
  kind: SendKind;
  id: string;
  scheduled?: { label: string; to: string; at: string } | null;
}) {
  const [emails, texts] = await Promise.all([
    listDeliveries(kind, id).catch(() => []),
    listSmsDeliveries(kind, id),
  ]);
  const rows = [
    ...emails.map((d) => ({
      id: d.id,
      label: d.status === "sent" ? "Email sent" : "Email failed",
      to: d.to_email,
      error: d.error,
      at: d.sent_at,
    })),
    ...texts.map((d) => ({
      id: d.id,
      label: d.status === "sent" ? "Text sent" : "Text not sent",
      to: d.to_phone,
      error: d.error,
      at: d.sent_at,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  if (!rows.length && !scheduled) return null;

  return (
    <Card className="h-fit p-5 xl:col-span-2">
      <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">Sent</h2>
      <ul className="space-y-2 text-sm">
        {scheduled ? (
          <li className="flex justify-between gap-3 border-b border-line py-2 last:border-0">
            <span className="text-sky-800">
              {scheduled.label} · {scheduled.to}
            </span>
            <span className="shrink-0 text-sky-800">Scheduled for {formatWhen(scheduled.at)}</span>
          </li>
        ) : null}
        {rows.map((row) => (
          <li key={row.id} className="flex justify-between gap-3 border-b border-line py-2 last:border-0">
            <span>
              {row.label} · {row.to}
              {row.error ? <span className="block text-rose-700">{row.error}</span> : null}
            </span>
            <span className="shrink-0 text-ink-soft">{formatDateLondon(row.at)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
