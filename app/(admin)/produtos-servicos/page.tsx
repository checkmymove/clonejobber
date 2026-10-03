import { notFound } from "next/navigation";
import { getCompanyId } from "@/lib/company";
import { penceToInput } from "@/lib/format";
import { listProducts, type ProductSort } from "@/lib/products/queries";
import { ProductsManager } from "@/components/products/products-manager";

export const dynamic = "force-dynamic";

export default async function ProductsServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; dir?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 100);
  const sort: ProductSort = sp.sort === "type" ? "type" : "name";
  const dir = sp.dir === "desc" ? "desc" : "asc";

  const companyId = await getCompanyId();
  if (!companyId) notFound();
  const rows = await listProducts(companyId, q, sort, dir);

  return (
    <div className="min-h-[calc(100dvh-6.5rem)] rounded-2xl bg-white px-6 py-8 sm:px-10">
      <ProductsManager
        q={q}
        sort={sort}
        dir={dir}
        items={rows.map((r) => ({
          id: r.id,
          itemType: r.item_type,
          name: r.name,
          description: r.description,
          unitPrice: penceToInput(r.unit_price),
          taxExempt: r.tax_exempt,
          durationMinutes: r.service_duration_minutes,
          allowQuantity: r.allow_quantity,
        }))}
      />
    </div>
  );
}
