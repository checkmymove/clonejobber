"use client";

import { useActionState } from "react";
import { signIn, type AuthState } from "@/lib/auth/actions";

const initial: AuthState = { ok: false };

export function LoginForm({
  next,
  configError,
}: {
  next: string;
  configError: boolean;
}) {
  const [state, action, pending] = useActionState(signIn, initial);

  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
        E-mail
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          className="h-11 rounded-xl border border-line bg-white px-3 font-normal text-ink outline-none focus:border-ink"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
        Senha
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-11 rounded-xl border border-line bg-white px-3 font-normal text-ink outline-none focus:border-ink"
        />
      </label>
      {configError ? (
        <p className="text-sm font-medium text-rose-700">
          Faltam variáveis de autenticação no ambiente.
        </p>
      ) : null}
      {state.message ? (
        <p className="text-sm font-medium text-rose-700">{state.message}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-xl bg-ink text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "A entrar…" : "Entrar"}
      </button>
    </form>
  );
}
