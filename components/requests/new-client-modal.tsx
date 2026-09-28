"use client";

import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { createClientQuick } from "@/lib/clients/crm-actions";

const TITLES = ["No title", "Mr", "Mrs", "Ms", "Miss", "Dr"];

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

const line = "border-[#d5dde1]";
const ink = "text-[#042b3c]";
const ph = "placeholder:text-[#667880]";
const green = "#388623";

const solo = `h-12 w-full rounded-lg border ${line} bg-white px-3 text-[15px] ${ink} outline-none ${ph} focus:border-[#388623] focus:ring-2 focus:ring-[#388623]/20`;
const group = `h-12 w-full border-0 bg-transparent px-3 text-[15px] ${ink} outline-none ${ph}`;

export interface CreatedClient {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  status: string;
  address_line: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
}

export function NewClientModal({
  open,
  onClose,
  leadSources,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  leadSources: { id: string; name: string }[];
  onCreated: (c: CreatedClient) => void;
}) {
  const [title, setTitle] = useState("No title");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [leadSourceId, setLeadSourceId] = useState("");
  const [street1, setStreet1] = useState("");
  const [street2, setStreet2] = useState("");
  const [city, setCity] = useState("");
  const [county, setCounty] = useState("");
  const [postcode, setPostcode] = useState("");
  const [country, setCountry] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const save = async () => {
    setSaving(true);
    setErrors({});
    const res = await createClientQuick({
      title,
      firstName,
      lastName,
      companyName,
      phone,
      email,
      leadSourceId,
      street1,
      street2,
      city,
      county,
      postcode,
      country,
    });
    setSaving(false);
    if (!res.ok) {
      setErrors(res.errors ?? {});
      return;
    }
    if (res.client) {
      onCreated(res.client);
      onClose();
      // reset for next time
      setFirstName("");
      setLastName("");
      setCompanyName("");
      setPhone("");
      setEmail("");
      setLeadSourceId("");
      setStreet1("");
      setStreet2("");
      setCity("");
      setCounty("");
      setPostcode("");
      setCountry("");
      setTitle("No title");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="New client"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[720px] overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className={`flex items-center justify-between border-b ${line} px-6 py-5`}>
          <h2 className={`text-[26px] font-extrabold ${ink}`}>New client</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-11 w-11 place-items-center rounded-xl border-2 border-[#8aa0a8] bg-[#f3efe6]"
          >
            <X size={22} className={ink} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-6">
          <div className={`overflow-hidden rounded-xl border ${line} bg-white`}>
            <div className={`grid grid-cols-[150px_1fr_1fr] border-b ${line}`}>
              <label className={`flex items-center gap-1 border-r ${line} px-3`}>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] leading-none text-[#667880]">Title</span>
                  <select
                    aria-label="Title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className={`mt-0.5 w-full appearance-none bg-transparent text-[15px] ${ink} outline-none`}
                  >
                    {TITLES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </span>
                <ChevronDown size={18} className={ink} aria-hidden />
              </label>
              <input
                aria-label="First name"
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={`${group} border-r ${line}`}
              />
              <input
                aria-label="Last name"
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={group}
              />
            </div>
            <input
              aria-label="Company name"
              placeholder="Company name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className={group}
            />
          </div>
          {(errors.firstName || errors.lastName) && (
            <p className="text-xs font-semibold text-rose-700">
              {errors.firstName || errors.lastName}
            </p>
          )}

          <input
            aria-label="Phone number"
            placeholder="Phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={solo}
          />
          {errors.phone && (
            <p className="-mt-2 text-xs font-semibold text-rose-700">{errors.phone}</p>
          )}
          <input
            aria-label="Email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={solo}
          />
          {errors.email && (
            <p className="-mt-2 text-xs font-semibold text-rose-700">{errors.email}</p>
          )}

          <select
            aria-label="Lead source"
            value={leadSourceId}
            onChange={(e) => setLeadSourceId(e.target.value)}
            className={`${solo} appearance-none ${leadSourceId ? "" : "text-[#667880]"}`}
          >
            <option value="">Lead source</option>
            {leadSources.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>

          <div className={`overflow-hidden rounded-xl border ${line} bg-white`}>
            <input
              aria-label="Street 1"
              placeholder="Street 1"
              value={street1}
              onChange={(e) => setStreet1(e.target.value)}
              className={`${group} border-b ${line}`}
            />
            <input
              aria-label="Street 2"
              placeholder="Street 2"
              value={street2}
              onChange={(e) => setStreet2(e.target.value)}
              className={`${group} border-b ${line}`}
            />
            <div className={`grid grid-cols-2 border-b ${line}`}>
              <input
                aria-label="City"
                placeholder="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={`${group} border-r ${line}`}
              />
              <input
                aria-label="County"
                placeholder="County"
                value={county}
                onChange={(e) => setCounty(e.target.value)}
                className={group}
              />
            </div>
            <div className="grid grid-cols-2">
              <input
                aria-label="Postal code"
                placeholder="Postal code"
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
                className={`${group} border-r ${line}`}
              />
              <label className="flex h-12 min-w-0 items-center gap-1 pr-2">
                <span className="min-w-0 flex-1 px-3">
                  <span className="block text-[12px] leading-none text-[#667880]">Country</span>
                  <select
                    aria-label="Country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className={`mt-0.5 block h-5 w-full appearance-none truncate bg-transparent text-[14px] leading-5 outline-none ${
                      country ? ink : "text-[#667880]"
                    }`}
                  >
                    <option value="">Select a country</option>
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </span>
                <ChevronDown size={18} className={ink} aria-hidden />
              </label>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 pb-6">
          <button
            type="button"
            onClick={onClose}
            className={`h-10 rounded-lg px-4 text-sm font-semibold ${ink} hover:bg-[#f4f6f7]`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="h-10 rounded-lg px-5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: green }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
