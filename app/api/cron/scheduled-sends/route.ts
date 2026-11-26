import { NextResponse } from "next/server";
import { processScheduledSends } from "@/lib/send/scheduled";

export const dynamic = "force-dynamic";

/**
 * Vercel schedule (every 15 minutes): sends the emails and texts that are due, such as
 * the removal confirmation 24 hours after a packing confirmation. With CRON_SECRET set,
 * Vercel sends it as a Bearer token and nothing else gets in. Rows are claimed before
 * sending, so a repeated or overlapping run never sends twice.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const result = await processScheduledSends();
  return NextResponse.json({ ok: true, ...result });
}
