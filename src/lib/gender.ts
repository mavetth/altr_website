import type { GenderTag, ProductCat } from "./types";
import { trLower } from "./categorize.ts";

/**
 * Ürünün cinsiyet ETİKETLERİ. Unisex bir ürün ["kadin","erkek"] taşır — yani hem KADIN
 * hem ERKEK filtresinde çıkar. Tek etiketli ürün yalnızca o filtrede görünür.
 *
 * İki kademeli tespit:
 *  1) Adda açık sinyal ("kadın", "men", "bayan"…). "women" içindeki "men" tuzağına karşı
 *     sözcük sınırlı aranır.
 *  2) Sinyal yoksa KATEGORİ konuşur: elbise/etek/korse/bluz/tayt pratikte kadın ürünüdür.
 *     Bu kademe olmadan katalogun %80'i unisex kalıyor ve cinsiyet filtresi işe yaramıyordu.
 * Hiçbiri tutmazsa unisex (iki etiket birden).
 */

const WOMEN =
  /kad[ıi]n|women|woman|womens|female|ladies|bayan|femme|wmns|hamile|anne/i;
const MEN = /erkek|\bmen\b|\bman\b|\bmens\b|\bmen'?s\b|\bmale\b|homme|menswear|baba/i;
const UNI = /unisex|uniseks/i;

/** Adında sinyal olmasa bile pratikte tek cinsiyete ait olan kategoriler. */
const WOMEN_CATS = new Set<ProductCat>([
  "ELBİSE",
  "ETEK",
  "KORSE / BODY",
  "BLUZ",
  "TAYT",
]);

export const BOTH: GenderTag[] = ["kadin", "erkek"];

/**
 * BEDEN ARALIĞINDAN cinsiyet — üçüncü ve en zayıf kademe. Geriye TEK kural kaldı.
 *
 * Fikir şuydu: ad ve kategori susuyorsa beden aralığının UÇLARI konuşur. İlk ölçümde
 * (adında cinsiyet YAZAN ürünler etiketli veri sayılarak) dört kalıp da güçlü
 * görünüyordu — `S,M,L` %87 kadın, `XS,S,M,L` %93 kadın gibi; toplam isabet %86.
 * Ama o ölçüm, bedenlerin ÜRETİLEN aralık olduğu varsayımına dayanıyordu.
 *
 * SONRA BU VARSAYIM BOZULDU: adaptörler bedeni artık STOKTAKİLERDEN alıyor (Ticimax'in
 * beden başına `stokAdedi` alanı okunmaya başlandı — bkz. jsonld.mjs). Yani aralık
 * "üretilen"i değil "kalan"ı gösteriyor: XL'i tükenmiş bir erkek ürünü `S,M,L`ye düşüp
 * kadın kalıbına benziyor. Yeniden ölçüm (2026-07-29 katalogu):
 *
 *   M'den başlayıp XL+'e çıkar   -> erkek   n=50    %96   ✔ KALDI
 *   L'de biter                   -> kadın   n=793   %76   ✘ elendi
 *   2XL+'e uzanır, XS yok        -> erkek   n=296   %72   ✘ elendi
 *   XL'de biter, XS'ten başlar   -> kadın   n=274   %41   ✘ elendi (yazı-turadan kötü)
 *
 * Elenenler kaldırıldı: yanlış cinsiyet, filtreyi kullanan kişiye ürünü TAMAMEN
 * kaybettiriyor — %70 isabetli bir kuralın zarar/fayda oranı negatif. Ayakta kalan
 * kural stoktan etkilenmiyor, çünkü küçük bedenlerin YOKLUĞUNA değil büyük bedenlerin
 * VARLIĞINA bakıyor (bir ürün 2XL'de satılıyorsa erkek kalıbıdır; tükenmesi bunu
 * değiştirmez).
 *
 * SAYISAL bedenler de işe yaramıyor (ayrıca ölçüldü): 32-46 çift numara hem kadın mini
 * şortunda hem erkek kargo pantolonunda geçiyor. Yalnız harfli merdivene bakılır.
 * Denetim: `npm run check-gender` (eşik %80).
 */
const LADDER = ["4XS", "3XS", "2XS", "XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL", "6XL"];
const IDX = { M: LADDER.indexOf("M"), XL: LADDER.indexOf("XL") };

/**
 * BOL KESİM ürünlerde beden aralığı yalan söylüyor: erkek "oversize" tişörtler S-M-L
 * satılıyor (kalıp zaten büyük), yani kadın kalıbına benziyorlar. Bu ürünlerde beden
 * sinyaline hiç bakmıyoruz.
 */
const LOOSE_FIT = /oversize|boxy|baggy|relaxed fit/i;

function gendersFromSizes(sizes: readonly string[]): GenderTag[] | null {
  const idx = sizes.map((s) => LADDER.indexOf(s)).filter((i) => i >= 0);
  if (idx.length < 2) return null; // tek beden ayırt etmiyor (ölçüldü: "M" %18 kadın, gürültü)
  const lo = Math.min(...idx);
  const hi = Math.max(...idx);

  // Klasik erkek aralığı: M'den başlar, XL ve üstüne çıkar. Küçük beden hiç yok.
  if (lo >= IDX.M && hi >= IDX.XL) return ["erkek"];

  return null; // kararsız -> unisex
}

export function detectGenders(
  name: string,
  category?: ProductCat,
  sizes: readonly string[] = [],
): GenderTag[] {
  const hay = trLower(name);
  if (hay && !UNI.test(hay)) {
    const w = WOMEN.test(hay);
    const m = MEN.test(hay);
    if (w && !m) return ["kadin"];
    if (m && !w) return ["erkek"];
    if (!w && !m && category && WOMEN_CATS.has(category)) return ["kadin"];
  }
  // Ad "unisex" DİYORSA ya da bol kesimse bedene bakmayız (bkz. LOOSE_FIT).
  if (hay && (UNI.test(hay) || LOOSE_FIT.test(hay))) return [...BOTH];
  return gendersFromSizes(sizes) ?? [...BOTH];
}

/** Ürünün etiketlerinden okunabilir bir rozet metni. */
export function genderLabel(genders: GenderTag[]): string {
  if (genders.length >= 2) return "UNISEX";
  return genders[0] === "kadin" ? "KADIN" : "ERKEK";
}

export const GENDER_LABELS: Record<GenderTag, string> = {
  kadin: "KADIN",
  erkek: "ERKEK",
};
