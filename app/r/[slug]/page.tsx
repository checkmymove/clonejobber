import { notFound } from "next/navigation";
import {
  getActiveServices,
  getCompanyBySlug,
  getLeadSources,
} from "@/lib/requests/company";
import { RequestWizard } from "@/components/request-wizard/wizard";

export const dynamic = "force-dynamic";

export default async function PublicRequestPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);

  if (!company) notFound();

  if (!company.request_form_active) {
    return (
      <PublicShell companyName={company.brand_name}>
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <h2 className="text-xl font-extrabold text-ink">
            This form is currently closed
          </h2>
          <p className="mt-2 text-sm text-ink-soft">
            Please contact {company.name} directly.
          </p>
        </div>
      </PublicShell>
    );
  }

  const [leadSources, services] = await Promise.all([
    getLeadSources(company.id),
    getActiveServices(company.id),
  ]);

  return (
    <PublicShell companyName={company.name}>
      <RequestWizard
        slug={company.slug}
        companyName={company.name}
        primaryColor={company.primary_color}
        termsUrl={company.terms_url}
        maxImages={company.max_request_images}
        leadSources={leadSources}
        services={services}
      />
    </PublicShell>
  );
}

function PublicShell({
  companyName,
  children,
}: {
  companyName: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-cream">
      <header className="border-b border-line bg-white/80">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-2 px-4">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-ink text-xs font-black text-white">
            O
          </div>
          <p className="truncate text-sm font-bold text-ink">{companyName}</p>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl px-3 py-6 sm:px-4">
        {children}
      </main>
      <footer className="mx-auto max-w-2xl px-4 pb-10 text-center text-xs text-ink-mute">
        <p>
          {companyName} · Powered by Opero · Protected against spam
        </p>
      </footer>
    </div>
  );
}
