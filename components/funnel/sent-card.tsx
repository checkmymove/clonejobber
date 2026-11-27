import { formatDateLondon } from "@/lib/format";
import { listDeliveries } from "@/lib/email/send";
import { listSmsDeliveries } from "@/lib/sms/send";
import type { SendKind } from "@/lib/send/types";
import { Card } from "@/components/ui";

/** Emails and texts sent for a document, newest first. Renders nothing before the first send. */
export async function SentCard({ kind, id }: { kind: SendKind; id: string }) {
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
  if (!rows.length) return null;

  return (
    <Card className="h-fit p-5 xl:col-span-2">
      <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">Sent</h2>
      <ul className="space-y-2 text-sm">
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
