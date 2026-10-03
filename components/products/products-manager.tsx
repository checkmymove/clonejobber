"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { ChevronsUpDown, Plus, Search, X } from "lucide-react";
import {
  createProduct,
  updateProduct,
  type ProductActionResult,
} from "@/lib/products/actions";
import { DURATION_OPTIONS } from "@/lib/products/validation";

export type ProductItem = {
  id: string;
  itemType: "service" | "product";
  name: string;
  description: string;
  unitPrice: string;
  taxExempt: boolean;
  durationMinutes: number;
  allowQuantity: boolean;
};

const INK = "#042b3c";
const GREEN = "#388623";
const initial: ProductActionResult = { ok: false };

function typeLabel(t: string) {
  return t === "product" ? "Product" : "Service";
}

function sortHref(q: string, sort: string, dir: string, column: string) {
  const next = sort === column && dir === "asc" ? "desc" : "asc";
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("sort", column);
  params.set("dir", next);
  return `?${params.toString()}`;
}

export function ProductsManager({
  items,
  q,
  sort,
  dir,
}: {
  items: ProductItem[];
  q: string;
  sort: string;
  dir: string;
}) {
  const [dialog, setDialog] = useState<{ item: ProductItem | null } | null>(null);

  return (
    <div>
      <h1 className="text-[40px] font-bold leading-tight tracking-tight" style={{ color: INK }}>
        Products &amp; services
      </h1>
      <p className="mt-6 text-[15px] text-[#1c3d46]">
        Add and update your products &amp; services to stay organized when creating quotes, jobs,
        and invoices.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <form method="get" className="relative w-full max-w-[500px]">
          {sort !== "name" || dir !== "asc" ? (
            <>
              <input type="hidden" name="sort" value={sort} />
              <input type="hidden" name="dir" value={dir} />
            </>
          ) : null}
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#5d6f78]" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search"
            aria-label="Search products and services"
            className="h-[50px] w-full rounded-xl border border-[#d5dde1] bg-white pl-12 pr-12 text-[15px] outline-none focus:border-[#388623] [&::-webkit-search-cancel-button]:hidden"
            style={{ color: INK }}
          />
          {q ? (
            <Link
              href="?"
              aria-label="Clear search"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#5d6f78] hover:text-[#042b3c]"
            >
              <X size={18} />
            </Link>
          ) : null}
        </form>
        <button
          type="button"
          onClick={() => setDialog({ item: null })}
          className="inline-flex h-10 items-center gap-2 rounded-lg px-4 text-[15px] font-semibold text-white hover:opacity-90"
          style={{ background: GREEN }}
        >
          <Plus size={18} />
          Add Item
        </button>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-[#d5dde1]">
        <table className="w-full min-w-[720px] table-fixed text-left text-[15px]">
          <colgroup>
            <col className="w-[40%]" />
            <col className="w-[42%]" />
            <col className="w-[18%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-[#e6ebed] text-[15px] font-bold shadow-[0_2px_4px_rgba(4,43,60,0.06)]" style={{ color: INK }}>
              <th className="px-5 py-5 font-bold">
                <Link href={sortHref(q, sort, dir, "name")} className="inline-flex items-center gap-1">
                  Name <ChevronsUpDown size={15} className="text-[#5d6f78]" />
                </Link>
              </th>
              <th className="px-5 py-5 font-bold">Description</th>
              <th className="px-5 py-5 font-bold">
                <Link href={sortHref(q, sort, dir, "type")} className="inline-flex items-center gap-1">
                  Type <ChevronsUpDown size={15} className="text-[#5d6f78]" />
                </Link>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-5 py-10 text-center text-[#5d6f78]">
                  {q
                    ? `No products or services match “${q}”.`
                    : "No products or services yet. Click Add Item to create your first one."}
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => setDialog({ item })}
                  className="cursor-pointer border-b border-[#e6ebed] last:border-0 hover:bg-[#f7f8f8]"
                >
                  <td className="px-5 py-5 align-top font-bold" style={{ color: INK }}>
                    {item.name}
                  </td>
                  <td className="px-5 py-5 align-top text-[#1c3d46]">
                    <p className="line-clamp-2 whitespace-pre-line break-words">{item.description}</p>
                  </td>
                  <td className="px-5 py-5 align-top text-[#1c3d46]">{typeLabel(item.itemType)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {dialog ? (
        <ItemDialog key={dialog.item?.id ?? "new"} item={dialog.item} onClose={() => setDialog(null)} />
      ) : null}
    </div>
  );
}

function FloatingField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className={`block rounded-lg border bg-white px-3 pb-2 pt-1.5 focus-within:border-[#388623] ${
          error ? "border-[#c0392b]" : "border-[#d5dde1]"
        }`}
      >
        <span className="block text-[12px] text-[#5d6f78]">{label}</span>
        {children}
      </label>
      {error ? <p className="mt-1 text-[13px] text-[#c0392b]">{error}</p> : null}
    </div>
  );
}

function ItemDialog({ item, onClose }: { item: ProductItem | null; onClose: () => void }) {
  const editing = Boolean(item);
  const [state, action, pending] = useActionState(editing ? updateProduct : createProduct, initial);
  const [itemType, setItemType] = useState<string>(item?.itemType ?? "service");
  const errors = state.errors ?? {};

  useEffect(() => {
    if (state.ok) onClose();
  }, [state, onClose]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const inputCls = "block w-full bg-transparent text-[15px] outline-none";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#123035]/45 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-dialog-title"
        onClick={(event) => event.stopPropagation()}
        className="max-h-[calc(100dvh-2rem)] w-full max-w-[575px] overflow-y-auto rounded-2xl bg-white px-6 py-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="product-dialog-title" className="text-[24px] font-bold tracking-tight" style={{ color: INK }}>
            {editing ? "Edit Product/Service" : "Add New Product/Service"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-lg text-[#5d6f78] hover:bg-[#f4f6f7]"
          >
            <X size={20} />
          </button>
        </div>

        <form action={action} className="mt-6 space-y-4" style={{ color: INK }}>
          {item ? <input type="hidden" name="id" value={item.id} /> : null}

          <FloatingField label="Item type" error={errors.itemType}>
            <select
              name="itemType"
              value={itemType}
              onChange={(e) => setItemType(e.target.value)}
              className={inputCls}
            >
              <option value="service">Service</option>
              <option value="product">Product</option>
            </select>
          </FloatingField>

          <div>
            <input
              name="name"
              defaultValue={item?.name ?? ""}
              placeholder="Name"
              aria-label="Name"
              maxLength={120}
              className={`h-[50px] w-full rounded-lg border bg-white px-3 text-[15px] outline-none focus:border-[#388623] ${
                errors.name ? "border-[#c0392b]" : "border-[#d5dde1]"
              }`}
            />
            {errors.name ? <p className="mt-1 text-[13px] text-[#c0392b]">{errors.name}</p> : null}
          </div>

          <div>
            <textarea
              name="description"
              defaultValue={item?.description ?? ""}
              placeholder="Description"
              aria-label="Description"
              rows={4}
              maxLength={4000}
              className={`w-full resize-y rounded-lg border bg-white px-3 py-3 text-[15px] outline-none focus:border-[#388623] ${
                errors.description ? "border-[#c0392b]" : "border-[#d5dde1]"
              }`}
            />
            {errors.description ? (
              <p className="mt-1 text-[13px] text-[#c0392b]">{errors.description}</p>
            ) : null}
          </div>

          <FloatingField label="Unit Price (£)" error={errors.unitPrice}>
            <input
              name="unitPrice"
              inputMode="decimal"
              defaultValue={item?.unitPrice ?? "0.00"}
              className={inputCls}
            />
          </FloatingField>

          <label className="flex items-center gap-3 text-[15px]">
            <input
              type="checkbox"
              name="taxExempt"
              defaultChecked={item?.taxExempt ?? false}
              className="h-[18px] w-[18px] accent-[#388623]"
            />
            Exempt from Tax
          </label>

          {itemType === "service" ? (
            <div className="border-t border-[#e6ebed] pt-5">
              <h3 className="text-[18px] font-bold">Online Booking</h3>
              <p className="mt-2 text-[15px] text-[#1c3d46]">
                These settings are only available for online booking.{" "}
                <Link href="/solicitacoes" className="font-medium text-[#388623] underline">
                  Manage in requests and bookings
                </Link>
              </p>
              <div className="mt-4 space-y-4">
                <FloatingField label="Service Duration" error={errors.durationMinutes}>
                  <select
                    name="durationMinutes"
                    defaultValue={String(item?.durationMinutes ?? 60)}
                    className={inputCls}
                  >
                    {DURATION_OPTIONS.map((o) => (
                      <option key={o.minutes} value={o.minutes}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </FloatingField>
                <label className="flex items-start gap-3 text-[15px]">
                  <input
                    type="checkbox"
                    name="allowQuantity"
                    defaultChecked={item?.allowQuantity ?? false}
                    className="mt-1 h-[18px] w-[18px] accent-[#388623]"
                  />
                  <span>
                    Allow customers to select quantity
                    <span className="block text-[13px] text-[#5d6f78]">
                      Duration and unit price will scale based on quantity. (e.g. 15min x 4 = 1h)
                    </span>
                  </span>
                </label>
              </div>
            </div>
          ) : null}

          {state.message ? <p className="text-[14px] text-[#c0392b]">{state.message}</p> : null}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-lg border border-[#d5dde1] px-5 text-[15px] font-semibold hover:bg-[#f7f8f8]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="h-11 rounded-lg px-6 text-[15px] font-semibold text-white hover:opacity-90 disabled:opacity-60"
              style={{ background: GREEN }}
            >
              {pending ? "Saving…" : editing ? "Save" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
