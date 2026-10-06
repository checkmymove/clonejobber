import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { deleteQuote } from "@/lib/funnel/engine";
import { isUuid } from "@/lib/funnel/validation";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ ok: false, message: "Quote not found." }, { status: 404 });
  const result = await deleteQuote(sql, id);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
