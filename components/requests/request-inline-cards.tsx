"use client";

import Link from "next/link";

import { useEffect, useState } from "react";
import { Box, CalendarDays, Clock, MapPin, Package, Truck, UserRound } from "lucide-react";
import { CardIcon } from "@/components/card-icon";
import { openPicker } from "@/components/date-field";
import { TimeField, toTime24 } from "@/components/time-field";
import { formatDateLondon } from "@/lib/format";
import { HOURS_OPTIONS } from "@/lib/requests/constants";
import {
  saveRequestContact,
  saveRequestInPlace,
} from "@/lib/requests/actions";
import {
  toAdminRequestInput,
  type RequestEditSnapshot,
} from "@/lib/requests/edit-snapshot";
import {
  Dl,
  Field,
  InlineEditCard,
  inventorySummary,
  LocationFields,
  YesNoSelect,
  inlineArea,
  inlineField,
  type LocationDraft,
} from "@/components/inline-edit-card";

function pickupOf(s: RequestEditSnapshot): LocationDraft {
  return {
    address: s.pickupAddress,
    postcode: s.pickupPostcode,
    floor: s.pickupFloor,
    lift: s.pickupLift,
    parking: s.pickupParking,
    bedrooms: s.pickupBedrooms,
  };
}

function deliveryOf(s: RequestEditSnapshot): LocationDraft {
  return {
    address: s.deliveryAddress,
    postcode: s.deliveryPostcode,
    floor: s.deliveryFloor,
    lift: s.deliveryLift,
    parking: s.deliveryParking,
    bedrooms: s.deliveryBedrooms,
  };
}

function withPickup(s: RequestEditSnapshot, loc: LocationDraft): RequestEditSnapshot {
  return {
    ...s,
    pickupAddress: loc.address,
    pickupPostcode: loc.postcode,
    pickupFloor: loc.floor,
    pickupLift: loc.lift,
    pickupParking: loc.parking,
    pickupBedrooms: loc.bedrooms,
  };
}

function withDelivery(s: RequestEditSnapshot, loc: LocationDraft): RequestEditSnapshot {
  return {
    ...s,
    deliveryAddress: loc.address,
    deliveryPostcode: loc.postcode,
    deliveryFloor: loc.floor,
    deliveryLift: loc.lift,
    deliveryParking: loc.parking,
    deliveryBedrooms: loc.bedrooms,
  };
}

export function RequestContactCard({
  requestId,
  clientId,
  firstName,
  lastName,
  companyName,
  email,
  phone,
  leadSource,
  marketingEmail,
  marketingSms,
}: {
  requestId: string;
  clientId: string;
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  phone: string;
  leadSource: string;
  marketingEmail: boolean;
  marketingSms: boolean;
}) {
  const initial = {
    firstName,
    lastName,
    companyName,
    email,
    phone,
    marketingEmail,
    marketingSms,
  };
  const [draft, setDraft] = useState(initial);
  useEffect(() => setDraft(initial), [firstName, lastName, companyName, email, phone, marketingEmail, marketingSms]);

  const rows: [string, React.ReactNode][] = [
    [
      "Name",
      <Link key="name" href={`/clientes/${clientId}`} className="font-semibold text-accent hover:underline">
        {`${firstName} ${lastName}`.trim() || "—"}
      </Link>,
    ],
    ["Email", email || "—"],
    ["Phone", phone || "—"],
    ["Heard via", leadSource || "—"],
    ["Marketing email", marketingEmail ? "Yes" : "No"],
    ["Marketing SMS", marketingSms ? "Yes" : "No"],
  ];
  if (companyName) rows.splice(1, 0, ["Company", companyName]);

  return (
    <InlineEditCard
      // Always open, and the Summary next to it stretches to the same height.
      fitContent
      className="self-stretch p-5"
      title="Contact Information"
      icon={<CardIcon icon={UserRound} tone="blue" />}
      view={<Dl rows={rows} />}
      onCancel={() => setDraft(initial)}
      onSave={() => saveRequestContact(clientId, requestId, draft)}
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
      <Field label="Email">
        <input className={inlineField} value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
      </Field>
      <Field label="Phone">
        <input className={inlineField} value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
      </Field>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={draft.marketingEmail}
          onChange={(e) => setDraft({ ...draft, marketingEmail: e.target.checked })}
        />
        Marketing email
      </label>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={draft.marketingSms}
          onChange={(e) => setDraft({ ...draft, marketingSms: e.target.checked })}
        />
        Marketing SMS
      </label>
    </InlineEditCard>
  );
}

type Saved = { ok: boolean; message?: string; errors?: Record<string, string> };

/** Calls onSaved after a successful save, so a form holding a copy can reload it. */
async function saveThen(work: Promise<Saved>, onSaved?: () => void): Promise<Saved> {
  const result = await work;
  if (result.ok) onSaved?.();
  return result;
}

export function PackingServiceCard({
  snapshot,
  onSaved,
  half = false,
}: {
  snapshot: RequestEditSnapshot;
  onSaved?: () => void;
  /** One column instead of the full row (job page, beside Date & time). */
  half?: boolean;
}) {
  const [draft, setDraft] = useState(snapshot);
  useEffect(() => setDraft(snapshot), [snapshot]);
  return (
    <InlineEditCard
      className={half ? "h-fit p-5" : "h-fit p-5 xl:col-span-2"}
      title="Packing Service"
      icon={<CardIcon icon={Package} tone="orange" />}
      onCancel={() => setDraft(snapshot)}
      onSave={() => saveThen(saveRequestInPlace(snapshot.id, toAdminRequestInput(draft)), onSaved)}
      view={
        <Dl
          divided
          rows={[
            ["Packing services", snapshot.needsPacking ? "Yes" : "No"],
            ["Packing materials", snapshot.needsBoxes ? "Yes" : "No"],
          ]}
        />
      }
    >
      <Field label="Packing services">
        <YesNoSelect value={draft.needsPacking} onChange={(needsPacking) => setDraft({ ...draft, needsPacking })} />
      </Field>
      <Field label="Packing materials">
        <YesNoSelect value={draft.needsBoxes} onChange={(needsBoxes) => setDraft({ ...draft, needsBoxes })} />
      </Field>
    </InlineEditCard>
  );
}

/** The service and hours the client asked for in the request form. */
export function RemovalServiceCard({
  snapshot,
  services,
  onSaved,
  half = false,
}: {
  snapshot: RequestEditSnapshot;
  services: { id: string; name: string }[];
  onSaved?: () => void;
  /** One column instead of the full row (request page, beside Packing Service). */
  half?: boolean;
}) {
  const [draft, setDraft] = useState(snapshot);
  useEffect(() => setDraft(snapshot), [snapshot]);
  const selected = services.filter((s) => snapshot.serviceIds.includes(s.id));

  return (
    <InlineEditCard
      className={half ? "h-fit p-5" : "h-fit p-5 xl:col-span-2"}
      title="Removal Service"
      icon={<CardIcon icon={Truck} tone="green" />}
      onCancel={() => setDraft(snapshot)}
      onSave={() => saveThen(saveRequestInPlace(snapshot.id, toAdminRequestInput(draft)), onSaved)}
      view={
        <div className="overflow-hidden rounded-xl border border-line">
          {selected.length > 0 ? (
            <ul className="divide-y divide-emerald-100">
              {selected.map((s) => (
                <li key={s.id} className="flex items-center gap-3 bg-emerald-50/70 px-4 py-3 text-[15px] font-bold text-ink">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-[12px] font-bold text-white">
                    ✓
                  </span>
                  {s.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-sm text-ink-soft">No service selected.</p>
          )}
          <p className="flex items-center justify-between border-t border-line px-4 py-3 text-sm text-ink-soft">
            Hours <span className="font-semibold text-ink">{snapshot.hours || "—"}</span>
          </p>
        </div>
      }
    >
      <div className="space-y-2">
        {services.map((service) => {
          const checked = draft.serviceIds.includes(service.id);
          return (
            <label key={service.id} className="flex items-center gap-2 text-sm font-semibold text-ink">
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  setDraft({
                    ...draft,
                    serviceIds: checked
                      ? draft.serviceIds.filter((id) => id !== service.id)
                      : [...draft.serviceIds, service.id],
                  })
                }
              />
              {service.name}
            </label>
          );
        })}
      </div>
      <Field label="Hours">
        <select className={inlineField} value={draft.hours} onChange={(e) => setDraft({ ...draft, hours: e.target.value })}>
          <option value="">—</option>
          {HOURS_OPTIONS.map((hours) => (
            <option key={hours} value={hours}>
              {hours}
            </option>
          ))}
        </select>
      </Field>
    </InlineEditCard>
  );
}

function locationRows(loc: LocationDraft): [string, string][] {
  return [
    ["Address", `${loc.address}${loc.postcode ? `, ${loc.postcode}` : ""}`.replace(/^, /, "") || "—"],
    ["Floor", loc.floor || "—"],
    ["Lift", loc.lift ? "Yes" : "No"],
    ["Parking", loc.parking || "—"],
    ["Bedrooms", loc.bedrooms || "—"],
  ];
}

const emptyStop: LocationDraft = {
  address: "",
  postcode: "",
  floor: "",
  lift: false,
  parking: "",
  bedrooms: "",
};

/** Most stops of one kind a request may list (public form allows the same). */
const MAX_STOPS = 5;

/**
 * Collection (or Delivery) of the request. When the client gave more than one, the
 * card lists Collection 1, 2… and the editor can add or remove the extra ones.
 */
export function RequestLocationCard({
  title,
  snapshot,
  kind,
  onSaved,
}: {
  title: string;
  snapshot: RequestEditSnapshot;
  kind: "pickup" | "delivery";
  onSaved?: () => void;
}) {
  const noun = kind === "pickup" ? "Collection" : "Delivery";
  const current = kind === "pickup" ? pickupOf(snapshot) : deliveryOf(snapshot);
  const currentExtras = (kind === "pickup" ? snapshot.extraPickups : snapshot.extraDeliveries) ?? [];
  const [draft, setDraft] = useState(current);
  const [extras, setExtras] = useState<LocationDraft[]>(currentExtras);
  useEffect(() => {
    setDraft(current);
    setExtras(currentExtras);
  }, [snapshot, kind]);
  const many = currentExtras.length > 0;

  const view = many ? (
    <div className="space-y-3">
      {[current, ...currentExtras].map((loc, i) => (
        <div key={i} className={i > 0 ? "border-t border-line pt-3" : undefined}>
          <p className="mb-1 text-[12px] font-bold uppercase tracking-wide text-ink-soft">
            {noun} {i + 1}
          </p>
          <Dl rows={locationRows(loc)} />
        </div>
      ))}
    </div>
  ) : (
    <Dl rows={locationRows(current)} />
  );

  const save = () => {
    const base = kind === "pickup" ? withPickup(snapshot, draft) : withDelivery(snapshot, draft);
    const next = kind === "pickup" ? { ...base, extraPickups: extras } : { ...base, extraDeliveries: extras };
    return saveThen(saveRequestInPlace(snapshot.id, toAdminRequestInput(next)), onSaved);
  };

  return (
    <InlineEditCard
      title={many ? `${title} (${currentExtras.length + 1})` : title}
      icon={<CardIcon icon={MapPin} tone={kind === "pickup" ? "emerald" : "rose"} />}
      view={view}
      onCancel={() => {
        setDraft(current);
        setExtras(currentExtras);
      }}
      onSave={save}
    >
      {extras.length > 0 ? (
        <p className="text-[12px] font-bold uppercase tracking-wide text-ink-soft">{noun} 1</p>
      ) : null}
      <LocationFields value={draft} onChange={setDraft} />
      {extras.map((stop, i) => (
        <div key={i} className="space-y-3 border-t border-line pt-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12px] font-bold uppercase tracking-wide text-ink-soft">
              {noun} {i + 2}
            </p>
            <button
              type="button"
              onClick={() => setExtras(extras.filter((_, j) => j !== i))}
              className="rounded-lg px-2 py-1 text-xs font-bold text-rose-700 hover:bg-rose-50"
            >
              ✕ Remove
            </button>
          </div>
          <LocationFields
            value={stop}
            onChange={(value) => setExtras(extras.map((s, j) => (j === i ? value : s)))}
          />
        </div>
      ))}
      {extras.length + 1 < MAX_STOPS ? (
        <button
          type="button"
          onClick={() => setExtras([...extras, { ...emptyStop }])}
          className="flex h-9 w-full items-center justify-center rounded-lg border border-dashed border-blue-300 bg-blue-50 text-sm font-bold text-blue-700 hover:border-blue-500 hover:bg-blue-100"
        >
          + Add {noun}
        </button>
      ) : null}
    </InlineEditCard>
  );
}

export function RequestInventoryCard({
  snapshot,
  files,
}: {
  snapshot: RequestEditSnapshot;
  files: { id: string; file_name: string }[];
}) {
  const [inventory, setInventory] = useState(snapshot.inventory);
  useEffect(() => setInventory(snapshot.inventory), [snapshot.inventory]);

  return (
    <InlineEditCard
      className="h-fit p-5 xl:col-span-2"
      title="Inventory List"
      icon={<CardIcon icon={Box} tone="blue" boxed />}
      collapsible
      summary={inventorySummary(snapshot.inventory, files.length)}
      onCancel={() => setInventory(snapshot.inventory)}
      onSave={() => saveRequestInPlace(snapshot.id, toAdminRequestInput({ ...snapshot, inventory }))}
      view={
        <>
          <p className="whitespace-pre-wrap text-sm text-ink">{snapshot.inventory || "—"}</p>
          {files.length > 0 ? (
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {files.map((file) => (
                <a
                  key={file.id}
                  href={`/api/requests/${snapshot.id}/files/${file.id}`}
                  target="_blank"
                  rel="noreferrer"
                  title={file.file_name}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/requests/${snapshot.id}/files/${file.id}`}
                    alt={file.file_name}
                    className="aspect-square w-full rounded-lg border border-line object-cover"
                    loading="lazy"
                  />
                </a>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-ink-mute">No images attached.</p>
          )}
        </>
      }
    >
      <textarea className={inlineArea} value={inventory} onChange={(e) => setInventory(e.target.value)} />
    </InlineEditCard>
  );
}

/** "09:00" or "9am" → "9:00 AM"; free text the client typed is shown as it is. */
function clockLabel(raw: string): string {
  const hhmm = toTime24(raw);
  const match = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return raw.trim() || "—";
  const hour = Number(match[1]);
  return `${hour % 12 === 0 ? 12 : hour % 12}:${match[2]} ${hour >= 12 ? "PM" : "AM"}`;
}

/** Moving date and time the client gave: two boxes side by side under Collection and Delivery. */
export function RequestMovingCard({ snapshot }: { snapshot: RequestEditSnapshot }) {
  const [moveDate, setMoveDate] = useState(snapshot.moveDate);
  const [moveTime, setMoveTime] = useState(toTime24(snapshot.moveTime));
  useEffect(() => {
    setMoveDate(snapshot.moveDate);
    setMoveTime(toTime24(snapshot.moveTime));
  }, [snapshot]);

  return (
    <>
      <InlineEditCard
        layout="stat"
        title="Moving date"
        icon={<CardIcon icon={CalendarDays} tone="blue" boxed />}
        onCancel={() => setMoveDate(snapshot.moveDate)}
        onSave={() => saveRequestInPlace(snapshot.id, toAdminRequestInput({ ...snapshot, moveDate }))}
        view={snapshot.moveDate ? formatDateLondon(snapshot.moveDate) + " " + snapshot.moveDate.slice(0, 4) : "Not set"}
      >
        <Field label="Moving date">
          <input type="date" onClick={openPicker} className={inlineField} value={moveDate} onChange={(e) => setMoveDate(e.target.value)} />
        </Field>
      </InlineEditCard>
      <InlineEditCard
        layout="stat"
        title="Moving time"
        icon={<CardIcon icon={Clock} tone="violet" boxed />}
        onCancel={() => setMoveTime(toTime24(snapshot.moveTime))}
        onSave={() => saveRequestInPlace(snapshot.id, toAdminRequestInput({ ...snapshot, moveTime }))}
        view={clockLabel(snapshot.moveTime)}
      >
        <Field label="Moving time">
          <TimeField ariaLabel="Moving time" className={inlineField} value={moveTime} onChange={setMoveTime} />
        </Field>
      </InlineEditCard>
    </>
  );
}
