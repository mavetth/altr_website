import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { recordOutbound, summarizeOutbound, type OutboundEvent } from "@/lib/events";
import { NO_STORE, requireAdmin } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/outbound — kullanıcı dışarı yönlendirilirken çağrılır.
 * Gövde istemciden gelir ama HİÇBİR alanına olduğu gibi güvenilmez: hedef host
 * sunucuda URL'den yeniden türetilir, metinler kırpılır. Aksi hâlde olay dosyası
 * istemcinin yazdığı keyfi veriyle dolar.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const str = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : undefined);
  const url = str(body.url, 2000);
  let targetHost = "";
  if (url) {
    try {
      targetHost = new URL(url).hostname.toLowerCase();
    } catch {
      /* bozuk url -> host boş kalır */
    }
  }
  const brandSlug = str(body.brandSlug, 80);
  if (!brandSlug) return NextResponse.json({ ok: false }, { status: 400 });

  const ev: OutboundEvent = {
    at: new Date().toISOString(),
    kind: body.kind === "product" ? "product" : "brand",
    brand: str(body.brand, 120) ?? brandSlug,
    brandSlug,
    productId: str(body.productId, 200),
    productName: str(body.productName, 200),
    category: str(body.category, 60),
    targetHost,
    price: typeof body.price === "number" ? body.price : null,
    currency: str(body.currency, 8),
    ctxCat: str(body.ctxCat, 60),
    ctxQuery: str(body.ctxQuery, 120),
    session: str(body.session, 64),
  };

  await recordOutbound(ev);
  // Gövdesiz yanıt: bu istek sendBeacon ile de gönderilebiliyor, cevabı kimse okumuyor.
  return new NextResponse(null, { status: 204 });
}

/**
 * GET /api/outbound?days=30 — ham özet (ileride sıralama algoritmasının girdisi).
 *
 * ADMİNE ÖZEL: hangi markanın ne kadar trafik çevirdiği ticari bir bilgi, herkese
 * açık bir uçtan verilemez. Yetki oturum çerezinden okunur (bkz. lib/api-auth.ts).
 */
export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if ("deny" in gate) return gate.deny;

  const days = Math.min(365, Math.max(1, Number(req.nextUrl.searchParams.get("days") ?? 30)));
  const summary = await summarizeOutbound(days);
  return NextResponse.json(summary, { headers: NO_STORE });
}
