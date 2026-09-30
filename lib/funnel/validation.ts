import { parseGbpToPence, parseLines, type LineInput, type ParsedLine } from "./money";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(v: string): boolean {
  return UUID.test(v);
}

export type QuoteInput = {
  clientId: string;
  requestId?: string;
  title: string;
  message: string;
  notes: string;
  /** Moving date. Stored in quotes.valid_until. */
  validUntil: string;
  moveTime?: string;
  inventory?: string;
  discount?: string;
  tax?: string;
  deposit?: string;
  lines: LineInput[];
};

export type VisitInput = {
  title: string;
  date: string;
  later: boolean;
  start: string;
  end: string;
  anytime: boolean;
  assignee: string;
  instructions: string;
};

export type JobInput = {
  clientId: string;
  quoteId?: string;
  requestId?: string;
  title: string;
  notes: string;
  remindInvoice: boolean;
  visits: VisitInput[];
  lines: LineInput[];
};

export type InvoiceInput = {
  clientId: string;
  jobId?: string;
  quoteId?: string;
  subject: string;
  message: string;
  notes: string;
  paymentTerms: string;
  lines: LineInput[];
};

export type AdminRequestInput = {
  clientId: string;
  title: string;
  moveDate: string;
  moveTime: string;
  pickupAddress: string;
  pickupPostcode: string;
  pickupFloor: string;
  pickupLift: boolean;
  pickupParking: string;
  pickupBedrooms: string;
  deliveryAddress: string;
  deliveryPostcode: string;
  deliveryFloor: string;
  deliveryLift: boolean;
  deliveryParking: string;
  deliveryBedrooms: string;
  needsPacking: boolean;
  needsBoxes: boolean;
  serviceId: string;
  hours: string;
  inventory: string;
};

export function validateQuoteInput(input: QuoteInput): {
  errors: Record<string, string>;
  parsed: ParsedLine[];
  subtotal: number;
  discount: number;
  tax: number;
  deposit: number;
  total: number;
} {
  const errors: Record<string, string> = {};
  if (!isUuid(input.clientId)) errors.clientId = "Select a client";
  if (input.requestId && !isUuid(input.requestId)) errors.requestId = "Invalid request";
  if (input.validUntil && Number.isNaN(Date.parse(input.validUntil))) {
    errors.validUntil = "Invalid date";
  }
  const { errors: lineErrors, parsed, subtotal } = parseLines(input.lines);
  Object.assign(errors, lineErrors);
  const discount = parseGbpToPence(input.discount ?? "");
  const tax = parseGbpToPence(input.tax ?? "");
  const deposit = parseGbpToPence(input.deposit ?? "");
  if (discount == null) errors.discount = "Invalid discount";
  if (tax == null) errors.tax = "Invalid tax";
  if (deposit == null) errors.deposit = "Invalid deposit";
  if (discount != null && discount > subtotal) errors.discount = "Discount cannot exceed the subtotal";
  const total = Math.max(0, subtotal - (discount ?? 0) + (tax ?? 0));
  return {
    errors,
    parsed,
    subtotal,
    discount: discount ?? 0,
    tax: tax ?? 0,
    deposit: deposit ?? 0,
    total,
  };
}

export function validateJobInput(input: JobInput): {
  errors: Record<string, string>;
  parsed: ParsedLine[];
  subtotal: number;
} {
  const errors: Record<string, string> = {};
  if (!isUuid(input.clientId)) errors.clientId = "Select a client";
  if (input.quoteId && !isUuid(input.quoteId)) errors.quoteId = "Invalid quote";
  if (!input.visits.length) errors.visits = "Add at least one visit";
  const { errors: lineErrors, parsed, subtotal } = parseLines(input.lines);
  Object.assign(errors, lineErrors);
  return { errors, parsed, subtotal };
}

const TERMS = ["due_on_receipt", "net_7", "net_15", "net_30"] as const;

export function dueOnFromTerms(terms: string, issued = new Date()): Date {
  const d = new Date(issued);
  const add =
    terms === "net_7" ? 7 : terms === "net_15" ? 15 : terms === "net_30" ? 30 : 0;
  d.setDate(d.getDate() + add);
  return d;
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function validateInvoiceInput(input: InvoiceInput): {
  errors: Record<string, string>;
  parsed: ParsedLine[];
  subtotal: number;
} {
  const errors: Record<string, string> = {};
  if (!isUuid(input.clientId)) errors.clientId = "Select a client";
  if (!(TERMS as readonly string[]).includes(input.paymentTerms)) {
    errors.paymentTerms = "Invalid payment terms";
  }
  if (!input.subject.trim()) errors.subject = "Subject is required";
  const { errors: lineErrors, parsed, subtotal } = parseLines(input.lines);
  Object.assign(errors, lineErrors);
  return { errors, parsed, subtotal };
}

function bedroomsError(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) return "Bedrooms must be a whole number from 0 to 50";
  const n = Number(raw);
  if (n > 50) return "Bedrooms must be 0–50";
  return null;
}

export function validateAdminRequest(input: AdminRequestInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!isUuid(input.clientId)) errors.clientId = "Select a client";
  if (!input.pickupAddress.trim()) errors.pickupAddress = "Collection address is required";
  if (!input.pickupPostcode.trim()) errors.pickupPostcode = "Collection postcode is required";
  if (!input.deliveryAddress.trim()) errors.deliveryAddress = "Delivery address is required";
  if (!input.deliveryPostcode.trim()) errors.deliveryPostcode = "Delivery postcode is required";
  if (!input.inventory.trim()) errors.inventory = "Inventory is required";
  const pickupBeds = bedroomsError(input.pickupBedrooms);
  if (pickupBeds) errors.pickupBedrooms = pickupBeds;
  const deliveryBeds = bedroomsError(input.deliveryBedrooms);
  if (deliveryBeds) errors.deliveryBedrooms = deliveryBeds;
  if (input.moveDate && Number.isNaN(Date.parse(`${input.moveDate}T00:00:00Z`))) {
    errors.moveDate = "Use the format dd/mm/yyyy.";
  }
  return errors;
}
