"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, MessageSquare, Send } from "lucide-react";
import { CARD_TITLE, CardIcon } from "@/components/card-icon";
import { SendDialog, useSendDialog } from "@/components/funnel/send-dialog";
import { Card } from "@/components/ui";

/** End of the job page: send the job to the client by email and text, to approve it. */
export function JobSendCard({
  jobId,
  approved,
  sentAt,
  clientName,
}: {
  jobId: string;
  approved: boolean;
  sentAt: string | null;
  clientName: string;
}) {
  const router = useRouter();
  const sender = useSendDialog();
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const when = sentAt
    ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(
        new Date(sentAt),
      )
    : null;

  return (
    <Card className="h-fit p-5 xl:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <CardIcon icon={Send} tone="emerald" boxed />
          <div className="min-w-0">
            <h2 className={CARD_TITLE}>{approved ? "Job approved" : "Client approval"}</h2>
            <p className="text-sm text-ink-soft">
              {approved
                ? `${clientName} approved this job. You can send the booking details again.`
                : when
                  ? `Sent to ${clientName} on ${when}. Waiting for approval.`
                  : `Send this job to ${clientName} by email and text to approve.`}
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={opening}
          onClick={async () => {
            setOpening(true);
            setError(null);
            const result = await sender.open("job", jobId);
            setOpening(false);
            if (!result.ok) setError(result.message ?? "Could not prepare the message.");
          }}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#13213d] px-5 text-sm font-semibold text-white hover:bg-[#1e3a5f] disabled:opacity-60"
        >
          <Mail size={16} aria-hidden />
          <MessageSquare size={16} aria-hidden />
          {approved ? "Send booking by email & text" : when ? "Resend for approval" : "Send for approval by email & text"}
        </button>
      </div>
      {error ? <p className="mt-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      {sender.draft ? (
        <SendDialog
          draft={sender.draft}
          onClose={sender.close}
          onDone={() => {
            sender.close();
            router.refresh();
          }}
        />
      ) : null}
    </Card>
  );
}
