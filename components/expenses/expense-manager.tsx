"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { openPicker } from "@/components/date-field";
import { buttonDark } from "@/components/ui";
import { formatDateNumericLondon, formatGBP, penceToInput } from "@/lib/format";
import { deleteExpenseAction, saveExpenseAction } from "@/lib/expenses/actions";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_METHODS,
  categoryLabel,
  methodLabel,
  type ExpenseInput,
} from "@/lib/expenses/constants";
import type { ExpenseRow } from "@/lib/expenses/queries";

const field =
  "h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-[#1d4ed8]";

function blank(today: string): ExpenseInput {
  return { spentOn: today, category: "fuel", description: "", vendor: "", amount: "", paymentMethod: "card", jobId: "" };
}

/** Expenses list with the add / edit form above it. */
export function ExpenseManager({
  rows,
  jobs,
  today,
}: {
  rows: ExpenseRow[];
  jobs: { id: string; label: string }[];
  today: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<ExpenseInput>(blank(today));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const set = (patch: Partial<ExpenseInput>) => setDraft((d) => ({ ...d, ...patch }));

  const open = (row: ExpenseRow | null) => {
    setErrors({});
    setMessage(null);
    setEditing(row ? row.id : "new");
    setDraft(
      row
        ? {
            spentOn: row.spent_on,
            category: row.category,
            description: row.description,
            vendor: row.vendor,
            amount: penceToInput(row.amount),
            paymentMethod: row.payment_method,
            jobId: row.job_id ?? "",
          }
        : blank(today),
    );
  };

  const save = async () => {
    setPending(true);
    setMessage(null);
    const result = await saveExpenseAction(editing === "new" ? null : editing, draft);
    setPending(false);
    setErrors(result.errors ?? {});
    if (!result.ok) {
      setMessage(result.message ?? "Could not save.");
      return;
    }
    setEditing(null);
    router.refresh();
  };

  const remove = async (row: ExpenseRow) => {
    if (!window.confirm(`Delete this expense of ${formatGBP(row.amount)}?`)) return;
    const result = await deleteExpenseAction(row.id);
    if (!result.ok) setMessage(result.message ?? "Could not delete.");
    else router.refresh();
  };

  const err = (key: string) => (errors[key] ? <span className="mt-1 block text-xs text-rose-700">{errors[key]}</span> : null);

  return (
    <section className="rounded-2xl border border-line bg-card p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)] sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold tracking-tight text-ink">Expenses this month</h2>
        <button type="button" onClick={() => open(null)} className={buttonDark}>
          <Plus size={17} aria-hidden />
          Add expense
        </button>
      </div>

      {editing ? (
        <div
          className="mt-4 rounded-xl border border-line bg-cream/60 p-4"
          onKeyDown={(event) => {
            if (event.key === "Escape") setEditing(null);
          }}
        >
          <p className="mb-3 text-sm font-bold text-ink">{editing === "new" ? "New expense" : "Edit expense"}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-semibold text-ink-soft">
              Date
              <input type="date" onClick={openPicker} className={`${field} mt-1`} value={draft.spentOn} onChange={(e) => set({ spentOn: e.target.value })} />
              {err("spentOn")}
            </label>
            <label className="text-xs font-semibold text-ink-soft">
              Category
              <select className={`${field} mt-1`} value={draft.category} onChange={(e) => set({ category: e.target.value })}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
              {err("category")}
            </label>
            <label className="text-xs font-semibold text-ink-soft">
              Amount (£)
              <input inputMode="decimal" placeholder="0.00" className={`${field} mt-1`} value={draft.amount} onChange={(e) => set({ amount: e.target.value })} />
              {err("amount")}
            </label>
            <label className="text-xs font-semibold text-ink-soft">
              Paid by
              <select className={`${field} mt-1`} value={draft.paymentMethod} onChange={(e) => set({ paymentMethod: e.target.value })}>
                {EXPENSE_METHODS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-ink-soft sm:col-span-2">
              Description
              <input placeholder="Diesel for the Luton van" className={`${field} mt-1`} value={draft.description} onChange={(e) => set({ description: e.target.value })} />
              {err("description")}
            </label>
            <label className="text-xs font-semibold text-ink-soft">
              Supplier
              <input placeholder="Shell" className={`${field} mt-1`} value={draft.vendor} onChange={(e) => set({ vendor: e.target.value })} />
              {err("vendor")}
            </label>
            <label className="text-xs font-semibold text-ink-soft">
              Job (optional)
              <select className={`${field} mt-1`} value={draft.jobId} onChange={(e) => set({ jobId: e.target.value })}>
                <option value="">No job</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.label}
                  </option>
                ))}
              </select>
              {err("jobId")}
            </label>
          </div>
          {message ? <p className="mt-3 text-sm font-semibold text-rose-700">{message}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="h-10 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink hover:bg-cream"
            >
              Cancel
            </button>
            <button type="button" onClick={save} disabled={pending} className={`${buttonDark} disabled:opacity-60`}>
              {pending ? "Saving…" : "Save expense"}
            </button>
          </div>
        </div>
      ) : message ? (
        <p className="mt-3 text-sm font-semibold text-rose-700">{message}</p>
      ) : null}

      {rows.length === 0 ? (
        <p className="mt-4 rounded-xl bg-cream px-4 py-6 text-center text-sm text-ink-soft">No expenses this month.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="fit-table w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs font-medium text-ink-soft">
                <th className="py-2.5 pr-4 font-medium">Date</th>
                <th className="py-2.5 pr-4 font-medium">Category</th>
                <th className="py-2.5 pr-4 font-medium">Description</th>
                <th className="py-2.5 pr-4 font-medium">Job</th>
                <th className="py-2.5 pr-4 font-medium">Paid by</th>
                <th className="py-2.5 pr-4 text-right font-medium">Amount</th>
                <th className="w-20 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-line last:border-0 hover:bg-cream/50">
                  <td className="py-3 pr-4 whitespace-nowrap text-ink">{formatDateNumericLondon(row.spent_on)}</td>
                  <td data-label="Category" className="py-3 pr-4">
                    <span className="inline-flex rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-[#1d4ed8]">
                      {categoryLabel(row.category)}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <p className="text-ink">{row.description || "—"}</p>
                    {row.vendor ? <p className="text-xs text-ink-soft">{row.vendor}</p> : null}
                  </td>
                  <td data-label="Job" className="py-3 pr-4">
                    {row.job_id ? (
                      <Link href={`/servicos/${row.job_id}`} className="font-medium text-[#1d4ed8] hover:underline">
                        {row.job_number}
                        {row.job_client ? <span className="text-ink-soft"> · {row.job_client}</span> : null}
                      </Link>
                    ) : (
                      <span className="text-ink-mute">—</span>
                    )}
                  </td>
                  <td data-label="Paid by" className="py-3 pr-4 text-ink-soft">{methodLabel(row.payment_method)}</td>
                  <td className="py-3 pr-4 text-right font-semibold whitespace-nowrap text-ink">{formatGBP(row.amount)}</td>
                  <td className="py-3 text-right whitespace-nowrap">
                    <button type="button" onClick={() => open(row)} aria-label="Edit expense" className="inline-grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-cream hover:text-ink">
                      <Pencil size={15} />
                    </button>
                    <button type="button" onClick={() => remove(row)} aria-label="Delete expense" className="inline-grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-rose-50 hover:text-rose-700">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
