"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { submitRequest } from "@/lib/requests/actions";
import { HOURS_OPTIONS, STEP_TITLES } from "@/lib/requests/constants";
import {
  validateContact,
  validateFileList,
  validateHours,
  validateInventory,
  validateLocation,
  validatePacking,
  validateServices,
  type ContactStep,
  type Errors,
  type LocationStep,
  type PackingStep,
} from "@/lib/requests/validation";
import {
  Field,
  MultiSelect,
  ProgressBar,
  YesNo,
  inputCls,
} from "./fields";

export interface WizardProps {
  slug: string;
  companyName: string;
  primaryColor: string;
  termsUrl: string | null;
  maxImages: number;
  leadSources: { id: string; name: string }[];
  services: { id: string; name: string }[];
}

interface DraftImage {
  key: string;
  file: File;
  preview: string;
}

const emptyLocation: LocationStep = {
  address: "",
  postcode: "",
  floor: "",
  hasLift: null,
  parking: "",
  bedrooms: "",
};

const ERROR_STEP: [RegExp, number][] = [
  [/^(firstName|lastName|companyName|email|phone|leadSourceId|moveDate|moveTime)$/, 0],
  [/^pickup\./, 1],
  [/^delivery\./, 2],
  [/^(needsService|needsMaterials)$/, 3],
  [/^(services|hours)$/, 4],
  [/^(inventory|images)$/, 5],
  [/^terms$/, 6],
];

function stepForErrors(errors: Errors): number {
  let first = 6;
  for (const key of Object.keys(errors)) {
    for (const [re, step] of ERROR_STEP) {
      if (re.test(key) && step < first) first = step;
    }
  }
  return first;
}

export function RequestWizard({
  slug,
  companyName,
  primaryColor,
  termsUrl,
  maxImages,
  leadSources,
  services,
}: WizardProps) {
  const draftKey = `opero:req-draft:${slug}`;
  const [step, setStep] = useState(0);
  const [contact, setContact] = useState<ContactStep>({
    firstName: "",
    lastName: "",
    companyName: "",
    email: "",
    phone: "",
    marketingEmail: false,
    marketingSms: false,
    leadSourceId: "",
    moveDate: "",
    moveTime: "",
  });
  const [pickup, setPickup] = useState<LocationStep>({ ...emptyLocation });
  const [delivery, setDelivery] = useState<LocationStep>({ ...emptyLocation });
  const [packing, setPacking] = useState<PackingStep>({
    needsService: null,
    needsMaterials: null,
  });
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [hours, setHours] = useState<string[]>([]);
  const [inventory, setInventory] = useState("");
  const [images, setImages] = useState<DraftImage[]>([]);
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ number: string } | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const startedAt = useRef<number>(Date.now());
  const idemKey = useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`,
  );
  const fileInput = useRef<HTMLInputElement>(null);
  const validServiceIds = useMemo(() => services.map((s) => s.id), [services]);

  // Restore draft (fields only — browsers never allow File objects to persist).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.contact) setContact(d.contact);
        if (d.pickup) setPickup(d.pickup);
        if (d.delivery) setDelivery(d.delivery);
        if (d.packing) setPacking(d.packing);
        if (Array.isArray(d.serviceIds)) setServiceIds(d.serviceIds);
        if (Array.isArray(d.hours)) setHours(d.hours);
        if (typeof d.inventory === "string") setInventory(d.inventory);
        if (typeof d.step === "number") setStep(Math.min(d.step, 6));
        if (typeof d.startedAt === "number") startedAt.current = d.startedAt;
        if (typeof d.idemKey === "string") idemKey.current = d.idemKey;
      }
    } catch {
      /* corrupted draft: start fresh */
    }
    setRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist draft on every change.
  useEffect(() => {
    if (!restored || result) return;
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          contact,
          pickup,
          delivery,
          packing,
          serviceIds,
          hours,
          inventory,
          step,
          startedAt: startedAt.current,
          idemKey: idemKey.current,
        }),
      );
    } catch {
      /* storage full/blocked: form still works in memory */
    }
  }, [contact, pickup, delivery, packing, serviceIds, hours, inventory, step, restored, result, draftKey]);

  useEffect(
    () => () => {
      images.forEach((i) => URL.revokeObjectURL(i.preview));
    },
    [images],
  );

  const setC = (patch: Partial<ContactStep>) =>
    setContact((c) => ({ ...c, ...patch }));
  const setP = (patch: Partial<LocationStep>) =>
    setPickup((p) => ({ ...p, ...patch }));
  const setD = (patch: Partial<LocationStep>) =>
    setDelivery((d) => ({ ...d, ...patch }));

  function validateStep(s: number): Errors {
    switch (s) {
      case 0:
        return validateContact(contact);
      case 1:
        return validateLocation(pickup);
      case 2:
        return validateLocation(delivery);
      case 3:
        return validatePacking(packing);
      case 4:
        return {
          ...validateServices(serviceIds, validServiceIds),
          ...validateHours(hours),
        };
      case 5:
        return {
          ...validateInventory(inventory),
          ...validateFileList(
            images.map((i) => ({
              name: i.file.name,
              size: i.file.size,
              type: i.file.type,
            })),
            maxImages,
          ),
        };
      default:
        return terms ? {} : { terms: "You must accept the Terms and Conditions" };
    }
  }

  const next = () => {
    const e = validateStep(step);
    setErrors(e);
    if (Object.keys(e).length === 0) {
      setSubmitMessage(null);
      setStep((s) => Math.min(s + 1, 6));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const back = () => {
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onPickFiles = (list: FileList | null) => {
    if (!list) return;
    const picked = Array.from(list);
    const existingKeys = new Set(
      images.map((i) => `${i.file.name}::${i.file.size}::${i.file.lastModified}`),
    );
    const fresh = picked.filter(
      (f) => !existingKeys.has(`${f.name}::${f.size}::${f.lastModified}`),
    );
    const merged = [
      ...images,
      ...fresh.map((file) => ({
        key: `${file.name}::${file.size}::${file.lastModified}::${Math.random()}`,
        file,
        preview: URL.createObjectURL(file),
      })),
    ];
    const e = validateFileList(
      merged.map((i) => ({ name: i.file.name, size: i.file.size, type: i.file.type })),
      maxImages,
    );
    if (e.images) {
      setErrors((prev) => ({ ...prev, images: e.images }));
      merged.forEach((m, idx) => {
        if (idx >= images.length) URL.revokeObjectURL(m.preview);
      });
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setErrors((prev) => {
      const { images: _omit, ...rest } = prev;
      return rest;
    });
    setImages(merged.slice(0, maxImages));
    if (fileInput.current) fileInput.current.value = "";
  };

  const removeImage = (key: string) =>
    setImages((imgs) => {
      const target = imgs.find((i) => i.key === key);
      if (target) URL.revokeObjectURL(target.preview);
      return imgs.filter((i) => i.key !== key);
    });

  const confirm = async () => {
    const e = validateStep(6);
    // Re-validate everything server will check, surfacing the first bad step.
    const all: Errors = {
      ...validateContact(contact),
      ...Object.fromEntries(
        Object.entries(validateLocation(pickup)).map(([k, v]) => [`pickup.${k}`, v]),
      ),
      ...Object.fromEntries(
        Object.entries(validateLocation(delivery)).map(([k, v]) => [
          `delivery.${k}`,
          v,
        ]),
      ),
      ...validatePacking(packing),
      ...validateServices(serviceIds, validServiceIds),
      ...validateHours(hours),
      ...validateInventory(inventory),
      ...validateFileList(
        images.map((i) => ({ name: i.file.name, size: i.file.size, type: i.file.type })),
        maxImages,
      ),
      ...e,
    };
    if (Object.keys(all).length > 0) {
      setErrors(all);
      setStep(stepForErrors(all));
      return;
    }

    setSubmitting(true);
    setSubmitMessage(null);
    try {
      const fd = new FormData();
      fd.set("slug", slug);
      fd.set("idempotencyKey", idemKey.current);
      fd.set("startedAt", String(startedAt.current));
      fd.set("website", ""); // honeypot, always empty for humans
      fd.set("contact", JSON.stringify(contact));
      fd.set("pickup", JSON.stringify(pickup));
      fd.set("delivery", JSON.stringify(delivery));
      fd.set("packing", JSON.stringify(packing));
      fd.set("services", JSON.stringify(serviceIds));
      fd.set("hours", JSON.stringify(hours));
      fd.set("inventory", inventory);
      fd.set("termsAccepted", terms ? "true" : "false");
      for (const img of images) fd.append("images", img.file, img.file.name);

      const res = await submitRequest(fd);
      if (res.ok && res.number) {
        localStorage.removeItem(draftKey);
        setResult({ number: res.number });
        window.scrollTo({ top: 0 });
      } else if (res.errors) {
        setErrors(res.errors);
        setStep(stepForErrors(res.errors));
        setSubmitMessage(res.message ?? "Please review the highlighted fields.");
      } else {
        setSubmitMessage(res.message ?? "Something went wrong. Please try again.");
      }
    } catch {
      setSubmitMessage("Network error. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-2xl">
          ✓
        </div>
        <h2 className="mt-4 text-2xl font-extrabold text-ink">
          Request received
        </h2>
        <p className="mt-2 text-sm text-ink-soft">
          Thank you — {companyName} will be in touch shortly.
        </p>
        <p className="mx-auto mt-4 inline-block rounded-xl bg-cream px-4 py-2 text-sm font-bold text-ink">
          Your reference: {result.number}
        </p>
      </div>
    );
  }

  const serviceName = (id: string) =>
    services.find((s) => s.id === id)?.name ?? id;

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-8">
      <ProgressBar total={7} current={step} color={primaryColor} />
      <h2 className="mt-4 text-xl font-extrabold text-ink">
        {STEP_TITLES[step]}
      </h2>
      <p className="mt-0.5 text-xs text-ink-mute">
        Step {step + 1} of 7
      </p>

      <div className="mt-5 space-y-4">
        {step === 0 ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" required error={errors.firstName}>
                <input
                  className={inputCls(errors.firstName)}
                  value={contact.firstName}
                  onChange={(e) => setC({ firstName: e.target.value })}
                  autoComplete="given-name"
                />
              </Field>
              <Field label="Last name" required error={errors.lastName}>
                <input
                  className={inputCls(errors.lastName)}
                  value={contact.lastName}
                  onChange={(e) => setC({ lastName: e.target.value })}
                  autoComplete="family-name"
                />
              </Field>
            </div>
            <Field label="Company name (if applicable)" error={errors.companyName}>
              <input
                className={inputCls(errors.companyName)}
                value={contact.companyName}
                onChange={(e) => setC({ companyName: e.target.value })}
                autoComplete="organization"
              />
            </Field>
            <Field label="Email" required error={errors.email}>
              <input
                type="email"
                className={inputCls(errors.email)}
                value={contact.email}
                onChange={(e) => setC({ email: e.target.value })}
                autoComplete="email"
              />
            </Field>
            <Field
              label="Phone"
              required
              error={errors.phone}
              hint="We may use this number for communications about your service."
            >
              <input
                type="tel"
                className={inputCls(errors.phone)}
                value={contact.phone}
                onChange={(e) => setC({ phone: e.target.value })}
                autoComplete="tel"
                placeholder="+44 7700 900000"
              />
            </Field>
            <Field
              label="How did you hear about us?"
              required
              error={errors.leadSourceId}
            >
              <select
                className={inputCls(errors.leadSourceId)}
                value={contact.leadSourceId}
                onChange={(e) => setC({ leadSourceId: e.target.value })}
              >
                <option value="">Select an option</option>
                {leadSources.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Date of Your Move"
                error={errors.moveDate}
                hint="If you don’t have a date yet, leave it blank."
              >
                <input
                  type="date"
                  className={inputCls(errors.moveDate)}
                  value={contact.moveDate}
                  onChange={(e) => setC({ moveDate: e.target.value })}
                />
              </Field>
              <Field label="Moving time" required error={errors.moveTime}>
                <input
                  type="time"
                  className={inputCls(errors.moveTime)}
                  value={contact.moveTime}
                  onChange={(e) => setC({ moveTime: e.target.value })}
                />
              </Field>
            </div>
          </>
        ) : null}

        {step === 1 || step === 2 ? (
          <LocationFields
            value={step === 1 ? pickup : delivery}
            onChange={step === 1 ? setP : setD}
            errors={errors}
            prefix={step === 1 ? "pickup" : "delivery"}
            addressLabel={step === 1 ? "Pickup address" : "Delivery Address"}
            bedroomsLabel={
              step === 1
                ? "How many bedrooms are you moving from?"
                : "How many bedrooms are you moving to?"
            }
          />
        ) : null}

        {step === 3 ? (
          <>
            <Field label="Do you need packing services?" required>
              <YesNo
                value={packing.needsService}
                onChange={(v) =>
                  setPacking((p) => ({ ...p, needsService: v }))
                }
                error={errors.needsService}
              />
            </Field>
            <Field label="Do you need packing materials?" required>
              <YesNo
                value={packing.needsMaterials}
                onChange={(v) =>
                  setPacking((p) => ({ ...p, needsMaterials: v }))
                }
                error={errors.needsMaterials}
              />
            </Field>
          </>
        ) : null}

        {step === 4 ? (
          <>
            <MultiSelect
              label="Which service do you require?"
              required
              options={services.map((s) => ({ id: s.id, label: s.name }))}
              selected={serviceIds}
              onChange={setServiceIds}
              placeholder="Select options"
              error={errors.services}
            />
            <MultiSelect
              label="How many hours do you need?"
              required
              options={HOURS_OPTIONS.map((h) => ({ id: h, label: h }))}
              selected={hours}
              onChange={setHours}
              placeholder="Select options"
              error={errors.hours}
            />
          </>
        ) : null}

        {step === 5 ? (
          <>
            <Field
              label="Inventory List"
              required
              error={errors.inventory}
              hint="Please provide as much information as you can."
            >
              <textarea
                className="min-h-28 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[15px] text-ink outline-none focus:border-accent focus:ring-2 focus:ring-emerald-100"
                value={inventory}
                onChange={(e) => setInventory(e.target.value)}
                placeholder="3 bedrooms, wardrobe, 40 boxes, sofa, dinner table, 6 chairs, piano, bags…"
              />
            </Field>
            <div>
              <p className="mb-1.5 text-sm font-semibold text-ink">
                Share images of the work to be done
              </p>
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line bg-stone-50 px-4 py-6 text-sm text-ink-soft transition hover:border-accent hover:bg-emerald-50/50"
              >
                <span className="text-2xl" aria-hidden>
                  🖼
                </span>
                Upload here
                <span className="text-xs">
                  {images.length}/{maxImages} · JPG, PNG or WEBP up to 8 MB each
                </span>
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => onPickFiles(e.target.files)}
              />
              {errors.images ? (
                <p className="mt-1 text-xs font-semibold text-rose-700">
                  {errors.images}
                </p>
              ) : null}
              {images.length > 0 ? (
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {images.map((img) => (
                    <div key={img.key} className="relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.preview}
                        alt={img.file.name}
                        className="aspect-square w-full rounded-lg border border-line object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(img.key)}
                        aria-label={`Remove ${img.file.name}`}
                        className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-ink/80 text-xs text-white hover:bg-rose-700"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </>
        ) : null}

        {step === 6 ? (
          <div className="space-y-4 text-sm">
            <ReviewSection title="Contact Information">
              <ReviewRow
                label="Name"
                value={`${contact.firstName} ${contact.lastName}`.trim()}
              />
              {contact.companyName ? (
                <ReviewRow label="Company" value={contact.companyName} />
              ) : null}
              <ReviewRow label="Email" value={contact.email} />
              <ReviewRow label="Phone" value={contact.phone} />
              <ReviewRow
                label="Heard via"
                value={
                  leadSources.find((l) => l.id === contact.leadSourceId)?.name ?? "—"
                }
              />
              <ReviewRow label="Move date" value={contact.moveDate || "Not set"} />
              <ReviewRow label="Moving time" value={contact.moveTime} />
            </ReviewSection>
            <ReviewSection title="Collection Information">
              <LocationReview value={pickup} />
            </ReviewSection>
            <ReviewSection title="Delivery Information">
              <LocationReview value={delivery} />
            </ReviewSection>
            <ReviewSection title="Packing Service">
              <ReviewRow
                label="Packing services"
                value={packing.needsService ? "Yes" : "No"}
              />
              <ReviewRow
                label="Packing materials"
                value={packing.needsMaterials ? "Yes" : "No"}
              />
            </ReviewSection>
            <ReviewSection title="Service Details">
              <div>
                {services.map((s) => (
                  <p key={s.id} className="flex items-center gap-2 py-0.5">
                    <span
                      aria-hidden
                      className={
                        serviceIds.includes(s.id)
                          ? "font-bold text-emerald-700"
                          : "text-ink-mute"
                      }
                    >
                      {serviceIds.includes(s.id) ? "✓" : "—"}
                    </span>
                    {s.name}
                  </p>
                ))}
              </div>
              <ReviewRow label="Hours" value={hours.join(", ")} />
            </ReviewSection>
            <ReviewSection title="Inventory List">
              <p className="whitespace-pre-wrap text-ink">{inventory}</p>
              {images.length > 0 ? (
                <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {images.map((img) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={img.key}
                      src={img.preview}
                      alt={img.file.name}
                      className="aspect-square w-full rounded-lg border border-line object-cover"
                    />
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-ink-mute">No images attached.</p>
              )}
            </ReviewSection>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-stone-50 p-3 text-[13px] text-ink-soft">
              <input
                type="checkbox"
                checked={terms}
                onChange={(e) => setTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-emerald-700"
              />
              <span>
                By continuing you agree to our{" "}
                {termsUrl ? (
                  <a
                    href={termsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-ink underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Terms and Conditions
                  </a>
                ) : (
                  "Terms and Conditions"
                )}
                .
              </span>
            </label>
            {errors.terms || errors.services || errors.inventory ? (
              <p className="text-xs font-semibold text-rose-700">
                {errors.terms ?? errors.services ?? errors.inventory}
              </p>
            ) : null}
            {Object.keys(errors).filter(
              (k) => !["terms", "services", "inventory"].includes(k),
            ).length > 0 ? (
              <p className="text-xs font-semibold text-rose-700">
                Some sections need attention — use Back to fix them.
              </p>
            ) : null}
          </div>
        ) : null}

        {submitMessage ? (
          <p className="rounded-xl bg-rose-50 px-3 py-2.5 text-sm font-semibold text-rose-800">
            {submitMessage}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          {step > 0 ? (
            <button
              type="button"
              onClick={back}
              disabled={submitting}
              className="h-11 rounded-xl border border-line bg-white px-5 text-sm font-bold text-ink hover:bg-cream disabled:opacity-50"
            >
              Back
            </button>
          ) : null}
          {step < 6 ? (
            <button
              type="button"
              onClick={next}
              className="h-11 rounded-xl px-6 text-sm font-bold text-white"
              style={{ background: primaryColor }}
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={confirm}
              disabled={submitting}
              className="h-11 rounded-xl px-6 text-sm font-bold text-white disabled:opacity-60"
              style={{ background: primaryColor }}
            >
              {submitting ? "Sending…" : "Confirm"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function LocationFields({
  value,
  onChange,
  errors,
  prefix,
  addressLabel,
  bedroomsLabel,
}: {
  value: LocationStep;
  onChange: (p: Partial<LocationStep>) => void;
  errors: Errors;
  prefix: "pickup" | "delivery";
  addressLabel: string;
  bedroomsLabel: string;
}) {
  const err = (k: string) => errors[k] ?? errors[`${prefix}.${k}`];
  return (
    <>
      <Field label={addressLabel} required error={err("address")}>
        <input
          className={inputCls(err("address"))}
          value={value.address}
          onChange={(e) => onChange({ address: e.target.value })}
          autoComplete="street-address"
          placeholder="Start typing the address…"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Postcode" required error={err("postcode")}>
          <input
            className={inputCls(err("postcode"))}
            value={value.postcode}
            onChange={(e) => onChange({ postcode: e.target.value })}
            autoComplete="postal-code"
            placeholder="E2 8DP"
          />
        </Field>
        <Field label="Floor (Which floor)" required error={err("floor")}>
          <input
            className={inputCls(err("floor"))}
            value={value.floor}
            onChange={(e) => onChange({ floor: e.target.value })}
            placeholder="Ground Floor"
          />
        </Field>
      </div>
      <Field label="Lift" required>
        <YesNo
          value={value.hasLift}
          onChange={(v) => onChange({ hasLift: v })}
          error={err("hasLift")}
        />
      </Field>
      <Field label="Parking Restrictions" required error={err("parking")}>
        <input
          className={inputCls(err("parking"))}
          value={value.parking}
          onChange={(e) => onChange({ parking: e.target.value })}
          placeholder="e.g. No restrictions"
        />
      </Field>
      <Field label={bedroomsLabel} required error={err("bedrooms")}>
        <input
          type="number"
          min={0}
          max={50}
          className={inputCls(err("bedrooms"))}
          value={value.bedrooms}
          onChange={(e) => onChange({ bedrooms: e.target.value })}
        />
      </Field>
    </>
  );
}

function ReviewSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line p-3.5">
      <h3 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">
        {title}
      </h3>
      {children}
    </section>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex justify-between gap-4 py-0.5">
      <span className="text-ink-soft">{label}</span>
      <span className="text-right font-semibold text-ink">{value}</span>
    </p>
  );
}

function LocationReview({ value }: { value: LocationStep }) {
  return (
    <>
      <ReviewRow label="Address" value={`${value.address}, ${value.postcode}`} />
      <ReviewRow label="Floor" value={value.floor} />
      <ReviewRow label="Lift" value={value.hasLift ? "Yes" : "No"} />
      <ReviewRow label="Parking" value={value.parking} />
      <ReviewRow label="Bedrooms" value={value.bedrooms} />
    </>
  );
}
