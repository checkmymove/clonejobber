import { LoginForm } from "@/components/auth/login-form";
import { safeNextPath } from "@/lib/auth/allowlist";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-line bg-card p-8 shadow-[0_1px_2px_rgba(18,48,53,0.06)]">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-sm font-black text-white">
          O
        </div>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink">
          Entrar
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Acesso do administrador de Moving London Transport.
        </p>
        <LoginForm next={next} configError={params.error === "config"} />
      </div>
    </main>
  );
}
