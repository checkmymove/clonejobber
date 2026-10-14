"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  Banknote,
  FileText,
  Lock,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { ActionButton, MoreMenu } from "@/components/funnel/more-menu";
import {
  closeJobAction,
  deleteJobAction,
  reopenJobAction,
  setVisitDoneAction,
} from "@/lib/jobs/actions";
import type { JobListStatus } from "@/lib/jobs/status";

export function JobHeaderActions({
  jobId,
  clientId,
  quoteId,
  listStatus,
  closed,
  invoiceCount,
}: {
  jobId: string;
  clientId: string;
  quoteId: string | null;
  listStatus: JobListStatus;
  closed: boolean;
  invoiceCount: number;
}) {
  const router = useRouter();
  const refresh = async <T extends { ok: boolean }>(work: Promise<T>) => {
    const result = await work;
    if (result.ok) router.refresh();
    return result;
  };

  const primary = closed ? (
    listStatus === "requires_invoicing" ? (
      <ActionButton
        label="Create Invoice"
        icon={<FileText size={16} />}
        run={async () => router.push(`/faturas/novo?jobId=${jobId}`)}
      />
    ) : (
      <ActionButton
        label="Re-open Job"
        icon={<RotateCcw size={16} />}
        run={() => refresh(reopenJobAction(jobId))}
      />
    )
  ) : (
    <ActionButton
      label="Close Job"
      icon={<Lock size={16} />}
      confirm="Close this job? Open visits will be marked complete."
      run={() => refresh(closeJobAction(jobId))}
    />
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <MoreMenu
        items={[
          {
            kind: "action",
            label: "Close Job",
            icon: <Lock size={18} />,
            hidden: closed,
            confirm: "Close this job? Open visits will be marked complete.",
            run: () => refresh(closeJobAction(jobId)),
          },
          {
            kind: "action",
            label: "Re-open Job",
            icon: <RotateCcw size={18} />,
            hidden: !closed,
            run: () => refresh(reopenJobAction(jobId)),
          },
          { kind: "link", label: "Edit Job", icon: <Pencil size={18} />, href: `/servicos/${jobId}/editar` },
          {
            kind: "link",
            label: "Create Invoice",
            icon: <FileText size={18} />,
            href: `/faturas/novo?jobId=${jobId}`,
          },
          {
            kind: "link",
            label: "Collect Deposit",
            icon: <Banknote size={18} />,
            hidden: !quoteId,
            href: `/pagamentos/novo?clientId=${clientId}&quoteId=${quoteId ?? ""}&kind=deposit&returnTo=${encodeURIComponent(`/servicos/${jobId}`)}`,
          },
          { kind: "separator" },
          {
            kind: "action",
            label: "Delete",
            icon: invoiceCount ? <Archive size={18} /> : <Trash2 size={18} />,
            danger: true,
            confirm: "Delete this job and its visits? This cannot be undone.",
            run: () => deleteJobAction(jobId),
          },
        ]}
      />
      {primary}
    </div>
  );
}

export function VisitDoneToggle({ visitId, done }: { visitId: string; done: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <input
      type="checkbox"
      aria-label={done ? "Mark visit incomplete" : "Mark visit complete"}
      checked={done}
      disabled={pending}
      onChange={async (event) => {
        setPending(true);
        const result = await setVisitDoneAction(visitId, event.target.checked);
        setPending(false);
        if (result.ok) router.refresh();
      }}
      className="size-4 cursor-pointer accent-[#388623]"
    />
  );
}
