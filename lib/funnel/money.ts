/** GBP display strings → integer pence. Empty string is 0. */

export function parseGbpToPence(raw: string): number | null {
  let t = raw.trim().replace(/[£\s]/g, "");
  if (!t) return 0;
  if (t.includes(",") && t.includes(".")) t = t.replace(/,/g, "");
  else if (t.includes(",")) t = t.replace(",", ".");
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function parseQty(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

export function lineTotalPence(qty: number, unitPence: number): number {
  return Math.round(qty * unitPence);
}

export type LineInput = {
  name: string;
  description?: string;
  qty: string;
  unitPrice: string;
};

export type ParsedLine = {
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export function parseLines(lines: LineInput[]): {
  errors: Record<string, string>;
  parsed: ParsedLine[];
  subtotal: number;
} {
  const errors: Record<string, string> = {};
  const named = lines.filter((l) => l.name.trim());
  if (named.length === 0) {
    return { errors: { lines: "Add at least one named line item" }, parsed: [], subtotal: 0 };
  }
  const parsed: ParsedLine[] = [];
  named.forEach((l, i) => {
    const qty = parseQty(l.qty || "1");
    const unit = parseGbpToPence(l.unitPrice);
    if (qty == null) errors[`lines.${i}.qty`] = "Invalid quantity";
    if (unit == null) errors[`lines.${i}.unitPrice`] = "Invalid unit price";
    if (qty != null && unit != null) {
      parsed.push({
        name: l.name.trim(),
        description: (l.description ?? "").trim(),
        quantity: qty,
        unitPrice: unit,
        total: lineTotalPence(qty, unit),
      });
    }
  });
  const subtotal = parsed.reduce((s, l) => s + l.total, 0);
  return { errors, parsed, subtotal };
}
