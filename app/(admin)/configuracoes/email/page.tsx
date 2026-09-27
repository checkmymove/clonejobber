import Link from "next/link";
import { COMPANY_SLUG, getCompanyId } from "@/lib/company";
import { googleRedirectUri } from "@/lib/email/config";
import { disconnectGmail } from "@/lib/email/actions";
import { getGoogleConnection } from "@/lib/email/google";
import { Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

function messageFromQuery(sp: { connected?: string; error?: string }): string | null {
  if (sp.connected) return "Gmail connected. Quotes and invoices can be sent from the document page.";
  if (!sp.error) return null;
  if (sp.error === "missing_oauth") return "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are missing.";
  if (sp.error === "invalid_state") return "OAuth state did not match. Try connecting again.";
  if (sp.error === "company") return "Company not found.";
  return decodeURIComponent(sp.error);
}

export default async function EmailSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const companyId = await getCompanyId(COMPANY_SLUG);
  const connection = companyId ? await getGoogleConnection(companyId) : null;
  const flash = messageFromQuery(sp);
  const redirectUri = googleRedirectUri();

  return (
    <div>
      <PageHeader
        title="Email (Gmail)"
        subtitle="Connect the company Gmail account. Messages go out from that mailbox and stay in Sent."
      />

      {flash ? (
        <p className={`mb-4 text-sm font-semibold ${sp.error ? "text-rose-700" : "text-emerald-800"}`}>
          {flash}
        </p>
      ) : null}

      <Card className="max-w-xl p-5">
        {connection ? (
          <p className="text-sm text-ink">
            Connected as <span className="font-bold">{connection.email}</span>
          </p>
        ) : (
          <p className="text-sm text-ink-soft">No Gmail account connected yet.</p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href="/api/integrations/google/start"
            className="inline-flex h-10 items-center rounded-xl bg-ink px-4 text-sm font-bold text-white hover:opacity-90"
          >
            {connection ? "Reconnect Gmail" : "Connect Gmail"}
          </a>
          {connection ? (
            <form
              action={async () => {
                "use server";
                await disconnectGmail();
              }}
            >
              <button
                type="submit"
                className="h-10 rounded-xl border border-line bg-card px-4 text-sm font-bold text-ink hover:bg-cream"
              >
                Disconnect
              </button>
            </form>
          ) : null}
        </div>

        <p className="mt-5 text-xs leading-relaxed text-ink-soft">
          Google Cloud must list this redirect URI:{" "}
          <code className="break-all rounded bg-cream px-1 py-0.5 text-[11px]">{redirectUri}</code>
          . Local development also needs the same URI saved on the OAuth client.
        </p>
        <p className="mt-3 text-xs text-ink-mute">
          Scopes: gmail.send and userinfo.email (to show which account is connected).
        </p>
      </Card>

      <p className="mt-4">
        <Link href="/" className="text-sm font-bold text-accent hover:underline">
          ← Dashboard
        </Link>
      </p>
    </div>
  );
}
