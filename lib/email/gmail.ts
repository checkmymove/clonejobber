import "server-only";
import { buildRawEmail, toBase64Url } from "./mime";

export async function sendGmailMessage(input: {
  accessToken: string;
  from: string;
  to: string;
  subject: string;
  html: string;
}): Promise<{ id: string }> {
  const raw = toBase64Url(
    buildRawEmail({
      from: input.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
    }),
  );
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      authorization: `Bearer ${input.accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });
  const json = (await res.json()) as { id?: string; error?: { message?: string } };
  if (!res.ok || !json.id) {
    throw new Error(json.error?.message || "Gmail send failed");
  }
  return { id: json.id };
}
