import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui";
import { EqualHeightBody } from "@/components/equal-height";
import { formatDateNumericLondon, formatGBP } from "@/lib/format";
import type { ParsedLine } from "@/lib/funnel/money";
import { paymentMethodLabel } from "@/lib/payments/constants";
import type { QuoteDepositSummary } from "@/lib/payments/queries";

/** Read-only cards shared by the Job and Invoice detail pages (Jobber layout). */

export function CardTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-2">
      <h2 className="text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">{children}</h2>
      {action}
    </div>
  );
}

export function ClientBox({
  clientId,
  name,
  address,
  addressLabel = "Property address",
  phone,
  email,
}: {
  clientId: string;
  name: string;
  address: string;
  addressLabel?: string;
  phone: string;
  email: string;
}) {
  return (
    <Card className="h-fit p-5">
      <CardTitle>Client</CardTitle>
      <EqualHeightBody label="client">
      <Link href={`/clientes/${clientId}`} className="text-lg font-extrabold text-ink hover:underline">
        {name}
      </Link>
      <div className="mt-3 space-y-3 text-sm [overflow-wrap:anywhere]">
        <div>
          <p className="text-ink-soft">{addressLabel}</p>
          <p className="text-ink">{address || "—"}</p>
        </div>
        <div className="space-y-0.5">
          {phone ? (
            <a href={`tel:${phone}`} className="block font-semibold text-accent underline">
              {phone}
            </a>
          ) : null}
          {email ? (
            <a href={`mailto:${email}`} className="block font-semibold text-accent underline">
              {email}
            </a>
          ) : null}
        </div>
      </div>
      </EqualHeightBody>
    </Card>
  );
}

export function DetailRows({ title, rows }: { title: string; rows: [string, ReactNode][] }) {
  return (
    <Card className="h-fit p-5">
      <CardTitle>{title}</CardTitle>
      <EqualHeightBody label={title.toLowerCase()}>
        <dl className="divide-y divide-line text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[9.5rem_1fr] gap-3 py-2">
              <dt className="text-ink-soft">{label}</dt>
              <dd className="font-semibold text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </EqualHeightBody>
    </Card>
  );
}

/** Address card for a document that has no linked request (no floor/lift details). */
export function AddressCard({ title, address }: { title: string; address: string }) {
  return (
    <Card className="h-fit p-5">
      <CardTitle>{title}</CardTitle>
      <EqualHeightBody label={title.toLowerCase()}>
        <p className="text-sm text-ink">{address || "—"}</p>
      </EqualHeightBody>
    </Card>
  );
}

export type TotalRow = {
  label: ReactNode;
  value: string;
  strong?: boolean;
  muted?: boolean;
  highlight?: boolean;
};

export function LineItemsCard({
  lines,
  totals,
  action,
}: {
  lines: ParsedLine[];
  totals: TotalRow[];
  action?: ReactNode;
}) {
  return (
    <Card className="h-fit p-5 xl:col-span-2">
      <CardTitle action={action}>Product / Service</CardTitle>
      <div className="overflow-x-auto">
        <table className="w-full fit-table text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs font-semibold text-ink-mute">
              <th className="py-2 pr-4 font-semibold">Line item</th>
              <th className="w-24 py-2 pr-4 text-right font-semibold">Quantity</th>
              <th className="w-28 py-2 pr-4 text-right font-semibold">Unit price</th>
              <th className="w-28 py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={index} className="border-b border-line align-top last:border-0">
                <td className="py-3 pr-4">
                  <p className="font-bold text-ink">{line.name}</p>
                  {line.description ? (
                    <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap text-ink-soft">
                      {line.description}
                    </p>
                  ) : null}
                </td>
                <td data-label="Quantity" className="py-3 pr-4 text-right text-ink">{line.quantity}</td>
                <td data-label="Unit price" className="py-3 pr-4 text-right text-ink">{formatGBP(line.unitPrice)}</td>
                <td className="py-3 text-right font-semibold text-ink">{formatGBP(line.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TotalsList totals={totals} className="mt-4 ml-auto max-w-sm border-t" />
    </Card>
  );
}

function TotalsList({ totals, className = "" }: { totals: TotalRow[]; className?: string }) {
  return (
    <div className={`divide-y divide-line border-line text-sm ${className}`}>
      {totals.map((row, index) => (
        <div
          key={index}
          className={`flex justify-between gap-4 px-2 py-2 ${row.highlight ? "rounded-lg bg-[#f6f7f8]" : ""} ${
            row.strong ? "font-extrabold text-ink" : row.muted ? "text-ink-soft" : "text-ink"
          }`}
        >
          <span>{row.label}</span>
          <span>{row.value}</span>
        </div>
      ))}
    </div>
  );
}

export function TotalsCard({ title = "Totals", totals }: { title?: string; totals: TotalRow[] }) {
  return (
    <Card className="h-fit p-5 xl:col-span-2">
      <CardTitle>{title}</CardTitle>
      <TotalsList totals={totals} className="ml-auto max-w-sm" />
    </Card>
  );
}

/** Required deposit, each deposit collected, and what is still outstanding. */
export function depositTotalRows(deposits: QuoteDepositSummary, alwaysShowRequired = false): TotalRow[] {
  return [
    ...(deposits.required || alwaysShowRequired
      ? [{ label: "Required deposit", value: formatGBP(deposits.required), muted: true }]
      : []),
    ...deposits.deposits.map((d) => ({
      label: (
        <Link href={`/pagamentos/${d.id}`} className="text-accent underline">
          Deposit collected · {formatDateNumericLondon(d.paid_on)} · {paymentMethodLabel(d.method)}
        </Link>
      ),
      value: `-${formatGBP(d.amount)}`,
      muted: true,
    })),
    {
      label: "Outstanding deposit",
      value: formatGBP(Math.max(0, deposits.required - deposits.collected)),
      highlight: true,
    },
  ];
}

export function dateOrDash(value: string | Date | null | undefined): string {
  return value ? formatDateNumericLondon(value) : "—";
}
