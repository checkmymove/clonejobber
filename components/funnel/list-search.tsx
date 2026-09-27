export function ListSearch({
  defaultValue,
  placeholder,
}: {
  defaultValue?: string;
  placeholder: string;
}) {
  return (
    <form method="get" className="mb-3 flex gap-2">
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-10 w-full rounded-xl border border-line bg-card px-3 text-sm text-ink outline-none focus:border-accent sm:max-w-sm"
      />
      <button
        type="submit"
        className="h-10 shrink-0 rounded-xl bg-ink px-4 text-sm font-bold text-white hover:opacity-90"
      >
        Search
      </button>
    </form>
  );
}
