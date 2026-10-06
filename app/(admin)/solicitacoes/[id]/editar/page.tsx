import { notFound } from "next/navigation";
import { listClientsForSelect } from "@/lib/clients/queries";
import { COMPANY_SLUG } from "@/lib/company";
import { toDateInput } from "@/lib/format";
import { getActiveServices, getCompanyBySlug, getLeadSources } from "@/lib/requests/company";
import { getRequestDetail } from "@/lib/requests/queries";
import { NewRequestForm } from "@/components/requests/new-request-form";

export const dynamic = "force-dynamic";

export default async function EditarSolicitacaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const company = await getCompanyBySlug(COMPANY_SLUG);
  if (!company) notFound();

  const request = await getRequestDetail(id);
  if (!request) notFound();

  const [services, clients, leadSources] = await Promise.all([
    getActiveServices(company.id),
    listClientsForSelect(COMPANY_SLUG),
    getLeadSources(company.id),
  ]);

  return (
    <div className="min-h-[calc(100dvh-6.5rem)] rounded-2xl bg-white px-6 py-8 sm:px-10">
      <div className="mx-auto max-w-[760px]">
        <h1 className="text-[28px] font-bold tracking-tight text-[#042b3c]">Edit request</h1>
        <NewRequestForm
          services={services}
          clients={clients}
          leadSources={leadSources}
          requestId={request.id}
          initial={{
            clientId: request.client_id,
            moveDate: toDateInput(request.move_date),
            moveTime: request.move_time ?? "",
            pickupAddress: request.pickup_address ?? "",
            pickupPostcode: request.pickup_postcode ?? "",
            pickupFloor: request.pickup_floor ?? "",
            pickupLift: request.pickup_has_lift ?? false,
            pickupParking: request.pickup_parking,
            pickupBedrooms: request.pickup_bedrooms == null ? "" : String(request.pickup_bedrooms),
            deliveryAddress: request.delivery_address ?? "",
            deliveryPostcode: request.delivery_postcode ?? "",
            deliveryFloor: request.delivery_floor ?? "",
            deliveryLift: request.delivery_has_lift ?? false,
            deliveryParking: request.delivery_parking,
            deliveryBedrooms:
              request.delivery_bedrooms == null ? "" : String(request.delivery_bedrooms),
            needsPacking: request.needs_packing_service,
            needsBoxes: request.needs_packing_materials,
            serviceId: request.service_ids[0] ?? "",
            hours: request.estimated_hours[0] ?? "",
            inventory: request.inventory_description,
          }}
        />
      </div>
    </div>
  );
}
