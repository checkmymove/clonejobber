import { NextResponse } from "next/server";
import { isUuid } from "@/lib/funnel/validation";
import { buildJobPdf, pdfDownload } from "@/lib/pdf/builders";

export const dynamic = "force-dynamic";

/** PDF download from the client view. The document id is the client's link. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isUuid(id)) return new NextResponse("Not found", { status: 404 });
  const pdf = await buildJobPdf(id);
  if (!pdf) return new NextResponse("Not found", { status: 404 });
  return pdfDownload(pdf);
}
