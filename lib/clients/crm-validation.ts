// CRM validators: profile extensions, properties, contacts, notes, tags,
// appointments, manual communications. Dependency-free (node-testable).

export type Errors = Record<string, string>;

export const CLIENT_STATUSES = ["lead", "active", "inactive", "archived"] as const;
export const CLIENT_TYPES = ["individual", "company"] as const;
export const PAYMENT_TERMS = [
  "due_on_receipt",
  "net_7",
  "net_15",
  "net_30",
  "custom",
] as const;
export const PROPERTY_LABELS = ["Billing", "Collection", "Delivery", "Other"] as const;
export const APPOINTMENT_KINDS = ["assessment", "visit", "call", "follow_up", "other"] as const;
export const CHANNELS = ["email", "sms", "whatsapp"] as const;

const PHONE_RE = /^\+?[0-9\s\-().]{7,22}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function phoneOk(v: string): boolean {
  const digits = v.replace(/\D/g, "");
  return PHONE_RE.test(v.trim()) && digits.length >= 7 && digits.length <= 15;
}

export interface ProfileInput {
  title: string;
  firstName: string;
  lastName: string;
  companyName: string;
  clientType: string;
  status: string;
  email: string;
  phone: string;
  phoneMobile: string;
  paymentTerms: string;
  paymentTermsCustom: string;
  askForReview: boolean;
}

export function validateProfile(p: ProfileInput): Errors {
  const e: Errors = {};
  if (p.title.trim().length > 20) e.title = "Title is too long";
  if (!p.firstName.trim() || p.firstName.trim().length > 60)
    e.firstName = "First name is required";
  if (!p.lastName.trim() || p.lastName.trim().length > 60)
    e.lastName = "Last name is required";
  if (p.companyName.trim().length > 120) e.companyName = "Company name is too long";
  if (!(CLIENT_TYPES as readonly string[]).includes(p.clientType))
    e.clientType = "Invalid type";
  if (!(CLIENT_STATUSES as readonly string[]).includes(p.status))
    e.status = "Invalid status";
  if (!p.email.trim()) e.email = "Email is required";
  else if (!EMAIL_RE.test(p.email.trim())) e.email = "Enter a valid email address";
  if (!p.phone.trim()) e.phone = "Phone is required";
  else if (!phoneOk(p.phone)) e.phone = "Enter a valid phone number";
  if (p.phoneMobile.trim() && !phoneOk(p.phoneMobile))
    e.phoneMobile = "Enter a valid mobile number";
  if (!(PAYMENT_TERMS as readonly string[]).includes(p.paymentTerms))
    e.paymentTerms = "Invalid payment terms";
  if (p.paymentTerms === "custom" && !p.paymentTermsCustom.trim())
    e.paymentTermsCustom = "Describe the custom terms";
  return e;
}

export interface PropertyInput {
  label: string;
  addressLine: string;
  city: string;
  postcode: string;
  instructions: string;
  isPrimary: boolean;
  isBilling: boolean;
}

export function validateProperty(p: PropertyInput): Errors {
  const e: Errors = {};
  if (!(PROPERTY_LABELS as readonly string[]).includes(p.label))
    e.label = "Invalid label";
  if (!p.addressLine.trim() || p.addressLine.trim().length > 200)
    e.addressLine = "Address is required";
  if (p.city.trim().length > 120) e.city = "City is too long";
  if (!p.postcode.trim() || p.postcode.trim().length > 20)
    e.postcode = "Postcode is required";
  if (p.instructions.trim().length > 1000)
    e.instructions = "Instructions are too long";
  return e;
}

export interface ContactInput {
  name: string;
  role: string;
  phone: string;
  email: string;
  notes: string;
}

export function validateContactInput(c: ContactInput): Errors {
  const e: Errors = {};
  if (!c.name.trim() || c.name.trim().length > 120)
    e.name = "Name is required";
  if (c.role.trim().length > 80) e.role = "Role is too long";
  if (c.phone.trim() && !phoneOk(c.phone)) e.phone = "Enter a valid phone";
  if (c.email.trim() && !EMAIL_RE.test(c.email.trim()))
    e.email = "Enter a valid email";
  if (c.notes.trim().length > 1000) e.notes = "Notes are too long";
  return e;
}

export function validateNote(content: string): Errors {
  const e: Errors = {};
  if (!content.trim()) e.content = "Note cannot be empty";
  else if (content.trim().length > 4000) e.content = "Note is too long";
  return e;
}

export function validateTag(name: string): Errors {
  const e: Errors = {};
  if (!name.trim() || name.trim().length > 40)
    e.name = "Tag must be 1–40 characters";
  return e;
}

export interface AppointmentInput {
  title: string;
  kind: string;
  startsAt: string;
  endsAt: string;
  notes: string;
}

export function validateAppointment(a: AppointmentInput): Errors {
  const e: Errors = {};
  if (!a.title.trim() || a.title.trim().length > 160)
    e.title = "Title is required";
  if (!(APPOINTMENT_KINDS as readonly string[]).includes(a.kind))
    e.kind = "Invalid kind";
  const s = Date.parse(a.startsAt);
  if (!a.startsAt || Number.isNaN(s)) e.startsAt = "Start is required";
  if (a.endsAt) {
    const en = Date.parse(a.endsAt);
    if (Number.isNaN(en)) e.endsAt = "Invalid end";
    else if (!Number.isNaN(s) && en < s) e.endsAt = "End must be after start";
  }
  if (a.notes.trim().length > 2000) e.notes = "Notes are too long";
  return e;
}

export interface MessageInput {
  channel: string;
  subject: string;
  body: string;
}

export function validateMessage(m: MessageInput): Errors {
  const e: Errors = {};
  if (!(CHANNELS as readonly string[]).includes(m.channel))
    e.channel = "Invalid channel";
  if (m.subject.trim().length > 200) e.subject = "Subject is too long";
  if (!m.body.trim()) e.body = "Message cannot be empty";
  else if (m.body.trim().length > 8000) e.body = "Message is too long";
  return e;
}

export interface FullPropertyInput extends PropertyInput {
  street2: string;
  county: string;
  country: string;
  taxRate: string;
  billingSame: boolean;
}

export function validateFullProperty(p: FullPropertyInput): Errors {
  const e = validateProperty(p);
  if (p.street2.trim().length > 200) e.street2 = "Street 2 is too long";
  if (p.county.trim().length > 120) e.county = "County is too long";
  if (!p.country.trim() || p.country.trim().length > 120)
    e.country = "Country is required";
  if (p.taxRate.trim().length > 60) e.taxRate = "Tax rate is too long";
  return e;
}

export interface NewClientPayload {
  profile: ProfileInput;
  leadSourceId: string;
  marketingEmail: boolean;
  marketingSms: boolean;
  contacts: ContactInput[];
  properties: FullPropertyInput[];
}

/** Aggregate validator for the full New Client form (indexed error keys). */
export function validateNewClient(
  data: NewClientPayload,
  validLeadSourceIds: string[],
): Errors {
  const e: Errors = { ...validateProfile(data.profile) };
  if (data.leadSourceId && !validLeadSourceIds.includes(data.leadSourceId)) {
    e.leadSourceId = "Invalid lead source";
  }
  data.contacts.forEach((c, i) => {
    const ce = validateContactInput(c);
    for (const [k, v] of Object.entries(ce)) e[`contacts.${i}.${k}`] = v;
  });
  data.properties.forEach((p, i) => {
    const pe = validateFullProperty(p);
    for (const [k, v] of Object.entries(pe)) e[`properties.${i}.${k}`] = v;
  });
  return e;
}
