"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { approvePublicJob } from "@/lib/jobs/public-actions";

/** "Approve job" on the client's job page; once approved it says so. */
export function PublicJobApprove({ jobId, approved }: { jobId: string; approved: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(approved);

  if (done) {
    return (
      <p className="rounded-xl bg-emerald-50 px-4 py-3 text-[15px] font-semibold text-emerald-800">
        You approved this job. We will confirm the date, time and team shortly.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError("");
          const result = await approvePublicJob(jobId);
          setPending(false);
          if (!result.ok) {
            setError(result.message ?? "Something went wrong. Please try again.");
            return;
          }
          setDone(true);
          router.refresh();
        }}
        className="h-11 rounded-xl bg-[#388623] px-6 text-[15px] font-bold text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Approving…" : "Approve job"}
      </button>
      <p className="text-sm text-ink-soft">Need a change? Reply to our email or give us a call.</p>
      {error ? <p className="w-full text-sm font-semibold text-rose-700">{error}</p> : null}
    </div>
  );
}
