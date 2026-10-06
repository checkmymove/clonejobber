import { penceToInput, toDateInput } from "@/lib/format";

export function jobSnapshotFromDetail(j: {
  id: string;
  client_id: string;
  quote_id: string | null;
  request_id: string | null;
  title: string;
  notes: string;
  pickup_address: string;
  delivery_address: string;
  remind_invoice: boolean;
  quote_number: string | null;
  total: number;
  scheduled_date: string | Date | null;
  anytime: boolean;
  window_start: string;
  window_end: string;
  visits: {
    id: string;
    title: string;
    visit_date: string | Date | null;
    start_time: string;
    end_time: string;
    anytime: boolean;
    later: boolean;
    assignee: string;
    instructions: string;
  }[];
  lines: { name: string; description: string; quantity: number; unitPrice: number }[];
}) {
  const window = j.anytime ? "Anytime" : `${j.window_start || "—"} – ${j.window_end || "—"}`;
  return {
    id: j.id,
    clientId: j.client_id,
    quoteId: j.quote_id ?? undefined,
    requestId: j.request_id ?? undefined,
    title: j.title,
    notes: j.notes,
    pickupAddress: j.pickup_address,
    deliveryAddress: j.delivery_address,
    remindInvoice: j.remind_invoice,
    quoteNumber: j.quote_number ?? "Direct",
    total: j.total,
    scheduledDate: toDateInput(j.scheduled_date),
    window,
    visits:
      j.visits.length > 0
        ? j.visits.map((visit) => ({
            id: visit.id,
            title: visit.title,
            date: toDateInput(visit.visit_date),
            later: visit.later,
            start: visit.start_time,
            end: visit.end_time,
            anytime: visit.anytime,
            assignee: visit.assignee,
            instructions: visit.instructions,
          }))
        : [
            {
              id: "visit-fallback",
              title: "",
              date: toDateInput(j.scheduled_date),
              later: !j.scheduled_date,
              start: j.window_start,
              end: j.window_end,
              anytime: j.anytime,
              assignee: "",
              instructions: "",
            },
          ],
    lines: j.lines.map((line, index) => ({
      id: `job-line-${index}`,
      name: line.name,
      description: line.description,
      qty: String(line.quantity),
      price: penceToInput(line.unitPrice),
    })),
  };
}
