import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, destroySession } from "@/lib/auth";
import { clearSessionCookie } from "@/lib/auth-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST → oturumu sunucuda da sil (çerezi silmek tek başına yetmez). */
export async function POST(req: NextRequest) {
  await destroySession(req.cookies.get(SESSION_COOKIE)?.value);
  return clearSessionCookie(
    NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } }),
  );
}
