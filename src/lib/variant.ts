import type { Product, Variant } from "./types";

/**
 * Varyant seçimi — arayüz ve import script'i AYNI kuralı kullanmak zorunda.
 *
 * Bu üç satır eskiden `query.ts` içindeydi; oradan import etmek script'e bütün sorgu/keşfet
 * zincirini (ve JSON okumalarını) sürüklüyor. Kural ise kataloğun `price` alanını da
 * belirlediği için scrape/import tarafının erişimi ŞART: kartta hangi varyant görünüyorsa
 * ürünün fiyatı o olmalı.
 */

/**
 * Kart/modal açılışta gösterilecek varyant indeksi: EN ÇOK BEDENİ OLAN STOKTAKİ renk.
 *
 * Ürün "stokta" sayılır (ve stok filtresinden geçer) EN AZ BİR rengi stoktaysa; ama varyant
 * dizisinin ilk elemanı (renge göre bölünmüş ürünlerin katlanma sırası) tükenmiş renk olabilir.
 * Varsayılanı 0 bırakırsak alınabilir bir ürün kartta tükenmiş rengiyle "STOKTA YOK" gibi
 * görünüyordu.
 *
 * "İlk stoktaki" yetmiyordu (2026-07-30): renklerin katalogdaki sırası markanın kendi
 * sıralaması ve çoğu zaman anlamsız. Kart, o rengin bedenlerini gösterdiği için, yalnız
 * "XS" kalmış bir renk açılışta seçildiğinde ürün tükenmiş gibi duruyordu — oysa yanındaki
 * renkte sekiz beden var. Artık en çok BEDEN üreten stoktaki renk seçiliyor: kullanıcı
 * ürünün en dolu hâliyle karşılaşır.
 *
 * Eşitlikte katalog sırası korunur (kararlı seçim: aynı ürün her boyamada aynı renkle
 * açılmalı). Hiç stok yoksa (TÜMÜ görünümündeki tükenmiş ürün) 0'a düşer.
 */
export function defaultVariantIndex(p: Product): number {
  let best = -1;
  let bestSizes = -1;
  for (let i = 0; i < p.variants.length; i++) {
    const v = p.variants[i];
    if (!v.inStock) continue;
    // "TEK BEDEN" bir çeşitlilik değil — ölçüde sayılmaz, ama renk yine aday.
    const n = v.sizes.filter((s) => s !== "TEK BEDEN").length;
    if (n > bestSizes) {
      bestSizes = n;
      best = i;
    }
  }
  return best >= 0 ? best : 0;
}

/**
 * Ürünün VİTRİN FİYATI: kartta açılışta hangi varyant görünüyorsa onun fiyatı.
 *
 * Eskiden `price` tüm renklerin/bedenlerin MİNİMUMU idi. Kart ise seçili varyantın
 * fiyatını yazıyordu; renge göre fiyatı değişen üründe (katalogun %5'i) kartta 1799 ₺
 * görünürken filtre ve sıralama 1099 ₺ ile eşleşiyordu. Artık tek bir "gösterilen fiyat"
 * var; aralık `priceMin`/`priceMax` alanlarında duruyor ve filtre onları kullanıyor.
 *
 * Fiyatsız varyanta düşerse fiyatı olan ilk varyanta geçer — kart "—" göstermesin.
 */
export function displayPrice(variants: Variant[], fallback: number | null = null): number | null {
  // `defaultVariantIndex` ile AYNI varyantı seçmek zorunda: kartta hangi renk açıksa
  // fiyat onun olmalı. İki yerde iki farklı seçim, bu dosyanın baştan çözdüğü
  // "kartta 1799 yazarken filtre 1099 ile eşleşiyor" hatasını geri getirirdi.
  const pick = variants[defaultVariantIndex({ variants } as Product)];
  if (pick && typeof pick.price === "number") return pick.price;
  const any = variants.find((v) => typeof v.price === "number");
  return any ? (any.price as number) : fallback;
}

/** Varyantların fiyat aralığı — filtre bu aralıkla kesişime bakar. */
export function priceRange(variants: Variant[]): { min: number | null; max: number | null } {
  const ps = variants.map((v) => v.price).filter((p): p is number => typeof p === "number" && p > 0);
  return ps.length ? { min: Math.min(...ps), max: Math.max(...ps) } : { min: null, max: null };
}
