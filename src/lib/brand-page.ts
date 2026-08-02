import type { Product } from "./types";
import { aggregateProducts } from "./aggregate";
import { BRANDS, brandBySlug } from "./brands";
import { brandStyles } from "./brand-styles.ts";
import { brandPerks } from "./brand-perks.ts";
import { buildFeed, currentSeed } from "./discovery.ts";
import {
  BRAND_PAGE_SIZE,
  type BrandIndexRow,
  type BrandPageData,
  type BrandStats,
} from "./brand-page-shared";

/**
 * Marka sayfalarının veri katmanı.
 *
 * Ana vitrinden ayrı duruyor çünkü soru farklı: orada "bugün ne göstermeliyim", burada
 * "bu marka kim". Marka sayfası katalogun tamamını değil, markanın KENDİ vitrinini
 * gösterir — o yüzden keşfet akışının marka-yorgunluğu/serpme kuralları burada anlamsız,
 * yalnız kalite sıralaması ve stok önceliği kalır.
 */

/* Tipler ve saf yardımcılar `brand-page-shared.ts`te: bu dosya katalogu (yani
   `node:fs`i) okuyor, istemci bileşenleri oradan DEĞER alamaz. Aşağıda yeniden
   dışa veriliyorlar, çağıranların import yolu değişmesin. */
export { BRAND_PAGE_SIZE, indexLetter } from "./brand-page-shared";
export type { BrandStats, BrandPageData, BrandIndexRow } from "./brand-page-shared";

function statsOf(items: Product[]): BrandStats {
  const cats = new Map<string, number>();
  const curr = new Map<string, number>();
  for (const p of items) {
    cats.set(p.category, (cats.get(p.category) ?? 0) + 1);
    curr.set(p.currency, (curr.get(p.currency) ?? 0) + 1);
  }
  // Baskın para birimi: fiyat aralığını iki farklı birimden karıştırmayalım.
  const currency = [...curr.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "TRY";
  const prices = items
    .filter((p) => p.price != null && p.currency === currency)
    .map((p) => p.price as number)
    .sort((a, b) => a - b);

  return {
    total: items.length,
    inStock: items.filter((p) => p.inStock).length,
    categories: [...cats.entries()]
      .map(([cat, n]) => ({ cat, n }))
      .sort((a, b) => b.n - a.n),
    priceLow: prices[0] ?? null,
    priceMid: prices.length ? prices[Math.floor(prices.length / 2)] : null,
    priceHigh: prices[prices.length - 1] ?? null,
    currency,
  };
}

export async function loadBrandPage(
  slug: string,
  page = 1,
): Promise<BrandPageData | null> {
  const brand = brandBySlug(slug);
  if (!brand) return null;

  const all = await aggregateProducts();
  const mine = all.filter((p) => p.brandSlug === slug);
  // Katalogda hiç ürünü olmayan marka için sayfa açmak ölü bir sayfa üretir.
  if (!mine.length) return null;

  // Vitrindeki kuralın aynısı: tükenmişler en sonda (bkz. query.ts runQuery).
  const seed = currentSeed();
  const live = mine.filter((p) => p.inStock);
  const dead = mine.filter((p) => !p.inStock);
  const ordered = buildFeed(live, "kategori", seed, live.length).concat(
    buildFeed(dead, "kategori", seed, dead.length),
  );

  const start = (Math.max(1, page) - 1) * BRAND_PAGE_SIZE;
  return {
    brand: { name: brand.name, slug: brand.slug, url: brand.url },
    styles: brandStyles(slug),
    perks: brandPerks(slug),
    stats: statsOf(mine),
    items: ordered.slice(start, start + BRAND_PAGE_SIZE),
    matched: mine.length,
  };
}

/** Markalar sayfasının listesi — alfabetik, katalogdaki ürün adetleriyle. */
export async function loadBrandIndex(): Promise<BrandIndexRow[]> {
  const all = await aggregateProducts();
  const counts = new Map<string, number>();
  for (const p of all) counts.set(p.brandSlug, (counts.get(p.brandSlug) ?? 0) + 1);

  return BRANDS.map((b) => {
    const perks = brandPerks(b.slug);
    return {
      name: b.name,
      slug: b.slug,
      count: counts.get(b.slug) ?? 0,
      styles: brandStyles(b.slug),
      perk: perks.find((p) => p.tip === "kargo") ?? perks[0] ?? null,
    };
  })
    .filter((b) => b.count > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
}
