"use client";

import { useRouter } from "next/navigation";
import {
  Ban,
  Banknote,
  CheckCircle,
  Eye,
  FileDown,
  Lock,
  Mail,
  Pencil,
  RotateCcw,
  Send,
  ShieldOff,
  Trash2,
} from "lucide-react";
import { ActionButton, MoreMenu } from "@/components/funnel/more-menu";
import { SendDialog, useSendDialog } from "@/components/funnel/send-dialog";
import {
  badDebtInvoiceAction,
  closeInvoiceAction,
  deleteInvoiceAction,
  reopenInvoiceAction,
  updateInvoiceStatus,
  voidInvoiceAction,
} from "@/lib/invoices/actions";

export function InvoiceHeaderActions({
  invoiceId,
  clientId,
  status,
  balance,
  paymentCount,
}: {
  invoiceId: string;
  clientId: string;
  /** Stored status: draft, sent, overdue, paid, bad_debt, cancelled. */
  status: string;
  balance: number;
  paymentCount: number;
}) {
  const router = useRouter();
  const sender = useSendDialog();
  const refresh = async <T extends { ok: boolean }>(work: Promise<T>) => {
    const result = await work;
    if (result.ok) router.refresh();
    return result;
  };
  const open = status === "draft" || status === "sent" || status === "overdue";
  const collectHref = `/pagamentos/novo?clientId=${clientId}&invoiceId=${invoiceId}&returnTo=${encodeURIComponent(`/faturas/${invoiceId}`)}`;

  let primary: React.ReactNode = null;
  if (open && balance > 0) {
    primary = (
      <ActionButton
        label="Collect Payment"
        icon={<Banknote size={16} />}
        run={async () => router.push(collectHref)}
      />
    );
  } else if (status === "paid" || status === "bad_debt") {
    primary = (
      <ActionButton
        label="Re-open Invoice"
        icon={<RotateCcw size={16} />}
        run={() => refresh(reopenInvoiceAction(invoiceId))}
      />
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <MoreMenu
        items={[
          {
            kind: "action",
            label: "Send email & text",
            icon: <Mail size={18} />,
            hidden: status === "cancelled",
            run: () => sender.open("invoice", invoiceId),
          },
          {
            kind: "action",
            label: "Mark as Sent",
            icon: <Send size={18} />,
            hidden: status !== "draft",
            run: () => refresh(updateInvoiceStatus(invoiceId, "sent")),
          },
          {
            kind: "link",
            label: "Edit Invoice",
            icon: <Pencil size={18} />,
            hidden: status === "cancelled",
            href: `/faturas/${invoiceId}/editar`,
          },
          {
            kind: "link",
            label: "Preview as Client",
            icon: <Eye size={18} />,
            href: `/i/${invoiceId}`,
            file: true,
          },
          {
            kind: "link",
            label: "Print or Save PDF",
            icon: <FileDown size={18} />,
            href: `/api/invoices/${invoiceId}/pdf`,
            file: true,
          },
          {
            kind: "link",
            label: "Collect Payment",
            icon: <Banknote size={18} />,
            hidden: !open || balance <= 0,
            href: collectHref,
          },
          { kind: "separator", hidden: !open },
          {
            kind: "action",
            label: "Close Invoice (no payment)",
            icon: <CheckCircle size={18} />,
            hidden: !open,
            confirm: "Mark this invoice as paid without recording a payment?",
            run: () => refresh(closeInvoiceAction(invoiceId)),
          },
          {
            kind: "action",
            label: "Close as Bad Debt",
            icon: <ShieldOff size={18} />,
            hidden: !(status === "sent" || status === "overdue") || balance <= 0,
            confirm: "Write off the remaining balance as bad debt?",
            run: () => refresh(badDebtInvoiceAction(invoiceId)),
          },
          {
            kind: "action",
            label: "Re-open Invoice",
            icon: <RotateCcw size={18} />,
            hidden: !(status === "paid" || status === "bad_debt"),
            run: () => refresh(reopenInvoiceAction(invoiceId)),
          },
          {
            kind: "action",
            label: "Void Invoice",
            icon: <Ban size={18} />,
            hidden: status === "cancelled" || paymentCount > 0,
            confirm: "Void this invoice? It stays for your records but can no longer be edited, sent or paid.",
            run: () => refresh(voidInvoiceAction(invoiceId)),
          },
          { kind: "separator" },
          {
            kind: "action",
            label: "Delete",
            icon: paymentCount ? <Lock size={18} /> : <Trash2 size={18} />,
            danger: true,
            confirm: "Delete this invoice? This cannot be undone.",
            run: () => deleteInvoiceAction(invoiceId),
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
