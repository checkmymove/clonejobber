"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Wallet } from "lucide-react";
import { CardIcon } from "@/components/card-icon";
import { Card } from "@/components/ui";
import { CardTitle } from "@/components/funnel/document-cards";
import { inlineField } from "@/components/inline-edit-card";
import { openPicker } from "@/components/date-field";
import { formatDateNumericLondon, formatGBP, padMoney } from "@/lib/format";
import { EXPENSE_CATEGORIES, EXPENSE_METHODS, categoryLabel } from "@/lib/expenses/constants";
import { deleteExpenseAction, saveExpenseAction } from "@/lib/expenses/actions";

export type JobExpense = {
  id: string;
  spent_on: string;
  category: string;
  description: string;
  vendor: string;
  amount: number;
};

// What a crew spends on a job comes first in the list.
const JOB_CATEGORIES = ["materials", "food", "fuel", "tolls_parking", "van_hire", "equipment", "subcontractors", "other"];

/**
 * Expenses under Labour on the job page: materials, food and other costs of this job.
 * They are the same records as the Expenses page, linked to the job.
 */
export function JobExpensesCard({
  jobId,
  expenses,
  today,
}: {
  jobId: string;
  /** Null until the expenses table exists (migration 0025). */
  expenses: JobExpense[] | null;
  today: string;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blank = { spentOn: today, category: "materials", description: "", amount: "", paymentMethod: "card" };
  const [draft, setDraft] = useState(blank);
  const total = (expenses ?? []).reduce((s, e) => s + e.amount, 0);
  const categories = EXPENSE_CATEGORIES.filter((c) => JOB_CATEGORIES.includes(c.key)).sort(
    (a, b) => JOB_CATEGORIES.indexOf(a.key) - JOB_CATEGORIES.indexOf(b.key),
  );

  async function save() {
    setPending(true);
    setError(null);
    const result = await saveExpenseAction(null, { ...draft, vendor: "", jobId });
    setPending(false);
    if (!result.ok) {
      setError(result.message ?? "Could not save the expense.");
      return;
    }
    setDraft(blank);
    setAdding(false);
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this expense?")) return;
    const result = await deleteExpenseAction(id);
    if (!result.ok) setError(result.message ?? "Could not delete the expense.");
    router.refresh();
  }

  return (
    <Card className="h-fit p-5 xl:col-span-2">
      <CardTitle
        icon={<CardIcon icon={Wallet} tone="orange" boxed />}
        action={
          expenses ? (
            <button
              type="button"
              onClick={() => setAdding((v) => !v)}
              aria-label="Add expense"
              className="grid h-7 w-7 place-items-center rounded-lg border border-line text-ink-soft hover:bg-cream hover:text-ink"
            >
              <Plus size={14} />
            </button>
          ) : null
        }
      >
        Expenses
      </CardTitle>

      {expenses === null ? (
        <p className="text-sm text-ink-mute">Expenses need the latest database update (npm run migrate).</p>
      ) : (
        <>
          <div className="mb-3">
            <p className="text-xs text-ink-mute">Spent on this job</p>
            <p className="text-2xl font-extrabold text-ink">{formatGBP(total)}</p>
          </div>

          {adding ? (
            <div className="mb-4 grid grid-cols-1 gap-2 rounded-xl border border-line p-3 sm:grid-cols-[140px_170px_minmax(0,1fr)_110px_140px]">
              <input
                type="date"
                aria-label="Date"
                onClick={openPicker}
                value={draft.spentOn}
                onChange={(e) => setDraft({ ...draft, spentOn: e.target.value })}
                className={inlineField}
              />
              <select
                aria-label="Category"
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                className={inlineField}
              >
                {categories.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input
                aria-label="Description"
                placeholder="What was it? (e.g. 20 boxes, lunch for 2)"
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                className={inlineField}
              />
              <input
                aria-label="Amount"
                inputMode="decimal"
                placeholder="£0.00"
                value={draft.amount}
                onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                onBlur={(e) => setDraft({ ...draft, amount: padMoney(e.target.value) })}
                className={`${inlineField} text-right`}
              />
              <select
                aria-label="Paid by"
                value={draft.paymentMethod}
                onChange={(e) => setDraft({ ...draft, paymentMethod: e.target.value })}
                className={inlineField}
              >
                {EXPENSE_METHODS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
              <div className="flex gap-2 sm:col-span-5 sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false);
                    setDraft(blank);
                    setError(null);
                  }}
                  className="h-9 rounded-lg border border-line px-3 text-sm font-semibold text-ink hover:bg-cream"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void save()}
                  className="h-9 rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                >
                  {pending ? "Saving…" : "Save expense"}
                </button>
              </div>
            </div>
          ) : null}
          {error ? <p className="mb-3 text-sm font-semibold text-rose-700">{error}</p> : null}

          {expenses.length === 0 ? (
            <p className="text-sm text-ink-mute">
              No expenses yet. Use + to add materials, food and other costs of this job.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="fit-table w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs font-semibold text-ink-mute">
                    <th className="py-2 pr-4 font-semibold">Date</th>
                    <th className="py-2 pr-4 font-semibold">Category</th>
                    <th className="py-2 pr-4 font-semibold">Description</th>
                    <th className="py-2 pr-4 text-right font-semibold">Amount</th>
                    <th className="w-10 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id} className="border-b border-line last:border-0">
                      <td className="py-2.5 pr-4 text-ink-soft">{formatDateNumericLondon(e.spent_on)}</td>
                      <td className="py-2.5 pr-4 text-ink">{categoryLabel(e.category)}</td>
                      <td className="py-2.5 pr-4 text-ink">{e.description || e.vendor || "—"}</td>
                      <td className="py-2.5 pr-4 text-right font-semibold text-ink">{formatGBP(e.amount)}</td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          aria-label="Delete expense"
                          onClick={() => void remove(e.id)}
                          className="grid h-7 w-7 place-items-center rounded text-ink-mute hover:bg-rose-50 hover:text-rose-700"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
