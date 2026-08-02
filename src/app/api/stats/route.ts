import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { NO_STORE, requireAdmin } from "@/lib/api-auth";
import { summarizeStats } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/stats?days=30 — ADMIN'e özel davranış özeti.
 *
 * Yetki sunucuda, oturum çerezinden okunur (bkz. lib/api-auth.ts); istemcinin
 * gönderdiği hiçbir alan (rol, e-posta) dikkate alınmaz.
 */
export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if ("deny" in gate) return gate.deny;

  const raw = Number(req.nextUrl.searchParams.get("days") ?? 30);
  const days = Math.min(180, Math.max(1, Number.isFinite(raw) ? Math.round(raw) : 30));
  const summary = await summarizeStats(days);
  return NextResponse.json(summary, { headers: NO_STORE });
}
