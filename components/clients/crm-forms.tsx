"use client";

import { useActionState } from "react";
import {
  APPOINTMENT_KINDS,
  CHANNELS,
  CLIENT_STATUSES,
  CLIENT_TYPES,
  PAYMENT_TERMS,
  PROPERTY_LABELS,
} from "@/lib/clients/crm-validation";
import type { ActionResult } from "@/lib/clients/crm-actions";

type Action = (prev: ActionResult, fd: FormData) => Promise<ActionResult>;

const inputCls =
  "h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-accent";

function Err({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <span className="mt-0.5 block text-xs font-semibold text-rose-700">{msg}</span>
  );
}

function SaveButton({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 rounded-xl bg-ink px-5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "Salvando…" : label}
    </button>
  );
}

// ------------------------------------------------------------------ profile
export interface ProfileDefaults {
  title: string;
  firstName: string;
  lastName: string;
  companyName: string;
  clientType: string;
  status: string;
  email: string;
  phone: string;
  phoneMobile: string;
  paymentTerms: string;
  paymentTermsCustom: string;
  askForReview: boolean;
}

export function ProfileForm({
  action,
  defaults,
}: {
  action: Action;
  defaults: ProfileDefaults;
}) {
  const [state, formAction, pending] = useActionState(action, { ok: true });
  const e = state.errors ?? {};
  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[100px_1fr_1fr]">
        <label className="block text-sm font-semibold text-ink">
          Title
          <input name="title" defaultValue={defaults.title} className={inputCls} placeholder="Mr" />
          <Err msg={e.title} />
        </label>
        <label className="block text-sm font-semibold text-ink">
          First name *
          <input name="firstName" defaultValue={defaults.firstName} className={inputCls} />
          <Err msg={e.firstName} />
        </label>
        <label className="block text-sm font-semibold text-ink">
          Last name *
          <input name="lastName" defaultValue={defaults.lastName} className={inputCls} />
          <Err msg={e.lastName} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-ink">
          Type
          <select name="clientType" defaultValue={defaults.clientType} className={inputCls}>
            {CLIENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t === "individual" ? "Individual" : "Company"}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold text-ink">
          Status
          <select name="status" defaultValue={defaults.status} className={inputCls}>
            {CLIENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-sm font-semibold text-ink">
        Company
        <input name="companyName" defaultValue={defaults.companyName} className={inputCls} />
        <Err msg={e.companyName} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-ink">
          Main email *
          <input name="email" type="email" defaultValue={defaults.email} className={inputCls} />
          <Err msg={e.email} />
        </label>
        <label className="block text-sm font-semibold text-ink">
          Main phone *
          <input name="phone" type="tel" defaultValue={defaults.phone} className={inputCls} />
          <Err msg={e.phone} />
        </label>
      </div>
      <label className="block text-sm font-semibold text-ink">
        Mobile phone
        <input name="phoneMobile" type="tel" defaultValue={defaults.phoneMobile} className={inputCls} />
        <Err msg={e.phoneMobile} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-ink">
          Payment terms
          <select name="paymentTerms" defaultValue={defaults.paymentTerms} className={inputCls}>
            {PAYMENT_TERMS.map((t) => (
              <option key={t} value={t}>
                {t === "due_on_receipt" ? "Due upon receipt" : t.replace("_", " ").toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold text-ink">
          Custom terms
          <input name="paymentTermsCustom" defaultValue={defaults.paymentTermsCustom} className={inputCls} />
          <Err msg={e.paymentTermsCustom} />
        </label>
      </div>
      <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink">
        <input
          type="checkbox"
          name="askForReview"
          defaultChecked={defaults.askForReview}
          className="h-4 w-4 accent-emerald-700"
        />
        Ask for a review
      </label>
      {state.message ? (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">
          {state.message}
        </p>
      ) : null}
      <SaveButton pending={pending} label="Salvar perfil" />
    </form>
  );
}

// ---------------------------------------------------------------- property
export function PropertyForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, { ok: true });
  const e = state.errors ?? {};
  return (
    <form action={formAction} className="space-y-3 rounded-xl bg-cream p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-ink">
          Label *
          <select name="label" defaultValue="Other" className={inputCls}>
            {PROPERTY_LABELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold text-ink">
          Postcode *
          <input name="postcode" className={inputCls} />
          <Err msg={e.postcode} />
        </label>
      </div>
      <label className="block text-sm font-semibold text-ink">
        Address *
        <input name="addressLine" className={inputCls} />
        <Err msg={e.addressLine} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-ink">
          Street 2
          <input name="street2" className={inputCls} />
        </label>
        <label className="block text-sm font-semibold text-ink">
          City
          <input name="city" className={inputCls} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm font-semibold text-ink">
          County
          <input name="county" className={inputCls} />
        </label>
        <label className="block text-sm font-semibold text-ink">
          Country
          <input name="country" defaultValue="United Kingdom" className={inputCls} />
        </label>
        <label className="block text-sm font-semibold text-ink">
          Tax rate
          <input name="taxRate" className={inputCls} placeholder="20% VAT" />
        </label>
      </div>
      <label className="block text-sm font-semibold text-ink">
        Property notes / access instructions
        <input name="instructions" className={inputCls} />
      </label>
      <div className="flex gap-4 text-sm text-ink">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isPrimary" className="h-4 w-4 accent-emerald-700" />
          Primary
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isBilling" className="h-4 w-4 accent-emerald-700" />
          Billing
        </label>
      </div>
      <SaveButton pending={pending} label="Adicionar propriedade" />
    </form>
  );
}

// ----------------------------------------------------------------- contact
export function ContactForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, { ok: true });
  const e = state.errors ?? {};
  return (
    <form action={formAction} className="space-y-3 rounded-xl bg-cream p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-ink">
          Name *
          <input name="name" className={inputCls} />
          <Err msg={e.name} />
        </label>
        <label className="block text-sm font-semibold text-ink">
          Role
          <input name="role" className={inputCls} placeholder="Owner, manager…" />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-ink">
          Phone
          <input name="phone" className={inputCls} />
          <Err msg={e.phone} />
        </label>
        <label className="block text-sm font-semibold text-ink">
          Email
          <input name="email" className={inputCls} />
          <Err msg={e.email} />
        </label>
      </div>
      <SaveButton pending={pending} label="Add contact" />
    </form>
  );
}

// -------------------------------------------------------------------- note
export function NoteForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, { ok: true });
  return (
    <form action={formAction} className="space-y-2">
      <textarea
        name="content"
        rows={3}
        placeholder="Leave an internal note for yourself or a team member"
        className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent"
      />
      {state.errors?.content ? <Err msg={state.errors.content} /> : null}
      <SaveButton pending={pending} label="Adicionar nota" />
    </form>
  );
}

// --------------------------------------------------------------------- tag
export function TagForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, { ok: true });
  return (
    <form action={formAction} className="flex gap-2">
      <input
        name="name"
        placeholder="New tag"
        aria-label="New tag"
        className="h-9 min-w-0 flex-1 rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={pending}
        className="h-9 shrink-0 rounded-xl bg-ink px-3 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
      >
        +
      </button>
      {state.errors?.name ? <Err msg={state.errors.name} /> : null}
    </form>
  );
}

// -------------------------------------------------------------- appointment
export function AppointmentForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, { ok: true });
  const e = state.errors ?? {};
  return (
    <form action={formAction} className="space-y-3 rounded-xl bg-cream p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-ink">
          Title *
          <input name="title" className={inputCls} placeholder="On-site assessment" />
          <Err msg={e.title} />
        </label>
        <label className="block text-sm font-semibold text-ink">
          Kind
          <select name="kind" defaultValue="visit" className={inputCls}>
            {APPOINTMENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {k.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-ink">
          Starts at *
          <input name="startsAt" type="datetime-local" className={inputCls} />
          <Err msg={e.startsAt} />
        </label>
        <label className="block text-sm font-semibold text-ink">
          Ends at
          <input name="endsAt" type="datetime-local" className={inputCls} />
          <Err msg={e.endsAt} />
        </label>
      </div>
      <SaveButton pending={pending} label="Add" />
    </form>
  );
}

// ----------------------------------------------------------------- message
export function MessageForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, { ok: true });
  const e = state.errors ?? {};
  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-line p-3">
      <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
        <label className="block text-sm font-semibold text-ink">
          Channel
          <select name="channel" defaultValue="email" className={inputCls}>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold text-ink">
          Subject
          <input name="subject" className={inputCls} placeholder="Subject" />
        </label>
      </div>
      <label className="block text-sm font-semibold text-ink">
        Message *
        <textarea name="body" rows={4} className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent" />
        <Err msg={e.body} />
      </label>
      <p className="-mt-1 text-xs text-ink-mute">
        Registrado no histórico. O envio pelo provedor chega na fase de e-mail.
      </p>
      <SaveButton pending={pending} label="Registrar mensagem" />
    </form>
  );
}

// -------------------------------------------------------------------- file
export function FileUploadForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, { ok: true });
  return (
    <form action={formAction} encType="multipart/form-data" className="flex flex-wrap items-center gap-2">
      <input
        type="file"
        name="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="text-sm text-ink-soft"
        aria-label="Upload file"
      />
      <button
        type="submit"
        disabled={pending}
        className="h-9 rounded-xl bg-ink px-4 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Enviando…" : "Upload"}
      </button>
      {state.message ? (
        <p className="w-full text-xs font-semibold text-rose-700">{state.message}</p>
      ) : null}
    </form>
  );
}
