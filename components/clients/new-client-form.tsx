"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { createClientFull } from "@/lib/clients/crm-actions";
import type {
  ContactInput,
  FullPropertyInput,
  ProfileInput,
} from "@/lib/clients/crm-validation";

const COUNTRIES = [
  "United Kingdom",
  "Ireland",
  "France",
  "Germany",
  "Spain",
  "Italy",
  "Portugal",
  "Netherlands",
  "Belgium",
  "Poland",
  "Romania",
  "United States",
  "Canada",
  "Australia",
  "Other",
];

const TITLES = ["No title", "Mr", "Mrs", "Ms", "Miss", "Dr"];

const TAX_RATES = ["20% VAT", "5% VAT", "0% Exempt"];

const emptyContact: ContactInput = {
  name: "",
  role: "",
  phone: "",
  email: "",
  notes: "",
};

const emptyProperty: FullPropertyInput = {
  label: "Collection",
  addressLine: "",
  street2: "",
  city: "",
  county: "",
  postcode: "",
  country: "",
  taxRate: "",
  instructions: "",
  isPrimary: false,
  isBilling: false,
  billingSame: true,
};

const line = "border-[#d5dde1]";
const ink = "text-[#042b3c]";
const placeholder = "placeholder:text-[#667880]";
const green = "#388623";

const soloField = `h-12 w-full rounded-lg border ${line} bg-white px-3 text-[15px] ${ink} outline-none ${placeholder} focus:border-[#388623] focus:ring-2 focus:ring-[#388623]/20`;

const groupField = `h-12 w-full border-0 bg-transparent px-3 text-[15px] ${ink} outline-none ${placeholder} focus:relative focus:z-10 focus:ring-2 focus:ring-inset focus:ring-[#388623]/30`;

function Err({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <span className="mt-1 block text-xs font-semibold text-rose-700">{msg}</span>;
}

function Accordion({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-lg bg-[#f9f8f6]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`flex h-[52px] w-full items-center justify-between px-4 text-left text-[15px] font-bold ${ink}`}
      >
        {title}
        <ChevronDown
          size={18}
          strokeWidth={2.4}
          className="shrink-0 transition-transform"
          style={{ color: green, transform: open ? "rotate(180deg)" : undefined }}
          aria-hidden
        />
      </button>
      {open && children ? <div className="space-y-3 px-4 pb-4">{children}</div> : null}
    </div>
  );
}

function GreenCheck({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className="grid h-5 w-5 shrink-0 place-items-center rounded-[4px] border"
      style={
        checked
          ? { background: green, borderColor: green }
          : { background: "#fff", borderColor: "#c5ced3" }
      }
    >
      {checked ? (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M2.2 6.2 4.7 8.7 9.8 3.4"
            stroke="#fff"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </span>
  );
}

export function NewClientForm({
  leadSources,
  justCreated,
}: {
  leadSources: { id: string; name: string }[];
  justCreated: boolean;
}) {
  const [profile, setProfile] = useState<ProfileInput>({
    title: "No title",
    firstName: "",
    lastName: "",
    companyName: "",
    clientType: "individual",
    status: "active",
    email: "",
    phone: "",
    phoneMobile: "",
    paymentTerms: "due_on_receipt",
    paymentTermsCustom: "",
    askForReview: true,
  });
  const [leadSourceId, setLeadSourceId] = useState("");
  const [commsOpen, setCommsOpen] = useState(false);
  const [marketingEmail, setMarketingEmail] = useState(false);
  const [marketingSms, setMarketingSms] = useState(false);
  const [contacts, setContacts] = useState<ContactInput[]>([]);
  const [properties, setProperties] = useState<FullPropertyInput[]>([{ ...emptyProperty }]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const P = (patch: Partial<ProfileInput>) => setProfile((p) => ({ ...p, ...patch }));

  const patchProperty = (i: number, patch: Partial<FullPropertyInput>) =>
    setProperties((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const submit = async (fd: FormData) => {
    setSaving(true);
    setMessage(null);
    fd.set("profile", JSON.stringify(profile));
    fd.set("leadSourceId", leadSourceId);
    fd.set("marketingEmail", String(marketingEmail));
    fd.set("marketingSms", String(marketingSms));
    fd.set("contacts", JSON.stringify(contacts));
    fd.set("properties", JSON.stringify(properties));
    const res = await createClientFull(fd);
    setSaving(false);
    if (!res.ok) {
      setErrors(res.errors ?? {});
      setMessage(res.message ?? "Please review the highlighted fields.");
      window.scrollTo({ top: 0 });
    }
  };

  const err = (k: string) => errors[k];

  return (
    <form action={submit} className="mt-8">
      {justCreated ? (
        <p className="mb-6 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
          Client saved. You can create another one below.
        </p>
      ) : null}
      {message ? (
        <p className="mb-6 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          {message}
        </p>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,640px)] lg:gap-x-16">
        <div>
          <h2 className={`text-base font-bold ${ink}`}>Primary contact details</h2>
          <p className="mt-1.5 text-[13px] leading-5 text-[#5d6f78]">
            Provide the main point of contact to ensure smooth communication and reliable client
            records.
          </p>
        </div>

        <div className="min-w-0 space-y-4">
          <div className={`overflow-hidden rounded-lg border ${line} bg-white`}>
            <div className="grid grid-cols-[118px_1fr_1fr]">
              <label className={`flex items-center gap-1 border-r ${line} px-3`}>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] leading-none text-[#667880]">Title</span>
                  <select
                    aria-label="Title"
                    value={profile.title}
                    onChange={(e) => P({ title: e.target.value })}
                    className={`mt-0.5 w-full appearance-none bg-transparent text-[15px] ${ink} outline-none`}
                  >
                    {TITLES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </span>
                <ChevronDown size={16} strokeWidth={2.4} style={{ color: green }} aria-hidden />
              </label>
              <input
                aria-label="First name"
                placeholder="First name"
                value={profile.firstName}
                onChange={(e) => P({ firstName: e.target.value })}
                className={`${groupField} border-r ${line}`}
              />
              <input
                aria-label="Last name"
                placeholder="Last name"
                value={profile.lastName}
                onChange={(e) => P({ lastName: e.target.value })}
                className={groupField}
              />
            </div>
            <input
              aria-label="Company name"
              placeholder="Company name"
              value={profile.companyName}
              onChange={(e) => P({ companyName: e.target.value })}
              className={`${groupField} border-t ${line}`}
            />
          </div>
          <Err msg={err("firstName") || err("lastName") || err("companyName") || err("title")} />

          <h3 className={`pt-2 text-base font-bold ${ink}`}>Communication</h3>
          <input
            aria-label="Phone number"
            placeholder="Phone number"
            autoComplete="tel"
            value={profile.phone}
            onChange={(e) => P({ phone: e.target.value })}
            className={soloField}
          />
          <Err msg={err("phone")} />
          <input
            aria-label="Email"
            placeholder="Email"
            type="email"
            autoComplete="email"
            value={profile.email}
            onChange={(e) => P({ email: e.target.value })}
            className={soloField}
          />
          <Err msg={err("email")} />

          <div>
            <button
              type="button"
              onClick={() => setCommsOpen((v) => !v)}
              className="text-sm font-semibold underline underline-offset-2"
              style={{ color: green }}
            >
              Communication settings
            </button>
            {commsOpen ? (
              <div className={`mt-3 space-y-2 rounded-lg border ${line} bg-white p-4`}>
                <label className={`relative flex cursor-pointer items-center gap-2.5 text-sm ${ink}`}>
                  <input
                    type="checkbox"
                    className="absolute inset-0 cursor-pointer opacity-0"
                    checked={marketingEmail}
                    onChange={(e) => setMarketingEmail(e.target.checked)}
                  />
                  <GreenCheck checked={marketingEmail} />
                  Wants marketing emails
                </label>
                <label className={`relative flex cursor-pointer items-center gap-2.5 text-sm ${ink}`}>
                  <input
                    type="checkbox"
                    className="absolute inset-0 cursor-pointer opacity-0"
                    checked={marketingSms}
                    onChange={(e) => setMarketingSms(e.target.checked)}
                  />
                  <GreenCheck checked={marketingSms} />
                  Wants marketing SMS
                </label>
              </div>
            ) : null}
          </div>

          <h3 className={`pt-2 text-base font-bold ${ink}`}>Lead information</h3>
          <select
            aria-label="Lead source"
            value={leadSourceId}
            onChange={(e) => setLeadSourceId(e.target.value)}
            className={`${soloField} appearance-none ${leadSourceId ? "" : "text-[#667880]"}`}
          >
            <option value="">Lead source</option>
            {leadSources.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <Err msg={err("leadSourceId")} />

          <Accordion title="Additional client details">
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                aria-label="Type"
                value={profile.clientType}
                onChange={(e) => P({ clientType: e.target.value })}
                className={soloField}
              >
                <option value="individual">Individual</option>
                <option value="company">Company</option>
              </select>
              <select
                aria-label="Status"
                value={profile.status}
                onChange={(e) => P({ status: e.target.value })}
                className={soloField}
              >
                <option value="lead">Lead</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <input
              aria-label="Mobile phone"
              placeholder="Mobile phone"
              value={profile.phoneMobile}
              onChange={(e) => P({ phoneMobile: e.target.value })}
              className={soloField}
            />
            <Err msg={err("phoneMobile")} />
            <select
              aria-label="Payment terms"
              value={profile.paymentTerms}
              onChange={(e) => P({ paymentTerms: e.target.value })}
              className={soloField}
            >
              <option value="due_on_receipt">Residential default (Due upon receipt)</option>
              <option value="net_7">Net 7</option>
              <option value="net_15">Net 15</option>
              <option value="net_30">Net 30</option>
              <option value="custom">Custom</option>
            </select>
            {profile.paymentTerms === "custom" ? (
              <>
                <input
                  aria-label="Custom terms"
                  placeholder="Custom terms"
                  value={profile.paymentTermsCustom}
                  onChange={(e) => P({ paymentTermsCustom: e.target.value })}
                  className={soloField}
                />
                <Err msg={err("paymentTermsCustom")} />
              </>
            ) : null}
            <label className={`relative flex cursor-pointer items-center gap-2.5 text-sm ${ink}`}>
              <input
                type="checkbox"
                className="absolute inset-0 cursor-pointer opacity-0"
                checked={profile.askForReview}
                onChange={(e) => P({ askForReview: e.target.checked })}
              />
              <GreenCheck checked={profile.askForReview} />
              Ask for a review
            </label>
          </Accordion>

          <Accordion title="Additional contacts">
            {contacts.map((ct, i) => (
              <div key={i} className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className={`text-sm font-bold ${ink}`}>Contact {i + 1}</p>
                  <button
                    type="button"
                    onClick={() => setContacts((cs) => cs.filter((_, j) => j !== i))}
                    className="text-xs font-bold text-rose-700 hover:underline"
                  >
                    Remove
                  </button>
                </div>
                <input
                  aria-label={`Contact ${i + 1} name`}
                  placeholder="Name"
                  value={ct.name}
                  onChange={(e) =>
                    setContacts((cs) => cs.map((c, j) => (j === i ? { ...c, name: e.target.value } : c)))
                  }
                  className={soloField}
                />
                <Err msg={err(`contacts.${i}.name`)} />
                <input
                  aria-label={`Contact ${i + 1} role`}
                  placeholder="Role"
                  value={ct.role}
                  onChange={(e) =>
                    setContacts((cs) => cs.map((c, j) => (j === i ? { ...c, role: e.target.value } : c)))
                  }
                  className={soloField}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <input
                      aria-label={`Contact ${i + 1} phone`}
                      placeholder="Phone"
                      value={ct.phone}
                      onChange={(e) =>
                        setContacts((cs) =>
                          cs.map((c, j) => (j === i ? { ...c, phone: e.target.value } : c)),
                        )
                      }
                      className={soloField}
                    />
                    <Err msg={err(`contacts.${i}.phone`)} />
                  </div>
                  <div>
                    <input
                      aria-label={`Contact ${i + 1} email`}
                      placeholder="Email"
                      value={ct.email}
                      onChange={(e) =>
                        setContacts((cs) =>
                          cs.map((c, j) => (j === i ? { ...c, email: e.target.value } : c)),
                        )
                      }
                      className={soloField}
                    />
                    <Err msg={err(`contacts.${i}.email`)} />
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setContacts((cs) => [...cs, { ...emptyContact }])}
              className="text-sm font-semibold"
              style={{ color: green }}
            >
              Add contact
            </button>
          </Accordion>
        </div>
      </div>

      <hr className="my-8 border-[#e6ebed]" />

      <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,640px)] lg:gap-x-16">
        <div>
          <h2 className={`text-base font-bold ${ink}`}>Property address</h2>
          <p className="mt-1.5 text-[13px] leading-5 text-[#5d6f78]">
            Enter the primary service address, billing address, or any additional locations where
            services may take place.
          </p>
          <button
            type="button"
            onClick={() => setProperties((ps) => [...ps, { ...emptyProperty, label: "Other" }])}
            className="mt-4 h-10 rounded-lg border bg-white px-4 text-sm font-semibold hover:bg-[#f4faf4]"
            style={{ borderColor: green, color: green }}
          >
            Add Another Address
          </button>
        </div>

        <div className="min-w-0 space-y-8">
          {properties.map((a, i) => (
            <div key={i} className="space-y-4">
              {properties.length > 1 ? (
                <div className="flex items-center justify-between">
                  <p className={`text-sm font-bold ${ink}`}>Address {i + 1}</p>
                  <button
                    type="button"
                    onClick={() => setProperties((ps) => ps.filter((_, j) => j !== i))}
                    className="text-xs font-bold text-rose-700 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ) : null}

              <div className={`overflow-hidden rounded-lg border ${line} bg-white`}>
                <input
                  aria-label="Street 1"
                  placeholder="Street 1"
                  value={a.addressLine}
                  onChange={(e) => patchProperty(i, { addressLine: e.target.value })}
                  className={`${groupField} border-b ${line}`}
                />
                <input
                  aria-label="Street 2"
                  placeholder="Street 2"
                  value={a.street2}
                  onChange={(e) => patchProperty(i, { street2: e.target.value })}
                  className={`${groupField} border-b ${line}`}
                />
                <div className={`grid grid-cols-2 border-b ${line}`}>
                  <input
                    aria-label="City"
                    placeholder="City"
                    value={a.city}
                    onChange={(e) => patchProperty(i, { city: e.target.value })}
                    className={`${groupField} border-r ${line}`}
                  />
                  <input
                    aria-label="County"
                    placeholder="County"
                    value={a.county}
                    onChange={(e) => patchProperty(i, { county: e.target.value })}
                    className={groupField}
                  />
                </div>
                <div className="grid grid-cols-2">
                  <input
                    aria-label="Postal code"
                    placeholder="Postal code"
                    value={a.postcode}
                    onChange={(e) => patchProperty(i, { postcode: e.target.value })}
                    className={`${groupField} border-r ${line}`}
                  />
                  <label className="flex h-12 min-w-0 items-center gap-1 pr-2">
                    <span className="min-w-0 flex-1 px-3">
                      <span className="block text-[11px] leading-none text-[#667880]">Country</span>
                      <select
                        aria-label="Country"
                        value={a.country}
                        onChange={(e) => patchProperty(i, { country: e.target.value })}
                        className={`mt-0.5 block h-5 w-full appearance-none truncate bg-transparent text-[14px] leading-5 outline-none ${
                          a.country ? ink : "text-[#667880]"
                        }`}
                      >
                        <option value="">Select a country</option>
                        {COUNTRIES.map((ctry) => (
                          <option key={ctry} value={ctry}>
                            {ctry}
                          </option>
                        ))}
                      </select>
                    </span>
                    <ChevronDown size={16} strokeWidth={2.4} className="text-[#042b3c]" aria-hidden />
                  </label>
                </div>
              </div>
              <Err
                msg={
                  err(`properties.${i}.addressLine`) ||
                  err(`properties.${i}.postcode`) ||
                  err(`properties.${i}.country`)
                }
              />

              <div className="relative">
                <select
                  aria-label="Search tax rate"
                  value={a.taxRate}
                  onChange={(e) => patchProperty(i, { taxRate: e.target.value })}
                  className={`${soloField} appearance-none pr-10 ${a.taxRate ? "" : "text-[#667880]"}`}
                >
                  <option value="">Search tax rate</option>
                  {TAX_RATES.map((rate) => (
                    <option key={rate} value={rate}>
                      {rate}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  strokeWidth={2.4}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#042b3c]"
                  aria-hidden
                />
              </div>
              <Err msg={err(`properties.${i}.taxRate`)} />

              <label className={`relative flex cursor-pointer items-center gap-2.5 text-sm ${ink}`}>
                <input
                  type="checkbox"
                  className="absolute inset-0 cursor-pointer opacity-0"
                  checked={a.billingSame}
                  onChange={(e) => patchProperty(i, { billingSame: e.target.checked })}
                />
                <GreenCheck checked={a.billingSame} />
                Billing address is the same as property address
              </label>

              <Accordion title="Property details">
                <input
                  aria-label="Access instructions"
                  placeholder="Access instructions"
                  value={a.instructions}
                  onChange={(e) => patchProperty(i, { instructions: e.target.value })}
                  className={soloField}
                />
              </Accordion>

              <Accordion title="Property contacts" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 grid items-center gap-3 lg:grid-cols-[240px_minmax(0,640px)] lg:gap-x-16">
        <Link
          href="/clientes"
          className={`inline-flex h-10 w-fit items-center rounded-lg border ${line} bg-white px-4 text-sm font-semibold ${ink} hover:bg-[#f7f8f8]`}
        >
          Cancel
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="submit"
            name="intent"
            value="another"
            disabled={saving}
            className={`h-10 rounded-lg border ${line} bg-white px-4 text-sm font-semibold ${ink} hover:bg-[#f7f8f8] disabled:opacity-60`}
          >
            {saving ? "Saving…" : "Save and Create Another"}
          </button>
          <button
            type="submit"
            name="intent"
            value="save"
            disabled={saving}
            className="h-10 rounded-lg px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            style={{ background: green }}
          >
            {saving ? "Saving…" : "Save client"}
          </button>
        </div>
      </div>
    </form>
  );
}
