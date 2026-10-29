"use client";

import { openPicker } from "@/components/date-field";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Trash2 } from "lucide-react";
import { ActionButton, MoreMenu } from "@/components/funnel/more-menu";
import { Field, InlineEditCard, inlineArea, inlineField } from "@/components/inline-edit-card";
import { emailPaymentReceipt, removePayment, updatePayment } from "@/lib/payments/actions";
import { PAYMENT_METHODS, paymentMethodLabel } from "@/lib/payments/constants";
import { formatDateNumericLondon } from "@/lib/format";

export function PaymentHeaderActions({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <MoreMenu
        items={[
          {
            kind: "action",
            label: "Delete",
            icon: <Trash2 size={18} />,
            danger: true,
            confirm: "Delete this payment? The invoice balance goes back up.",
            run: () => removePayment(paymentId),
          },
        ]}
      />
      <ActionButton
        label="Send Receipt"
        icon={<Mail size={16} />}
        run={async () => {
          const result = await emailPaymentReceipt(paymentId);
          if (result.ok) router.refresh();
          return result;
        }}
      />
    </div>
  );
}

export function PaymentDetailsCard({
  paymentId,
  method,
  paidOn,
  reference,
  details,
}: {
  paymentId: string;
  method: string;
  paidOn: string;
  reference: string;
  details: string;
}) {
  const [draft, setDraft] = useState({ method, paidOn, reference, details });
  useEffect(() => setDraft({ method, paidOn, reference, details }), [method, paidOn, reference, details]);
  const rows: [string, string][] = [
    ["Transaction date", formatDateNumericLondon(paidOn)],
    ["Method", paymentMethodLabel(method)],
    ["Reference number", reference || "—"],
    ["Details", details || "—"],
  ];
  return (
    <InlineEditCard
      title="Details"
      onCancel={() => setDraft({ method, paidOn, reference, details })}
      onSave={() => updatePayment(paymentId, draft)}
      view={
        <dl className="divide-y divide-line text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[9.5rem_1fr] gap-3 py-2">
              <dt className="text-ink-soft">{label}</dt>
              <dd className="whitespace-pre-wrap font-semibold text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Method">
          <select
            className={inlineField}
            value={draft.method}
            onChange={(e) => setDraft({ ...draft, method: e.target.value })}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Transaction date">
          <input
            type="date"
            onClick={openPicker}
            className={inlineField}
            value={draft.paidOn}
            onChange={(e) => setDraft({ ...draft, paidOn: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Reference number">
        <input
          className={inlineField}
          value={draft.reference}
          onChange={(e) => setDraft({ ...draft, reference: e.target.value })}
        />
      </Field>
      <Field label="Details">
        <textarea
          className={inlineArea}
          value={draft.details}
          onChange={(e) => setDraft({ ...draft, details: e.target.value })}
        />
      </Field>
    </InlineEditCard>
  );
}
