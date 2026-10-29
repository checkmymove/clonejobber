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

export type EmailAttachment = { fileName: string; mimeType: string; data: Uint8Array };
/** Image shown inside the HTML through `cid:<contentId>` (logos), so it needs no public URL. */
export type InlineImage = { contentId: string; fileName: string; mimeType: string; data: Uint8Array };

/** Base64 body folded at 76 characters, as MIME requires. */
function foldedBase64(data: Uint8Array): string {
  return (Buffer.from(data).toString("base64").match(/.{1,76}/g) ?? []).join("\r\n");
}

export function buildRawEmail(input: {
  from: string;
  to: string;
  bcc?: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
  inlineImages?: InlineImage[];
  boundary?: string;
}): string {
  const subject = encodeHeader(input.subject.replace(/[\r\n]+/g, " ").trim());
  const headers = [
    `From: ${input.from}`,
    `To: ${input.to}`,
    input.bcc ? `Bcc: ${input.bcc}` : "",
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
  ].filter(Boolean);
  const attachments = input.attachments ?? [];
  const inline = input.inlineImages ?? [];
  if (attachments.length === 0 && inline.length === 0) {
    return [
      ...headers,
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      input.html,
    ].join("\r\n");
  }
  const boundary = input.boundary ?? `jtg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const htmlPart = ["Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: 8bit", "", input.html].join("\r\n");
  // HTML and its inline images travel together as multipart/related.
  const body = inline.length
    ? [
        `Content-Type: multipart/related; boundary="${boundary}-rel"`,
        "",
        `--${boundary}-rel`,
        htmlPart,
        ...inline.map((image) =>
          [
            `--${boundary}-rel`,
            `Content-Type: ${image.mimeType}; name="${image.fileName.replace(/["\r\n]/g, "")}"`,
            `Content-ID: <${image.contentId}>`,
            "Content-Disposition: inline",
            "Content-Transfer-Encoding: base64",
            "",
            foldedBase64(image.data),
          ].join("\r\n"),
        ),
        `--${boundary}-rel--`,
      ].join("\r\n")
    : htmlPart;
  const parts = [
    [`--${boundary}`, body].join("\r\n"),
    ...attachments.map((file) => {
      const name = file.fileName.replace(/["\r\n]/g, "");
      return [
        `--${boundary}`,
        `Content-Type: ${file.mimeType}; name="${name}"`,
        `Content-Disposition: attachment; filename="${name}"`,
        "Content-Transfer-Encoding: base64",
        "",
        foldedBase64(file.data),
      ].join("\r\n");
    }),
  ];
  return [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    ...parts,
    `--${boundary}--`,
    "",
  ].join("\r\n");
}
