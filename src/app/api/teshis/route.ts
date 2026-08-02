import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { NO_STORE, requireAdmin } from "@/lib/api-auth";
import { aggregateProducts } from "@/lib/aggregate";
import { deadImageCount } from "@/lib/img-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/teshis — sunucunun o anki hâli. ADMİNE ÖZEL.
 *
 * "Vitrin neden böyle davranıyor" sorusunun ilk durağı. Bu tur eklendi çünkü iki ayrı
 * arıza yalnız sunucuya SSH ile bakarak anlaşılabiliyordu:
 *   · katalog boş dönüyor ama sunucu ayakta (bkz. lib/aggregate.ts'teki memo hatası)
 *   · hangi katalog dosyasının yüklü olduğu (ALTR_CATALOG) dışarıdan görünmüyor
 *
 * Ölçüm değil TEŞHİS: burada iş sonucu değil, sistemin durumu var.
 */
export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if ("deny" in gate) return gate.deny;

  const all = await aggregateProducts();
  const mem = process.memoryUsage();
  const mb = (n: number) => `${Math.round(n / 1024 / 1024)} MB`;

  return NextResponse.json(
    {
      katalog_dosyasi: process.env.ALTR_CATALOG ?? ".data/catalog.json (varsayılan)",
      urun_sayisi: all.length,
      stokta: all.filter((p) => p.inStock).length,
      marka_sayisi: new Set(all.map((p) => p.brandSlug)).size,
      // 0 ürün + ayakta sunucu = katalog okunamıyor demektir; en kritik satır bu.
      katalog_durumu: all.length ? "yüklü" : "BOŞ — katalog okunamadı, sunucu günlüğüne bak",
      olu_bilinen_gorsel: deadImageCount(),
      heap: mb(mem.heapUsed),
      rss: mb(mem.rss),
      calisma_suresi_dk: Math.round(process.uptime() / 60),
      node: process.version,
      ortam: process.env.NODE_ENV ?? "?",
    },
    { headers: NO_STORE },
  );
}
