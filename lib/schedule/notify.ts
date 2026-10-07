import { describeVisitSlot } from "./dates";

export type VisitSlot = {
  date: string | null;
  start: string;
  end: string;
  anytime: boolean;
  unscheduled: boolean;
};

export function buildRescheduleMessage(input: {
  clientName: string;
  companyName: string;
  jobNumber: string;
  previous: VisitSlot;
  next: VisitSlot;
}): { subject: string; message: string } {
  const first = input.clientName.trim().split(/\s+/)[0] || "there";
  const previous = describeVisitSlot(input.previous);
  const next = describeVisitSlot(input.next);
  const job = input.jobNumber.trim() || "your job";
  return {
    subject: `Your ${input.companyName.trim() || "Opero"} visit has been rescheduled`,
    message: [
      `Hi ${first},`,
      "",
      `We've updated the visit for ${job}.`,
      `Previously: ${previous}.`,
      `Now: ${next}.`,
      "",
      "Please reply if this time does not work and we will find another slot.",
      "",
      `Best wishes,`,
      input.companyName.trim() || "Moving London Transport",
    ].join("\n"),
  };
}

export function visitSlotChanged(previous: VisitSlot, next: VisitSlot): boolean {
  return (
    previous.date !== next.date ||
    previous.start !== next.start ||
    previous.end !== next.end ||
    previous.anytime !== next.anytime ||
    previous.unscheduled !== next.unscheduled
  );
}
