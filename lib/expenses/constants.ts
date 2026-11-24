// Expenses: categories, payment methods and form validation. Pure: client-safe and testable.

export const EXPENSE_CATEGORIES = [
  { key: "fuel", label: "Fuel" },
  { key: "van_hire", label: "Van hire" },
  { key: "materials", label: "Packing materials" },
  { key: "food", label: "Food & meals" },
  { key: "equipment", label: "Equipment" },
  { key: "tolls_parking", label: "Tolls & parking" },
  { key: "insurance", label: "Insurance" },
  { key: "marketing", label: "Marketing" },
  { key: "subcontractors", label: "Subcontractors" },
  { key: "office", label: "Office & software" },
  { key: "other", label: "Other" },
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]["key"];

export const EXPENSE_METHODS = [
  { key: "card", label: "Card" },
  { key: "bank_transfer", label: "Bank transfer" },
  { key: "cash", label: "Cash" },
  { key: "other", label: "Other" },
] as const;

export type ExpenseMethod = (typeof EXPENSE_METHODS)[number]["key"];

export function categoryLabel(key: string): string {
  return EXPENSE_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

export function methodLabel(key: string): string {
  return EXPENSE_METHODS.find((m) => m.key === key)?.label ?? key;
}

export type ExpenseInput = {
  spentOn: string;
  category: string;
  description: string;
  vendor: string;
  amount: string;
  paymentMethod: string;
  jobId: string;
};

export type ParsedExpense = {
  spentOn: string;
  category: ExpenseCategory;
  description: string;
  vendor: string;
  /** Pence. */
  amount: number;
  paymentMethod: ExpenseMethod;
  jobId: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Checks the expense form; amounts are typed in pounds ("£42.50") and stored in pence. */
export function validateExpense(
  input: ExpenseInput,
): { ok: true; value: ParsedExpense } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!validDate(input.spentOn.trim())) errors.spentOn = "Choose a valid date";
  if (!EXPENSE_CATEGORIES.some((c) => c.key === input.category)) errors.category = "Choose a category";
  if (!EXPENSE_METHODS.some((m) => m.key === input.paymentMethod)) errors.paymentMethod = "Choose how it was paid";
  const raw = input.amount.trim().replace(/^£/, "").replace(/,/g, "");
  const amount = /^\d{1,7}(\.\d{1,2})?$/.test(raw) ? Math.round(Number(raw) * 100) : NaN;
  if (!Number.isFinite(amount) || amount <= 0) errors.amount = "Enter an amount in pounds, e.g. 42.50";
  if (input.description.trim().length > 300) errors.description = "Description is too long";
  if (input.vendor.trim().length > 120) errors.vendor = "Supplier is too long";
  const jobId = input.jobId.trim();
  if (jobId && !UUID.test(jobId)) errors.jobId = "Choose a job from the list";
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      spentOn: input.spentOn.trim(),
      category: input.category as ExpenseCategory,
      description: input.description.trim(),
      vendor: input.vendor.trim(),
      amount,
      paymentMethod: input.paymentMethod as ExpenseMethod,
      jobId: jobId || null,
    },
  };
}
