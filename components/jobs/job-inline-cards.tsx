"use client";

import { useEffect, useState } from "react";
import { formatGBP, formatDateLondon } from "@/lib/format";
import type { JobInput, VisitInput } from "@/lib/funnel/validation";
import { saveJobInPlace } from "@/lib/jobs/actions";
import {
  Dl,
  Field,
  InlineEditCard,
  LineFields,
  inlineArea,
  inlineField,
  type DraftLine,
} from "@/components/inline-edit-card";

type VisitDraft = VisitInput & { id: string };

export type JobEditSnapshot = {
  id: string;
  clientId: string;
  quoteId?: string;
  requestId?: string;
  title: string;
  notes: string;
  pickupAddress: string;
  deliveryAddress: string;
  remindInvoice: boolean;
  quoteNumber: string;
  total: number;
  scheduledDate: string;
  window: string;
  visits: VisitDraft[];
  lines: DraftLine[];
};

function toJobInput(
  snapshot: JobEditSnapshot,
  patch: Partial<Omit<JobInput, "visits" | "lines">> & { visits?: VisitDraft[]; lines?: DraftLine[] } = {},
): JobInput {
  const visits = patch.visits ?? snapshot.visits;
  return {
    clientId: snapshot.clientId,
    quoteId: snapshot.quoteId,
    requestId: snapshot.requestId,
    title: patch.title ?? snapshot.title,
    notes: patch.notes ?? snapshot.notes,
    pickupAddress: patch.pickupAddress ?? snapshot.pickupAddress,
    deliveryAddress: patch.deliveryAddress ?? snapshot.deliveryAddress,
    remindInvoice: patch.remindInvoice ?? snapshot.remindInvoice,
    visits: visits.map(({ id: _id, ...visit }) => visit),
    lines: (patch.lines ?? snapshot.lines).map((line) => ({
      name: line.name,
      description: line.description,
      qty: line.qty,
      unitPrice: line.price,
    })),
  };
}

export function JobScheduleCard({ snapshot }: { snapshot: JobEditSnapshot }) {
  const [title, setTitle] = useState(snapshot.title);
  const [pickupAddress, setPickupAddress] = useState(snapshot.pickupAddress);
  const [deliveryAddress, setDeliveryAddress] = useState(snapshot.deliveryAddress);
  const [notes, setNotes] = useState(snapshot.notes);
  const [remindInvoice, setRemindInvoice] = useState(snapshot.remindInvoice);
  useEffect(() => {
    setTitle(snapshot.title);
    setPickupAddress(snapshot.pickupAddress);
    setDeliveryAddress(snapshot.deliveryAddress);
    setNotes(snapshot.notes);
    setRemindInvoice(snapshot.remindInvoice);
  }, [snapshot]);

  return (
    <InlineEditCard
      title="Schedule"
      onCancel={() => {
        setTitle(snapshot.title);
        setPickupAddress(snapshot.pickupAddress);
        setDeliveryAddress(snapshot.deliveryAddress);
        setNotes(snapshot.notes);
        setRemindInvoice(snapshot.remindInvoice);
      }}
      onSave={() =>
        saveJobInPlace(
          snapshot.id,
          toJobInput(snapshot, { title, pickupAddress, deliveryAddress, notes, remindInvoice }),
        )
      }
      view={
        <Dl
          rows={[
            ["Date", snapshot.scheduledDate ? formatDateLondon(snapshot.scheduledDate) : "Schedule mais tarde"],
            ["Janela", snapshot.window],
            ["Collection", snapshot.pickupAddress || "—"],
            ["Delivery", snapshot.deliveryAddress || "—"],
            ["Quote", snapshot.quoteNumber],
            ["Total", formatGBP(snapshot.total)],
          ]}
        />
      }
    >
      <Field label="Title">
        <input className={inlineField} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Collection">
        <input className={inlineField} value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} />
      </Field>
      <Field label="Delivery">
        <input className={inlineField} value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} />
      </Field>
      <Field label="Notes">
        <textarea className={inlineArea} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={remindInvoice} onChange={(e) => setRemindInvoice(e.target.checked)} />
        Remind to invoice
      </label>
    </InlineEditCard>
  );
}

export function JobVisitsCard({ snapshot }: { snapshot: JobEditSnapshot }) {
  const [visits, setVisits] = useState(snapshot.visits);
  useEffect(() => setVisits(snapshot.visits), [snapshot.visits]);

  return (
    <InlineEditCard
      title="Visits"
      onCancel={() => setVisits(snapshot.visits)}
      onSave={() => saveJobInPlace(snapshot.id, toJobInput(snapshot, { visits }))}
      view={
        <div className="space-y-2 text-sm">
          {snapshot.visits.map((visit) => (
            <p key={visit.id} className="rounded-xl border border-line p-3">
              <span className="font-bold text-ink">
                {visit.date ? formatDateLondon(visit.date) : "No date"}
              </span>
              <span className="text-ink-soft">
                {" "}
                · {visit.anytime || visit.later ? (visit.later ? "Later" : "Anytime") : `${visit.start || "—"}–${visit.end || "—"}`}
              </span>
              {visit.instructions ? <span className="mt-1 block text-ink-soft">{visit.instructions}</span> : null}
            </p>
          ))}
        </div>
      }
    >
      <div className="space-y-3">
        {visits.map((visit) => (
          <div key={visit.id} className="space-y-2 rounded-xl border border-line p-3">
            <Field label="Date">
              <input
                type="date"
                className={inlineField}
                disabled={visit.later}
                value={visit.date}
                onChange={(e) =>
                  setVisits(visits.map((item) => (item.id === visit.id ? { ...item, date: e.target.value } : item)))
                }
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={visit.later}
                onChange={(e) =>
                  setVisits(visits.map((item) => (item.id === visit.id ? { ...item, later: e.target.checked } : item)))
                }
              />
              Schedule later
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Start">
                <input
                  type="time"
                  className={inlineField}
                  disabled={visit.later || visit.anytime}
                  value={visit.start}
                  onChange={(e) =>
                    setVisits(visits.map((item) => (item.id === visit.id ? { ...item, start: e.target.value } : item)))
                  }
                />
              </Field>
              <Field label="End">
                <input
                  type="time"
                  className={inlineField}
                  disabled={visit.later || visit.anytime}
                  value={visit.end}
                  onChange={(e) =>
                    setVisits(visits.map((item) => (item.id === visit.id ? { ...item, end: e.target.value } : item)))
                  }
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={visit.anytime}
                onChange={(e) =>
                  setVisits(visits.map((item) => (item.id === visit.id ? { ...item, anytime: e.target.checked } : item)))
                }
              />
              Anytime
            </label>
            <Field label="Instructions">
              <textarea
                className={inlineArea}
                value={visit.instructions}
                onChange={(e) =>
                  setVisits(
                    visits.map((item) => (item.id === visit.id ? { ...item, instructions: e.target.value } : item)),
                  )
                }
              />
            </Field>
          </div>
        ))}
      </div>
    </InlineEditCard>
  );
}

export function JobItemsCard({ snapshot }: { snapshot: JobEditSnapshot }) {
  const [lines, setLines] = useState(snapshot.lines);
  useEffect(() => setLines(snapshot.lines), [snapshot.lines]);

  return (
    <InlineEditCard
      className="h-fit p-5 xl:col-span-2"
      title="Items"
      onCancel={() => setLines(snapshot.lines)}
      onSave={() => saveJobInPlace(snapshot.id, toJobInput(snapshot, { lines }))}
      view={
        <>
          {snapshot.lines.map((line) => (
            <div key={line.id} className="flex justify-between gap-3 border-b border-line py-2 text-sm last:border-0">
              <div>
                <p className="font-bold text-ink">{line.name}</p>
                {line.description ? <p className="text-ink-soft">{line.description}</p> : null}
                <p className="text-xs text-ink-mute">{line.qty} × {line.price}</p>
              </div>
            </div>
          ))}
        </>
      }
    >
      <LineFields lines={lines} onChange={setLines} />
    </InlineEditCard>
  );
}
