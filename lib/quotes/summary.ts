const SERVICE_DETAIL: Record<string, string> = {
  "Driver + Luton Van":
    "A driver will attend with a Luton van to load at the collection address, transport the goods, and unload at the delivery address.",
  "Driver + Helper + Luton Van":
    "A driver and a helper will attend with a Luton van. The crew will carry, load, transport and unload the goods between the collection and delivery addresses.",
  "Office Relocation":
    "Office relocation of furniture, equipment and packed items from the current workplace to the new address.",
  "Disposal Service":
    "Collection and transport of items for disposal, including loading and delivery to the agreed disposal point.",
  "Piano Service":
    "Specialist piano move, with careful handling from the collection point through transport and placement at the delivery address.",
  "Helper Service":
    "An additional helper on site to carry, load and unload alongside the booked crew.",
  "Fixed price":
    "One agreed price for the whole job, instead of an hourly rate.",
  "Packing service":
    "The crew will pack items before they are loaded and transport them to the delivery address.",
};

export function describeService(name: string): string {
  return (
    SERVICE_DETAIL[name] ??
    `${name} will be carried out as part of this removal.`
  );
}

export type QuoteLocation = {
  address: string | null;
  postcode: string | null;
  floor: string | null;
  hasLift: boolean | null;
  parking: string | null;
  bedrooms: number | null;
};

export function hoursToQty(hours: string[]): string {
  const numeric = hours.map((h) => h.trim()).find((h) => /^\d+(\.\d+)?$/.test(h));
  return numeric ?? "1";
}

function durationSentence(hours: string[]): string {
  const values = hours.map((h) => h.trim()).filter(Boolean);
  if (values.length === 0) return "Estimated duration was not set on the request.";
  if (values.length === 1 && /^\d+$/.test(values[0])) {
    const n = Number(values[0]);
    return `Estimated duration: ${n} hour${n === 1 ? "" : "s"}, counted from arrival at the collection address until the last item is unloaded.`;
  }
  return `Estimated duration: ${values.join(", ")}, counted from arrival at the collection address until the last item is unloaded.`;
}

function locationBlock(title: string, loc: QuoteLocation): string {
  const address = [loc.address, loc.postcode].filter(Boolean).join(", ") || "Address not provided";
  const lines = [
    address,
    `Floor: ${loc.floor?.trim() || "not set"}`,
    `Lift: ${loc.hasLift == null ? "not set" : loc.hasLift ? "yes" : "no"}`,
    `Parking: ${loc.parking?.trim() || "not set"}`,
    `Bedrooms: ${loc.bedrooms == null ? "not set" : String(loc.bedrooms)}`,
  ];
  return `${title}\n${lines.join("\n")}`;
}

export function buildServiceSummary(input: {
  services: string[];
  hours: string[];
  needsPacking: boolean;
  needsMaterials: boolean;
  pickup: QuoteLocation;
  delivery: QuoteLocation;
}): string {
  const services =
    input.services.length > 0
      ? input.services
          .map((name) => {
            const detail = describeService(name);
            return `${name}. ${detail}`;
          })
          .join("\n\n")
      : "No service was selected on the request.";

  const packing = input.needsPacking
    ? "Packing service: included. The crew will pack items before they are loaded."
    : "Packing service: not included. Items should be ready to load.";
  const materials = input.needsMaterials
    ? "Packing materials: included. Boxes and packing materials will be supplied."
    : "Packing materials: not included.";

  return [
    "Removal service based on this request. The crew will carry out the services below.",
    `Services to be provided\n${services}`,
    `Duration\n${durationSentence(input.hours)}`,
    `Packing\n${packing}\n${materials}`,
    locationBlock("Collection", input.pickup),
    locationBlock("Delivery", input.delivery),
  ].join("\n\n");
}
