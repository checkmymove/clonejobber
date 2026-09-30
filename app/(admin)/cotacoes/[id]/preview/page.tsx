import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDateLondon, formatPounds } from "@/lib/format";
import { getQuoteDetail } from "@/lib/quotes/queries";
import type { QuoteStop } from "@/lib/quotes/templates";

export const dynamic = "force-dynamic";

const blue = "#3b5bdb";

export default async function QuotePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const q = await getQuoteDetail(id);
  if (!q) notFound();

  const clientName = displayName(q.client_title, q.client_name);
  const headerAddress = q.client_address || q.collection?.address || "";
  const sentLabel = q.sent_at ? formatDateLondon(q.sent_at) : "Not sent yet";
  const money = (pence: number) => formatPounds(pence / 100);

  return (
    <div className="min-h-[calc(100dvh-6.5rem)] rounded-2xl bg-white px-4 py-6 sm:px-8">
      <Link
        href={`/cotacoes/${id}`}
        className="mb-6 inline-flex h-9 items-center text-sm font-bold text-[#3b5bdb] hover:underline"
      >
        ← Back to quote
      </Link>

      <article className="mx-auto max-w-[860px] text-[#1c3d46]">
        <header className="flex items-center gap-3 border-b border-[#e6ebed] pb-4">
          <div
            className="grid h-12 w-12 place-items-center rounded-md text-[11px] font-black text-white"
            style={{ background: "#123035" }}
          >
            ML
          </div>
          <h1 className="text-[22px] font-bold text-[#042b3c]">{q.company_name}</h1>
        </header>

        <section className="mt-6 grid gap-6 border-b border-[#e6ebed] pb-6 sm:grid-cols-[minmax(0,1fr)_220px]">
          <div>
            <p className="text-sm text-[#5d6f78]">Quote {q.number}</p>
            <p className="mt-2 text-[18px] font-bold text-[#042b3c]">{clientName}</p>
            {headerAddress ? <p className="mt-1 text-sm">{headerAddress}</p> : null}
            {q.client_phone ? <p className="text-sm">{q.client_phone}</p> : null}
            {q.deposit > 0 ? (
              <p className="mt-4 text-sm">
                An outstanding deposit of{" "}
                <strong>{money(q.deposit)}</strong> will be required to begin.
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 items-start gap-3 border-t border-[#e6ebed] pt-4 text-sm sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
            <p className="text-[#5d6f78]">Sent on</p>
            <p className="text-right font-semibold">{sentLabel}</p>
          </div>
        </section>

        {q.collection || q.delivery ? (
          <section className="mt-8 grid gap-8 border-b border-[#e6ebed] pb-8 sm:grid-cols-2">
            {q.collection ? <StopBlock title="Collection" stop={q.collection} /> : null}
            {q.delivery ? <StopBlock title="Delivery" stop={q.delivery} /> : null}
          </section>
        ) : null}

        <section className="mt-8 overflow-x-auto">
          <div className="grid min-w-[640px] grid-cols-[minmax(0,1fr)_72px_110px_110px] gap-3 text-sm font-bold text-white">
            {["Product / Service", "Qty.", "Unit Price", "Total"].map((label) => (
              <span key={label} className="rounded-md px-2 py-1" style={{ background: blue }}>
                {label}
              </span>
            ))}
          </div>

          <div className="mt-4 space-y-8">
            {q.lines.map((line, index) => (
              <div
                key={`${line.name}-${index}`}
                className="grid min-w-[640px] grid-cols-[minmax(0,1fr)_72px_110px_110px] gap-3 text-sm"
              >
                <div>
                  <p className="font-bold" style={{ color: blue }}>
                    {line.name}
                  </p>
                  {index === 0 ? (
                    <div className="mt-3 space-y-1 text-[#1c3d46]">
                      <p>
                        <span className="font-bold">Moving Date:</span>{" "}
                        {q.valid_until ? formatDateLondon(q.valid_until) : "—"}
                      </p>
                      <p>
                        <span className="font-bold">Moving Time:</span> {q.move_time?.trim() || "—"}
                      </p>
                      <p>
                        <span className="font-bold">Delivery Address:</span>{" "}
                        {q.delivery?.address || "—"}
                      </p>
                    </div>
                  ) : null}
                  {line.description?.trim() ? (
                    <p className="mt-3 whitespace-pre-wrap leading-6 text-[#3d4f57]">{line.description}</p>
                  ) : null}
                </div>
                <p className="text-right">{line.quantity}</p>
                <p className="text-right">{money(line.unitPrice)}</p>
                <p className="text-right">{money(line.total)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 flex justify-end border-t border-[#e6ebed] pt-4">
          <dl className="w-full max-w-[280px] text-sm">
            <TotalRow label="Subtotal" value={money(q.subtotal)} />
            {q.discount > 0 ? <TotalRow label="Discount" value={money(q.discount)} /> : null}
            {q.tax > 0 ? <TotalRow label="Tax" value={money(q.tax)} /> : null}
            <TotalRow label="Total" value={money(q.total)} strong />
            {q.deposit > 0 ? <TotalRow label="Deposit Required" value={money(q.deposit)} /> : null}
          </dl>
        </section>

        {q.message?.trim() ? (
          <section className="mt-10 border-t border-[#e6ebed] pt-6">
            <h2 className="text-[15px] font-bold text-[#042b3c]">Terms and Conditions</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#3d4f57]">{q.message}</p>
          </section>
        ) : null}
      </article>
    </div>
  );
}

function displayName(title: string, name: string) {
  const honorific = title.trim();
  if (!honorific || honorific.toLowerCase() === "no title") return name;
  const label = honorific.endsWith(".") ? honorific : `${honorific}.`;
  return `${label} ${name}`;
}

function StopBlock({ title, stop }: { title: string; stop: QuoteStop }) {
  const rows: [string, string][] = [
    ["Address", stop.address],
    ["Floor", stop.floor],
    ["Lift", stop.lift],
    ["Parking", stop.parking],
    ["Bedrooms", stop.bedrooms],
  ];
  return (
    <div>
      <h2 className="text-[16px] font-bold text-[#042b3c]">{title}</h2>
      <dl className="mt-3 space-y-1 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
            <dt className="text-[#5d6f78]">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function TotalRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-6 border-b border-[#e6ebed] py-2 ${strong ? "font-bold text-[#042b3c]" : ""}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
