import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { isUuid } from "@/lib/funnel/validation";
import { buildQuotePdf, pdfDownload } from "@/lib/pdf/builders";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAdminUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return new NextResponse("Not found", { status: 404 });

  const pdf = await buildQuotePdf(id);
  if (!pdf) return new NextResponse("Not found", { status: 404 });

  await sql`
    insert into quote_pdf_exports (company_id, quote_id, file_name, byte_size)
    values (${pdf.companyId}, ${id}, ${pdf.fileName}, ${pdf.bytes.byteLength})
  `;
  await sql`
    insert into activity_log (company_id, actor, action, entity, entity_id, summary)
    values (${pdf.companyId}, 'admin', 'quote.pdf_exported', 'quote', ${id},
            ${`Saved PDF ${pdf.fileName}`})
  `;
  return pdfDownload(pdf);
}
