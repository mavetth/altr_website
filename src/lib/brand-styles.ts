// Node'un tip-soymayla doğrudan çalıştırdığı scriptler için JSON import attribute'u
// gerekiyor (bkz. brand-scores.ts).
import RAW from "../../data/brand-styles.json" with { type: "json" };

/**
 * MARKA TARZI — vitrinin ikinci ekseni.
 *
 * Kategori "ne giydiğin"i söyler (TİŞÖRT, MONT); tarz "nasıl giyindiğin"i. Kullanıcı
 * çoğu zaman ikincisini arıyor: "techwear bir şey" diye bakan biri mont/pantolon/çanta
 * arasında gezinmek istemiyor, o dünyayı bir bütün olarak görmek istiyor.
 *
 * Buradaki tablo markanın tarzıdır ve ÜRÜN tarzının ÖNSELİDİR (prior): alternatif
 * giyimde bir markanın katalogu tek bir sahneye aittir, o yüzden iyi bir başlangıç
 * tahminidir. Ama tek başına yetmiyordu — ürünlerin %86,6'sı "streetwear", %55,6'sı
 * "basic" çıkıyordu, yani filtre hiçbir şeyi ayırmıyordu ve DESENLİ bir ürün "basic"
 * görünüyordu. Ürünün kendi tarzı `src/lib/product-styles.ts`te bu önselin üstüne
 * kurulur; sorgu ürünün `styles` alanına bakar, bu tabloya değil.
 *
 * Bu tablo hâlâ marka ROZETLERİNDE ve /markalar sayfasında kullanılıyor.
 *
 * Veri: data/brand-styles.json — elle düzenlenir, scraper DOKUNMAZ.
 */

export const STYLES = [
  { k: "streetwear", label: "STREETWEAR", note: "sokak, grafik, oversize" },
  { k: "basic", label: "BASIC", note: "sade, günlük, temel parça" },
  { k: "techwear", label: "TECHWEAR", note: "teknik kumaş, işlevsel, karanlık" },
  { k: "ravewear", label: "RAVEWEAR", note: "gece, kulüp, deneysel" },
  { k: "spor", label: "SPOR", note: "aktif, performans, eşofman" },
  { k: "old-money", label: "OLD MONEY", note: "sakin lüks, gömlek, triko" },
  // 2026-07-29'da eklendi. Ham kaynakta (data/brands.csv) zaten "old money/minimal"
  // diye 6 markada yazılıydı ama old-money'e katlanmıştı; sade kesim + düz renk
  // ayrı bir eksen ve kullanıcı bunu ayrıca istiyor (örnek: Kaft).
  { k: "minimalist", label: "MİNİMALİST", note: "sade kesim, düz renk, sakin palet" },
  // 2026-07-30'da eklendi. Kendi ekseni: 2000'ler estetiği (baggy/low-rise kesim,
  // parlak-metalik yüzey, kelebek/yıldız/rhinestone motifleri, mini omuz çantası).
  // `streetwear`e katlanamaz — kesim ve palet bambaşka; `ravewear` ile komşu ama
  // ravewear GECE/kulüp, y2k GÜNDÜZ ve nostaljik.
  { k: "y2k", label: "Y2K", note: "2000'ler, baggy, parlak, rhinestone" },
] as const;

export type StyleKey = (typeof STYLES)[number]["k"];

const STYLE_KEYS = new Set<string>(STYLES.map((s) => s.k));

export function isStyleKey(v: string): v is StyleKey {
  return STYLE_KEYS.has(v);
}

const TABLE = (RAW as { tarzlar: Record<string, string[]> }).tarzlar;

/** Slug -> tarzları. Dosyada yoksa boş dizi (tarz filtrelerinde çıkmaz). */
export function brandStyles(slug: string): StyleKey[] {
  const v = TABLE[slug];
  return Array.isArray(v) ? (v.filter(isStyleKey) as StyleKey[]) : [];
}

/**
 * Seçilen tarzlardan HERHANGİ birine ait marka slug'ları. Sorgu bunu bir kez kurup
 * ürün başına Set üyeliği testi yapar — 54 bin ürün × tarz dizisi taraması yerine.
 */
export function slugsForStyles(keys: readonly StyleKey[]): Set<string> {
  const want = new Set<string>(keys);
  const out = new Set<string>();
  for (const [slug, list] of Object.entries(TABLE)) {
    if (list.some((s) => want.has(s))) out.add(slug);
  }
  return out;
}

/**
 * Tarz -> o tarzdaki MARKA sayısı. Yalnız marka tablosunu denetleyen script kullanır
 * (scripts/check-brand-styles.mjs) — vitrinde ÜRÜN adedi gösteriliyor.
 */
export function brandStyleCounts(): Record<StyleKey, number> {
  const out = Object.fromEntries(STYLES.map((s) => [s.k, 0])) as Record<StyleKey, number>;
  for (const list of Object.values(TABLE)) {
    for (const s of list) if (isStyleKey(s)) out[s]++;
  }
  return out;
}

/**
 * Tarz -> o tarzdaki ÜRÜN sayısı. Filtre panelinde çipin yanında gösterilir.
 *
 * Eskiden MARKA sayardı; tarz ürüne taşındıktan sonra o sayı yanıltıcı oldu (14 markalı
 * techwear'ın 640 ürünü var, 36 markalı basic'in 25 bin). Katalogdan sayılır.
 */
export function styleCounts(products: ReadonlyArray<{ styles?: string[] }>): Record<StyleKey, number> {
  const out = Object.fromEntries(STYLES.map((s) => [s.k, 0])) as Record<StyleKey, number>;
  for (const p of products) {
    for (const s of p.styles ?? []) if (isStyleKey(s)) out[s]++;
  }
  return out;
}

/** Tarzı verilmemiş marka slug'ları — denetim için (scripts/check-brand-styles.mjs). */
export function untaggedBrands(allSlugs: readonly string[]): string[] {
  return allSlugs.filter((s) => !TABLE[s]?.length);
}
