"use client";

import { useRouter } from "next/navigation";
import { Mail, Pencil } from "lucide-react";
import { MoreMenu } from "@/components/funnel/more-menu";
import { SendDialog, useSendDialog } from "@/components/funnel/send-dialog";

export function RequestMoreMenu({ requestId }: { requestId: string }) {
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
