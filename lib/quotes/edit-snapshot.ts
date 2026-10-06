import { penceToInput } from "@/lib/format";

export function quoteLinesFromPence(
  lines: { name: string; description: string; quantity: number; unitPrice: number }[],
) {
  return lines.map((line, index) => ({
    id: `quote-line-${index}`,
    name: line.name,
    description: line.description,
    qty: String(line.quantity),
    price: penceToInput(line.unitPrice),
  }));
}
