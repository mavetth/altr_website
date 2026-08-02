import { aggregateProducts } from "@/lib/aggregate";
import { runQuery, parseQuery } from "@/lib/query";
import { isDeadImage } from "@/lib/img-cache";
import { BRANDS } from "@/lib/brands";
import { styleCounts } from "@/lib/brand-styles";
import { decodeShare, resolveShare, parseShareMode, DEFAULT_LIST_NAME } from "@/lib/lists";
import { App } from "@/components/App";
import type { SharedList } from "@/store";

// İlk boyama sunucuda; sonraki filtre/sayfa etkileşimleri /api/products üzerinden.
export const dynamic = "force-dynamic";

function toSearchParams(sp: Record<string, string | string[] | undefined>): URLSearchParams {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const first = Array.isArray(v) ? v[0] : v;
    if (first !== undefined) usp.set(k, first);
  }
  return usp;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // sayfa doğrudan bir filtre/kategori/sayfa linkiyle açılırsa (paylaşılan link, yenileme,
  // geri tuşu), ilk boyama URL'deki durumu yansıtsın — DEFAULT_QUERY'ye sabitlenip
  // client'ta yeniden fetch'e gerek kalmasın diye.
  const sp = toSearchParams(await searchParams);
  const initialQuery = parseQuery(sp);

  const all = await aggregateProducts();
  // Görseli ölü bilinen ürünler sona (bkz. lib/query.ts QueryOptions) — /api/products
  // ile aynı yeteneği vermek zorundayız, yoksa ilk boyama ile sonraki istekler
  // farklı sıralama üretir ve sayfa kendi altından kayar.
  const initialResult = runQuery(all, initialQuery, { isDeadImage });

  // Paylaşılan liste: link `?liste=<kodlar>&ad=<başlık>` ile gelir. Ürünler SUNUCUDA
  // çözülür — alan kişi hesabı olmadan, tek istekte tam listeyi görür. Katalogdan
  // kalkmış ürünler sessizce düşer, kaç tane olduğu ayrıca söylenir.
  let shared: SharedList | null = null;
  const shareCode = sp.get("liste");
  if (shareCode) {
    const codes = decodeShare(shareCode);
    const items = resolveShare(all, codes);
    const mode = parseShareMode(sp.get("mod"));
    shared = {
      name: (sp.get("ad") ?? "").slice(0, 40) || (mode === "kombin" ? "KOMBİN" : DEFAULT_LIST_NAME),
      items,
      missing: Math.max(0, codes.length - items.length),
      mode,
    };
  }

  const brands = BRANDS.map((b) => ({
    name: b.name,
    slug: b.slug,
    live: Boolean(b.url && b.platform !== "none"),
    url: b.url,
  }));

  const urlByName: Record<string, string | null> = {};
  for (const b of BRANDS) urlByName[b.name] = b.url;

  // Kategori adetleri: 34 kategorilik düz listede hangisinin dolu olduğu görünsün.
  // Filtreden bağımsız, katalogun tamamı üzerinden — tek geçiş, sayfa başına ihmal edilebilir.
  const catCounts: Record<string, number> = {};
  for (const p of all) catCounts[p.category] = (catCounts[p.category] ?? 0) + 1;
  // görünümlerin sayacı: "TÜM ÜRÜNLER" katalogun tamamı, "MARKALAR" marka adedi
  catCounts["TÜM ÜRÜNLER"] = all.length;
  catCounts["MARKALAR"] = BRANDS.length;

  // Beden adetleri: filtredeki beden kutuları artık ELLE YAZILI beş harften değil,
  // katalogda gerçekten geçen bedenlerden türetiliyor (jean 30/32, ayakkabı 41,
  // "TEK BEDEN", 3XL…). Adedi 0 olan bir beden hiç çizilmez.
  const sizeCounts: Record<string, number> = {};
  for (const p of all) for (const s of p.sizes) sizeCounts[s] = (sizeCounts[s] ?? 0) + 1;

  // Tarz adetleri de katalogdan: tarz artık ürünün kendi alanı, marka sayısı değil
  // ÜRÜN sayısı gösteriliyor (bkz. src/lib/product-styles.ts).
  const styleCountMap = styleCounts(all);

  // Renk aileleri: etiketi olmayan ürün hiçbir kovaya girmez, yani sayı "bu renkte
  // KAÇ ürün bulunabilir" sorusunun dürüst cevabı (bkz. lib/color-tags.ts).
  const colorCounts: Record<string, number> = {};
  for (const p of all) for (const c of p.colorTags ?? []) colorCounts[c] = (colorCounts[c] ?? 0) + 1;

  return (
    <App
      initialQuery={initialQuery}
      initialResult={initialResult}
      shared={shared}
      brands={brands}
      brandCount={BRANDS.length}
      urlByName={urlByName}
      catCounts={catCounts}
      sizeCounts={sizeCounts}
      styleCounts={styleCountMap}
      colorCounts={colorCounts}
    />
  );
}
