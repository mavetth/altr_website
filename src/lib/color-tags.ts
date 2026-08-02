import { trLower } from "./categorize.ts";

/**
 * KANONİK RENK AİLELERİ — filtrelenebilir renk etiketi.
 *
 * Neden ayrı bir kavram: katalogdaki renk verisi ya markanın serbest metni
 * ("Buz Mavisi", "Antrasit Melanj", "-") ya da bir hex. İkisi de filtre kutusu olamaz;
 * kullanıcı "mavi" arıyor, "Buz Mavisi" değil. Bu dosya ikisini de 15 aileden birine
 * indiriyor.
 *
 * Etiket ÜRÜNE yazılır (`Product.colorTags`) ve import zamanında üretilir
 * (scripts/tag-colors.mjs) — runtime'da hesaplanacak bir şey değil.
 *
 * "çok renkli" bir aile DEĞİL bir işaret: desenli/baskılı, tek bir rengi olmayan ürün.
 * Diğer ailelerle birlikte durabilir.
 */

export type ColorTag =
  | "siyah" | "beyaz" | "gri" | "bej" | "kahverengi"
  | "kirmizi" | "bordo" | "pembe" | "turuncu" | "sari"
  | "yesil" | "mavi" | "lacivert" | "mor" | "cok-renkli";

export interface ColorFamily {
  k: ColorTag;
  label: string;
  /** Filtre kutusunda çizilecek temsilî renk. */
  swatch: string;
}

/** Sıra filtre panelindeki sıradır: nötrler önce, sonra sıcak→soğuk, en sonda desen. */
export const COLOR_TAGS: readonly ColorFamily[] = [
  { k: "siyah", label: "SİYAH", swatch: "#111111" },
  { k: "beyaz", label: "BEYAZ", swatch: "#f0efea" },
  { k: "gri", label: "GRİ", swatch: "#8a8a86" },
  { k: "bej", label: "BEJ / KREM", swatch: "#cdbfa2" },
  { k: "kahverengi", label: "KAHVE", swatch: "#5b4230" },
  { k: "kirmizi", label: "KIRMIZI", swatch: "#b03030" },
  { k: "bordo", label: "BORDO", swatch: "#5c2028" },
  { k: "pembe", label: "PEMBE", swatch: "#d1789b" },
  { k: "turuncu", label: "TURUNCU", swatch: "#d2712c" },
  { k: "sari", label: "SARI", swatch: "#d8c24a" },
  { k: "yesil", label: "YEŞİL", swatch: "#4a7a45" },
  { k: "mavi", label: "MAVİ", swatch: "#2f6aa8" },
  { k: "lacivert", label: "LACİVERT", swatch: "#20263a" },
  { k: "mor", label: "MOR", swatch: "#6a3a8a" },
  { k: "cok-renkli", label: "ÇOK RENKLİ", swatch: "#8a8a90" },
];

const KEYS = new Set<string>(COLOR_TAGS.map((c) => c.k));

export function isColorTag(v: unknown): v is ColorTag {
  return typeof v === "string" && KEYS.has(v);
}

export function colorTagLabel(k: string): string {
  return COLOR_TAGS.find((c) => c.k === k)?.label ?? k.toUpperCase();
}

/* ------------------------------------------------------------- hex → aile -- */

export function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** RGB → HSL. h 0-360, s/l 0-1. */
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === R) h = ((G - B) / d + (G < B ? 6 : 0)) * 60;
  else if (max === G) h = ((B - R) / d + 2) * 60;
  else h = ((R - G) / d + 4) * 60;
  return [h, s, l];
}

/**
 * RGB → renk ailesi.
 *
 * Önce NÖTR ekseni ayrılır (doygunluk düşükse renk yok, sadece açıklık var), sonra
 * hue kutuları. İki özel durum kural gerektiriyor:
 *  - LACİVERT mavinin koyusu, ayrı bir aile olarak isteniyor (kullanıcı için ayrı bir
 *    renk); mavi hue'sunda l < 0.28 ise lacivert sayılır.
 *  - BORDO aynı şekilde kırmızının koyusu.
 *  - Düşük doygunluklu ama sarımsı-açık tonlar GRİ değil BEJ: krem/ekru/taş rengi
 *    giyimde çok yaygın ve griye düşerse filtre işe yaramaz hâle gelir.
 */
export function rgbToTag(r: number, g: number, b: number): ColorTag {
  const [h, s, l] = rgbToHsl(r, g, b);

  if (l <= 0.14) return "siyah";
  if (s < 0.12) {
    if (l >= 0.86) return "beyaz";
    // Nötre yakın ama sıcak tarafta duran açık tonlar bej ailesidir.
    if (l >= 0.6 && h >= 20 && h <= 70 && s >= 0.05) return "bej";
    return l <= 0.2 ? "siyah" : "gri";
  }
  if (l >= 0.9 && s < 0.25) return "beyaz";

  // Kahve/bej ekseni: turuncu-sarı hue'sunda ama doygunluğu kısık olanlar.
  if (h >= 15 && h < 50 && s < 0.45) return l < 0.42 ? "kahverengi" : "bej";
  if (h >= 15 && h < 45 && l < 0.3) return "kahverengi";

  if (h < 15 || h >= 345) return l < 0.3 ? "bordo" : l > 0.65 && s < 0.5 ? "pembe" : "kirmizi";
  if (h < 45) return "turuncu";
  if (h < 70) return "sari";
  if (h < 170) return "yesil";
  // Mavi ekseni geniş (deniz mavisinden mora yakın maviye); koyusu ayrı bir aile.
  if (h < 255) return l < 0.28 ? "lacivert" : "mavi";
  if (h < 290) return "mor";
  // 290–345 arası mor↔pembe geçişi: açık veya soluk olanı pembe okunur.
  return l > 0.6 || s < 0.5 ? "pembe" : "mor";
}

export function hexToTag(hex: string): ColorTag | null {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToTag(rgb[0], rgb[1], rgb[2]) : null;
}

/* -------------------------------------------------------------- ad → aile -- */

/**
 * Renk ADI sözlüğü. `colors.ts`teki MAP'ten türetilmedi bilerek: orada amaç "bir hex
 * bul" (bulunamazsa uydurma gri), burada amaç "hangi aile" ve YANLIŞ CEVAP VERMEMEK.
 * Tanımadığı adda `null` döner ve karar görsele bırakılır.
 */
const NAME_MAP: Record<string, ColorTag> = {
  siyah: "siyah", black: "siyah", "jet black": "siyah", antrasit: "siyah", kömür: "siyah",

  beyaz: "beyaz", white: "beyaz", ekru: "bej", krem: "bej", cream: "bej", ivory: "bej",
  antikbeyaz: "bej", offwhite: "bej", "off white": "bej", "kırık beyaz": "bej",

  gri: "gri", gray: "gri", grey: "gri", melanj: "gri", füme: "gri", fume: "gri",
  duman: "gri", gümüş: "gri", gumus: "gri", silver: "gri", çelik: "gri", celik: "gri",
  metalik: "gri", "gri melanj": "gri",

  bej: "bej", beige: "bej", taş: "bej", tas: "bej", stone: "bej", vizon: "bej",
  bisküvi: "bej", biskuvi: "bej", kum: "bej", sand: "bej", nude: "bej",

  kahverengi: "kahverengi", kahve: "kahverengi", brown: "kahverengi", taba: "kahverengi",
  camel: "kahverengi", bronz: "kahverengi", bakır: "kahverengi", bakir: "kahverengi",
  çikolata: "kahverengi", cikolata: "kahverengi", mocha: "kahverengi",

  kırmızı: "kirmizi", kirmizi: "kirmizi", red: "kirmizi", mercan: "kirmizi",
  kiremit: "kirmizi", ateş: "kirmizi",

  bordo: "bordo", burgundy: "bordo", vişne: "bordo", visne: "bordo", şarap: "bordo",
  sarap: "bordo", maroon: "bordo",

  pembe: "pembe", pink: "pembe", fuşya: "pembe", fusya: "pembe", fuchsia: "pembe",
  somon: "pembe", salmon: "pembe", pudra: "pembe", rose: "pembe",

  turuncu: "turuncu", orange: "turuncu", "somon turuncu": "turuncu",

  sarı: "sari", sari: "sari", yellow: "sari", hardal: "sari", safran: "sari",
  altın: "sari", altin: "sari", gold: "sari", limon: "sari",

  yeşil: "yesil", yesil: "yesil", green: "yesil", haki: "yesil", khaki: "yesil",
  nefti: "yesil", zeytin: "yesil", olive: "yesil", mint: "yesil", nane: "yesil",
  çimen: "yesil", cimen: "yesil", petrol: "yesil", turkuaz: "yesil",

  mavi: "mavi", blue: "mavi", buz: "mavi", saks: "mavi", bebe: "mavi",
  "bebe mavi": "mavi", gökyüzü: "mavi", sky: "mavi", cyan: "mavi",

  lacivert: "lacivert", navy: "lacivert", indigo: "lacivert",

  mor: "mor", purple: "mor", lila: "mor", lilac: "mor", leylak: "mor",
  mürdüm: "mor", murdum: "mor", violet: "mor", eflatun: "mor",

  renkli: "cok-renkli", "çok renkli": "cok-renkli", multicolor: "cok-renkli",
  multi: "cok-renkli", desenli: "cok-renkli", baskılı: "cok-renkli",
  baskili: "cok-renkli", karışık: "cok-renkli", karisik: "cok-renkli",
  kamuflaj: "cok-renkli", camo: "cok-renkli", ebru: "cok-renkli", tiedye: "cok-renkli",
  "tie dye": "cok-renkli", batik: "cok-renkli",
};

/**
 * Renk adından aile(ler). Bileşik adlar ("Siyah - Beyaz", "Açık Mavi") birden çok
 * aile döndürebilir; hiçbiri tanınmıyorsa BOŞ döner — uydurma bir cevap vermek yerine
 * karar görsel ölçüme bırakılır.
 *
 * "Açık/Koyu/Antik" gibi niteleyiciler atılır: aile zaten bir ton aralığı, "açık mavi"
 * de "koyu mavi" de mavidir.
 */
const QUALIFIERS = new Set([
  "açık", "acik", "koyu", "orta", "antik", "soft", "light", "dark", "pale", "deep",
  "neon", "pastel", "mat", "parlak", "metalik", "rengi", "renk", "tonu",
]);

export function nameToTags(raw: string): ColorTag[] {
  const key = trLower(String(raw ?? "")).trim();
  if (!key || key === "-") return [];

  const direct = NAME_MAP[key];
  if (direct) return [direct];

  const out: ColorTag[] = [];
  const push = (t: ColorTag | undefined) => {
    if (t && !out.includes(t)) out.push(t);
  };

  // Ayraçlı bileşikler: "Siyah / Beyaz" -> iki aile.
  for (const part of key.split(/[/\-,|+&]/).map((s) => s.trim())) {
    if (!part) continue;
    if (NAME_MAP[part]) {
      push(NAME_MAP[part]);
      continue;
    }
    // Ayraçsız: "Açık Mavi", "Buz Mavisi" — niteleyiciyi atıp sözcüklere bak.
    for (const w of part.split(/\s+/)) {
      if (QUALIFIERS.has(w)) continue;
      // "mavisi" / "yeşili" gibi iyelik ekleri: sondaki eki soyarak da dene.
      push(NAME_MAP[w] ?? NAME_MAP[w.replace(/(si|sı|su|sü|i|ı|u|ü)$/u, "")]);
    }
  }
  return out;
}
