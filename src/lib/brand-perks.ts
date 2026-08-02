import PERKS from "../../data/brand-perks.json";

/**
 * MARKA AVANTAJLARI — markanın kendi sitesinde duyurduğu alışveriş koşulları
 * (kargo eşiği, taksit, kapıda ödeme, iade süresi, ilk sipariş indirimi).
 *
 * Veri `scripts/fetch-brand-perks.mjs` ile markanın ana sayfasından toplanır ve
 * `data/brand-perks.json`da durur. Cümleler MARKANIN KENDİ İFADESİDİR: özetlenmez,
 * yeniden yazılmaz — kampanya koşulu markadan markaya değişiyor ve bizim özetimiz
 * tutmayan bir taahhüt hâline gelirdi. Marka sayfası da bu yüzden "markanın kendi
 * sayfasındaki duyuru" diye etiketleyerek gösterir.
 *
 * Avantajı bulunamayan markada bölüm HİÇ çizilmez — uydurma avantaj yok.
 */
export type PerkKind = "kargo" | "hizli" | "taksit" | "kapida" | "iade" | "indirim";

export interface Perk {
  tip: PerkKind;
  metin: string;
}

const TABLE = (PERKS as { markalar: Record<string, Perk[]> }).markalar;

/** Verinin toplandığı an (ISO) — sayfada "… tarihli duyuru" notu için. */
export const PERKS_AT: string = (PERKS as { at?: string }).at ?? "";

export function brandPerks(slug: string): Perk[] {
  return TABLE[slug] ?? [];
}

/** Avantaj türünün kısa etiketi — cümlenin kendisi zaten metinde. */
export const PERK_LABEL: Record<PerkKind, string> = {
  kargo: "KARGO",
  hizli: "HIZLI GÖNDERİM",
  taksit: "TAKSİT",
  kapida: "KAPIDA ÖDEME",
  iade: "İADE",
  indirim: "İNDİRİM",
};
