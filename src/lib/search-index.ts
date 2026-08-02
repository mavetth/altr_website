import type { Product } from "./types.ts";
import { searchFold } from "./slug.ts";
import { expandToken } from "./search-synonyms.ts";
import { colorTagLabel } from "./color-tags.ts";

/**
 * ÜRÜN ARAMASI.
 *
 * Önceki hâli tek satırdı: `p.name.toLowerCase().includes(q) || p.brand...`. Üç şeyi
 * birden yapamıyordu:
 *
 *  1. TÜRKÇE. Düz `toLowerCase()` "Oath Istanbul"u "oath ıstanbul" yapıyor; klavyede
 *     "istanbul" yazan kullanıcı noktalı i ile noktasız ı eşleşmediği için markayı
 *     BULAMIYORDU. Aynı sorun "Köstebek"i "kostebek" diye arayanda da vardı.
 *     `searchFold` iki tarafa da uygulanınca ikisi de çözülüyor.
 *  2. ÇOK KELİME. "siyah tişört" tek parça olarak aranıyordu; ürün adında tam olarak
 *     o sırayla geçmedikçe HİÇ sonuç yoktu. Artık sorgu jetonlara bölünüyor ve her
 *     jeton ayrı ayrı aranıyor (VE).
 *  3. ALAKA. Arama bir filtreydi, sıralama yine keşfet dokumasıydı — yani "nike"
 *     yazınca Nike ürünleri sayfanın herhangi bir yerinde olabiliyordu. Artık sorgu
 *     doluyken sıralama alaka skoruna geçiyor.
 *
 * Aranabilir metin ürün başına BİR KEZ katlanıp modül içi haritada tutulur. Kataloga
 * yazılmadı bilerek: dosya 114 MB ve bu alan onu ~%12 büyütürdü; katlama işi ise
 * 69 bin ürün için tek seferlik ~150 ms.
 */

/** id -> katlanmış aranabilir metin. Katalog memo'su ile aynı ömürde. */
const cache = new Map<string, string>();

/** HMR / katalog değişiminde çağrılır (aggregate.clearAggregateMemo ile birlikte). */
export function clearSearchIndex(): void {
  cache.clear();
}

function haystack(p: Product): string {
  const hit = cache.get(p.id);
  if (hit !== undefined) return hit;
  // Kategori ve renk aileleri de metne giriyor: "mavi hoodie" araması, adında "mavi"
  // geçmese de mavi etiketli hoodie'leri bulsun.
  const parts = [
    p.name,
    p.brand,
    p.category,
    ...(p.styles ?? []),
    ...(p.colorTags ?? []).map(colorTagLabel),
    ...(p.variants ?? []).map((v) => v.color).filter(Boolean),
  ];
  const text = searchFold(parts.join(" "));
  cache.set(p.id, text);
  return text;
}

export interface SearchQuery {
  /** Ham (katlanmış) sorgu — marka tam eşleşmesi için. */
  full: string;
  /** Her jeton için eşanlamlılarıyla genişletilmiş liste. Jetonlar arası VE. */
  groups: string[][];
}

export function parseSearch(raw: string): SearchQuery | null {
  const full = searchFold(String(raw ?? "").trim());
  if (!full) return null;
  const tokens = full.split(/\s+/).filter((t) => t.length > 0);
  if (!tokens.length) return null;
  return { full, groups: tokens.map(expandToken) };
}

/** Ürün sorguya uyuyor mu — HER jeton grubu (veya eşanlamlısı) metinde geçmeli. */
export function matches(p: Product, q: SearchQuery): boolean {
  const text = haystack(p);
  for (const group of q.groups) {
    if (!group.some((t) => text.includes(t))) return false;
  }
  return true;
}

/** Sözcük başında mı geçiyor — "san" araması "sanat"ı bulsun, "kırmızısan"ı değil. */
function hasWordStart(text: string, token: string): boolean {
  let i = text.indexOf(token);
  while (i >= 0) {
    if (i === 0 || !/[a-z0-9]/.test(text[i - 1])) return true;
    i = text.indexOf(token, i + 1);
  }
  return false;
}

/**
 * Alaka skoru. Mutlak değeri anlamsız, yalnız sıralama içindir.
 *
 * Sıralama sezgisi: kullanıcı bir MARKA yazdıysa o markanın ürünleri gelmeli; ürün
 * ADINDA geçiyorsa isim eşleşmesi kategoriden değerli; kategori/renk eşleşmesi en zayıf
 * sinyal (çok ürün paylaşıyor).
 */
export function relevance(p: Product, q: SearchQuery): number {
  const brand = searchFold(p.brand);
  const name = searchFold(p.name);
  let score = 0;

  // Marka adının tamamı yazıldıysa bu en güçlü niyet işareti.
  if (brand === q.full) score += 120;
  else if (brand.includes(q.full)) score += 70;

  if (name.startsWith(q.full)) score += 55;
  else if (name.includes(q.full)) score += 30;

  for (const group of q.groups) {
    // Jeton başına en iyi eşleşme sayılır; eşanlamlı üzerinden gelen eşleşme,
    // kullanıcının yazdığı jetonun kendisi kadar güçlü sayılmaz.
    let best = 0;
    for (let i = 0; i < group.length; i++) {
      const t = group[i];
      const viaSynonym = i > 0;
      let s = 0;
      if (hasWordStart(name, t)) s = 22;
      else if (name.includes(t)) s = 12;
      else if (hasWordStart(brand, t)) s = 18;
      else if (haystack(p).includes(t)) s = 6;
      if (viaSynonym) s *= 0.6;
      if (s > best) best = s;
    }
    score += best;
  }

  return score;
}
