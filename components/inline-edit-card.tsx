"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Card } from "@/components/ui";

export const inlineField =
  "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-accent";
export const inlineArea =
  "min-h-[88px] w-full resize-y rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent";

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[13px] text-ink-soft">{label}</span>
      {children}
    </label>
  );
}

export function InlineEditCard({
  title,
  view,
  children,
  onSave,
  onCancel,
  accent,
  className,
}: {
  title: string;
  view: ReactNode;
  children: ReactNode;
  onSave: () => Promise<{ ok: boolean; message?: string; errors?: Record<string, string> }>;
  onCancel?: () => void;
  accent?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  return (
    <Card className={className ?? "h-fit p-5"} accent={accent}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <h2 className="text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">{title}</h2>
        {!editing ? (
          <button
            type="button"
            aria-label={`Edit ${title}`}
            onClick={() => {
              setError("");
              setEditing(true);
            }}
            className="grid h-7 w-7 place-items-center rounded-lg text-ink-soft hover:bg-cream hover:text-ink"
          >
            <Pencil size={14} />
          </button>
        ) : null}
      </div>
      {editing ? (
        <form
          className="space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setError("");
            const result = await onSave();
            setPending(false);
            if (!result.ok) {
              setError(
                result.message ||
                  Object.values(result.errors ?? {})[0] ||
                  "Could not save.",
              );
              return;
            }
            setEditing(false);
            router.refresh();
          }}
        >
          {children}
          {error ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                onCancel?.();
                setEditing(false);
                setError("");
              }}
              className="h-9 rounded-xl border border-line bg-card px-3 text-sm font-bold text-ink hover:bg-cream"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="h-9 rounded-xl bg-ink px-3 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      ) : (
        view
      )}
    </Card>
  );
}

export function Dl({ rows }: { rows: [string, string][] }) {
  return (
    <div className="text-sm">
      {rows.map(([k, v]) => (
        <p key={k} className="flex justify-between gap-4 py-0.5">
          <span className="text-ink-soft">{k}</span>
          <span className="text-right font-semibold text-ink">{v}</span>
        </p>
      ))}
    </div>
  );
}

export function YesNoSelect({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <select
      className={inlineField}
      value={value ? "yes" : "no"}
      onChange={(event) => onChange(event.target.value === "yes")}
    >
      <option value="yes">Yes</option>
      <option value="no">No</option>
    </select>
  );
}

export type LocationDraft = {
  address: string;
  postcode: string;
  floor: string;
  lift: boolean;
  parking: string;
  bedrooms: string;
};

export function LocationFields({
  value,
  onChange,
}: {
  value: LocationDraft;
  onChange: (value: LocationDraft) => void;
}) {
  const patch = (part: Partial<LocationDraft>) => onChange({ ...value, ...part });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Address">
        <input className={inlineField} value={value.address} onChange={(e) => patch({ address: e.target.value })} />
      </Field>
      <Field label="Postcode">
        <input className={inlineField} value={value.postcode} onChange={(e) => patch({ postcode: e.target.value })} />
      </Field>
      <Field label="Floor">
        <input className={inlineField} value={value.floor} onChange={(e) => patch({ floor: e.target.value })} />
      </Field>
      <Field label="Lift">
        <YesNoSelect value={value.lift} onChange={(lift) => patch({ lift })} />
      </Field>
      <Field label="Parking">
        <input className={inlineField} value={value.parking} onChange={(e) => patch({ parking: e.target.value })} />
      </Field>
      <Field label="Bedrooms">
        <input className={inlineField} value={value.bedrooms} onChange={(e) => patch({ bedrooms: e.target.value })} />
      </Field>
    </div>
  );
}

export type DraftLine = {
  id: string;
  name: string;
  description: string;
  qty: string;
  price: string;
};

export function newDraftLine(): DraftLine {
  return {
    id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: "",
    description: "",
    qty: "1",
    price: "",
  };
}

export function LineFields({
  lines,
  onChange,
}: {
  lines: DraftLine[];
  onChange: (lines: DraftLine[]) => void;
}) {
  return (
    <div className="space-y-3">
      {lines.map((line, index) => (
        <div key={line.id} className="space-y-2 rounded-xl border border-line p-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_5.5rem_6.5rem_auto]">
            <input
              aria-label={`Line ${index + 1} name`}
              className={inlineField}
              placeholder="Service"
              value={line.name}
              onChange={(e) =>
                onChange(lines.map((item) => (item.id === line.id ? { ...item, name: e.target.value } : item)))
              }
            />
            <input
              aria-label={`Line ${index + 1} quantity`}
              className={inlineField}
              placeholder="Qty"
              value={line.qty}
              onChange={(e) =>
                onChange(lines.map((item) => (item.id === line.id ? { ...item, qty: e.target.value } : item)))
              }
            />
            <input
              aria-label={`Line ${index + 1} price`}
              className={inlineField}
              placeholder="Price"
              value={line.price}
              onChange={(e) =>
                onChange(lines.map((item) => (item.id === line.id ? { ...item, price: e.target.value } : item)))
              }
            />
            <button
              type="button"
              className="h-10 rounded-lg px-2 text-sm font-bold text-rose-700 hover:bg-rose-50"
              onClick={() => onChange(lines.filter((item) => item.id !== line.id))}
            >
              Remove
            </button>
          </div>
          <textarea
            aria-label={`Line ${index + 1} summary`}
            className={inlineArea}
            placeholder="Service summary"
            value={line.description}
            onChange={(e) =>
              onChange(lines.map((item) => (item.id === line.id ? { ...item, description: e.target.value } : item)))
            }
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...lines, newDraftLine()])}
        className="text-sm font-bold text-accent hover:underline"
      >
        Add line item
      </button>
    </div>
  );
}
