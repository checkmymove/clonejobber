"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  Banknote,
  Eye,
  FileDown,
  FileText,
  Lock,
  Mail,
  Pencil,
  RotateCcw,
  Send,
  Trash2,
} from "lucide-react";
import { ActionButton, MoreMenu } from "@/components/funnel/more-menu";
import { SendDialog, useSendDialog } from "@/components/funnel/send-dialog";
import { openCompleteVisit } from "@/components/jobs/complete-visit-dialog";
import { savePendingSchedule } from "@/components/jobs/job-schedule-card";
import {
  closeJobAction,
  deleteJobAction,
  reopenJobAction,
  setVisitDoneAction,
} from "@/lib/jobs/actions";

export function JobHeaderActions({
  jobId,
  clientId,
  quoteId,
  closed,
  invoiceCount,
  sent = false,
}: {
  jobId: string;
  clientId: string;
  quoteId: string | null;
  closed: boolean;
  invoiceCount: number;
  /** Booking confirmation already emailed: offer to send it again. */
  sent?: boolean;
}) {
  const router = useRouter();
  const sender = useSendDialog();
  const refresh = async <T extends { ok: boolean }>(work: Promise<T>) => {
    const result = await work;
    if (result.ok) router.refresh();
    return result;
  };

  // An unsaved Schedule (date, times, team picked but Save not clicked) is saved first,
  // creating the visit, so the confirmation goes out with it.
  const sendConfirmation = async () => {
    const saved = await savePendingSchedule();
    if (!saved.ok) return saved;
    return sender.open("job", jobId);
  };

  // Before invoicing, the job's main action is the booking confirmation (email & text).
  const primary =
    invoiceCount === 0 ? (
      <ActionButton
        label={sent ? "Resend Job Confirmation" : "Send Job Confirmation"}
        icon={<Send size={16} />}
        run={sendConfirmation}
      />
    ) : closed ? (
      <ActionButton
        label="Re-open Job"
        icon={<RotateCcw size={16} />}
        run={() => refresh(reopenJobAction(jobId))}
      />
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
          {
            kind: "link",
            label: "Create Invoice",
            icon: <FileText size={18} />,
            hidden: invoiceCount > 0,
            href: `/faturas/novo?jobId=${jobId}`,
          },
          { kind: "link", label: "Edit Job", icon: <Pencil size={18} />, href: `/servicos/${jobId}/editar` },
          {
            kind: "action",
            label: sent ? "Resend Email and Text" : "Send email & text",
            icon: <Mail size={18} />,
            run: sendConfirmation,
          },
          { kind: "link", label: "Preview as Client", icon: <Eye size={18} />, href: `/j/${jobId}`, file: true },
          {
            kind: "link",
            label: "Print or Save PDF",
            icon: <FileDown size={18} />,
            href: `/api/jobs/${jobId}/pdf`,
            file: true,
          },
          {
            kind: "link",
            label: "Collect Deposit",
            icon: <Banknote size={18} />,
            href: `/pagamentos/novo?${new URLSearchParams({
              clientId,
              ...(quoteId ? { quoteId } : {}),
              kind: "deposit",
              returnTo: `/servicos/${jobId}`,
            })}`,
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
      {sender.draft ? (
        <SendDialog
          draft={sender.draft}
          onClose={sender.close}
          onDone={() => {
            sender.close();
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

/** Ticking opens the complete-visit dialog (invoice, close job); unticking reopens the visit. */
export function VisitDoneToggle({ visitId, done }: { visitId: string; done: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <input
      type="checkbox"
      aria-label={done ? "Mark visit incomplete" : "Mark visit complete"}
      aria-haspopup={done ? undefined : "dialog"}
      checked={done}
      disabled={pending}
      onChange={async (event) => {
        if (event.target.checked) {
          openCompleteVisit(visitId);
          return;
        }
        setPending(true);
        const result = await setVisitDoneAction(visitId, false);
        setPending(false);
        if (result.ok) router.refresh();
      }}
      className="size-4 cursor-pointer accent-[#388623]"
    />
  );
}
