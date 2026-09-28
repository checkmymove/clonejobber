"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { NewClientModal, type CreatedClient } from "@/components/requests/new-client-modal";

export type RichClient = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  status?: string;
  address_line?: string | null;
  city?: string | null;
  postcode?: string | null;
  country?: string | null;
};

function fullName(c: RichClient) {
  return `${c.first_name} ${c.last_name}`.trim();
}

function addressLine(c: RichClient) {
  const parts = [c.address_line, c.city, c.country, c.postcode].filter(Boolean);
  return parts.length ? parts.join(", ") : "No address on file";
}

export function ClientSelect({
  clients,
  value,
  onChange,
  leadSources = [],
  error,
  disabled,
}: {
  clients: RichClient[];
  value: string;
  onChange: (id: string) => void;
  leadSources?: { id: string; name: string }[];
  error?: string;
  disabled?: boolean;
}) {
  const [list, setList] = useState<RichClient[]>(clients);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => setList(clients), [clients]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open ]);

  const selected = useMemo(
    () => list.find((c) => c.id === value) ?? null,
    [list, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) =>
      `${c.first_name} ${c.last_name} ${c.email} ${c.phone ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [list, query]);

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery("");
  };

  const handleCreated = (c: CreatedClient) => {
    setList((prev) => [...prev, c]);
    onChange(c.id);
    setOpen(false);
    setQuery("");
  };

  return (
    <div>
      <div ref={wrapRef} className="relative">
        <input
          aria-label="Select a client"
          placeholder="Select a client"
          value={open ? query : selected ? fullName(selected) : query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setQuery(selected ? "" : query);
            setOpen(true);
          }}
          className="h-[52px] w-full rounded-xl border-2 border-[#042b3c]/60 bg-white px-4 text-[16px] text-[#042b3c] outline-none placeholder:text-[#667880] focus:border-[#042b3c] disabled:bg-[#f7f8f8]"
        />
        {open && !disabled ? (
          <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-xl border border-[#d5dde1] bg-white shadow-xl">
            <div className="max-h-[320px] overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-4 py-6 text-sm text-[#667880]">
                  No clients match “{query}”.
                </p>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pick(c.id)}
                    className="flex w-full items-start justify-between gap-3 border-b border-[#eef2f3] px-4 py-3 text-left hover:bg-[#f7faf7]"
                  >
                    <span className="min-w-0">
                      <span className="block text-[16px] font-bold text-[#1f2a30]">
                        {fullName(c)}
                      </span>
                      <span className="mt-0.5 block truncate text-[14px] text-[#5d6f78]">
                        {addressLine(c)}
                      </span>
                      <span className="block truncate text-[14px] text-[#5d6f78]">
                        {c.email}
                        {c.phone ? ` · ${c.phone}` : ""}
                      </span>
                    </span>
                    <span
                      className={`mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold ${
                        c.status === "active"
                          ? "bg-[#e7f0e2] text-[#2f5b25]"
                          : "bg-[#e3eefb] text-[#2c5f8a]"
                      }`}
                    >
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          c.status === "active" ? "bg-[#3f7d2c]" : "bg-[#4a90d9]"
                        }`}
                      />
                      {c.status === "active" ? "Active" : "Lead"}
                    </span>
                  </button>
                ))
              )}
            </div>
            <div className="border-t border-[#e6ebed] p-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setModalOpen(true);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-[15px] font-bold text-[#388623] hover:bg-[#f2f8f0]"
              >
                <Plus size={18} strokeWidth={2.6} />
                Create new client
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {!value && !disabled ? (
        <p className="mt-1.5 text-sm font-semibold text-[#d34545]">
          {error || "Select a client"}
        </p>
      ) : null}

      {selected ? (
        <div className="mt-3 rounded-xl border border-[#d5dde1] bg-white px-4 py-3.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[15px] font-bold text-[#042b3c]">
              {fullName(selected)}{" "}
              <span
                aria-hidden
                className="ml-1 inline-block h-2 w-2 rounded-full bg-[#4a90d9]"
              />
            </p>
            <button
              type="button"
              aria-label="Change client"
              onClick={() => {
                onChange("");
                setQuery("");
                setOpen(true);
              }}
              className="px-1 text-lg font-bold leading-none text-[#042b3c]"
            >
              …
            </button>
          </div>
          <p className="mt-1.5 text-[14px] leading-5 text-[#1f2a30]">
            {selected.address_line ? (
              <>
                {selected.address_line}
                <br />
              </>
            ) : null}
            {[selected.city, selected.country, selected.postcode]
              .filter(Boolean)
              .join(", ") || "No address on file"}
          </p>
          <p className="mt-1.5 text-[14px] font-semibold text-[#2e7d1b]">
            {selected.phone || "No phone"}
          </p>
          <p className="text-[14px] font-semibold text-[#2e7d1b] underline underline-offset-2">
            {selected.email}
          </p>
        </div>
      ) : null}

      <NewClientModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        leadSources={leadSources}
        onCreated={handleCreated}
      />
    </div>
  );
}
