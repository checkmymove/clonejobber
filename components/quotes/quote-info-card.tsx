import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { Card, Badge } from "@/components/ui";
import { CARD_TITLE, CardIcon } from "@/components/card-icon";
const day = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/London" });

/** "Quote information": number, where it came from, its status and dates. */
export function QuoteInfoCard({
  number,
  status,
  statusLabel,
  archived,
  createdAt,
  requestId,
  requestNumber,
  clientId,
  clientNumber,
  clientName,
  jobId,
}: {
  number: string;
  status: string;
  statusLabel: string;
  archived: boolean;
  createdAt: string | Date;
  requestId: string | null;
  requestNumber: string | null;
  clientId: string;
  clientNumber: number | null;
  clientName: string;
  jobId: string | null;
}) {
  const row = "flex items-center justify-between gap-4 py-1.5";
  const link = "font-medium text-[#1d4ed8] underline-offset-2 hover:underline";
  return (
    <Card className="self-stretch p-5">
      <div className="mb-3 flex items-center gap-3">
        <CardIcon icon={ClipboardList} tone="blue" />
        <h2 className={CARD_TITLE}>Quote information</h2>
      </div>
      <div className="text-sm">
        <p className={row}>
          <span className="text-ink-soft">Quote number</span>
          <span className="font-bold text-ink">{number}</span>
        </p>
        <p className={row}>
          <span className="text-ink-soft">Related request</span>
          {requestId ? (
            <Link href={`/solicitacoes/${requestId}`} className={`${link} underline`}>
              {requestNumber}
            </Link>
          ) : (
            <span className="text-ink">—</span>
          )}
        </p>
        <p className={row}>
          <span className="text-ink-soft">Client</span>
          <Link href={`/clientes/${clientId}`} className={link}>
            {clientNumber ? `#${clientNumber} - ` : ""}
            {clientName}
          </Link>
        </p>
        <p className={row}>
          <span className="text-ink-soft">Status</span>
          <span className="flex gap-1.5">
            <Badge tone={status}>{statusLabel}</Badge>
            {archived ? <Badge tone="archived">Archived</Badge> : null}
          </span>
        </p>
        <p className={row}>
          <span className="text-ink-soft">Created</span>
          <span className="text-ink">{day.format(new Date(createdAt))}</span>
        </p>
        {jobId ? (
          <p className={row}>
            <span className="text-ink-soft">Job</span>
            <Link href={`/servicos/${jobId}`} className={link}>
              View job
            </Link>
          </p>
        ) : null}
      </div>
    </Card>
  );
}
