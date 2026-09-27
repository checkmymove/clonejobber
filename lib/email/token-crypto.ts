import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";

/** 32-byte key from TOKEN_ENCRYPTION_KEY (64 hex chars, or standard base64). */
export function encryptionKey(): Buffer | null {
  const raw = process.env.TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  const buf = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes (64 hex characters)");
  }
  return buf;
}

export function isSealedToken(value: string): boolean {
  return value.startsWith(PREFIX);
}

/** AES-256-GCM. Throws when the key is missing. */
export function sealToken(plain: string): string {
  const key = encryptionKey();
  if (!key) throw new Error("Missing TOKEN_ENCRYPTION_KEY");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ciphertext]).toString("base64url");
}

/**
 * Sealed values decrypt with the current key.
 * Values stored before encryption (no prefix) are returned unchanged.
 */
export function openToken(stored: string): string {
  if (!isSealedToken(stored)) return stored;
  const key = encryptionKey();
  if (!key) throw new Error("Missing TOKEN_ENCRYPTION_KEY");
  const buf = Buffer.from(stored.slice(PREFIX.length), "base64url");
  if (buf.length < 29) {
    throw new Error("Could not decrypt Gmail token. Check TOKEN_ENCRYPTION_KEY.");
  }
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Could not decrypt Gmail token. Check TOKEN_ENCRYPTION_KEY.");
  }
}
