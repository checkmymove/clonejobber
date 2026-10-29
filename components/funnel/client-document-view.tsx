import type { ReactNode } from "react";
import { FileDown } from "lucide-react";
import { formatGBP } from "@/lib/format";
import type { ParsedLine } from "@/lib/funnel/money";
import { Card } from "@/components/ui";

export type ClientDocRow = { label: string; value: ReactNode; strong?: boolean };

/**
 * What the client sees for a job or an invoice, after Jobber's client hub:
 * company header, the document card (number, title, client, dates, status),
 * the Product / Service table, totals and the message, with a PDF download.
 */
export function ClientDocumentView({
  companyName,
  heading,
  title,
  status,
  clientName,
  clientLines,
  facts,
  lines,
  showPrices,
  totals,
  pdfHref,
  children,
}: {
  companyName: string;
  heading: string;
  title: string;
  status?: { label: string; dot: string; badge: string };
  clientName: string;
  clientLines: string[];
  facts: ClientDocRow[];
  lines: ParsedLine[];
  showPrices: boolean;
  totals: ClientDocRow[];
  pdfHref: string;
  children?: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-cream">
      <header className="border-b border-line bg-[#f6f5f1]">
        <div className="mx-auto flex max-w-[1040px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/moving-london-logo.png" alt="" className="h-14 w-14 rounded-md bg-white object-contain" />
            <p className="text-[18px] font-bold text-ink">{companyName}</p>
          </div>
          <a
            href={pdfHref}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-card px-4 text-sm font-bold text-ink hover:bg-white"
          >
            <FileDown size={16} />
            Download PDF
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-[1040px] px-4 py-6 sm:px-6">
        <Card className="p-6 sm:p-8">
          <div className="grid gap-6 border-b-2 border-line pb-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-1">
              <p className="text-[15px] text-ink-soft">{heading}</p>
              {title ? <p className="text-[17px] font-bold text-ink">{title}</p> : null}
              <p className="pt-1 text-[17px] font-bold text-ink">{clientName}</p>
              {clientLines.filter(Boolean).map((line) => (
                <p key={line} className="text-[15px] text-ink">
                  {line}
                </p>
              ))}
            </div>
            <div className="md:border-l md:border-line md:pl-6">
              {status ? (
                <p className="mb-3 flex justify-end">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${status.badge}`}>
                    <span className={`size-2 rounded-full ${status.dot}`} />
                    {status.label}
                  </span>
                </p>
              ) : null}
              <dl className="divide-y divide-line text-[15px]">
                {facts.map((row) => (
                  <div key={row.label} className="grid grid-cols-2 gap-3 py-2">
                    <dt className="text-ink-soft">{row.label}</dt>
                    <dd className="text-ink">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="mt-5 w-full min-w-[560px] text-left text-[15px]">
              <thead>
                <tr className="text-ink">
                  <th className="py-2 pr-4 font-bold">Product / Service</th>
                  <th className="w-20 py-2 pr-4 text-right font-bold">Qty.</th>
                  {showPrices ? (
                    <>
                      <th className="w-32 py-2 pr-4 text-right font-bold">Unit Price</th>
                      <th className="w-32 py-2 text-right font-bold">Total</th>
                    </>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={index} className="border-b border-line align-top last:border-0">
                    <td className="py-3 pr-4">
                      <p className="font-bold text-ink">{line.name}</p>
                      {line.description ? (
                        <p className="mt-1 whitespace-pre-wrap text-ink">{line.description}</p>
                      ) : null}
                    </td>
                    <td className="py-3 pr-4 text-right text-ink">{line.quantity}</td>
                    {showPrices ? (
                      <>
                        <td className="py-3 pr-4 text-right text-ink">{formatGBP(line.unitPrice)}</td>
                        <td className="py-3 text-right text-ink">{formatGBP(line.total)}</td>
                      </>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totals.length ? (
            <dl className="ml-auto mt-4 w-full max-w-[320px] border-t-2 border-line pt-2 text-[15px]">
              {totals.map((row) => (
                <div
                  key={row.label}
                  className={`flex justify-between gap-6 py-2 ${row.strong ? "font-extrabold text-ink" : "text-ink-soft"}`}
                >
                  <dt>{row.label}</dt>
                  <dd className="text-ink">{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {children}
        </Card>
      </div>
    </div>
  );
}
