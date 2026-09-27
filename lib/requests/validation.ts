// Pure validators shared by the wizard (client) and the Server Action.
// Every function returns a map field -> message; empty map = valid.
// NOTE: this module must stay dependency-free so tests can import it with plain node.

import {
  ALLOWED_MIME_TYPES,
  HOURS_OPTIONS,
  MAX_FILE_SIZE_BYTES,
} from "./constants";

export type Errors = Record<string, string>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9\s\-().]{7,22}$/;
const UK_POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function required(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function isValidEmail(v: string): boolean {
  return EMAIL_RE.test(v.trim());
}

export function isValidPhone(v: string): boolean {
  const digits = v.replace(/\D/g, "");
  return PHONE_RE.test(v.trim()) && digits.length >= 7 && digits.length <= 15;
}

export function isValidUkPostcode(v: string): boolean {
  return UK_POSTCODE_RE.test(v.trim());
}

export function isValidTime(v: string): boolean {
  return TIME_RE.test(v.trim());
}

export function isValidDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + "T00:00:00Z");
  return !Number.isNaN(d.getTime());
}

/** Normalised phone used for duplicate-client lookup. */
export function normalizePhone(v: string): string {
  return v.replace(/[\s\-().]/g, "");
}

export interface ContactStep {
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  phone: string;
  marketingEmail: boolean;
  marketingSms: boolean;
  leadSourceId: string;
  moveDate: string;
  moveTime: string;
}

export function validateContact(s: ContactStep): Errors {
  const e: Errors = {};
  if (!required(s.firstName) || s.firstName.trim().length > 60)
    e.firstName = "First name is required";
  if (!required(s.lastName) || s.lastName.trim().length > 60)
    e.lastName = "Last name is required";
  if (s.companyName.trim().length > 120)
    e.companyName = "Company name is too long";
  if (!required(s.email)) e.email = "Email is required";
  else if (!isValidEmail(s.email)) e.email = "Enter a valid email address";
  if (!required(s.phone)) e.phone = "Phone is required";
  else if (!isValidPhone(s.phone)) e.phone = "Enter a valid phone number";
  if (!required(s.leadSourceId))
    e.leadSourceId = "Please tell us how you heard about us";
  if (required(s.moveDate) && !isValidDate(s.moveDate))
    e.moveDate = "Enter a valid date";
  if (!required(s.moveTime)) e.moveTime = "Moving time is required";
  else if (!isValidTime(s.moveTime)) e.moveTime = "Enter a valid time";
  return e;
}

export interface LocationStep {
  address: string;
  postcode: string;
  floor: string;
  hasLift: boolean | null;
  parking: string;
  bedrooms: string;
}

export function validateLocation(s: LocationStep): Errors {
  const e: Errors = {};
  if (!required(s.address) || s.address.trim().length > 200)
    e.address = "Address is required";
  if (!required(s.postcode)) e.postcode = "Postcode is required";
  else if (!isValidUkPostcode(s.postcode)) e.postcode = "Enter a valid UK postcode";
  if (!required(s.floor) || s.floor.trim().length > 60)
    e.floor = "Floor is required";
  if (s.hasLift === null || s.hasLift === undefined)
    e.hasLift = "Please answer if there is a lift";
  if (!required(s.parking) || s.parking.trim().length > 200)
    e.parking = "Parking information is required";
  const b = Number(s.bedrooms);
  if (!required(s.bedrooms) || !Number.isInteger(b) || b < 0 || b > 50)
    e.bedrooms = "Enter a valid number of bedrooms";
  return e;
}

export interface PackingStep {
  needsService: boolean | null;
  needsMaterials: boolean | null;
}

export function validatePacking(s: PackingStep): Errors {
  const e: Errors = {};
  if (s.needsService === null || s.needsService === undefined)
    e.needsService = "Please answer";
  if (s.needsMaterials === null || s.needsMaterials === undefined)
    e.needsMaterials = "Please answer";
  return e;
}

export function validateServices(
  serviceIds: string[],
  validIds: string[],
): Errors {
  const e: Errors = {};
  if (serviceIds.length === 0) e.services = "Select at least one service";
  else if (serviceIds.some((id) => !validIds.includes(id)))
    e.services = "Invalid service selected";
  return e;
}

export function validateHours(hours: string[]): Errors {
  const e: Errors = {};
  const allowed = HOURS_OPTIONS as readonly string[];
  if (hours.length === 0) e.hours = "Select at least one option";
  else if (hours.some((h) => !allowed.includes(h)))
    e.hours = "Invalid hours option";
  return e;
}

export function validateInventory(description: string): Errors {
  const e: Errors = {};
  const len = description.trim().length;
  if (len < 10) e.inventory = "Please describe the items (min. 10 characters)";
  else if (len > 2000) e.inventory = "Description is too long (max. 2000)";
  return e;
}

export interface ClientFile {
  name: string;
  size: number;
  type: string;
}

export function validateFileList(
  files: ClientFile[],
  maxImages: number,
): Errors {
  const e: Errors = {};
  if (files.length > maxImages)
    e.images = `Maximum ${maxImages} images allowed`;
  for (const f of files) {
    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(f.type)) {
      e.images = "Only JPG, PNG or WEBP images are allowed";
      break;
    }
    if (f.size <= 0 || f.size > MAX_FILE_SIZE_BYTES) {
      e.images = "Each image must be up to 8 MB";
      break;
    }
  }
  const seen = new Set<string>();
  for (const f of files) {
    const key = `${f.name}::${f.size}`;
    if (seen.has(key)) {
      e.images = "Duplicate images detected";
      break;
    }
    seen.add(key);
  }
  return e;
}

/** Server-side magic-byte check (never trust the client MIME). */
export function sniffImageMime(buf: Uint8Array): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
    return "image/png";
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  )
    return "image/webp";
  return null;
}
