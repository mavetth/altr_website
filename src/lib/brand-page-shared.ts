import type { Product } from "./types";
import type { Perk } from "./brand-perks";

/**
 * Marka sayfasının İSTEMCİYE de giren parçaları: tipler ve saf yardımcılar.
 *
 * `brand-page.ts` katalogu okuyor, yani `node:fs` zincirine bağlı — bir istemci
 * bileşeni oradan DEĞER (sabit ya da fonksiyon) import ettiği anda tüm zincir
 * tarayıcı paketine giriyor ve derleme "node:fs/promises is not handled" ile
 * patlıyor. Tip importları silinip gittiği için bu hatayı tsc yakalamıyor; bu
 * dosya sınırın nerede olduğunu somutlaştırıyor.
 */

/** Marka sayfasında bir seferde kaç ürün. */
export const BRAND_PAGE_SIZE = 48;

export interface BrandStats {
  total: number;
  inStock: number;
  /** Kategori -> adet, çoktan aza. */
  categories: Array<{ cat: string; n: number }>;
  /** Fiyatı olanların en düşük/medyan/en yüksek değeri (baskın para biriminde). */
  priceLow: number | null;
  priceMid: number | null;
  priceHigh: number | null;
  currency: string;
}

export interface BrandPageData {
  brand: { name: string; slug: string; url: string | null };
  styles: string[];
  /** Markanın kendi sitesinde duyurduğu avantajlar (kargo/taksit/iade…). Boş olabilir. */
  perks: Perk[];
  stats: BrandStats;
  /** Sayfada gösterilecek ürünler (stoktakiler önce). */
  items: Product[];
  /** Filtre öncesi toplam — sayfalama için. */
  matched: number;
}

export interface BrandIndexRow {
  name: string;
  slug: string;
  count: number;
  styles: string[];
  /** Listede gösterilecek TEK avantaj — kargo varsa o, yoksa ilk sıradaki. */
  perk: Perk | null;
}

/**
 * Alfabetik gruplama harfi. Türkçe'ye göre: "Çanta" Ç'ye, "İstanbul" İ'ye düşer —
 * localeCompare ile sıralayıp sonra ASCII harfe indirgemek listeyi tutarsız yapardı.
 * Harf dışı ile başlayan adlar (ör. "4th") tek bir "#" kovasına toplanır.
 */
export function indexLetter(name: string): string {
  const c = name.trim().charAt(0).toLocaleUpperCase("tr");
  return /\p{L}/u.test(c) ? c : "#";
}
