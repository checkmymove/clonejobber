"use client";

/** A filter select that applies itself as soon as an option is picked (Jobber's filter pills). */
export function AutoSubmitSelect({
  name,
  defaultValue,
  options,
  className,
  ariaLabel,
}: {
  name: string;
  defaultValue: string;
  options: { value: string; label: string }[];
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <select
      name={name}
      aria-label={ariaLabel}
      defaultValue={defaultValue}
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
      className={className}
    >
      <option value="">All</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
