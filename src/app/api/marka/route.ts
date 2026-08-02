import { NextResponse } from "next/server";
import { loadBrandIndex, loadBrandPage } from "@/lib/brand-page";

/**
 * Marka rehberi ve marka sayfasının VERİ ucu.
 *
 * `/markalar` ve `/<slug>` sayfaları bu veriyi doğrudan sunucuda okur (SEO). Bu uç,
 * vitrinin içinden sekme değiştirerek aynı ekranlara geçildiğinde kullanılır —
 * kullanıcı sayfa yenilemeden markaya girip çıkabilsin diye.
 *
 *   GET /api/marka              → marka rehberi (alfabetik satırlar)
 *   GET /api/marka?slug=void    → tek markanın sayfası (&sayfa=2 ile derinlik)
 */

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const slug = sp.get("slug");
  const headers = { "Cache-Control": "no-store" };

  if (!slug) {
    return NextResponse.json({ rows: await loadBrandIndex() }, { headers });
  }

  const page = Math.max(1, Number(sp.get("sayfa") ?? "1") || 1);
  const data = await loadBrandPage(slug, page);
  if (!data) return NextResponse.json({ error: "yok" }, { status: 404, headers });
  return NextResponse.json(data, { headers });
}
