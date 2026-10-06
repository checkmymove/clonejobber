import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/session";
import { getCompanyId } from "@/lib/company";
import { sql } from "@/lib/db";
import { isUuid } from "@/lib/funnel/validation";
import { quotePdfFileName, quotePdfResponse, renderQuoteDetailPdf } from "@/lib/quotes/pdf";
import { getQuoteDetail } from "@/lib/quotes/queries";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAdminUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return new NextResponse("Not found", { status: 404 });
  const companyId = await getCompanyId();
  if (!companyId) return new NextResponse("Not found", { status: 404 });

  const quote = await getQuoteDetail(id);
  if (!quote) return new NextResponse("Not found", { status: 404 });

  const pdf = renderQuoteDetailPdf(quote);
  const fileName = quotePdfFileName(quote.number);

  await sql`
    insert into quote_pdf_exports (company_id, quote_id, file_name, byte_size)
    values (${companyId}, ${quote.id}, ${fileName}, ${pdf.byteLength})
  `;
  await sql`
    insert into activity_log (company_id, actor, action, entity, entity_id, summary)
    values (${companyId}, 'admin', 'quote.pdf_exported', 'quote', ${quote.id},
            ${`Saved PDF ${fileName}`})
  `;

  const response = quotePdfResponse(pdf, fileName);
  return new NextResponse(response.body, { status: 200, headers: response.headers });
}
