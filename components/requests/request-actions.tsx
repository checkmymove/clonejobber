"use client";

import { useRouter } from "next/navigation";
import { Banknote, Mail, Pencil } from "lucide-react";
import { MoreMenu } from "@/components/funnel/more-menu";
import { SendDialog, useSendDialog } from "@/components/funnel/send-dialog";

export function RequestMoreMenu({
  requestId,
  clientId,
  quoteId,
}: {
  requestId: string;
  clientId: string;
  /** The request's quote, when there is one: a deposit is recorded against a quote. */
  quoteId?: string | null;
}) {
  const router = useRouter();
  const sender = useSendDialog();
  return (
    <>
      <MoreMenu
        items={[
          {
            kind: "action",
            label: "Send email & text",
            icon: <Mail size={18} />,
            run: () => sender.open("request", requestId),
          },
          { kind: "link", label: "Edit Request", icon: <Pencil size={18} />, href: `/solicitacoes/${requestId}/editar` },
          {
            kind: "link",
            label: "Collect Deposit",
            icon: <Banknote size={18} />,
            href: `/pagamentos/novo?${new URLSearchParams({
              clientId,
              ...(quoteId ? { quoteId } : {}),
              kind: "deposit",
              returnTo: `/solicitacoes/${requestId}`,
            })}`,
          },
        ]}
      />
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
    </>
  );
}
