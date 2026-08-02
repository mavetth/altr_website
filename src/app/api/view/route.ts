import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { recordView, type ViewEvent } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/view — kullanıcı bir ürünün modalını açtı.
 *
 * Çıkış ölçümüyle aynı ilkeler: gövdeye güvenilmez (her alan kırpılır), yanıt
 * gövdesizdir (sendBeacon ile de gönderilebiliyor), hata vitrini etkilemez.
 * Görüntülenme çıkışın PAYDASIDIR: "modalı açan kaç kişi mağazaya gitti"
 * sorusunun cevabı bu iki sayının oranıdır.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const str = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : undefined);
  const brandSlug = str(body.brandSlug, 80);
  const productId = str(body.productId, 200);
  if (!brandSlug || !productId) return NextResponse.json({ ok: false }, { status: 400 });

  const ev: ViewEvent = {
    at: new Date().toISOString(),
    kind: "modal",
    brand: str(body.brand, 120) ?? brandSlug,
    brandSlug,
    productId,
    productName: str(body.productName, 200),
    category: str(body.category, 60),
    price: typeof body.price === "number" ? body.price : null,
    currency: str(body.currency, 8),
    ctxCat: str(body.ctxCat, 60),
    ctxQuery: str(body.ctxQuery, 120),
    session: str(body.session, 64),
  };

  await recordView(ev);
  return new NextResponse(null, { status: 204 });
}
