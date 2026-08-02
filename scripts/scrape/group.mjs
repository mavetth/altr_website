// VariantRecord[] -> ProductGroup[] (import-catalog'un beklediği biçim).
//
// Bir "grup" = aynı markanın aynı adlı ürünü; grubun varyantları o ürünün renkleridir.
// Adaptörler renk başına bir kayıt üretir; burada onları ada göre topluyoruz.

import { colorToHex } from "../../src/lib/colors.ts";
import { categorize, trLower } from "../../src/lib/categorize.ts";

const uniq = (a) => [...new Set(a.filter(Boolean))];

/** Ad + marka -> grup anahtarı (renk adı ada gömülüyse ayıklanmaz; o işi importer yapar). */
function keyOf(r) {
  return `${r.brandSlug}|${trLower(r.displayName).replace(/[^a-zçğıöşü0-9]+/g, " ").trim()}`;
}

export function buildGroups(records) {
  const map = new Map();
  for (const r of records) {
    if (!r?.displayName || !r.image) continue;
    const k = keyOf(r);
    let g = map.get(k);
    if (!g) {
      g = {
        id: `${r.brandSlug}::${trLower(r.displayName).replace(/[^a-z0-9çğıöşü]/g, "")}`,
        brand: r.brand,
        brandSlug: r.brandSlug,
        name: r.displayName,
        // Kategori adı + kaynağın etiket/kategori metninden birlikte belirlenir; etiketler
        // ("Hoodie", "Baggy Pantolon") ad kadar, bazen addan daha güvenilir sinyaldir.
        category: categorize(r.displayName, r.sourceText),
        // Ham etiket/kategori metni saklanır: cinsiyet tespiti de bunu kullanır
        // ("Erkek Giyim", "Kadın" etiketleri ürün adında geçmese de kaynakta duruyor).
        sourceText: r.sourceText ?? "",
        currency: r.currency || "TRY",
        variants: [],
        sizesAll: [],
        priceMin: null,
        pop: 0,
        day: 999,
        source: "live",
      };
      map.set(k, g);
    }
    g.variants.push({
      color: r.color || "",
      hex: r.colorCode || colorToHex(r.color || r.displayName),
      image: r.image,
      images: uniq([r.image, ...(r.images ?? [])]).slice(0, 5),
      sizes: r.sizes ?? [],
      inStock: !!r.inStock,
      price: r.price ?? null,
      productUrl: r.productUrl ?? null,
    });
    g.sizesAll = uniq([...g.sizesAll, ...(r.sizes ?? [])]);
    if (r.price != null && (g.priceMin == null || r.price < g.priceMin)) g.priceMin = r.price;
    g.pop = Math.max(g.pop, r.pop ?? 0);
    g.day = Math.min(g.day, r.day ?? 999);
  }

  for (const g of map.values()) if (g.day === 999) g.day = 20;
  return [...map.values()];
}
