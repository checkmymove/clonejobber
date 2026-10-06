import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { archiveQuote } from "@/lib/funnel/engine";
import { isUuid } from "@/lib/funnel/validation";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ ok: false, message: "Quote not found." }, { status: 404 });

  let archived = true;
  try {
    const body = (await req.json()) as { archived?: boolean };
    if (typeof body.archived === "boolean") archived = body.archived;
  } catch {
    archived = true;
  }

  const result = await archiveQuote(sql, id, archived);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
