import "server-only";
import { sql } from "@/lib/db";

export type DeliveryRow = {
  id: string;
  to_email: string;
  subject: string;
  status: string;
  error: string | null;
  gmail_message_id: string | null;
  sent_at: string;
};

export async function listDeliveries(
  documentType: "request" | "quote" | "job" | "invoice",
  documentId: string,
): Promise<DeliveryRow[]> {
  return sql<DeliveryRow[]>`
    select id, to_email, subject, status, error, gmail_message_id, sent_at
    from email_deliveries
    where document_type = ${documentType} and document_id = ${documentId}
    order by sent_at desc
    limit 20
  `;
}
