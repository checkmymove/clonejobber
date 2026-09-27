"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/clients/actions";

export interface ClientDefaults {
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  phone: string;
  notes: string;
}

const inputCls =
  "h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-accent";

export function ClientForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  defaults: ClientDefaults;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, { ok: true });
  const err = (k: string) => state.errors?.[k];

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-ink">
          First name *
          <input name="firstName" defaultValue={defaults.firstName} className={inputCls} />
          {err("firstName") ? <FieldError msg={err("firstName")!} /> : null}
        </label>
        <label className="block text-sm font-semibold text-ink">
          Last name *
          <input name="lastName" defaultValue={defaults.lastName} className={inputCls} />
          {err("lastName") ? <FieldError msg={err("lastName")!} /> : null}
        </label>
      </div>
      <label className="block text-sm font-semibold text-ink">
        Company (if applicable)
        <input name="companyName" defaultValue={defaults.companyName} className={inputCls} />
        {err("companyName") ? <FieldError msg={err("companyName")!} /> : null}
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-ink">
          Email *
          <input name="email" type="email" defaultValue={defaults.email} className={inputCls} />
          {err("email") ? <FieldError msg={err("email")!} /> : null}
        </label>
        <label className="block text-sm font-semibold text-ink">
          Phone *
          <input name="phone" type="tel" defaultValue={defaults.phone} className={inputCls} />
          {err("phone") ? <FieldError msg={err("phone")!} /> : null}
        </label>
      </div>
      {state.message ? (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="h-10 rounded-xl bg-ink px-5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Salvando…" : submitLabel}
      </button>
    </form>
  );
}

function FieldError({ msg }: { msg: string }) {
  return <span className="mt-0.5 block text-xs font-semibold text-rose-700">{msg}</span>;
}
