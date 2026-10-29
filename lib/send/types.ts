/** One "Send email & text" for requests, quotes, jobs and invoices. Safe for client components. */

export type SendKind = "request" | "quote" | "job" | "invoice";

export const SEND_KIND_LABEL: Record<SendKind, string> = {
  request: "request",
  quote: "quote",
  job: "job",
  invoice: "invoice",
};

/** The card at the top of the email, as Jobber shows it (heading, amount, View button). */
export type EmailCard = {
  heading: string;
  amount?: string;
  amountNote?: string;
  buttonLabel?: string;
};

export type SendDraft = {
  kind: SendKind;
  id: string;
  number: string;
  clientName: string;
  companyName: string;
  logoUrl: string;
  viewUrl: string | null;
  card: EmailCard;
  email: { to: string; subject: string; message: string };
  sms: { to: string; message: string };
  /** File name of the PDF attached to the email, or null when the document has none. */
  attachment: string | null;
  /** False until an SMS provider is connected; texts are then only logged. */
  smsReady: boolean;
};

export type ChannelResult = { ok: boolean; message?: string };

export type SendOutcome = {
  ok: boolean;
  message?: string;
  email?: ChannelResult;
  sms?: ChannelResult;
};

/** SMS segments: 160 characters for GSM text, 70 once a character needs Unicode. */
export function smsSegments(text: string): { length: number; segments: number } {
  const unicode = /[^\x0A\x0D\x20-\x7E£¥èéùìòÇØøÅå_ÆæßÉÄÖÑÜ§¿äöñüà€]/.test(text);
  const single = unicode ? 70 : 160;
  const multi = unicode ? 67 : 153;
  const length = [...text].length;
  return { length, segments: length <= single ? 1 : Math.ceil(length / multi) };
}
