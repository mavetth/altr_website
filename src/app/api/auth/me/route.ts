import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, publicUser, sessionUser } from "@/lib/auth";
import { googleConfigured } from "@/lib/google-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET → oturumdaki kullanıcı (yoksa null) + Google düğmesi gösterilsin mi. */
export async function GET(req: NextRequest) {
  const u = await sessionUser(req.cookies.get(SESSION_COOKIE)?.value);
  return NextResponse.json(
    { user: u ? publicUser(u) : null, google: googleConfigured() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
