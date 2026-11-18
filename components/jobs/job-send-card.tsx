"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { SendDialog, useSendDialog } from "@/components/funnel/send-dialog";

/** End of the job page: one button that sends the job to the client by email and text to approve. */
export function JobSendCard({ jobId, approved }: { jobId: string; approved: boolean }) {
  const router = useRouter();
  const sender = useSendDialog();
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  return (
    <div className="flex flex-col items-end gap-2 xl:col-span-2">
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
        <Send size={16} aria-hidden />
        {approved ? "Send booking" : "Send for approval"}
      </button>
      {error ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}
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
    </div>
  );
}
