// A job with packing has two visits: the packing service (by default the day before) and
// the collection (the move itself). They are told apart by the visit title, which is also
// what the Schedule calendar shows. Pure module: safe for client components and tests.

export const PACKING_VISIT_TITLE = "Packing service";
export const COLLECTION_VISIT_TITLE = "Collection";

export function isPackingVisit(title: string | null | undefined): boolean {
  return (title ?? "").trim().toLowerCase() === PACKING_VISIT_TITLE.toLowerCase();
}

type DatedVisit = { title: string | null; status: string; later: boolean; date: string | null; start: string };

const byDate = <T extends DatedVisit>(a: T, b: T) =>
  String(a.date).localeCompare(String(b.date)) || a.start.localeCompare(b.start);

/** Earliest open, dated visit of one kind (packing or collection; an untitled visit is a collection). */
export function firstVisitOfKind<T extends DatedVisit>(visits: T[], kind: "packing" | "collection"): T | null {
  return (
    visits
      .filter((v) => v.status !== "cancelled" && !v.later && v.date && isPackingVisit(v.title) === (kind === "packing"))
      .sort(byDate)[0] ?? null
  );
}
