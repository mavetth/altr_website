import { trLower } from "./categorize.ts";

/**
 * Renk adı (TR/EN) -> hex. Vitrin renk noktaları gösterdiği için canlı üründeki renk
 * seçeneği adlarını kaba hex'e çeviriyoruz.
 *
 * Bu sözlük bir SON ÇARE: renk noktasının asıl kaynağı, kaynağın verdiği gerçek renk
 * kodu (İkas `colorCode`, Ticimax `renkKodu`), o da yoksa ürün fotoğrafından ölçülen
 * baskın renktir (bkz. ColorSwatches). Sözlük yalnız ikisi de yokken devreye girer.
 *
 * TÜRKÇE TUZAĞI: eşleştirme `trLower` ile yapılır. Düz `toLowerCase()` kullanıldığında
 * "GRİ" -> "gri̇" (birleşik noktalı i) çıkıyor ve sözlükteki "gri" ile EŞLEŞMİYORDU;
 * büyük harfli yazan markaların bütün renkleri sessizce uydurma griye düşüyordu.
 */
const MAP: Record<string, string> = {
  siyah: "#111111", black: "#111111", "black/black": "#111111",
  beyaz: "#ededea", white: "#ededea", ekru: "#e8e2cf", krem: "#e8e2cf", cream: "#e8e2cf",
  gri: "#7d7d75", gray: "#7d7d75", grey: "#7d7d75", melanj: "#9a9a92", antrasit: "#3a3a3d",
  lacivert: "#20263a", navy: "#20263a", mavi: "#2f4a6a", blue: "#2f4a6a",
  yeşil: "#3a463a", yesil: "#3a463a", green: "#3a463a", haki: "#4b4d38", khaki: "#4b4d38",
  kırmızı: "#7a2727", kirmizi: "#7a2727", red: "#7a2727", bordo: "#4a1f24", burgundy: "#4a1f24",
  kahverengi: "#4a3527", brown: "#4a3527", kahve: "#4a3527", taba: "#8a5a3a", camel: "#a9825a",
  bej: "#c9bda0", beige: "#c9bda0", sarı: "#d8c24a", sari: "#d8c24a", yellow: "#d8c24a",
  turuncu: "#b5652f", orange: "#b5652f", mor: "#4a2f5a", purple: "#4a2f5a",
  pembe: "#b56a86", pink: "#b56a86", lila: "#8a6aa8", lilac: "#8a6aa8",
  turkuaz: "#2f8a8a", petrol: "#22484a", vizon: "#9a8a7a", metalik: "#8a8a90",

  // --- katalogda geçen ama sözlükte olmayıp uydurma griye düşen tonlar
  mürdüm: "#4a2440", murdum: "#4a2440", nefti: "#2c3a2e", buz: "#d4e0e4", duman: "#8f9296",
  fuşya: "#b02a6a", fusya: "#b02a6a", hardal: "#c39b2e",
  mint: "#9fd4bb", nane: "#9fd4bb", somon: "#d98a76", salmon: "#d98a76",
  gümüş: "#adadb2", gumus: "#adadb2", silver: "#adadb2",
  altın: "#c9a227", altin: "#c9a227", gold: "#c9a227", bakır: "#a1552d", bakir: "#a1552d",
  füme: "#5a5a5a", fume: "#5a5a5a", indigo: "#2b3a67", saks: "#2c5aa0",
  vişne: "#5c1f2b", visne: "#5c1f2b", kiremit: "#9c4a2f", mercan: "#e0705f",
  leylak: "#b9a3d4", bebe: "#a9c9e4", çelik: "#6e7377", celik: "#6e7377",
  taş: "#b8ae9c", tas: "#b8ae9c", stone: "#b8ae9c", zeytin: "#5a5c33", olive: "#5a5c33",
  şarap: "#4a1f24", sarap: "#4a1f24", bronz: "#8c6239", safran: "#d8a13a",
  antikbeyaz: "#e6dfd2", offwhite: "#e6dfd2", "off white": "#e6dfd2",
  neon: "#c6f542", pastel: "#dcd6e8", renkli: "#8a8a90", çok: "#8a8a90",
};

/**
 * Bilinmeyen renk adına STABİL ama uydurma bir gri. Aynı ad hep aynı grive düşer, yani
 * iki farklı renk birbirine karışmaz — ama gerçek rengi TEMSİL ETMEZ. Bu yüzden vitrin
 * bu değere güvenmiyor: ColorSwatches noktayı ürün fotoğrafından ölçüyor.
 */
function hashGray(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xff;
  const v = 70 + (h % 90); // 70..160 arası nötr ton
  const hex = v.toString(16).padStart(2, "0");
  return `#${hex}${hex}${hex}`;
}

export function colorToHex(name: string): string {
  const key = trLower(String(name)).trim();
  if (MAP[key]) return MAP[key];

  // "Siyah - Beyaz" / "Beyaz/Lacivert" gibi AYRAÇLI bileşiklerde ilk bilineni yakala
  for (const part of key.split(/[/\-,|]/).map((s) => s.trim())) {
    if (MAP[part]) return MAP[part];
  }

  // AYRAÇSIZ bileşikler ("Siyah Kırmızı", "Açık Mavi") eskiden hiç eşleşmiyordu: split
  // çalışmıyor, tam eşleşme de yok. Sözcük sözcük bakınca ikisi de çözülüyor.
  for (const word of key.split(/\s+/)) {
    if (MAP[word]) return MAP[word];
  }

  return hashGray(key || "default");
}

export function colorsToHex(names: string[], max = 3): string[] {
  const out: string[] = [];
  for (const n of names) {
    const hex = colorToHex(n);
    if (!out.includes(hex)) out.push(hex);
    if (out.length >= max) break;
  }
  return out.length ? out : ["#7d7d75"];
}
