import Link from "next/link";
import { COMPANY_SLUG, getCompanyId } from "@/lib/company";
import { googleRedirectUri } from "@/lib/email/config";
import { disconnectGmail } from "@/lib/email/actions";
import { getGoogleConnection } from "@/lib/email/google";
import { Card, PageHeader } from "@/components/ui";
import { TemplatesManager } from "@/components/settings/templates-manager";
import { listTemplates } from "@/lib/templates/queries";

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
  const [connection, templates] = await Promise.all([
    companyId ? getGoogleConnection(companyId) : null,
    companyId ? listTemplates(companyId) : [],
  ]);
  const flash = messageFromQuery(sp);
  const redirectUri = googleRedirectUri();

  return (
    <div>
      <PageHeader
        title="Emails & Text Messages"
        subtitle="The Gmail account that sends, and the email and text templates for every stage, from request to payment."
      />

      {flash ? (
        <p className={`mb-4 text-sm font-semibold ${sp.error ? "text-rose-700" : "text-emerald-800"}`}>
          {flash}
        </p>
      ) : null}

      <h2 className="mb-2 text-lg font-extrabold text-ink">Email account</h2>
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

      <h2 className="mb-1 mt-8 text-lg font-extrabold text-ink">Templates</h2>
      <p className="mb-3 max-w-3xl text-sm text-ink-soft">
        Customise the emails and text messages sent to your clients. Variables such as {"{{CLIENT_NAME}}"} are
        filled in when the message is sent; Reset goes back to the default text.
      </p>
      <TemplatesManager templates={templates} />

      <p className="mt-4">
        <Link href="/" className="text-sm font-bold text-accent hover:underline">
          ← Dashboard
        </Link>
      </p>
    </div>
  );
}
