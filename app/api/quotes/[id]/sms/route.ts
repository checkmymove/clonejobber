import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/session";
import { isUuid } from "@/lib/funnel/validation";
import { sendComposedQuoteSms } from "@/lib/sms/send";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ ok: false, message: "Quote not found." }, { status: 404 });

  let body: { to?: string; message?: string } = {};
  try {
    body = (await req.json()) as { to?: string; message?: string };
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON body." }, { status: 400 });
  }

  const result = await sendComposedQuoteSms({
    quoteId: id,
    to: body.to ?? "",
    message: body.message ?? "",
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
