"use client";

import { useEffect, useState } from "react";
import { InlineEditCard, inlineArea } from "@/components/inline-edit-card";
import { saveInvoiceNotes } from "@/lib/invoices/actions";
import { saveJobNotes } from "@/lib/jobs/actions";
import { saveQuoteNotes } from "@/lib/quotes/actions";

/** Internal notes (never shown to the client) on a quote, job or invoice. Always right after the Inventory list. */
export function NotesCard({
  kind,
  id,
  notes,
}: {
  kind: "quote" | "job" | "invoice";
  id: string;
  notes: string;
}) {
  const [draft, setDraft] = useState(notes);
  useEffect(() => setDraft(notes), [notes]);
  return (
    <InlineEditCard
      title="Internal notes"
      className="h-fit p-5 xl:col-span-2"
      onCancel={() => setDraft(notes)}
      onSave={() =>
        kind === "quote" ? saveQuoteNotes(id, draft) : kind === "job" ? saveJobNotes(id, draft) : saveInvoiceNotes(id, draft)
      }
      view={
        notes ? (
          <p className="whitespace-pre-wrap text-sm text-ink">{notes}</p>
        ) : (
          <p className="text-sm text-ink-mute">Leave an internal note for yourself or a team member.</p>
        )
      }
    >
      <textarea
        aria-label="Notes"
        className={inlineArea}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
    </InlineEditCard>
  );
}
