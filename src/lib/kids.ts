import { trLower } from "./categorize.ts";
import { isAgeSize } from "./sizes.ts";

/**
 * ÇOCUK ÜRÜNÜ TESPİTİ — vitrin yalnız yetişkin giyimi listeler.
 *
 * Katalog çocuk giyimini hiçbir alanda işaretlemiyor: ayrı kategori yok, cinsiyet
 * etiketi yok (çocuk ürünü "unisex" olarak geçiyor). Elimizde iki sinyal var ve
 * ikisinin de kendine özgü yanlış pozitifleri var:
 *
 *  1) YAŞ BEDENİ ("9-10 YAŞ") — KESİN sinyal. Tam katalogda 494 ürün taşıyor ve bir
 *     yetişkin ürününün yaş bedeni olmuyor.
 *  2) ADDAKİ SÖZCÜK — burası tuzaklı. Ham tarama 1.064 eşleşme veriyor ama büyük kısmı
 *     çocuk ürünü DEĞİL:
 *       - "Bebek Mavi" / "Baby Blue" / "Baby Pink" → RENK adı,
 *       - "Cry Baby", "Kids See Ghosts", "Baby Metal" → grup/albüm/slogan adı.
 *     Bu yüzden sözcükler iki güce ayrıldı:
 *       GÜÇLÜ  (çocuk, kids, junior, toddler…) tek başına yeter,
 *       ZAYIF  (bebek, baby) yalnız yaş bedeniyle ya da güçlü bir sözcükle birlikte sayılır.
 *     Ayrıca GÜÇLÜ sözcüklerin slogan olarak geçtiği bilinen kalıplar ayrıca elenir.
 *
 * Karar geri döndürülebilir: eşleşen ürün silinmez, `.data/catalog.archived.json`'a
 * ayrılır (bkz. scripts/import-catalog.mjs). Denetim: `npm run check-archive`.
 */

const L = "a-zçğıöşü0-9";
const w = (...alts: string[]) => new RegExp(`(?<![${L}])(?:${alts.join("|")})(?![${L}])`, "i");

/** Tek başına çocuk ürünü saydıran sözcükler. */
const STRONG = w(
  "çocuk", "cocuk", "çocuğu", "cocugu", "çocuklu", "çocuklar", "çocukları",
  "kids", "kids'", "junior", "juniors", "toddler", "infant",
  "newborn", "yenidoğan", "yenidogan", "oğlan", "oglan", "erkek çocuk", "kız çocuk",
  "kiz cocuk", "bebek giyim", "çocuk giyim",
);

/**
 * Yalnız başka bir sinyalle birlikte sayılan sözcükler (renk/slogan tuzağı).
 *
 * TEKİL "kid" bilerek buradadır: katalogda geçtiği 9 yerin hepsi slogandı
 * ("90's KID", "Muay Thai Kid", "Boxer Kid", "Kid Tom") — hiçbiri çocuk ürünü değil.
 * Çoğul "kids" güçlü sayılır ama "Stray Kids" grubu ayrıca SLOGAN'da elenir.
 */
const WEAK = w("bebek", "bebe", "baby", "babies", "bebegi", "bebeği", "kid", "kid's");

/**
 * GÜÇLÜ sözcüğün çocuk ürünü DEĞİL, bir gönderme olduğu bilinen kalıplar. Alternatif
 * giyimde grup/albüm/film adı basmak yaygın; bu liste katalog taranarak büyütülür.
 */
const SLOGAN = [
  // K-pop grubu. Katalogdaki en büyük yanlış pozitif kaynağı: 79 ürün, hepsi yetişkin
  // bedenli hayran ürünü (kostebek + touz-moda).
  /stray\s*kids/i,
  // Stray Kids üyeleri "… Kids Karma" kalıbıyla da geçiyor (Lee Know, Hyunjin, Felix).
  /kids\s+karma/i,
  /boca\s+juniors/i,
  /kids\s+see\s+ghosts/i,
  /the\s+kids\s+ar[eı]n'?t\s+alright/i,
  /kids\s+in\s+the\s+dark/i,
  /all\s+the\s+kids/i,
  /wild\s+kids/i,
  /lost\s+kids/i,
  /rich\s+kids/i,
  /kid\s+cudi/i,
  /kid\s+a\b/i,
  /baby\s+metal/i,
  /babymetal/i,
  /cry\s*baby/i,
  /crybaby/i,
  /baby\s+blue/i,
  /baby\s+pink/i,
];

/** Ad, çocuk ürünü değil bir gönderme mi? */
function isSlogan(name: string): boolean {
  return SLOGAN.some((re) => re.test(name));
}

/**
 * MARKA ADINI addan düşürür.
 *
 * Bazı markalar adında bu sözcükleri taşıyor ("Junior Crime") ve ürün adı markayla
 * başladığında her ürünü çocuk ürünü sanıyorduk. Marka adı bir ürün özelliği değil.
 */
function stripBrand(name: string, brand?: string): string {
  if (!brand) return name;
  const b = trLower(brand).trim();
  if (b.length < 3) return name;
  const esc = b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return trLower(name).replace(new RegExp(esc, "g"), " ");
}

/**
 * Bu ürün çocuk giyimi mi?
 *
 * @param name    ürün adı (kaynağın etiket metni de eklenebilir)
 * @param sizes   ürünün beden jetonları — YAŞ jetonu taşıyorsa kesin sinyal
 */
export function isKidsProduct(name: string, sizes: readonly string[] = [], brand?: string): boolean {
  return kidsReason(name, sizes, brand) != null;
}

/**
 * Denetim/rapor için: kararın hangi sinyale dayandığı ("yaş-bedeni" | "ad-güçlü" | null).
 * `isKidsProduct` bunun üstüne kurulu — iki fonksiyon ayrışamasın.
 *
 * @param brand markanın görünen adı; adında bu sözcükleri taşıyan markalar için gerekli.
 */
export function kidsReason(
  name: string,
  sizes: readonly string[] = [],
  brand?: string,
): string | null {
  if (sizes.some((s) => isAgeSize(s))) return "yaş-bedeni";

  const hay = stripBrand(name, brand);
  const flat = stripBrand(String(name).toLowerCase(), brand);
  if (isSlogan(hay) || isSlogan(flat)) return null;
  if (STRONG.test(hay) || STRONG.test(flat)) return "ad-güçlü";
  // Zayıf sözcük ("bebek"/"baby"/"kid") tek başına yetmez: buraya geldiysek yaş bedeni
  // de yok demektir, yani elimizde yalnız renk ya da slogan olma ihtimali yüksek bir
  // sözcük var. Çocuk saymıyoruz.
  if (WEAK.test(hay) || WEAK.test(flat)) return null;
  return null;
}
