"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { getCompanyId } from "@/lib/company";
import { sql } from "@/lib/db";
import { validateExpense, type ExpenseInput } from "./constants";
import { isMissingExpensesTable } from "./queries";

export type ExpenseActionResult = { ok: boolean; message?: string; errors?: Record<string, string> };

const MISSING = "Expenses need the latest database update. Run npm run migrate first.";

/** Check constraint failed: a category (e.g. Food & meals) the database doesn't know yet. */
function isCheckViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "23514";
}

function refresh(jobId?: string | null) {
  revalidatePath("/despesas");
  revalidatePath("/relatorios");
  if (jobId) revalidatePath(`/servicos/${jobId}`);
}

/** Adds an expense (id null) or updates one, scoped to the company. */
export async function saveExpenseAction(id: string | null, input: ExpenseInput): Promise<ExpenseActionResult> {
  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };
  const parsed = validateExpense(input);
  if (!parsed.ok) return { ok: false, errors: parsed.errors, message: Object.values(parsed.errors)[0] };
  const e = parsed.value;
  try {
    if (e.jobId) {
      const job = await sql`select 1 from jobs where id = ${e.jobId} and company_id = ${companyId}`;
      if (!job[0]) return { ok: false, errors: { jobId: "Job not found" }, message: "Job not found." };
    }
    if (id) {
      const rows = await sql`
        update expenses set spent_on = ${e.spentOn}, category = ${e.category}, description = ${e.description},
               vendor = ${e.vendor}, amount = ${e.amount}, payment_method = ${e.paymentMethod},
               job_id = ${e.jobId}, updated_at = now()
        where id = ${id} and company_id = ${companyId}
        returning id
      `;
      if (!rows[0]) return { ok: false, message: "Expense not found." };
    } else {
      await sql`
        insert into expenses (company_id, spent_on, category, description, vendor, amount, payment_method, job_id)
        values (${companyId}, ${e.spentOn}, ${e.category}, ${e.description}, ${e.vendor}, ${e.amount},
                ${e.paymentMethod}, ${e.jobId})
      `;
    }
  } catch (error) {
    if (isMissingExpensesTable(error) || isCheckViolation(error)) return { ok: false, message: MISSING };
    throw error;
  }
  refresh(e.jobId);
  return { ok: true };
}

export async function deleteExpenseAction(id: string): Promise<ExpenseActionResult> {
  await requireAdmin();
  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };
  try {
    const rows = await sql`delete from expenses where id = ${id} and company_id = ${companyId} returning id`;
    if (!rows[0]) return { ok: false, message: "Expense not found." };
  } catch (error) {
    if (isMissingExpensesTable(error)) return { ok: false, message: MISSING };
    throw error;
  }
  refresh();
  return { ok: true };
}
