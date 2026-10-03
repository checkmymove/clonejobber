"use server";

import { requireAdmin } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { getCompanyId } from "@/lib/company";
import { isUuid } from "@/lib/funnel/validation";
import {
  poundsToPence,
  validateProductInput,
  type Errors,
  type ProductInput,
} from "@/lib/products/validation";

export interface ProductActionResult {
  ok: boolean;
  errors?: Errors;
  message?: string;
}

function readInput(formData: FormData): ProductInput {
  return {
    itemType: String(formData.get("itemType") ?? ""),
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    unitPrice: String(formData.get("unitPrice") ?? ""),
    taxExempt: formData.get("taxExempt") === "on",
    durationMinutes: String(formData.get("durationMinutes") ?? "60"),
    allowQuantity: formData.get("allowQuantity") === "on",
  };
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && e.code === "23505";
}

async function save(id: string | null, formData: FormData): Promise<ProductActionResult> {
  await requireAdmin();
  const input = readInput(formData);
  const errors = validateProductInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const companyId = await getCompanyId();
  if (!companyId) return { ok: false, message: "Company not found." };

  const isService = input.itemType === "service";
  const values = {
    item_type: input.itemType,
    name: input.name.trim(),
    description: input.description.trim(),
    unit_price: poundsToPence(input.unitPrice) ?? 0,
    tax_exempt: input.taxExempt,
    service_duration_minutes: isService ? Number(input.durationMinutes) : 60,
    allow_quantity: isService ? input.allowQuantity : false,
  };

  try {
    if (id) {
      const rows = await sql<{ id: string }[]>`
        update products_services
        set ${sql(values)}, updated_at = now()
        where id = ${id} and company_id = ${companyId}
        returning id
      `;
      if (rows.length === 0) return { ok: false, message: "Item not found." };
    } else {
      await sql`insert into products_services ${sql({ ...values, company_id: companyId })}`;
    }
  } catch (e) {
    if (isUniqueViolation(e)) {
      return { ok: false, errors: { name: "An item with this name already exists" } };
    }
    throw e;
  }

  revalidatePath("/produtos-servicos");
  revalidatePath("/cotacoes/novo");
  return { ok: true };
}

export async function createProduct(
  _prev: ProductActionResult,
  formData: FormData,
): Promise<ProductActionResult> {
  return save(null, formData);
}

export async function updateProduct(
  _prev: ProductActionResult,
  formData: FormData,
): Promise<ProductActionResult> {
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) {
    await requireAdmin();
    return { ok: false, message: "Item not found." };
  }
  return save(id, formData);
}
