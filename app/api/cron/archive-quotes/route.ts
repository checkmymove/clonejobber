import { NextResponse } from "next/server";
import { archiveStaleQuotes } from "@/lib/quotes/auto-archive";

export const dynamic = "force-dynamic";

/**
 * Daily Vercel cron: archives quotes still awaiting a reply 5 days after they were sent.
 * With CRON_SECRET set, Vercel sends it as a Bearer token and nothing else gets in.
 * The job itself only applies that business rule, so it is safe to run more than once.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const archived = await archiveStaleQuotes();
  return NextResponse.json({ ok: true, archived });
}
