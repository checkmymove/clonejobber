"use client";

import { useEffect, useState } from "react";
import { InlineEditCard, inlineArea } from "@/components/inline-edit-card";
import { saveInvoiceNotes } from "@/lib/invoices/actions";
import { saveJobNotes } from "@/lib/jobs/actions";

/** Internal notes (never shown to the client) on a job or an invoice. */
export function NotesCard({
  kind,
  id,
  notes,
}: {
  kind: "job" | "invoice";
  id: string;
  notes: string;
}) {
  const [draft, setDraft] = useState(notes);
  useEffect(() => setDraft(notes), [notes]);
  return (
    <InlineEditCard
      title="Notes"
      className="h-fit p-5 xl:col-span-2"
      onCancel={() => setDraft(notes)}
      onSave={() => (kind === "job" ? saveJobNotes(id, draft) : saveInvoiceNotes(id, draft))}
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
