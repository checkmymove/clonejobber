"use client";

import { ServiceNameField } from "@/components/funnel/service-name-field";
import type { CatalogItem } from "@/components/quotes/quote-inline-cards";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Pencil } from "lucide-react";
import { Card } from "@/components/ui";
import { EqualHeightBody } from "@/components/equal-height";
import { CARD_TITLE } from "@/components/card-icon";
import { formatPounds, padMoney } from "@/lib/format";

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
  collapsible = false,
  summary,
  fitContent = false,
  icon,
  layout = "list",
  actions,
  footer,
}: {
  title: string;
  /** Buttons beside the pencil; `startEditing` opens the card's edit mode. */
  actions?: (startEditing: () => void) => ReactNode;
  /** Under the view (not while editing), e.g. the green Add line item; `startEditing` opens edit mode. */
  footer?: (startEditing: () => void) => ReactNode;
  /** Coloured icon before the title (see CardIcon). */
  icon?: ReactNode;
  /** "stat": icon, small title and one large value side by side (moving date, time). */
  layout?: "list" | "stat";
  view: ReactNode;
  children: ReactNode;
  onSave: () => Promise<{ ok: boolean; message?: string; errors?: Record<string, string> }>;
  onCancel?: () => void;
  accent?: string;
  className?: string;
  /** Starts collapsed to its title; the arrow (or a click on the title) reveals it. */
  collapsible?: boolean;
  /** Short hint shown next to the title while collapsed. */
  summary?: ReactNode;
  /** Always show the whole body: no collapsing to the neighbour's height, no arrow. */
  fitContent?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(!collapsible);
  const router = useRouter();
  const shown = open || editing;

  async function save() {
    setPending(true);
    setError("");
    const result = await onSave();
    setPending(false);
    if (!result.ok) {
      setError(result.message || Object.values(result.errors ?? {})[0] || "Could not save.");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  const pencil = !editing ? (
    <button
      type="button"
      aria-label={`Edit ${title}`}
      onClick={() => {
        setError("");
        setEditing(true);
      }}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-soft hover:bg-cream hover:text-ink"
    >
      <Pencil size={16} />
    </button>
  ) : null;

  if (layout === "stat" && !editing) {
    return (
      <Card className={className ?? "h-fit p-5"} accent={accent}>
        <div className="flex items-center gap-4">
          {icon}
          <div className="min-w-0 flex-1">
            <h2 className={CARD_TITLE}>{title}</h2>
            <div className="mt-0.5 text-[19px] leading-snug text-ink">{view}</div>
          </div>
          {pencil}
        </div>
      </Card>
    );
  }

  return (
    <Card className={className ?? "h-fit p-5"} accent={accent}>
      <div className={`flex items-center justify-between gap-2 ${shown ? "mb-3" : ""}`}>
        {collapsible ? (
          <button
            type="button"
            aria-expanded={shown}
            onClick={() => !editing && setOpen((v) => !v)}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
          >
            {icon}
            <h2 className={CARD_TITLE}>{title}</h2>
            {!shown && summary ? <span className="truncate text-[13px] text-ink-mute">{summary}</span> : null}
            <ChevronDown
              size={18}
              aria-hidden
              className={`ml-auto shrink-0 text-ink-soft transition-transform ${shown ? "rotate-180" : ""}`}
            />
          </button>
        ) : (
          <div className="flex min-w-0 items-center gap-3">
            {icon}
            <h2 className={CARD_TITLE}>{title}</h2>
          </div>
        )}
        <div className="flex shrink-0 items-center gap-2">
          {actions && !editing
            ? actions(() => {
                setError("");
                setEditing(true);
              })
            : null}
          {pencil}
        </div>
      </div>
      {!shown ? null : editing ? (
        // A div, not a form: these cards also sit inside page forms (New quote), and a
        // nested form would submit the outer one.
        <div
          className="space-y-3"
          onKeyDown={(event) => {
            if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
              event.preventDefault();
              void save();
            }
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
              type="button"
              onClick={() => void save()}
              disabled={pending}
              className="h-9 rounded-xl bg-ink px-3 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : (
        <>
          {fitContent ? (
            <div>{view}</div>
          ) : (
            <EqualHeightBody label={title.toLowerCase()}>{view}</EqualHeightBody>
          )}
          {footer
            ? footer(() => {
                setError("");
                setEditing(true);
              })
            : null}
        </>
      )}
    </Card>
  );
}

/** Label and value rows; `divided` puts a line between rows (Packing Service). */
export function Dl({ rows, divided = false }: { rows: [string, ReactNode][]; divided?: boolean }) {
  return (
    <div className={divided ? "divide-y divide-line text-sm" : "text-sm"}>
      {rows.map(([k, v]) => (
        <p key={k} className={`flex justify-between gap-4 ${divided ? "py-3 first:pt-1 last:pb-0" : "py-1"}`}>
          <span className="text-ink-soft">{k}</span>
          <span className={`text-right text-ink ${divided ? "font-semibold" : "font-medium"}`}>{v}</span>
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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

/** Line editor styles, the same as New quote (Convert to quote). */
const lineLabel = "mb-1 block text-[13px] text-ink-soft";
const lineField =
  "h-11 w-full rounded-lg border border-line bg-white px-3 text-[15px] text-ink outline-none placeholder:text-ink-mute focus:border-accent focus:ring-2 focus:ring-accent/20";

function lineTotal(line: DraftLine): number {
  const qty = Number(line.qty.replace(",", ".")) || 0;
  const price = Number(line.price.replace(",", ".")) || 0;
  return qty * price;
}

/**
 * Product / Service lines as New quote shows them: Service, Quantity, Unit price and
 * Total on one row, the Service summary under it, and the green Add line item below.
 */
export function LineFields({
  lines,
  onChange,
  catalog,
}: {
  lines: DraftLine[];
  onChange: (lines: DraftLine[]) => void;
  /** Products & Services: clicking a line's Service box lists them to pick from. */
  catalog?: CatalogItem[];
}) {
  const patch = (id: string, change: Partial<DraftLine>) =>
    onChange(lines.map((item) => (item.id === id ? { ...item, ...change } : item)));
  return (
    <div>
      <div className="space-y-6">
        {lines.map((line, index) => (
          <div key={line.id} className="space-y-3">
            <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_110px_150px_120px]">
              <div className="block">
                <span className={lineLabel}>Service</span>
                {catalog?.length ? (
                  <ServiceNameField
                    ariaLabel={`Line ${index + 1} name`}
                    className={lineField}
                    value={line.name}
                    catalog={catalog}
                    onChange={(name) => patch(line.id, { name })}
                    onPick={(picked) =>
                      patch(line.id, { name: picked.name, description: picked.description, price: padMoney(picked.price) })
                    }
                  />
                ) : (
                  <input
                    aria-label={`Line ${index + 1} name`}
                    className={lineField}
                    value={line.name}
                    onChange={(e) => patch(line.id, { name: e.target.value })}
                  />
                )}
              </div>
              <label className="block">
                <span className={lineLabel}>Quantity</span>
                <input
                  aria-label={`Line ${index + 1} quantity`}
                  className={lineField}
                  value={line.qty}
                  onChange={(e) => patch(line.id, { qty: e.target.value })}
                />
              </label>
              <label className="block">
                <span className={lineLabel}>Unit price</span>
                <input
                  aria-label={`Line ${index + 1} price`}
                  className={lineField}
                  placeholder="£ 0.00"
                  value={line.price}
                  onChange={(e) => patch(line.id, { price: e.target.value })}
                  onBlur={(e) => patch(line.id, { price: padMoney(e.target.value) })}
                />
              </label>
              <div className="block">
                <span className={lineLabel}>Total</span>
                <div className="flex h-11 items-center justify-end rounded-lg border border-line px-3 text-[15px] text-ink">
                  {formatPounds(lineTotal(line))}
                </div>
              </div>
            </div>
            <label className="block">
              <span className="mb-1 flex items-center justify-between gap-3">
                <span className="text-[13px] text-ink-soft">Service summary</span>
                <button
                  type="button"
                  className="text-[13px] font-semibold text-rose-700 hover:underline"
                  onClick={() => onChange(lines.filter((item) => item.id !== line.id))}
                >
                  Remove line
                </button>
              </span>
              <textarea
                aria-label={`Line ${index + 1} summary`}
                className="min-h-[180px] w-full resize-y rounded-lg border border-line bg-white px-3 py-2 text-[15px] leading-6 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                value={line.description}
                onChange={(e) => patch(line.id, { description: e.target.value })}
              />
            </label>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...lines, newDraftLine()])}
        className="mt-4 h-9 rounded-lg bg-accent px-3 text-sm font-semibold text-white hover:opacity-90"
      >
        Add line item
      </button>
    </div>
  );
}

/** "12 items · 3 photos" style hint for a collapsed inventory list. */
export function inventorySummary(inventory: string, photos = 0): string {
  const items = inventory.split("\n").filter((line) => line.trim()).length;
  const parts = [items ? `${items} line${items === 1 ? "" : "s"}` : "Empty"];
  if (photos) parts.push(`${photos} photo${photos === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

/**
 * Photos the client uploaded on the request, shown in every Inventory list down the
 * funnel (request, quote, job, invoice). Files are served by the request's file route.
 */
export function InventoryPhotos({
  requestId,
  files,
}: {
  requestId: string;
  files: { id: string; file_name: string }[];
}) {
  if (files.length === 0) return <p className="mt-2 text-sm text-ink-mute">No images attached.</p>;
  return (
    <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
      {files.map((file) => {
        const href = `/api/requests/${requestId}/files/${file.id}`;
        return (
          <a key={file.id} href={href} target="_blank" rel="noreferrer" title={file.file_name}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={href}
              alt={file.file_name}
              className="aspect-square w-full rounded-lg border border-line object-cover"
              loading="lazy"
            />
          </a>
        );
      })}
    </div>
  );
}
