"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { formatDateLondon } from "@/lib/format";
import type { AdminRequestDetail } from "@/lib/requests/queries";

export function QuoteRequestSidebar({ request }: { request: AdminRequestDetail | null }) {
  const [open, setOpen] = useState(true);

  return (
    <aside
      className={`h-fit shrink-0 rounded-2xl border border-[#d5dde1] bg-white xl:sticky xl:top-[88px] ${
        open ? "w-full p-4 lg:w-[300px]" : "w-12 p-1.5"
      }`}
    >
      <div className={`flex items-start gap-3 ${open ? "justify-between" : "justify-center"}`}>
        {open ? <h2 className="text-[20px] font-bold text-[#042b3c]">Request</h2> : null}
        {request ? (
          <button
            type="button"
            aria-expanded={open}
            aria-label={open ? "Hide request" : "Show request"}
            onClick={() => setOpen((value) => !value)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#d5dde1] text-[#042b3c] hover:bg-[#f7f8f8]"
          >
            <ChevronRight size={18} className={open ? "" : "rotate-180"} />
          </button>
        ) : null}
      </div>

      {!open ? null : !request ? (
        <p className="mt-4 text-sm text-[#5d6f78]">This client has no request yet.</p>
      ) : (
        <div className="mt-4 space-y-5 text-sm">
          <Field label="Requested" value={longDate(request.submitted_at)} />

          <Section title="Contact information">
            <Field
              label="Date of Your Move - (if you don't have a date yet, leave it blank)"
              value={numericDate(request.move_date)}
            />
            <Field label="Moving time" value={request.move_time?.trim() || "—"} />
          </Section>

          <Section title="Collection Information">
            <Field label="Pickup address:" value={request.pickup_address || "—"} />
            <Field label="Postcode" value={request.pickup_postcode || "—"} />
            <Field label="Floor (Which floor)" value={request.pickup_floor || "—"} />
            <Field label="Lift" value={yesNo(request.pickup_has_lift)} />
            <Field label="Parking Restrictions:" value={request.pickup_parking || "—"} />
            <Field
              label="How many bedrooms are you moving from?"
              value={request.pickup_bedrooms == null ? "—" : String(request.pickup_bedrooms)}
            />
          </Section>

          <Section title="Delivery information">
            <Field label="Delivery Address" value={request.delivery_address || "—"} />
            <Field label="Postcode" value={request.delivery_postcode || "—"} />
            <Field label="Floor (Which floor)" value={request.delivery_floor || "—"} />
            <Field label="Lift" value={yesNo(request.delivery_has_lift)} />
            <Field label="Parking Restrictions:" value={request.delivery_parking || "—"} />
            <Field
              label="How many bedrooms are you moving to?"
              value={request.delivery_bedrooms == null ? "—" : String(request.delivery_bedrooms)}
            />
          </Section>

          {request.needs_packing_service || request.needs_packing_materials ? (
            <Section title="Packing service">
              <Field label="Will you need packing?" value={request.needs_packing_service ? "Yes" : "No"} />
              <Field label="Do you need packing boxes?" value={request.needs_packing_materials ? "Yes" : "No"} />
            </Section>
          ) : null}

          <Section title="Service details">
            <Field
              label="Which service do you need?"
              value={request.service_names.length ? request.service_names.join(", ") : "—"}
            />
            <Field
              label="Hours"
              value={request.estimated_hours.length ? request.estimated_hours.join(", ") : "—"}
            />
          </Section>

          <Section title="Inventory list">
            <p className="whitespace-pre-wrap text-[15px] text-[#1f2a30]">
              {request.inventory_description?.trim() || "—"}
            </p>
          </Section>
        </div>
      )}
    </aside>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-t border-[#e6ebed] pt-4">
      <h3 className="font-bold text-[#042b3c]">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="block text-[13px] leading-5 text-[#9a7b4f]">{label}</span>
      <span className="mt-0.5 block text-[15px] text-[#1f2a30]">{value}</span>
    </p>
  );
}

function yesNo(value: boolean | null) {
  if (value == null) return "—";
  return value ? "Yes" : "No";
}

function longDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(date);
}

function numericDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDateLondon(value);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(date);
}
