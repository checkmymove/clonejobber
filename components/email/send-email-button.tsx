"use client";

import { useState } from "react";
import type { ActionResult } from "@/lib/funnel/engine";

export function SendEmailButton({
  label,
  run,
}: {
  label: string;
  run: () => Promise<ActionResult>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setError("");
          setPending(true);
          const result = await run();
          setPending(false);
          if (result && !result.ok) {
            setError(result.message || "Could not send email.");
          }
        }}
        className="h-9 rounded-xl bg-ink px-3 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "A enviar…" : label}
      </button>
      {error ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}
    </div>
  );
}
