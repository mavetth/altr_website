import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { readCounts, topRequested, unvoteRestock, voteRestock } from "@/lib/restock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Anonim oy işareti. Hesapla ilgisi yok (bilerek — oy vermek için üye olmak gerekseydi
 * sinyalin çoğu kaybolurdu); yalnız aynı tarayıcının aynı ürüne iki kez oy vermesini
 * engeller. HttpOnly: sayfadaki hiçbir script okuyamaz.
 */
const VOTER_COOKIE = "altr-vid";
const VOTER_MAX_AGE = 60 * 60 * 24 * 365;

function newVoterId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 20);
}

function voterOf(req: NextRequest): { id: string; fresh: boolean } {
  const cur = req.cookies.get(VOTER_COOKIE)?.value;
  if (cur && /^[a-z0-9]{8,40}$/i.test(cur)) return { id: cur, fresh: false };
  return { id: newVoterId(), fresh: true };
}

function withVoter(res: NextResponse, v: { id: string; fresh: boolean }): NextResponse {
  if (v.fresh) {
    res.cookies.set(VOTER_COOKIE, v.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: VOTER_MAX_AGE,
    });
  }
  return res;
}

/**
 * GET ?ids=a,b,c  → o ürünlerin oy sayıları + benim oy verdiklerim
 * GET ?top=1      → en çok istenenler (talep raporu)
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  if (sp.get("top")) {
    const limit = Math.min(500, Number(sp.get("limit") ?? "100") || 100);
    return NextResponse.json(
      { items: await topRequested(limit) },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const ids = (sp.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 200);
  const v = voterOf(req);
  const data = await readCounts(ids, v.id);
  // Yalnız okuma yapan istek yeni çerez BASMAZ: sayaçları görmek için işaretlenmeye
  // gerek yok, işaret ancak oy verilince anlamlı.
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

/** POST { productId, on, brandSlug?, name? } → oy ver / geri al */
export async function POST(req: NextRequest) {
  let body: { productId?: string; on?: boolean; brandSlug?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const productId = String(body.productId ?? "").slice(0, 200);
  if (!productId) return NextResponse.json({ error: "productId gerekli" }, { status: 400 });

  const v = voterOf(req);
  const on = body.on !== false;
  const r = on
    ? await voteRestock(productId, v.id, {
        brandSlug: body.brandSlug?.slice(0, 80),
        name: body.name?.slice(0, 160),
      })
    : await unvoteRestock(productId, v.id);

  return withVoter(NextResponse.json({ ...r, on }, { headers: { "Cache-Control": "no-store" } }), v);
}
