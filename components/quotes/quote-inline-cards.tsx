"use client";

import { useEffect, useState } from "react";
import { formatGBP, formatDateLondon } from "@/lib/format";
import type { QuoteInput } from "@/lib/funnel/validation";
import { saveQuoteInPlace } from "@/lib/quotes/actions";
import { saveRequestInPlace } from "@/lib/requests/actions";
import {
  toAdminRequestInput,
  type RequestEditSnapshot,
} from "@/lib/requests/edit-snapshot";
import {
  Dl,
  Field,
  InlineEditCard,
  LineFields,
  LocationFields,
  YesNoSelect,
  inlineArea,
  inlineField,
  type DraftLine,
  type LocationDraft,
} from "@/components/inline-edit-card";

export type QuoteEditSnapshot = {
  id: string;
  clientId: string;
  requestId?: string;
  title: string;
  message: string;
  notes: string;
  validUntil: string;
  moveTime: string;
  inventory: string;
  discount: string;
  tax: string;
  deposit: string;
  recipient: string;
  source: string;
  subtotal: number;
  total: number;
  depositPence: number;
  discountPence: number;
  taxPence: number;
  lines: DraftLine[];
};

function toQuoteInput(
  snapshot: QuoteEditSnapshot,
  patch: Partial<Omit<QuoteInput, "lines">> & { lines?: DraftLine[] } = {},
): QuoteInput {
  return {
    clientId: snapshot.clientId,
    requestId: snapshot.requestId,
    title: patch.title ?? snapshot.title,
    message: patch.message ?? snapshot.message,
    notes: patch.notes ?? snapshot.notes,
    validUntil: patch.validUntil ?? snapshot.validUntil,
    moveTime: patch.moveTime ?? snapshot.moveTime,
    inventory: patch.inventory ?? snapshot.inventory,
    discount: patch.discount ?? snapshot.discount,
    tax: patch.tax ?? snapshot.tax,
    deposit: patch.deposit ?? snapshot.deposit,
    lines: (patch.lines ?? snapshot.lines).map((line) => ({
      name: line.name,
      description: line.description,
      qty: line.qty,
      unitPrice: line.price,
    })),
  };
}

export function QuoteSummaryCard({ snapshot }: { snapshot: QuoteEditSnapshot }) {
  const [title, setTitle] = useState(snapshot.title);
  const [validUntil, setValidUntil] = useState(snapshot.validUntil);
  const [moveTime, setMoveTime] = useState(snapshot.moveTime);
  const [discount, setDiscount] = useState(snapshot.discount);
  const [tax, setTax] = useState(snapshot.tax);
  const [deposit, setDeposit] = useState(snapshot.deposit);
  const [message, setMessage] = useState(snapshot.message);

  useEffect(() => {
    setTitle(snapshot.title);
    setValidUntil(snapshot.validUntil);
    setMoveTime(snapshot.moveTime);
    setDiscount(snapshot.discount);
    setTax(snapshot.tax);
    setDeposit(snapshot.deposit);
    setMessage(snapshot.message);
  }, [snapshot]);

  return (
    <InlineEditCard
      title="Resumo"
      onCancel={() => {
        setTitle(snapshot.title);
        setValidUntil(snapshot.validUntil);
        setMoveTime(snapshot.moveTime);
        setDiscount(snapshot.discount);
        setTax(snapshot.tax);
        setDeposit(snapshot.deposit);
        setMessage(snapshot.message);
      }}
      onSave={async () => {
        const saved = await saveQuoteInPlace(
          snapshot.id,
          toQuoteInput(snapshot, { title, validUntil, moveTime, discount, tax, deposit, message }),
        );
        if (!saved.ok) return saved;
        return saved;
      }}
      view={
        <>
          <Dl
            rows={[
              ["Source", snapshot.source],
              ["Recipient", snapshot.recipient],
              ["Moving date", snapshot.validUntil ? formatDateLondon(snapshot.validUntil) : "—"],
              ["Moving time", snapshot.moveTime.trim() || "—"],
              ["Subtotal", formatGBP(snapshot.subtotal)],
              ...(snapshot.discountPence ? [["Discount", formatGBP(snapshot.discountPence)] as [string, string]] : []),
              ...(snapshot.taxPence ? [["Tax", formatGBP(snapshot.taxPence)] as [string, string]] : []),
              ["Total", formatGBP(snapshot.total)],
              ...(snapshot.depositPence
                ? [["Required deposit", formatGBP(snapshot.depositPence)] as [string, string]]
                : []),
            ]}
          />
          {snapshot.message ? (
            <details className="mt-4 rounded-xl border border-line">
              <summary className="cursor-pointer px-3 py-2 text-sm font-bold text-ink">
                Terms and conditions
              </summary>
              <p className="max-h-80 overflow-y-auto whitespace-pre-wrap border-t border-line px-3 py-3 text-sm text-ink">
                {snapshot.message}
              </p>
            </details>
          ) : null}
        </>
      }
    >
      <Field label="Title">
        <input className={inlineField} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Moving date">
          <input type="date" className={inlineField} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </Field>
        <Field label="Moving time">
          <input type="time" className={inlineField} value={moveTime} onChange={(e) => setMoveTime(e.target.value)} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Discount">
          <input className={inlineField} value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </Field>
        <Field label="Tax">
          <input className={inlineField} value={tax} onChange={(e) => setTax(e.target.value)} />
        </Field>
        <Field label="Deposit">
          <input className={inlineField} value={deposit} onChange={(e) => setDeposit(e.target.value)} />
        </Field>
      </div>
      <Field label="Terms and conditions">
        <textarea className={inlineArea} value={message} onChange={(e) => setMessage(e.target.value)} />
      </Field>
    </InlineEditCard>
  );
}

export function QuoteServicesCard({ snapshot }: { snapshot: QuoteEditSnapshot }) {
  const [lines, setLines] = useState(snapshot.lines);
  useEffect(() => setLines(snapshot.lines), [snapshot.lines]);

  return (
    <InlineEditCard
      title="Services"
      onCancel={() => setLines(snapshot.lines)}
      onSave={() => saveQuoteInPlace(snapshot.id, toQuoteInput(snapshot, { lines }))}
      view={
        <div className="space-y-2 text-sm">
          {snapshot.lines.map((line) => (
            <div key={line.id} className="flex justify-between gap-3 border-b border-line py-2 last:border-0">
              <div>
                <p className="font-bold text-ink">{line.name}</p>
                {line.description ? <p className="text-ink-soft">{line.description}</p> : null}
                <p className="text-xs text-ink-mute">
                  {line.qty} × {formatGBP(Math.round(Number(line.price || "0") * 100) || 0)}
                </p>
              </div>
            </div>
          ))}
        </div>
      }
    >
      <LineFields lines={lines} onChange={setLines} />
    </InlineEditCard>
  );
}

export function QuotePackingCard({ request }: { request: RequestEditSnapshot }) {
  const [needsPacking, setNeedsPacking] = useState(request.needsPacking);
  const [needsBoxes, setNeedsBoxes] = useState(request.needsBoxes);
  useEffect(() => {
    setNeedsPacking(request.needsPacking);
    setNeedsBoxes(request.needsBoxes);
  }, [request]);

  return (
    <InlineEditCard
      title="Packing service"
      onCancel={() => {
        setNeedsPacking(request.needsPacking);
        setNeedsBoxes(request.needsBoxes);
      }}
      onSave={() =>
        saveRequestInPlace(
          request.id,
          toAdminRequestInput({ ...request, needsPacking, needsBoxes }),
        )
      }
      view={
        <Dl
          rows={[
            ["Packing services", request.needsPacking ? "Yes" : "No"],
            ["Packing materials", request.needsBoxes ? "Yes" : "No"],
          ]}
        />
      }
    >
      <Field label="Packing services">
        <YesNoSelect value={needsPacking} onChange={setNeedsPacking} />
      </Field>
      <Field label="Packing materials">
        <YesNoSelect value={needsBoxes} onChange={setNeedsBoxes} />
      </Field>
    </InlineEditCard>
  );
}

function QuoteLocationCard({
  title,
  request,
  kind,
}: {
  title: string;
  request: RequestEditSnapshot;
  kind: "pickup" | "delivery";
}) {
  const current: LocationDraft =
    kind === "pickup"
      ? {
          address: request.pickupAddress,
          postcode: request.pickupPostcode,
          floor: request.pickupFloor,
          lift: request.pickupLift,
          parking: request.pickupParking,
          bedrooms: request.pickupBedrooms,
        }
      : {
          address: request.deliveryAddress,
          postcode: request.deliveryPostcode,
          floor: request.deliveryFloor,
          lift: request.deliveryLift,
          parking: request.deliveryParking,
          bedrooms: request.deliveryBedrooms,
        };
  const [draft, setDraft] = useState(current);
  useEffect(() => setDraft(current), [request, kind]);

  return (
    <InlineEditCard
      title={title}
      view={
        <Dl
          rows={[
            ["Address", `${current.address}${current.postcode ? `, ${current.postcode}` : ""}`.replace(/^, /, "") || "—"],
            ["Floor", current.floor || "—"],
            ["Lift", current.lift ? "Yes" : "No"],
            ["Parking", current.parking || "—"],
            ["Bedrooms", current.bedrooms || "—"],
          ]}
        />
      }
      onCancel={() => setDraft(current)}
      onSave={() =>
        saveRequestInPlace(
          request.id,
          toAdminRequestInput(
            kind === "pickup"
              ? {
                  ...request,
                  pickupAddress: draft.address,
                  pickupPostcode: draft.postcode,
                  pickupFloor: draft.floor,
                  pickupLift: draft.lift,
                  pickupParking: draft.parking,
                  pickupBedrooms: draft.bedrooms,
                }
              : {
                  ...request,
                  deliveryAddress: draft.address,
                  deliveryPostcode: draft.postcode,
                  deliveryFloor: draft.floor,
                  deliveryLift: draft.lift,
                  deliveryParking: draft.parking,
                  deliveryBedrooms: draft.bedrooms,
                },
          ),
        )
      }
    >
      <LocationFields value={draft} onChange={setDraft} />
    </InlineEditCard>
  );
}

export function QuoteCollectionCard({ request }: { request: RequestEditSnapshot }) {
  return <QuoteLocationCard title="Collection Information" request={request} kind="pickup" />;
}

export function QuoteDeliveryCard({ request }: { request: RequestEditSnapshot }) {
  return <QuoteLocationCard title="Delivery Information" request={request} kind="delivery" />;
}

export function QuoteInventoryCard({
  snapshot,
  request,
}: {
  snapshot: QuoteEditSnapshot;
  request: RequestEditSnapshot | null;
}) {
  const [inventory, setInventory] = useState(snapshot.inventory);
  useEffect(() => setInventory(snapshot.inventory), [snapshot.inventory]);

  return (
    <InlineEditCard
      title="Inventory list"
      onCancel={() => setInventory(snapshot.inventory)}
      onSave={async () => {
        const saved = await saveQuoteInPlace(snapshot.id, toQuoteInput(snapshot, { inventory }));
        if (!saved.ok) return saved;
        if (request) {
          return saveRequestInPlace(request.id, toAdminRequestInput({ ...request, inventory }));
        }
        return saved;
      }}
      view={<p className="whitespace-pre-wrap text-sm text-ink">{snapshot.inventory || "—"}</p>}
    >
      <textarea className={inlineArea} value={inventory} onChange={(e) => setInventory(e.target.value)} />
    </InlineEditCard>
  );
}
