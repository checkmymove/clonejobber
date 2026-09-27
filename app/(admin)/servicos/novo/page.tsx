import { listClientsForSelect } from "@/lib/clients/queries";
import { COMPANY_SLUG } from "@/lib/company";
import { NewJobForm } from "@/components/jobs/new-job-form";

export const dynamic = "force-dynamic";

export default async function NovoServicoPage() {
  const clients = await listClientsForSelect(COMPANY_SLUG);
  return (
    <div className="min-h-[calc(100dvh-6.5rem)] rounded-2xl bg-white px-6 py-8 sm:px-10">
      <div className="mx-auto max-w-[860px]">
        <NewJobForm clients={clients} />
      </div>
    </div>
  );
}
