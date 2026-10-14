/**
 * Jobber invoice statuses. Stored: draft, sent, overdue, paid, bad_debt, cancelled (= Voided).
 * Awaiting Payment / Past Due are derived from a sent invoice's due date.
 */

export type InvoiceListStatus =
  | "draft"
  | "awaiting_payment"
  | "past_due"
  | "paid"
  | "bad_debt"
  | "voided";

export const INVOICE_STATUS_META: Record<
  InvoiceListStatus,
  { label: string; dot: string; badge: string }
> = {
  draft: { label: "Draft", dot: "bg-stone-400", badge: "bg-stone-100 text-stone-700" },
  awaiting_payment: {
    label: "Awaiting payment",
    dot: "bg-amber-400",
    badge: "bg-amber-50 text-amber-900",
  },
  past_due: { label: "Past due", dot: "bg-rose-500", badge: "bg-rose-50 text-rose-800" },
  paid: { label: "Paid", dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-800" },
  bad_debt: { label: "Bad debt", dot: "bg-stone-500", badge: "bg-stone-200 text-stone-700" },
  voided: { label: "Voided", dot: "bg-stone-300", badge: "bg-stone-100 text-stone-500" },
};

export const INVOICE_STATUS_ORDER: InvoiceListStatus[] = [
  "past_due",
  "awaiting_payment",
  "draft",
  "paid",
  "bad_debt",
  "voided",
];

export function deriveInvoiceStatus(
  status: string,
  dueOn: string | null,
  today: string,
): InvoiceListStatus {
  switch (status) {
    case "draft":
      return "draft";
    case "paid":
      return "paid";
    case "bad_debt":
      return "bad_debt";
    case "cancelled":
      return "voided";
    case "overdue":
      return "past_due";
    default:
      return dueOn && dueOn < today ? "past_due" : "awaiting_payment";
  }
}

export const PAYMENT_TERMS = [
  { value: "due_on_receipt", label: "Due upon receipt", days: 0 },
  { value: "net_7", label: "Net 7", days: 7 },
  { value: "net_15", label: "Net 15", days: 15 },
  { value: "net_30", label: "Net 30", days: 30 },
  { value: "net_45", label: "Net 45", days: 45 },
] as const;

export function paymentTermsLabel(value: string): string {
  return PAYMENT_TERMS.find((t) => t.value === value)?.label ?? value;
}

/**
 * New balance and stored status after payments change.
 * A voided, bad-debt or manually closed invoice keeps its status.
 */
export function settleInvoice(input: {
  status: string;
  total: number;
  paid: number;
  badDebt: number;
  closedManually: boolean;
  everSent: boolean;
}): { balance: number; status: string } {
  const balance = Math.max(0, input.total - input.paid - input.badDebt);
  if (input.status === "cancelled") return { balance: 0, status: "cancelled" };
  if (input.status === "bad_debt") return { balance: 0, status: "bad_debt" };
  if (input.status === "paid" && input.closedManually) return { balance, status: "paid" };
  if (balance === 0 && input.total > 0 && input.paid > 0) return { balance, status: "paid" };
  if (input.status === "paid") {
    return { balance, status: input.everSent ? "sent" : "draft" };
  }
  return { balance, status: input.status };
}
