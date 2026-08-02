#!/usr/bin/env node
/**
 * KATEGORİ DENETİMİ — categorize.ts için elle toplanmış doğruluk listesi.
 *
 * Buradaki her satır katalogda GERÇEKTEN görülmüş bir üründür; hepsi bir zamanlar
 * yanlış kovaya düşmüştü. Kurala dokunduğunda bunu çalıştır: bir kuralı düzeltirken
 * başka birini bozmak bu dosyanın var olma sebebi.
 *
 * "-" beklenen kategori = ürün giyilemez sayılmalı (isNonWearable true).
 */
import { categorize, isNonWearable } from "../src/lib/categorize.ts";

const CASES = [
  // --- büyük harfli İngilizce adlar (trLower "I" -> "ı" tuzağı)
  ["CARDIGAN 002", "HIRKA"],
  ["FOIL BEANIE", "ŞAPKA"],
  ["CHOK-DEE ZIP-UP", "HOODIE"],
  ["OVERSIZE T-SHIRT", "TİŞÖRT"],
  ["CLASSIC DENIM JACKET", "CEKET"],
  ["SLIM FIT SHIRT", "GÖMLEK"],

  // --- Türkçe ek yumuşaması (p→b, k→ğ)
  ["Unisex Fitilli Pamuklu Tenis Çorabı Beyaz", "ÇORAP"],
  ["Erkek Punk Viking Rune Yüzüğü", "TAKI"],

  // --- sözlükte eksik olan gerçek ürün tipleri
  ["Beyaz Fiyonklu Vintage Tozluk", "ÇORAP"],
  ["Kabin Boy Monogram Canvas Deri Valiz", "ÇANTA"],
  ["Ray-Ban Aviator Black Glasses", "GÖZLÜK"],
  ["Sp5der Tracksuit", "TAKIM"],
  ["Kadın Punk Sivri Zincirli Motosiklet Botları", "AYAKKABI"],
  ["CARD HOLDER 027", "CÜZDAN"],
  ["Gotik Gerdanlık", "TAKI"],
  ["Death or Glory / Motosikletli Buff", "ATKI / ELDİVEN"],
  ["Sentetik Peruk", "AKSESUAR"],
  ["Kombin 238", "TAKIM"],
  ["Kombinini Tamamla 21", "TAKIM"],
  // "kombin" burada SIFAT (eşli tişört), ürün tipi değil — TAKIM olmamalı.
  ["Player 1 ve Player 2 Çift Kombin Tişört", "TİŞÖRT"],
  // uzun kollu tişört kendi kategorisidir, TİŞÖRT değil
  ["MORE SWAG UZUN KOLLU T-SHIRT", "UZUN KOLLU"],

  // --- giyilemez (vitrin bir giyim vitrini)
  ["Stranger Things Demogorgon Kalemlik", "-"],
  ["Anlatamıyorum - Şiir Beton Mum", "-"],
  ["Kuromi Figür Aydınlatma Gece Lambası", "-"],
  ["Drinker Bell Paşabahçe Kulplu Bira Bardağı", "-"],
  ["My Little Pony LEGO Masaüstü Dekorasyonu", "-"],
  ["Kadın Gotik Bağcıklı Püsküllü Şemsiye", "-"],
  ["Köpek Tasması", "-"],
  ["La Riche Directions - Rose Red Saç Boyası 88Ml", "-"],
  ["Y2K Pink Takma Tırnak", "-"],
  ["Still Life, Bornoz", "-"],

  // --- İÇ GİYİM (2026-07-29: kendi sekmesi oldu, kuralları da sıkılaştırıldı)
  ["Erkek Pamuklu Modal Lastikli Boxer", "İÇ GİYİM"],
  ["Kirazlı İpli Bikini Takımı", "İÇ GİYİM"],
  ["Beli Lastikli Ekose Desenli Pijama", "İÇ GİYİM"],
  // iç giyim sözcüğü BASKI ya da DETAY olabilir — asıl ürün dış giysidir
  ["Bikini Lines Baskılı Relaxed Fit Kadın Tshirt", "TİŞÖRT"],
  ["Wes Atelier Nakış İşlemeli Leopard Boxer Detay Baggy Eşofman", "EŞOFMAN ALTI"],
  ["Buy Me Lingerie Oversize Tişört", "TİŞÖRT"],
  // "külotlu çorap" bir çoraptır
  ["Lightning,Eyes And Love Külotlu Çorap", "ÇORAP"],

  // --- DİĞER kovasından çıkarılanlar (katalog ölçümüyle bulundu)
  ["Orange Slice Resin Earrings", "TAKI"],
  ["Habibi Vintage Nakışlı Bilezik", "TAKI"],
  ["Özel Tasarım Asi Hızma", "TAKI"],
  ["Kelebek Patchler", "AKSESUAR"],
  ["Düz Renkli Tokalı Canvas Kemerler", "KEMER"],
  ["Kemerli Gabardin Kapri", "ŞORT"],
  ["Düz Siyah Yıldız Baskılı Platform Kısa Postal", "AYAKKABI"],
  // "kemerli" bir giysinin ÖZELLİĞİ, kemer değil
  ["Erkek Baggy Fit Yüksek Bel Kemerli Gabardin Pantolon", "PANTOLON"],
  ["Siyah Anime Harajuku Punk Deri Kemerli Y2K Mini Etek", "ETEK"],
  // "patchwork"/"patchli" giysidir, aksesuar değil
  ["Erkek Baggy Fit Patchwork Hype Jean Pantolon Mavi", "JEAN"],
  ["Erkek Sırtı Patchli Oversize T - Shirt", "TİŞÖRT"],

  // --- eski regresyonlar: bunlar BOZULMAMALI
  ["Oversize Sweatshirt", "SWEATSHIRT"],
  ["Baggy Jean Pantolon", "JEAN"],
  ["Kanvas Çanta", "ÇANTA"],
  ["Halı Desenli T-Shirt", "TİŞÖRT"],
  // "havlu" giyilemez sözlüğünde geçiyor ama bu geçerli bir üründür — elenmemeli.
  // TRİKO kuralı POLO'dan önce geliyor (kumaş, yaka biçiminden daha belirleyici).
  ["Havlu Triko Polo", "TRİKO / KAZAK"],
  ["Kapüşonlu Sweatshirt", "HOODIE"],
  ["Siyah Kargo Pantolon", "PANTOLON"],
  ["Keten Şort", "ŞORT"],
];

let fail = 0;
for (const [name, want] of CASES) {
  const cat = categorize(name);
  const got = isNonWearable(name, cat) ? "-" : cat;
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "  ok" : "FAIL"}  ${got.padEnd(16)} beklenen: ${want.padEnd(16)} ${name}`);
}

console.log(`\n${CASES.length - fail}/${CASES.length} geçti`);
// `process.exit()` DEĞİL: Windows'ta stdout bir pipe'a bağlıyken (npm run),
// son `console.log`un yazımı bitmeden süreç kapatılınca libuv çöküyor
// ("Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)"). Denetim geçtiği
// hâlde `npm run check` zinciri bu yüzden kırılıyordu. `exitCode` ile süreç
// tamponu boşaltıp kendiliğinden çıkar.
process.exitCode = fail ? 1 : 0;
