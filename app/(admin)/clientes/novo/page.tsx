import { sql } from "@/lib/db";
import { getLeadSources } from "@/lib/requests/company";
import { NewClientForm } from "@/components/clients/new-client-form";

export const dynamic = "force-dynamic";

export default async function NovoClientePage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const { created } = await searchParams;
  const company = await sql<{ id: string }[]>`
    select id from companies where slug = 'moving-london' limit 1
  `;
  const leadSources = company[0] ? await getLeadSources(company[0].id) : [];

  return (
    <div className="min-h-[calc(100dvh-6.5rem)] rounded-2xl bg-white px-6 py-8 sm:px-10">
      <div className="max-w-[960px]">
        <h1 className="text-[28px] font-bold tracking-tight text-[#042b3c]">New Client</h1>
        <NewClientForm leadSources={leadSources} justCreated={created === "1"} />
      </div>
    </div>
  );
}
