/** RFC 2822 raw message → Gmail `raw` (base64url). */

export function toBase64Url(raw: string): string {
  return Buffer.from(raw, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function encodeHeader(value: string): string {
  if (/^[\x20-\x7e]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

export function buildRawEmail(input: {
  from: string;
  to: string;
  bcc?: string;
  subject: string;
  html: string;
}): string {
  const subject = encodeHeader(input.subject.replace(/[\r\n]+/g, " ").trim());
  const headers = [
    `From: ${input.from}`,
    `To: ${input.to}`,
    input.bcc ? `Bcc: ${input.bcc}` : "",
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
  ].filter(Boolean);
  return [...headers, "", input.html].join("\r\n");
}
