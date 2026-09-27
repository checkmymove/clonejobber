"use client";

type Client = { id: string; first_name: string; last_name: string; email: string };

export function ClientSelect({
  clients,
  value,
  onChange,
  error,
  disabled,
}: {
  clients: Client[];
  value: string;
  onChange: (id: string) => void;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <select
        aria-label="Select a client"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-lg border border-[#d5dde1] bg-white px-3 text-[15px] text-[#042b3c] outline-none focus:border-[#388623] focus:ring-2 focus:ring-[#388623]/20 disabled:bg-[#f7f8f8] disabled:text-[#8aa0a8]"
      >
        <option value="">Select a client</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.first_name} {c.last_name} · {c.email}
          </option>
        ))}
      </select>
      {!value && !disabled ? (
        <p className="mt-1.5 text-sm font-semibold text-[#d34545]">
          {error || "Select a client"}
        </p>
      ) : null}
    </div>
  );
}
