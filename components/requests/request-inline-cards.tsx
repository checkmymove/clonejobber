"use client";

import { useEffect, useState } from "react";
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

  const rows: [string, string][] = [
    ["Name", `${firstName} ${lastName}`.trim() || "—"],
    ["Email", email || "—"],
    ["Phone", phone || "—"],
    ["Heard via", leadSource || "—"],
    ["Marketing email", marketingEmail ? "Yes" : "No"],
    ["Marketing SMS", marketingSms ? "Yes" : "No"],
  ];
  if (companyName) rows.splice(1, 0, ["Company", companyName]);

  return (
    <InlineEditCard
      title="Contact Information"
      view={<Dl rows={rows} />}
      onCancel={() => setDraft(initial)}
      onSave={() => saveRequestContact(clientId, requestId, draft)}
    >
      <div className="grid gap-3 sm:grid-cols-2">
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

export function RequestPackingCard({
  snapshot,
  services,
}: {
  snapshot: RequestEditSnapshot;
  services: { id: string; name: string }[];
}) {
  const [draft, setDraft] = useState(snapshot);
  useEffect(() => setDraft(snapshot), [snapshot]);
  const selected = services.filter((s) => snapshot.serviceIds.includes(s.id));

  return (
    <InlineEditCard
      title="Packing Service"
      accent="#2f7d3b"
      onCancel={() => setDraft(snapshot)}
      onSave={() => saveRequestInPlace(snapshot.id, toAdminRequestInput(draft))}
      view={
        <>
          <Dl
            rows={[
              ["Packing services", snapshot.needsPacking ? "Yes" : "No"],
              ["Packing materials", snapshot.needsBoxes ? "Yes" : "No"],
            ]}
          />
          <div className="mt-4 rounded-xl border border-accent/25 bg-accent-soft p-4">
            <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-accent">
              Service Details
            </h2>
            {selected.length > 0 ? (
              <ul className="space-y-2">
                {selected.map((s) => (
                  <li key={s.id} className="flex items-center gap-2.5 text-[15px] font-bold text-ink">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-bold text-white">
                      ✓
                    </span>
                    {s.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-soft">No service selected.</p>
            )}
            <p className="mt-3 border-t border-accent/20 pt-3 text-sm text-ink-soft">
              Hours{" "}
              <span className="text-lg font-extrabold text-ink">{snapshot.hours || "—"}</span>
            </p>
          </div>
        </>
      }
    >
      <Field label="Packing services">
        <YesNoSelect value={draft.needsPacking} onChange={(needsPacking) => setDraft({ ...draft, needsPacking })} />
      </Field>
      <Field label="Packing materials">
        <YesNoSelect value={draft.needsBoxes} onChange={(needsBoxes) => setDraft({ ...draft, needsBoxes })} />
      </Field>
      <div>
        <p className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-accent">Service Details</p>
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
      </div>
      <Field label="Hours">
        <select
          className={inlineField}
          value={draft.hours}
          onChange={(e) => setDraft({ ...draft, hours: e.target.value })}
        >
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

export function RequestLocationCard({
  title,
  snapshot,
  kind,
}: {
  title: string;
  snapshot: RequestEditSnapshot;
  kind: "pickup" | "delivery";
}) {
  const current = kind === "pickup" ? pickupOf(snapshot) : deliveryOf(snapshot);
  const [draft, setDraft] = useState(current);
  useEffect(() => setDraft(current), [snapshot, kind]);
  const viewRows: [string, string][] = [
    ["Address", `${current.address}${current.postcode ? `, ${current.postcode}` : ""}`.replace(/^, /, "") || "—"],
    ["Floor", current.floor || "—"],
    ["Lift", current.lift ? "Yes" : "No"],
    ["Parking", current.parking || "—"],
    ["Bedrooms", current.bedrooms || "—"],
  ];

  return (
    <InlineEditCard
      title={title}
      view={<Dl rows={viewRows} />}
      onCancel={() => setDraft(current)}
      onSave={() =>
        saveRequestInPlace(
          snapshot.id,
          toAdminRequestInput(kind === "pickup" ? withPickup(snapshot, draft) : withDelivery(snapshot, draft)),
        )
      }
    >
      <LocationFields value={draft} onChange={setDraft} />
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
