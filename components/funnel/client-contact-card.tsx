"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Dl, Field, InlineEditCard, inlineField } from "@/components/inline-edit-card";
import { saveClientContact } from "@/lib/clients/actions";
import type { ClientContact } from "@/lib/clients/queries";

type Result = { ok: boolean; message?: string; errors?: Record<string, string> };

/**
 * Client box at the top left of quote, job and invoice pages, with the pencil that
 * edits the client record. A page can add its own rows (a quote's moving date and time).
 */
export function ClientContactCard({
  client,
  address,
  addressLabel = "Collection address",
  extraRows = [],
  extraFields,
  onSaveExtra,
  onCancelExtra,
}: {
  client: ClientContact;
  address: string;
  addressLabel?: string;
  extraRows?: [string, string][];
  extraFields?: ReactNode;
  onSaveExtra?: () => Promise<Result>;
  onCancelExtra?: () => void;
}) {
  const initial = {
    firstName: client.firstName,
    lastName: client.lastName,
    companyName: client.companyName,
    email: client.email,
    phone: client.phone,
  };
  const [draft, setDraft] = useState(initial);
  useEffect(() => setDraft(initial), [client.firstName, client.lastName, client.companyName, client.email, client.phone]);
  const name = `${client.firstName} ${client.lastName}`.trim();

  const rows: [string, string][] = [
    ...(client.companyName ? ([["Company", client.companyName]] as [string, string][]) : []),
    [addressLabel, address || "—"],
    ["Phone", client.phone || "—"],
    ["Email", client.email || "—"],
    ...extraRows,
  ];

  return (
    <InlineEditCard
      title="Client"
      onCancel={() => {
        setDraft(initial);
        onCancelExtra?.();
      }}
      onSave={async () => {
        const saved = await saveClientContact(client.id, draft);
        if (!saved.ok || !onSaveExtra) return saved;
        return onSaveExtra();
      }}
      view={
        <>
          <Link href={`/clientes/${client.id}`} className="text-lg font-extrabold text-ink hover:underline">
            {name}
          </Link>
          {client.number ? <span className="ml-2 text-sm text-ink-mute">#{client.number}</span> : null}
          <div className="mt-3 [overflow-wrap:anywhere]">
            <Dl rows={rows} />
          </div>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="First name">
          <input className={inlineField} value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} />
        </Field>
        <Field label="Last name">
          <input className={inlineField} value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} />
        </Field>
      </div>
      <Field label="Company">
        <input className={inlineField} value={draft.companyName} onChange={(e) => setDraft({ ...draft, companyName: e.target.value })} />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Email">
          <input className={inlineField} value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
        </Field>
        <Field label="Phone">
          <input className={inlineField} value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
        </Field>
      </div>
      {extraFields}
    </InlineEditCard>
  );
}
