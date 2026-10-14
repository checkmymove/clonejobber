/** Payment vocabulary shared by server and client code (Jobber "Create a payment record"). */

export const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cash", label: "Cash" },
  { value: "card", label: "Credit/debit card" },
  { value: "cheque", label: "Cheque" },
  { value: "paypal", label: "PayPal" },
  { value: "other", label: "Other" },
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"];

export function paymentMethodLabel(value: string): string {
  return PAYMENT_METHODS.find((m) => m.value === value)?.label ?? value;
}

export function isPaymentMethod(value: string): value is PaymentMethod {
  return PAYMENT_METHODS.some((m) => m.value === value);
}

export const PAYMENT_KIND_LABEL: Record<string, string> = {
  payment: "Payment",
  deposit: "Deposit",
  refund: "Refund",
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  succeeded: "Succeeded",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
};

/** Default text of the Details field, as Jobber writes it. */
export function paymentDetailsText(documents: string[]): string {
  if (!documents.length) return "";
  return `Payment applied to ${documents.join(", ")}`;
}
