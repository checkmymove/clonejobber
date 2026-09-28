import { notFound } from "next/navigation";
import { listClientsForSelect } from "@/lib/clients/queries";
import { getActiveServices, getCompanyBySlug, getLeadSources } from "@/lib/requests/company";
import { COMPANY_SLUG } from "@/lib/company";
import { NewRequestForm } from "@/components/requests/new-request-form";

export const dynamic = "force-dynamic";

export default async function NovaSolicitacaoPage() {
  const company = await getCompanyBySlug(COMPANY_SLUG);
  if (!company) notFound();

  const [services, clients, leadSources] = await Promise.all([
    getActiveServices(company.id),
    listClientsForSelect(COMPANY_SLUG),
    getLeadSources(company.id),
  ]);

  return (
    <div className="min-h-[calc(100dvh-6.5rem)] rounded-2xl bg-white px-6 py-8 sm:px-10">
      <div className="mx-auto max-w-[760px]">
        <h1 className="text-[28px] font-bold tracking-tight text-[#042b3c]">New request</h1>
        <NewRequestForm services={services} clients={clients} leadSources={leadSources} />
      </div>
    </div>
  );
}
