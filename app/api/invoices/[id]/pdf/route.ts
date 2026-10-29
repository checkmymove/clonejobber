import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/session";
import { isUuid } from "@/lib/funnel/validation";
import { buildInvoicePdf, pdfDownload } from "@/lib/pdf/builders";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAdminUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return new NextResponse("Not found", { status: 404 });

  const pdf = await buildInvoicePdf(id);
  if (!pdf) return new NextResponse("Not found", { status: 404 });
  const inline = new URL(req.url).searchParams.get("inline") === "1";
  return pdfDownload(pdf, inline ? "inline" : "attachment");
}
