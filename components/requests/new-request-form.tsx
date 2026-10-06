"use client";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { useMemo, useRef, useState } from "react";
import { Calendar, ChevronDown, Quote, Search, UserRound } from "lucide-react";
import { HOURS_OPTIONS } from "@/lib/requests/constants";
import {
  createAdminRequest,
  saveRequestAndConvert,
  updateAdminRequest,
} from "@/lib/requests/actions";
import { ClientSelect, type RichClient } from "@/components/funnel/client-select";
import { StickySaveBar } from "@/components/forms/sticky-save-bar";

const ink = "text-[#042b3c]";
const line = "border-[#d5dde1]";
const green = "#388623";
const ph = "placeholder:text-[#667880]";

const field = `h-12 w-full rounded-lg border ${line} bg-white px-3 text-[15px] ${ink} outline-none ${ph} focus:border-[#388623] focus:ring-2 focus:ring-[#388623]/20`;

function YesNo({
  value,
  onChange,
  label,
}: {
  value: boolean | null;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <div>
      <p className={`text-sm ${ink}`}>{label}</p>
      <div role="group" aria-label={label} className="mt-2 flex items-center justify-start gap-5">
        {[
          { v: true, label: "Yes" },
          { v: false, label: "No" },
        ].map((o) => {
          const selected = value === o.v;
          return (
            <button
              key={o.label}
              type="button"
              aria-pressed={selected}
              aria-label={`${label} ${o.label}`}
              onClick={() => onChange(o.v)}
              className={`inline-flex items-center gap-2 text-sm ${ink}`}
            >
              <span
                aria-hidden
                className={`grid h-4 w-4 shrink-0 place-items-center rounded-[3px] border ${
                  selected
                    ? "border-[#388623] bg-[#388623] text-white"
                    : "border-[#8aa0a8] bg-white"
                }`}
              >
                {selected ? (
                  <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2.2 6.2 4.7 8.8 9.8 3.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
              </span>
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <div>
      <p className={`text-sm ${ink}`}>{label}</p>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        className="relative mt-2 h-6 w-11 rounded-full transition-colors"
        style={{ background: on ? green : "#d7dee2" }}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
          style={{ left: on ? 22 : 2 }}
        />
      </button>
    </div>
  );
}

function isoToDisplay(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function displayToIso(display: string): string {
  const m = display.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return "";
  const [, dd, mm, yyyy] = m;
  const d = Number(dd);
  const mo = Number(mm);
  if (d < 1 || d > 31 || mo < 1 || mo > 12) return "";
  const iso = `${yyyy}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const dt = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(dt.getTime()) ? "" : iso;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className={`text-[17px] font-bold ${ink}`}>{children}</h2>;
}

function FieldErr({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs font-semibold text-rose-700">{msg}</p>;
}

const errBorder = "border-rose-500 focus:border-rose-500 focus:ring-rose-200";

function parkingToYesNo(raw: string | null | undefined): boolean | null {
  if (!raw || raw === "—") return null;
  const t = raw.trim();
  if (/^no$/i.test(t) || /no parking/i.test(t)) return false;
  if (/^yes$/i.test(t) || /has parking/i.test(t)) return true;
  return null;
}

function parseStoredMoveTime(raw: string | null | undefined): { text: string; period: "AM" | "PM" } {
  if (!raw?.trim()) return { text: "", period: "AM" };
  const match = raw.trim().match(/^(.+?)\s*(AM|PM)$/i);
  if (match) return { text: match[1].trim(), period: match[2].toUpperCase() as "AM" | "PM" };
  return { text: raw.trim(), period: "AM" };
}

export function NewRequestForm({
  services,
  clients,
  leadSources,
  requestId,
  initial,
}: {
  services: { id: string; name: string }[];
  clients: RichClient[];
  leadSources: { id: string; name: string }[];
  requestId?: string;
  initial?: {
    clientId: string;
    moveDate: string;
    moveTime: string;
    pickupAddress: string;
    pickupPostcode: string;
    pickupFloor: string;
    pickupLift: boolean;
    pickupParking: string | null;
    pickupBedrooms: string;
    deliveryAddress: string;
    deliveryPostcode: string;
    deliveryFloor: string;
    deliveryLift: boolean;
    deliveryParking: string | null;
    deliveryBedrooms: string;
    needsPacking: boolean;
    needsBoxes: boolean;
    serviceId: string;
    hours: string;
    inventory: string;
  };
}) {
  const storedTime = parseStoredMoveTime(initial?.moveTime);
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState(initial?.clientId ?? "");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const clearErr = (key: string) =>
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  const [pending, setPending] = useState(false);
  const [salesperson, setSalesperson] = useState("");
  const [moveDateIso, setMoveDateIso] = useState(initial?.moveDate ?? "");
  const [moveDateText, setMoveDateText] = useState(isoToDisplay(initial?.moveDate ?? ""));
  const [moveDateError, setMoveDateError] = useState("");
  const [moveTimeText, setMoveTimeText] = useState(storedTime.text);
  const [movePeriod, setMovePeriod] = useState<"AM" | "PM">(storedTime.period);
  const [pickup, setPickup] = useState({
    address: initial?.pickupAddress ?? "",
    postcode: initial?.pickupPostcode ?? "",
    floor: initial?.pickupFloor ?? "",
    lift: initial?.pickupLift ?? false,
    parkingYes: parkingToYesNo(initial?.pickupParking),
    bedrooms: initial?.pickupBedrooms ?? "",
  });
  const [delivery, setDelivery] = useState({
    address: initial?.deliveryAddress ?? "",
    postcode: initial?.deliveryPostcode ?? "",
    floor: initial?.deliveryFloor ?? "",
    lift: initial?.deliveryLift ?? false,
    parkingYes: parkingToYesNo(initial?.deliveryParking),
    bedrooms: initial?.deliveryBedrooms ?? "",
  });
  const [needsPacking, setNeedsPacking] = useState<boolean | null>(initial?.needsPacking ?? true);
  const [needsBoxes, setNeedsBoxes] = useState<boolean | null>(initial?.needsBoxes ?? true);
  const [serviceId, setServiceId] = useState(initial?.serviceId ?? "");
  const [hours, setHours] = useState(initial?.hours ?? "");
  const [inventory, setInventory] = useState(initial?.inventory ?? "");
  const [notes, setNotes] = useState("");
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const [imagesError, setImagesError] = useState("");
  const datePickerRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const money = useMemo(() => "£0.00", []);

  const onPickFiles = (list: FileList | null) => {
    if (!list) return;
    setImagesError("");
    const picked = Array.from(list).filter((f) =>
      ["image/jpeg", "image/png", "image/webp"].includes(f.type),
    );
    if (picked.length !== list.length) {
      setImagesError("Only JPG, PNG or WEBP images are allowed.");
    }
    const oversized = picked.find((f) => f.size > 8 * 1024 * 1024);
    if (oversized) {
      setImagesError(`Image ${oversized.name} exceeds 8 MB.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const merged = [
      ...images,
      ...picked.map((file) => ({ file, preview: URL.createObjectURL(file) })),
    ].slice(0, 10);
    setImages(merged);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result ?? "");
        resolve(result.includes(",") ? result.split(",")[1] : result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  async function submit(followUp?: "quote") {
        setError("");
        setFieldErrors({});
        setMoveDateError("");
        if (!clientId) {
          setFieldErrors({ clientId: "Select a client" });
          setError("Select a client to continue.");
          return;
        }
        if (moveDateText.trim()) {
          const iso = displayToIso(moveDateText);
          if (!iso) {
            setMoveDateError("Use the format dd/mm/yyyy.");
            setError("Use the format dd/mm/yyyy for the moving date.");
            return;
          }
          setMoveDateIso(iso);
        }
        const localErrors: Record<string, string> = {};
        if (!pickup.address.trim())
          localErrors.pickupAddress = "Collection address is required";
        if (!pickup.postcode.trim())
          localErrors.pickupPostcode = "Collection postcode is required";
        if (!delivery.address.trim())
          localErrors.deliveryAddress = "Delivery address is required";
        if (!delivery.postcode.trim())
          localErrors.deliveryPostcode = "Delivery postcode is required";
        if (!inventory.trim()) localErrors.inventory = "Inventory is required";
        if (Object.keys(localErrors).length > 0) {
          setFieldErrors(localErrors);
          setError("Check the highlighted fields.");
          return;
        }
        const photoBytes = images.reduce((sum, img) => sum + img.file.size, 0);
        if (photoBytes > 12 * 1024 * 1024) {
          setError("Photos must be 12 MB or less in total. Remove one and try again.");
          return;
        }
        setPending(true);
        try {
          const payloadImages = await Promise.all(
            images.map(async (img) => ({
              name: img.file.name,
              mime: img.file.type,
              size: img.file.size,
              data: await fileToBase64(img.file),
            })),
          );
          const iso = moveDateText.trim()
            ? displayToIso(moveDateText)
            : moveDateIso;
          const moveTime = moveTimeText.trim()
            ? `${moveTimeText.trim()} ${movePeriod}`
            : "";
          const payload = {
            clientId,
            title,
            moveDate: iso,
            moveTime,
            pickupAddress: pickup.address,
            pickupPostcode: pickup.postcode,
            pickupFloor: pickup.floor,
            pickupLift: pickup.lift,
            pickupParking:
              pickup.parkingYes === null
                ? "—"
                : pickup.parkingYes
                  ? "Has parking restrictions"
                  : "No parking restrictions",
            pickupBedrooms: pickup.bedrooms,
            deliveryAddress: delivery.address,
            deliveryPostcode: delivery.postcode,
            deliveryFloor: delivery.floor,
            deliveryLift: delivery.lift,
            deliveryParking:
              delivery.parkingYes === null
                ? "—"
                : delivery.parkingYes
                  ? "Has parking restrictions"
                  : "No parking restrictions",
            deliveryBedrooms: delivery.bedrooms,
            needsPacking: needsPacking === true,
            needsBoxes: needsBoxes === true,
            serviceId,
            hours,
            inventory,
            notes,
            images: payloadImages,
          };
          const result =
            followUp === "quote"
              ? await saveRequestAndConvert(requestId, payload)
              : requestId
                ? await updateAdminRequest(requestId, payload)
                : await createAdminRequest(payload);
          setPending(false);
          if (result && !result.ok) {
            setFieldErrors(result.errors ?? {});
            if (result.errors?.moveDate) setMoveDateError(result.errors.moveDate);
            setError(
              result.message ||
                Object.values(result.errors ?? {})[0] ||
                "Could not save request.",
            );
          }
        } catch (err) {
          if (isRedirectError(err)) throw err;
          setPending(false);
          const message = err instanceof Error ? err.message : "";
          setError(
            /body exceeded/i.test(message)
              ? "The photos are too large to save with the request. Remove one and try again."
              : "Could not save request. Check your connection and try again.",
          );
        }
  }

  return (
    <form
      className="mt-6 space-y-8 pb-24"
      onSubmit={async (e) => {
        e.preventDefault();
        await submit();
      }}
    >
      <input
        aria-label="Title"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className={field}
      />

      <div className="grid items-start gap-4">
        <ClientSelect
          clients={clients}
          value={clientId}
          onChange={(id) => {
            setClientId(id);
            clearErr("clientId");
          }}
          leadSources={leadSources}
          error={fieldErrors.clientId}
        />
        <label className="relative block">
          <UserRound
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5d6f78]"
          />
          <select
            aria-label="Salesperson"
            value={salesperson}
            onChange={(e) => setSalesperson(e.target.value)}
            className={`${field} appearance-none pl-9 pr-10 ${salesperson ? "" : "text-[#667880]"}`}
          >
            <option value="">Select a salesperson</option>
          </select>
          <ChevronDown
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#042b3c]"
          />
        </label>
      </div>

      <section className="space-y-4 border-t border-[#e6ebed] pt-8">
        <SectionTitle>Overview</SectionTitle>
        <div>
          <h3 className={`text-[15px] font-bold ${ink}`}>Contact details</h3>
          <p className="mt-1 text-[13px] leading-5 text-[#7b8e96]">
            This will be the main contact for this request.
          </p>
        </div>
        <div className="grid grid-cols-2 items-start gap-3">
          <div>
            <label className="relative block">
              <input
                aria-label="Date"
                placeholder="Date (dd/mm/yyyy)"
                value={moveDateText}
                onChange={(e) => {
                  setMoveDateText(e.target.value);
                  if (!e.target.value.trim()) {
                    setMoveDateIso("");
                    setMoveDateError("");
                    return;
                  }
                  const iso = displayToIso(e.target.value);
                  if (iso) {
                    setMoveDateIso(iso);
                    setMoveDateError("");
                  }
                }}
                onBlur={() => {
                  if (moveDateText.trim() && !displayToIso(moveDateText)) {
                    setMoveDateError("Use the format dd/mm/yyyy.");
                  } else {
                    setMoveDateError("");
                  }
                }}
                inputMode="numeric"
                className={`${field} pr-10`}
              />
              <button
                type="button"
                aria-label="Open calendar"
                onClick={() => datePickerRef.current?.showPicker?.()}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[#5d6f78] hover:bg-[#f1f4f5]"
              >
                <Calendar size={16} />
              </button>
              <input
                ref={datePickerRef}
                type="date"
                aria-hidden
                tabIndex={-1}
                className="absolute right-2 top-1/2 h-6 w-6 -translate-y-1/2 opacity-0"
                value={moveDateIso}
                onChange={(e) => {
                  setMoveDateIso(e.target.value);
                  setMoveDateText(isoToDisplay(e.target.value));
                  setMoveDateError("");
                }}
              />
            </label>
            {moveDateError ? (
              <p className="mt-1 text-xs font-semibold text-rose-700">
                {moveDateError}
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-2">
            <input
              aria-label="Moving time"
              placeholder="Moving time (e.g. 10:30)"
              value={moveTimeText}
              onChange={(e) => {
                const next = e.target.value;
                setMoveTimeText(next);
                const hour = Number((next.trim().match(/^(\d{1,2})/) ?? [])[1]);
                if (Number.isInteger(hour) && hour >= 12 && hour <= 24) {
                  setMovePeriod("PM");
                }
              }}
              className={field}
            />
            <select
              aria-label="AM or PM"
              value={movePeriod}
              onChange={(e) => setMovePeriod(e.target.value as "AM" | "PM")}
              className={`${field} appearance-none text-center`}
            >
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </div>
        </div>
      </section>

      <section className="space-y-4 border-t border-[#e6ebed] pt-8">
        <SectionTitle>Collection details</SectionTitle>
        <label className="relative block">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8aa0a8]"
          />
          <input
            aria-label="Collection address"
            placeholder="Collection address"
            value={pickup.address}
            onChange={(e) => {
              setPickup((p) => ({ ...p, address: e.target.value }));
              clearErr("pickupAddress");
            }}
            className={`${field} pl-9 ${fieldErrors.pickupAddress ? errBorder : ""}`}
          />
        </label>
        <FieldErr msg={fieldErrors.pickupAddress} />
        <input
          aria-label="Postcode"
          placeholder="Postcode"
          value={pickup.postcode}
          onChange={(e) => {
            setPickup((p) => ({ ...p, postcode: e.target.value }));
            clearErr("pickupPostcode");
          }}
          className={`${field} ${fieldErrors.pickupPostcode ? errBorder : ""}`}
        />
        <FieldErr msg={fieldErrors.pickupPostcode} />
        <input
          aria-label="Floor"
          placeholder="Floor (e.g. ground or 1st)"
          value={pickup.floor}
          onChange={(e) => setPickup((p) => ({ ...p, floor: e.target.value }))}
          className={field}
        />
        <Toggle
          label="Lift"
          on={pickup.lift}
          onChange={(lift) => setPickup((p) => ({ ...p, lift }))}
        />
        <YesNo
          label="Parking Restriction"
          value={pickup.parkingYes}
          onChange={(v) => setPickup((p) => ({ ...p, parkingYes: v }))}
        />
        <input
          aria-label="Bedrooms at collection"
          placeholder="How many bedrooms are you moving?"
          value={pickup.bedrooms}
          onChange={(e) => {
            setPickup((p) => ({ ...p, bedrooms: e.target.value }));
            clearErr("pickupBedrooms");
          }}
          className={field}
        />
        <FieldErr msg={fieldErrors.pickupBedrooms} />
      </section>

      <section className="space-y-4 border-t border-[#e6ebed] pt-8">
        <SectionTitle>Delivery details</SectionTitle>
        <label className="relative block">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8aa0a8]"
          />
          <input
            aria-label="Delivery address"
            placeholder="Delivery address"
            value={delivery.address}
            onChange={(e) => {
              setDelivery((d) => ({ ...d, address: e.target.value }));
              clearErr("deliveryAddress");
            }}
            className={`${field} pl-9 ${fieldErrors.deliveryAddress ? errBorder : ""}`}
          />
        </label>
        <FieldErr msg={fieldErrors.deliveryAddress} />
        <input
          aria-label="Delivery postcode"
          placeholder="Postcode"
          value={delivery.postcode}
          onChange={(e) => {
            setDelivery((d) => ({ ...d, postcode: e.target.value }));
            clearErr("deliveryPostcode");
          }}
          className={`${field} ${fieldErrors.deliveryPostcode ? errBorder : ""}`}
        />
        <FieldErr msg={fieldErrors.deliveryPostcode} />
        <input
          aria-label="Delivery floor"
          placeholder="Floor (e.g. ground or 1st)"
          value={delivery.floor}
          onChange={(e) => setDelivery((d) => ({ ...d, floor: e.target.value }))}
          className={field}
        />
        <Toggle
          label="Lift"
          on={delivery.lift}
          onChange={(lift) => setDelivery((d) => ({ ...d, lift }))}
        />
        <YesNo
          label="Parking Restriction"
          value={delivery.parkingYes}
          onChange={(v) => setDelivery((d) => ({ ...d, parkingYes: v }))}
        />
        <input
          aria-label="How many bedrooms are you moving"
          placeholder="How many bedrooms are you moving?"
          value={delivery.bedrooms}
          onChange={(e) => {
            setDelivery((d) => ({ ...d, bedrooms: e.target.value }));
            clearErr("deliveryBedrooms");
          }}
          className={`${field} ${fieldErrors.deliveryBedrooms ? errBorder : ""}`}
        />
        <FieldErr msg={fieldErrors.deliveryBedrooms} />
      </section>

      <section className="space-y-5 border-t border-[#e6ebed] pt-8">
        <SectionTitle>Packing service</SectionTitle>
        <YesNo
          label="Will you need packing?"
          value={needsPacking}
          onChange={setNeedsPacking}
        />
        <YesNo
          label="Do you need packing boxes?"
          value={needsBoxes}
          onChange={setNeedsBoxes}
        />
      </section>

      <section className="space-y-4 border-t border-[#e6ebed] pt-8">
        <SectionTitle>Service details</SectionTitle>
        <label className="relative block">
          <span className="mb-1.5 block text-sm text-[#5d6f78]">Which service do you need?</span>
          <select
            aria-label="Which service do you need?"
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            className={`${field} appearance-none pr-10 ${serviceId ? "" : "text-[#667880]"}`}
          >
            <option value="">Select options</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            className="pointer-events-none absolute bottom-4 right-3 text-[#042b3c]"
          />
        </label>
        <label className="relative block">
          <span className="mb-1.5 block text-sm text-[#5d6f78]">How many hours do you need?</span>
          <select
            aria-label="How many hours do you need?"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className={`${field} appearance-none pr-10 ${hours ? "" : "text-[#667880]"}`}
          >
            <option value="">Select options</option>
            {HOURS_OPTIONS.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            className="pointer-events-none absolute bottom-4 right-3 text-[#042b3c]"
          />
        </label>
      </section>

      <section className="space-y-4 border-t border-[#e6ebed] pt-8">
        <SectionTitle>Inventory list</SectionTitle>
        <div
          className={`overflow-hidden rounded-lg border ${fieldErrors.inventory ? "border-rose-500" : line} bg-white`}
        >
          <textarea
            aria-label="Inventory list"
            placeholder="Please give as much detail as you can."
            value={inventory}
            maxLength={500}
            onChange={(e) => {
              setInventory(e.target.value);
              clearErr("inventory");
            }}
            className={`min-h-[120px] w-full resize-y border-0 bg-transparent px-3 py-3 text-[15px] ${ink} outline-none ${ph}`}
          />
          <div className="flex justify-end px-3 pb-2 text-xs text-[#8aa0a8]">
            {inventory.length}/500
          </div>
        </div>
        <FieldErr msg={fieldErrors.inventory} />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="h-9 rounded-lg px-3 text-sm font-semibold text-white"
            style={{ background: green }}
          >
            Select images
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => onPickFiles(e.target.files)}
          />
        </div>
        {imagesError ? (
          <p className="text-xs font-semibold text-rose-700">{imagesError}</p>
        ) : null}
        {images.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {images.map((img, i) => (
              <div key={`${img.file.name}-${i}`} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.preview}
                  alt={img.file.name}
                  className="aspect-square w-full rounded-lg border border-[#d5dde1] object-cover"
                />
                <button
                  type="button"
                  aria-label={`Remove ${img.file.name}`}
                  onClick={() =>
                    setImages((prev) => prev.filter((_, j) => j !== i))
                  }
                  className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-[#042b3c]/80 text-xs text-white hover:bg-rose-700"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <p className="hidden">{money}</p>
      </section>

      <section className="space-y-4 border-t border-[#e6ebed] pt-8">
        <SectionTitle>Notes</SectionTitle>
        <textarea
          aria-label="Notes"
          placeholder="Leave an internal note for yourself or the team on this request."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={`min-h-[120px] w-full resize-y rounded-lg border ${line} bg-white px-3 py-3 text-[15px] ${ink} outline-none ${ph} focus:border-[#388623] focus:ring-2 focus:ring-[#388623]/20`}
        />
      </section>

      <StickySaveBar
        cancelHref={requestId ? `/solicitacoes/${requestId}` : "/solicitacoes"}
        error={error}
        pending={pending}
        saveLabel={requestId ? "Update request" : "Save request"}
        maxWidthClass="max-w-[760px]"
        menuItems={[
          {
            label: "Convert to Quote",
            icon: <Quote size={18} style={{ color: green }} />,
            onClick: () => void submit("quote"),
          },
        ]}
      />
    </form>
  );
}
