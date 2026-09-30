export type QuoteLineDraft = {
  name: string;
  description: string;
  qty: string;
  unitPrice: string;
};

export type QuoteStop = {
  address: string;
  floor: string;
  lift: string;
  parking: string;
  bedrooms: string;
};

export type QuotePacking = {
  service: string;
  materials: string;
};

export type QuotePrefill = {
  requestId: string;
  clientId: string;
  title: string;
  moveDate: string;
  moveTime: string;
  inventory: string;
  collection: QuoteStop | null;
  delivery: QuoteStop | null;
  packing: QuotePacking | null;
  lines: QuoteLineDraft[];
};

export type QuoteTemplate = {
  id: string;
  label: string;
  serviceName: string;
};

/** Options shown in the new-quote popup, in the same order as the reference screen. */
export const QUOTE_TEMPLATES: QuoteTemplate[] = [
  { id: "driver-helper", label: "Driver + helper", serviceName: "Driver + Helper + Luton Van" },
  { id: "driver-only", label: "Driver only", serviceName: "Driver + Luton Van" },
  { id: "disposal", label: "Rubbish clearance", serviceName: "Disposal Service" },
  { id: "fixed-price", label: "Fixed price", serviceName: "Fixed price" },
  { id: "helper", label: "Helper service", serviceName: "Helper Service" },
  { id: "office", label: "Office relocation", serviceName: "Office Relocation" },
  { id: "packing", label: "Packing service", serviceName: "Packing service" },
  { id: "piano", label: "Piano service", serviceName: "Piano Service" },
];

export function getQuoteTemplate(id: string | undefined): QuoteTemplate | null {
  if (!id) return null;
  return QUOTE_TEMPLATES.find((template) => template.id === id) ?? null;
}
