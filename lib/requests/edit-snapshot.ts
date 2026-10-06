import { toDateInput } from "@/lib/format";
import type { AdminRequestInput } from "@/lib/funnel/validation";

export type RequestEditSnapshot = {
  id: string;
  clientId: string;
  title: string;
  moveDate: string;
  moveTime: string;
  pickupAddress: string;
  pickupPostcode: string;
  pickupFloor: string;
  pickupLift: boolean;
  pickupParking: string;
  pickupBedrooms: string;
  deliveryAddress: string;
  deliveryPostcode: string;
  deliveryFloor: string;
  deliveryLift: boolean;
  deliveryParking: string;
  deliveryBedrooms: string;
  needsPacking: boolean;
  needsBoxes: boolean;
  serviceIds: string[];
  hours: string;
  inventory: string;
};

export function toAdminRequestInput(snapshot: RequestEditSnapshot): AdminRequestInput {
  return {
    clientId: snapshot.clientId,
    title: snapshot.title,
    moveDate: snapshot.moveDate,
    moveTime: snapshot.moveTime,
    pickupAddress: snapshot.pickupAddress,
    pickupPostcode: snapshot.pickupPostcode,
    pickupFloor: snapshot.pickupFloor,
    pickupLift: snapshot.pickupLift,
    pickupParking: snapshot.pickupParking,
    pickupBedrooms: snapshot.pickupBedrooms,
    deliveryAddress: snapshot.deliveryAddress,
    deliveryPostcode: snapshot.deliveryPostcode,
    deliveryFloor: snapshot.deliveryFloor,
    deliveryLift: snapshot.deliveryLift,
    deliveryParking: snapshot.deliveryParking,
    deliveryBedrooms: snapshot.deliveryBedrooms,
    needsPacking: snapshot.needsPacking,
    needsBoxes: snapshot.needsBoxes,
    serviceId: snapshot.serviceIds[0] ?? "",
    serviceIds: snapshot.serviceIds,
    hours: snapshot.hours,
    inventory: snapshot.inventory,
  };
}

export function requestSnapshotFromDetail(r: {
  id: string;
  client_id: string;
  number: string;
  move_date: string | Date | null;
  move_time: string | null;
  pickup_address: string | null;
  pickup_postcode: string | null;
  pickup_floor: string | null;
  pickup_has_lift: boolean | null;
  pickup_parking: string | null;
  pickup_bedrooms: number | null;
  delivery_address: string | null;
  delivery_postcode: string | null;
  delivery_floor: string | null;
  delivery_has_lift: boolean | null;
  delivery_parking: string | null;
  delivery_bedrooms: number | null;
  needs_packing_service: boolean;
  needs_packing_materials: boolean;
  service_ids: string[];
  estimated_hours: string[];
  inventory_description: string;
}): RequestEditSnapshot {
  return {
    id: r.id,
    clientId: r.client_id,
    title: r.number,
    moveDate: toDateInput(r.move_date),
    moveTime: r.move_time ?? "",
    pickupAddress: r.pickup_address ?? "",
    pickupPostcode: r.pickup_postcode ?? "",
    pickupFloor: r.pickup_floor ?? "",
    pickupLift: r.pickup_has_lift ?? false,
    pickupParking: r.pickup_parking ?? "",
    pickupBedrooms: r.pickup_bedrooms == null ? "" : String(r.pickup_bedrooms),
    deliveryAddress: r.delivery_address ?? "",
    deliveryPostcode: r.delivery_postcode ?? "",
    deliveryFloor: r.delivery_floor ?? "",
    deliveryLift: r.delivery_has_lift ?? false,
    deliveryParking: r.delivery_parking ?? "",
    deliveryBedrooms: r.delivery_bedrooms == null ? "" : String(r.delivery_bedrooms),
    needsPacking: r.needs_packing_service,
    needsBoxes: r.needs_packing_materials,
    serviceIds: r.service_ids,
    hours: r.estimated_hours[0] ?? "",
    inventory: r.inventory_description,
  };
}
