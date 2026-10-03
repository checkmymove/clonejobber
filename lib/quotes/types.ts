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

export type QuoteServiceChoice = {
  id: string;
  name: string;
  description: string;
  unitPrice: string;
};
