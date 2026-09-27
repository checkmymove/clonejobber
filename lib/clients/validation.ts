// Pure validators for the Clients module (shared admin-side).
// Dependency-free so plain node can import it in tests.

export type Errors = Record<string, string>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9\s\-().]{7,22}$/;

export interface ClientInput {
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  phone: string;
  notes: string;
}

export function validateClientInput(c: ClientInput): Errors {
  const e: Errors = {};
  if (!c.firstName.trim() || c.firstName.trim().length > 60)
    e.firstName = "First name is required";
  if (!c.lastName.trim() || c.lastName.trim().length > 60)
    e.lastName = "Last name is required";
  if (c.companyName.trim().length > 120)
    e.companyName = "Company name is too long";
  if (!c.email.trim()) e.email = "Email is required";
  else if (!EMAIL_RE.test(c.email.trim()) || c.email.trim().length > 160)
    e.email = "Enter a valid email address";
  const digits = c.phone.replace(/\D/g, "");
  if (!c.phone.trim()) e.phone = "Phone is required";
  else if (
    !PHONE_RE.test(c.phone.trim()) ||
    digits.length < 7 ||
    digits.length > 15
  )
    e.phone = "Enter a valid phone number";
  if (c.notes.trim().length > 4000) e.notes = "Notes are too long";
  return e;
}

export const ADDRESS_LABELS = ["Billing", "Collection", "Delivery", "Other"] as const;

export interface AddressInput {
  label: string;
  addressLine: string;
  city: string;
  postcode: string;
  instructions: string;
}

export function validateAddressInput(a: AddressInput): Errors {
  const e: Errors = {};
  if (!(ADDRESS_LABELS as readonly string[]).includes(a.label))
    e.label = "Invalid label";
  if (!a.addressLine.trim() || a.addressLine.trim().length > 200)
    e.addressLine = "Address is required";
  if (a.city.trim().length > 120) e.city = "City is too long";
  if (!a.postcode.trim() || a.postcode.trim().length > 20)
    e.postcode = "Postcode is required";
  if (a.instructions.trim().length > 1000)
    e.instructions = "Instructions are too long";
  return e;
}
