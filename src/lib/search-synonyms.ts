import { searchFold } from "./slug.ts";

/**
 * ARAMA EŞANLAMLILARI — elle, küçük ve ölçülebilir.
 *
 * Amaç kapsamlı bir dil modeli değil, kullanıcının GERÇEKTEN yazdığı ile katalogda
 * YAZAN arasındaki bilinen boşlukları kapatmak:
 *   - Türkçe/İngilizce ikizler ("tişört" ↔ "t-shirt")
 *   - şapkasız/aksansız yazımlar ("esofman", "kapsonlu")
 *   - yaygın kısaltmalar ("sweat" → "sweatshirt")
 *
 * Genişletme YALNIZ EKLER, hiçbir zaman daraltmaz: "sweat" yazan kullanıcı hem
 * "sweat" hem "sweatshirt" geçen ürünleri görür. Bu yüzden yanlış bir satır sonucu
 * kirletir ama hiçbir zaman sonucu YOK ETMEZ — bilerek bu tarafa eğimli.
 *
 * Anahtarlar `searchFold`dan geçmiş hâlleriyle tutulur (aksansız, küçük harf).
 */
const RAW: Record<string, string[]> = {
  // --- üst giyim
  tshirt: ["tisort", "t-shirt", "tişört"],
  "t-shirt": ["tisort", "tshirt"],
  tisort: ["tshirt", "t-shirt", "tişört"],
  tee: ["tisort", "tshirt"],
  sweat: ["sweatshirt", "sweatshırt"],
  sweatshirt: ["sweat"],
  kapsonlu: ["hoodie", "kapusonlu", "kapuson"],
  kapusonlu: ["hoodie", "kapsonlu"],
  hoodie: ["kapusonlu", "kapsonlu", "kapuson"],
  kazak: ["triko", "sweater"],
  triko: ["kazak", "sweater"],
  sweater: ["kazak", "triko"],
  gomlek: ["shirt"],
  atlet: ["kolsuz", "tank"],
  kolsuz: ["atlet", "tank"],

  // --- alt giyim
  pantalon: ["pantolon"],
  pantolon: ["pants", "trousers"],
  kot: ["jean", "denim"],
  jean: ["kot", "denim"],
  denim: ["jean", "kot"],
  esofman: ["eşofman", "jogger", "sweatpant"],
  jogger: ["esofman", "sweatpant"],
  sort: ["şort", "short"],
  tayt: ["legging"],

  // --- dış giyim
  mont: ["kaban", "parka", "jacket"],
  kaban: ["mont", "parka"],
  parka: ["mont", "kaban"],
  ceket: ["jacket", "blazer"],
  yelek: ["vest"],

  // --- aksesuar
  canta: ["bag", "çanta"],
  bag: ["canta", "çanta"],
  sapka: ["cap", "bere", "şapka"],
  cap: ["sapka", "şapka"],
  bere: ["beanie", "sapka"],
  kemer: ["belt"],
  corap: ["socks", "çorap"],
  gozluk: ["glasses", "gözlük"],

  // --- kalıp / kesim
  oversize: ["oversized", "bol"],
  oversized: ["oversize"],
  crop: ["cropped", "kisa"],
  cropped: ["crop"],

  // --- renk ikizleri (renk FİLTRESİ ayrı; bu sadece serbest aramada işe yarar)
  siyah: ["black"],
  black: ["siyah"],
  beyaz: ["white"],
  white: ["beyaz"],
  mavi: ["blue"],
  blue: ["mavi"],
  yesil: ["green", "yeşil"],
  green: ["yesil", "yeşil"],
  kirmizi: ["red", "kırmızı"],
  red: ["kirmizi", "kırmızı"],
  gri: ["gray", "grey"],
  gray: ["gri"],
  grey: ["gri"],
  bej: ["beige", "krem", "ekru"],
  lacivert: ["navy"],
  navy: ["lacivert"],
};

/** Anahtarlar ve değerler katlanmış hâlde tutulur — arama tarafı da katlanmış gelir. */
const SYNONYMS: Map<string, string[]> = new Map(
  Object.entries(RAW).map(([k, v]) => [searchFold(k), [...new Set(v.map(searchFold))]]),
);

/**
 * Bir jetonun arama karşılıkları — kendisi HER ZAMAN listede.
 * Zincirleme genişletme YOK (tek adım): "sweat" → "sweatshirt" olur ama
 * "sweatshirt"in kendi karşılıkları tekrar açılmaz; yoksa birkaç adımda tüm sözlük
 * tek bir jetondan türeyebilirdi.
 */
export function expandToken(token: string): string[] {
  const syn = SYNONYMS.get(token);
  return syn ? [token, ...syn] : [token];
}
