import type { ReactNode } from "react";
import { FileDown } from "lucide-react";
import { quoteClientGreeting } from "@/lib/email/templates";
import { formatDateNumericLondon, formatPounds, penceToInput } from "@/lib/format";
import type { QuoteDetail } from "@/lib/quotes/queries";
import type { QuoteStop } from "@/lib/quotes/types";
import { Card } from "@/components/ui";
import { PublicQuoteActions } from "@/components/quotes/public-quote-actions";

function money(pence: number) {
  return formatPounds(pence / 100);
}

function qtyLabel(quantity: number) {
  return Number.isInteger(quantity) ? String(quantity) : String(quantity);
}

function addressLines(quote: QuoteDetail): string[] {
  const street = quote.client_address_line?.trim();
  const city = quote.client_city?.trim();
  const postcode = quote.client_postcode?.trim();
  const locality = [city, city || postcode ? "United Kingdom" : "", postcode].filter(Boolean).join(", ");
  if (street && locality) return [street, locality];
  if (street) return [street];
  if (quote.client_address) return quote.client_address.split(" / ");
  if (quote.collection?.address) return [quote.collection.address];
  return [];
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-[13px] text-ink-soft">{label}</p>
      <div className="min-h-11 rounded-lg border border-line bg-white px-3 py-2.5 text-[15px] text-ink">
        {value || "—"}
      </div>
    </div>
  );
}

function StopCard({ title, stop }: { title: string; stop: QuoteStop | null }) {
  const rows: [string, string][] = [
    ["Address", stop?.address || "—"],
    ["Floor", stop?.floor || "—"],
    ["Lift", stop?.lift || "—"],
    ["Parking", stop?.parking || "—"],
    ["Bedrooms", stop?.bedrooms || "—"],
  ];
  return (
    <Card className="p-5">
      <h2 className="text-[16px] font-extrabold text-ink">{title}</h2>
      <dl className="mt-4 space-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-ink-soft">{label}</dt>
            <dd className="text-right font-semibold text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function Accordion({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="rounded-2xl border border-line bg-card shadow-[0_1px_2px_rgba(18,48,53,0.06)]">
      <summary className="cursor-pointer list-none px-5 py-4 text-[16px] font-extrabold text-ink marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-3">
          {title}
          <span className="text-lg font-normal text-ink-mute">⌄</span>
        </span>
      </summary>
      <div className="border-t border-line px-5 py-4 text-sm leading-6 text-ink">{children}</div>
    </details>
  );
}

export function PublicQuoteView({ quote }: { quote: QuoteDetail }) {
  const name = quoteClientGreeting(quote.client_title, quote.client_name);
  const address = addressLines(quote);
  const packing = quote.packing ?? { service: "No", materials: "No" };

  return (
    <div className="min-h-dvh bg-cream">
      <div className="mx-auto max-w-[980px] px-4 py-6 sm:px-6">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="text-center text-[10px] font-extrabold leading-tight tracking-wide text-ink">
              MOVING
              <br />
              LONDON
            </div>
            <p className="text-[15px] font-semibold text-ink">{quote.company_name}</p>
          </div>
          <a
            href={`/q/${quote.id}/pdf`}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-card px-4 text-sm font-bold text-ink hover:bg-white"
          >
            <FileDown size={16} />
            Download PDF
          </a>
        </header>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <p className="text-[18px] font-extrabold text-ink">{name}</p>
              <span className="h-2 w-2 rounded-full bg-sky-500" aria-hidden />
            </div>
            {address.length ? (
              <div className="mt-2 text-sm leading-6 text-ink-soft">
                {address.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            ) : null}
            {quote.client_phone ? (
              <a href={`tel:${quote.client_phone}`} className="mt-2 block text-sm font-semibold text-accent">
                {quote.client_phone}
              </a>
            ) : null}
            {quote.client_email ? (
              <a href={`mailto:${quote.client_email}`} className="block text-sm font-semibold text-accent">
                {quote.client_email}
              </a>
            ) : null}

            <div className="mt-6 space-y-4">
              <Field label="Title" value={quote.title || "Quote"} />
              <Field
                label="Moving date"
                value={quote.valid_until ? formatDateNumericLondon(quote.valid_until) : "—"}
              />
              <Field label="Moving time" value={quote.move_time?.trim() || "—"} />
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="p-5">
              <p className="text-[15px] font-semibold text-ink">Quote Total</p>
              <p className="mt-1 text-[34px] font-extrabold tracking-tight text-ink">{money(quote.total)}</p>
              {quote.deposit > 0 ? (
                <p className="mt-1 text-sm text-ink-soft">Deposit required: {money(quote.deposit)}</p>
              ) : null}
              <PublicQuoteActions
                quoteId={quote.id}
                status={quote.status}
                archived={Boolean(quote.archived_at)}
                converted={Boolean(quote.job_id)}
              />
            </Card>

            <Card className="p-5">
              <h2 className="text-[16px] font-extrabold text-ink">Packing service</h2>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-soft">Packing services</dt>
                  <dd className="font-semibold text-ink">{packing.service}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-soft">Packing materials</dt>
                  <dd className="font-semibold text-ink">{packing.materials}</dd>
                </div>
              </dl>
            </Card>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <StopCard title="Collection Information" stop={quote.collection} />
          <StopCard title="Delivery Information" stop={quote.delivery} />
        </div>

        <Card className="mt-4 p-5">
          <h2 className="text-[16px] font-extrabold text-ink">Product / Service</h2>
          <div className="mt-4 hidden grid-cols-[minmax(0,1fr)_88px_110px_110px] gap-3 text-[13px] font-semibold text-ink-soft sm:grid">
            <p>Service</p>
            <p className="text-center">Quantity</p>
            <p className="text-center">Unit price</p>
            <p className="text-right">Total</p>
          </div>
          <div className="mt-2 space-y-6">
            {quote.lines.map((line, index) => (
              <div key={`${line.name}-${index}`}>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_88px_110px_110px]">
                  <div className="min-h-11 rounded-lg border border-line bg-white px-3 py-2.5 text-[15px] font-semibold text-ink">
                    {line.name}
                  </div>
                  <div className="min-h-11 rounded-lg border border-line bg-white px-3 py-2.5 text-center text-[15px] text-ink">
                    {qtyLabel(line.quantity)}
                  </div>
                  <div className="min-h-11 rounded-lg border border-line bg-white px-3 py-2.5 text-center text-[15px] text-ink">
                    {penceToInput(line.unitPrice)}
                  </div>
                  <div className="min-h-11 rounded-lg border border-line bg-cream px-3 py-2.5 text-right text-[15px] font-bold text-ink">
                    {money(line.total)}
                  </div>
                </div>
                {line.description?.trim() ? (
                  <div className="mt-3">
                    <p className="mb-1 text-[13px] text-ink-soft">Service summary</p>
                    <div className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-line bg-white px-3 py-3 text-sm leading-6 text-ink">
                      {line.description}
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Card>

        <div className="mt-4 space-y-4">
          <Accordion title="Terms and conditions">
            <p className="max-h-80 overflow-y-auto whitespace-pre-wrap">
              {quote.message?.trim() || "No terms were added to this quote."}
            </p>
          </Accordion>
          <Accordion title="Inventory list">
            <p className="whitespace-pre-wrap">{quote.inventory?.trim() || "—"}</p>
          </Accordion>
        </div>

        <dl className="ml-auto mt-6 w-full max-w-[280px] text-sm">
          <div className="flex justify-between gap-6 py-2">
            <dt className="text-ink-soft">Subtotal</dt>
            <dd className="font-semibold">{money(quote.subtotal)}</dd>
          </div>
          <div className="flex justify-between gap-6 py-2">
            <dt className="text-ink-soft">Discount</dt>
            <dd className="font-semibold">{quote.discount > 0 ? money(quote.discount) : "—"}</dd>
          </div>
          <div className="flex justify-between gap-6 py-2">
            <dt className="text-ink-soft">Tax</dt>
            <dd className="font-semibold">{quote.tax > 0 ? money(quote.tax) : "—"}</dd>
          </div>
          <div className="flex justify-between gap-6 border-t border-line py-3 text-[15px] font-extrabold text-ink">
            <dt>Total</dt>
            <dd>{money(quote.total)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
