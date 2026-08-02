// Türkçe karakterleri de ele alan basit slug üretici. Marka adları -> anahtar/domain adayı.
const TR_MAP: Record<string, string> = {
  ç: "c", Ç: "c", ğ: "g", Ğ: "g", ı: "i", İ: "i", ö: "o", Ö: "o",
  ş: "s", Ş: "s", ü: "u", Ü: "u", â: "a", î: "i", û: "u",
};

export function slugify(input: string): string {
  return input
    .split("")
    .map((ch) => TR_MAP[ch] ?? ch)
    .join("")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // aksanları at
    .replace(/['’`]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * ARAMA için katlama: aksanları/Türkçe harfleri ASCII karşılığına indirir.
 *
 * Neden gerekli: "Oath Istanbul"u Türkçe küçültmek "oath ıstanbul" verir; kullanıcı
 * klavyesinde "istanbul" yazdığında noktalı i ile noktasız ı eşleşmez ve marka
 * BULUNAMAZ. Aynı sorun "Köstebek"i "kostebek" diye arayanda da var. Katlama iki tarafa
 * da uygulanınca ikisi de bulunur.
 *
 * `slugify` ile aynı harf tablosunu kullanır ama noktalama/boşluk yapısını korur —
 * bu bir anahtar değil, insanın yazdığı arama metni.
 */
export function searchFold(input: string): string {
  return input
    .split("")
    .map((ch) => TR_MAP[ch] ?? ch)
    .join("")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");
}

/** "Vamos / VAMOS CLO" gibi çift isimlerde ilk parçayı al. */
export function primaryName(name: string): string {
  return name.split("/")[0].trim();
}
