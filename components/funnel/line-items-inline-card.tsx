"use client";

import { useEffect, useMemo, useState } from "react";
import { Receipt } from "lucide-react";
import { CardIcon } from "@/components/card-icon";
import { InlineEditCard, LineFields, newDraftLine, type DraftLine } from "@/components/inline-edit-card";
import { LineItemsTable, TotalsList, type TotalRow } from "@/components/funnel/document-cards";
import { AddFromCatalog, type CatalogItem } from "@/components/quotes/quote-inline-cards";
import { penceToInput } from "@/lib/format";
import type { ParsedLine } from "@/lib/funnel/money";
import { saveInvoiceLinesAction } from "@/lib/invoices/actions";
import { saveJobLinesAction } from "@/lib/jobs/actions";

function toDraft(lines: ParsedLine[]): DraftLine[] {
  return lines.map((l, i) => ({
    id: `saved-${i}`,
    name: l.name,
    description: l.description,
    qty: String(l.quantity),
    price: penceToInput(l.unitPrice),
  }));
}

/**
 * Product / Service on the job and invoice pages. The pencil opens quantity, price and
 * description right here (the timer never changes them), so 5h quoted can become 8h
 * without leaving the page. Discount and tax stay as they are.
 */
export function LineItemsInlineCard({
  kind,
  id,
  lines,
  totals,
  catalog = [],
  note,
}: {
  kind: "job" | "invoice";
  id: string;
  lines: ParsedLine[];
  totals: TotalRow[];
  catalog?: CatalogItem[];
  /** Shown above the fields while editing (e.g. the job already has an invoice). */
  note?: string;
}) {
  const saved = useMemo(() => toDraft(lines), [lines]);
  const [draft, setDraft] = useState(saved);
  useEffect(() => setDraft(saved), [saved]);

  const add = (start: () => void, item: CatalogItem | null) => {
    const line = newDraftLine();
    setDraft([...saved, item ? { ...line, name: item.name, description: item.description, price: item.price } : line]);
    start();
  };

  return (
    <InlineEditCard
      className="h-fit p-5 xl:col-span-2"
      title="Product / Service"
      icon={<CardIcon icon={Receipt} tone="blue" boxed />}
      fitContent
      onCancel={() => setDraft(saved)}
      onSave={() => {
        const input = draft.map((l) => ({ name: l.name, description: l.description, qty: l.qty, unitPrice: l.price }));
        return kind === "job" ? saveJobLinesAction(id, input) : saveInvoiceLinesAction(id, input);
      }}
      actions={(start) => (
        <>
          <AddFromCatalog label="Add service" items={catalog.filter((c) => c.type === "service")} onPick={(item) => add(start, item)} />
          <AddFromCatalog label="Add product" items={catalog.filter((c) => c.type === "product")} onPick={(item) => add(start, item)} />
        </>
      )}
      view={
        <>
          <LineItemsTable lines={lines} />
          <TotalsList totals={totals} className="mt-4 ml-auto max-w-sm border-t" />
        </>
      }
    >
      {note ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{note}</p> : null}
      <LineFields lines={draft} onChange={setDraft} />
    </InlineEditCard>
  );
}
