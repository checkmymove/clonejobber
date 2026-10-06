import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { isUuid } from "@/lib/funnel/validation";
import { quotePdfFileName, quotePdfResponse, renderQuoteDetailPdf } from "@/lib/quotes/pdf";
import { getQuoteDetail } from "@/lib/quotes/queries";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isUuid(id)) return new NextResponse("Not found", { status: 404 });

  const quote = await getQuoteDetail(id);
  if (!quote) return new NextResponse("Not found", { status: 404 });

  const pdf = renderQuoteDetailPdf(quote);
  const fileName = quotePdfFileName(quote.number);
  await sql`
    insert into quote_pdf_exports (company_id, quote_id, file_name, byte_size)
    values (${quote.company_id}, ${quote.id}, ${fileName}, ${pdf.byteLength})
  `;
  await sql`
    insert into activity_log (company_id, actor, action, entity, entity_id, summary)
    values (${quote.company_id}, 'client', 'quote.pdf_exported', 'quote', ${quote.id},
            ${`Downloaded PDF ${fileName}`})
  `;

  const response = quotePdfResponse(pdf, fileName);
  return new NextResponse(response.body, { status: 200, headers: response.headers });
}
