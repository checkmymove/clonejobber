// Shared constants for the public Request flow.
// Service/hours options come from the DB at runtime; HOURS_OPTIONS is the
// closed allowlist demonstrated in the reference video.

export const HOURS_OPTIONS = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "Over 8 hours",
  "I don't know",
] as const;

export const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB per image

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MIN_FORM_SECONDS = 3; // time-trap anti-spam

export const STEP_TITLES = [
  "Contact Information",
  "Collection Information",
  "Delivery Information",
  "Packing Service",
  "Service & Inventory",
  "Review",
] as const;

export const TOTAL_STEPS = STEP_TITLES.length;
export const LAST_STEP = TOTAL_STEPS - 1;
