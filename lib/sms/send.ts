import "server-only";
import { sql } from "@/lib/db";
import type { SendKind } from "@/lib/send/types";

export type SmsDeliveryRow = {
  id: string;
  to_phone: string;
  status: string;
  error: string | null;
  sent_at: string;
};

export async function listSmsDeliveries(kind: SendKind, documentId: string): Promise<SmsDeliveryRow[]> {
  if (kind === "quote") {
    return sql<SmsDeliveryRow[]>`
      select id, to_phone, status, error, sent_at
      from sms_deliveries
      where quote_id = ${documentId}
      order by sent_at desc
      limit 20
    `;
  }
  try {
    return await sql<SmsDeliveryRow[]>`
      select id, to_phone, status, error, sent_at
      from sms_deliveries
      where document_type = ${kind} and document_id = ${documentId}
      order by sent_at desc
      limit 20
    `;
  } catch {
    // Before migration 0021 only quotes had texts.
    return [];
  }
}
