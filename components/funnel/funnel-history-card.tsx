import { ExternalLink } from "lucide-react";
import { Card } from "@/components/ui";
import { formatDateNumericLondon } from "@/lib/format";
import { getFunnelHistory, type FunnelStage } from "@/lib/funnel/history";

const STAGE: Record<FunnelStage, { label: string; dot: string }> = {
  client: { label: "Client", dot: "bg-stone-500" },
  request: { label: "Request", dot: "bg-[#b07828]" },
  quote: { label: "Quote", dot: "bg-[#a4445c]" },
  job: { label: "Job", dot: "bg-[#2f7d3b]" },
  invoice: { label: "Invoice", dot: "bg-[#245d8a]" },
  payment: { label: "Payment", dot: "bg-emerald-600" },
};

/**
 * Summary box on funnel pages: the document's history from client to payment.
 * Numbers open in a new browser tab, so the page being worked on stays put.
 */
export async function FunnelHistoryCard({
  clientId,
  requestId,
  quoteId,
  jobId,
  invoiceId,
  currentId,
}: {
  clientId: string;
  requestId?: string | null;
  quoteId?: string | null;
  jobId?: string | null;
  invoiceId?: string | null;
  currentId: string;
}) {
  const steps = await getFunnelHistory({ clientId, requestId, quoteId, jobId, invoiceId });
  return (
    <Card className="h-fit p-5">
      <h2 className="mb-3 text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">Summary</h2>
      <ol className="relative space-y-0">
        {steps.map((s, i) => {
          const current = s.id === currentId;
          return (
            <li key={`${s.stage}-${s.id}`} className="relative flex gap-3 pb-3 last:pb-0">
              {i < steps.length - 1 ? (
                <span aria-hidden className="absolute left-[5px] top-4 h-full w-px bg-line" />
              ) : null}
              <span aria-hidden className={`relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full ${STAGE[s.stage].dot}`} />
              <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p className="min-w-0 text-sm">
                  <span className="font-semibold text-ink-soft">{STAGE[s.stage].label}</span>{" "}
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1 font-bold hover:underline ${current ? "text-ink" : "text-accent"}`}
                    title="Opens in a new tab"
                  >
                    {s.number}
                    <ExternalLink size={12} aria-hidden />
                  </a>
                  {s.stage === "client" || s.detail ? (
                    <span className="text-ink-mute">
                      {" "}
                      · {s.stage === "client" ? s.detail : s.detail.replace(/_/g, " ")}
                    </span>
                  ) : null}
                  {current ? <span className="ml-1 rounded bg-cream px-1.5 py-0.5 text-[11px] font-bold text-ink-soft">this page</span> : null}
                </p>
                <span className="shrink-0 text-xs text-ink-mute">{formatDateNumericLondon(s.at)}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
