// Pure validators for Products & services. Dependency-free so plain node can import it in tests.

export type Errors = Record<string, string>;

export type ItemType = "service" | "product";

export const ITEM_TYPES: ItemType[] = ["service", "product"];

export const DURATION_OPTIONS: { minutes: number; label: string }[] = [
  15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240, 300, 360, 420, 480, 600, 720,
].map((minutes) => ({ minutes, label: formatDuration(minutes) }));

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

export interface ProductInput {
  itemType: string;
  name: string;
  description: string;
  unitPrice: string;
  taxExempt: boolean;
  durationMinutes: string;
  allowQuantity: boolean;
}

/** "85", "85.5", "£1,250.00" -> pence. Null when not a valid non-negative amount. */
export function poundsToPence(raw: string): number | null {
  const cleaned = raw.replace(/[£\s,]/g, "");
  if (cleaned === "") return 0;
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

export function validateProductInput(input: ProductInput): Errors {
  const e: Errors = {};
  if (!ITEM_TYPES.includes(input.itemType as ItemType)) {
    e.itemType = "Choose Service or Product";
  }
  const name = input.name.trim();
  if (!name) e.name = "Name is required";
  else if (name.length > 120) e.name = "Name is too long (120 characters max)";
  if (input.description.length > 4000) {
    e.description = "Description is too long (4000 characters max)";
  }
  if (poundsToPence(input.unitPrice) === null) {
    e.unitPrice = "Enter a valid price, e.g. 85.00";
  }
  if (input.itemType === "service") {
    const minutes = Number(input.durationMinutes);
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 1440) {
      e.durationMinutes = "Choose a service duration";
    }
  }
  return e;
}
