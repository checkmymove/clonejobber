import "server-only";
import { buildRawEmail, toBase64Url, type EmailAttachment, type InlineImage } from "./mime";

export async function sendGmailMessage(input: {
  accessToken: string;
  from: string;
  to: string;
  bcc?: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
  inlineImages?: InlineImage[];
}): Promise<{ id: string }> {
  const mime = buildRawEmail({
    from: input.from,
    to: input.to,
    bcc: input.bcc,
    subject: input.subject,
    html: input.html,
    attachments: input.attachments,
    inlineImages: input.inlineImages,
  });
  // Photos and documents can make the message several MB: the upload endpoint takes up to
  // 35 MB of raw MIME, while the JSON body is meant for small messages.
  const large = mime.length > 4 * 1024 * 1024;
  const res = large
    ? await fetch("https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=media", {
        method: "POST",
        headers: { authorization: `Bearer ${input.accessToken}`, "content-type": "message/rfc822" },
        body: mime,
      })
    : await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
          authorization: `Bearer ${input.accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ raw: toBase64Url(mime) }),
      });
  const json = (await res.json()) as { id?: string; error?: { message?: string } };
  if (!res.ok || !json.id) {
    throw new Error(json.error?.message || "Gmail send failed");
  }
  return { id: json.id };
}
