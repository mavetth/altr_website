import type { Product, ProductCat } from "./types";
import { brandScore01 } from "./brand-scores.ts";

/**
 * KEŞFET — vitrinin sıralama motoru.
 *
 * Üç ayrı problemi ÜÇ AYRI katmanda çözer; tek bir skora hepsini yüklemek denendiğinde
 * hiçbiri düzgün olmuyordu:
 *
 *   1. SKOR      → hangi ürün önce gelmeli (editoryal marka puanı + ürünün kendi kalitesi)
 *   2. SERPME    → aynı markanın 4560 ürünü akışı ele geçirmesin (marka bazlı adım/stride)
 *   3. ONARIM    → yan yana düşen tekrarları (aynı marka/kategori/ton) yerel takasla dağıt
 *
 * Rastgelelik skorun İÇİNE karışır ama TOHUMLUDUR: aynı tohum → aynı akış. Böylece
 * kullanıcı sayfa 2'ye geçip geri döndüğünde vitrin titremez, ama başka bir oturumda
 * (tohum döndüğünde) baştan farklı bir vitrin görür.
 *
 * Not: `pop` alanı kataloğun %58'inde sabit 50, kalanında 100−day — yani gerçek bir
 * popülerlik sinyali DEĞİL. Bu yüzden burada hiç kullanılmıyor; "POPÜLER" sıralaması da
 * kaldırıldı. `day` de yalnız shopify/woocommerce markalarında gerçek (ikas/jsonld sabit
 * 20 yazıyor) — tazelik bu yüzden sadece küçük bir BONUS, sıralamanın omurgası değil.
 */

export type FeedMode = "kesfet" | "kategori" | "markalar";

/* ---------------------------------------------------------------- tohum ---- */

/**
 * Tohumun ömrü. Aynı pencere içinde giren herkes aynı vitrini görür (sunucu ile
 * istemcinin ilk boyamada aynı sırayı üretmesi için gerekli), pencere dönünce vitrin
 * baştan karışır. 3 saat: gün içinde birkaç kez tazelenir, ama sabah bakıp öğlen dönen
 * kullanıcı için "sayfa altımdan kaydı" hissi yaratmaz.
 */
export const SEED_WINDOW_MS = 3 * 60 * 60 * 1000;

export function currentSeed(now: number = Date.now()): string {
  return Math.floor(now / SEED_WINDOW_MS).toString(36);
}

/**
 * ELLE tazeleme tohumu — "KEŞFETİ YENİLE" düğmesi bunu üretir.
 *
 * Pencere tohumundan ayrı bir işlev: pencere tohumu 3 saatte bir kendiliğinden döner,
 * bu ise kullanıcının "aynı vitrini gördüm, karıştır" demesinin karşılığıdır. Ön ekli
 * (`e-`) olması niyetli — akışın neden farklı geldiği günlükten/URL'den okunabiliyor.
 *
 * Sunucu bu tohumu doğrulamaz, doğrulaması da gerekmiyor: tohum yalnız SIRALAMAYA
 * giriyor, hangi ürünün görüneceğine değil. Uydurulmuş bir tohum geçerli bir vitrin
 * üretir, sadece başka bir sırayla.
 */
export function manualSeed(now: number = Date.now()): string {
  return `e-${now.toString(36)}${Math.floor(Math.random() * 46656).toString(36)}`;
}

/** FNV-1a — kısa, çakışması sıralama için önemsiz, her yerde aynı sonucu veren karma. */
export function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Tohum + anahtar → [0,1). Deterministik: aynı çift her zaman aynı sayıyı verir. */
export function rand01(seed: string, key: string): number {
  return hashStr(`${seed}|${key}`) / 0x100000000;
}

/* ----------------------------------------------------------- ürün skoru ---- */

/**
 * Akışın YÜZÜ olan kategoriler. Vitrin bir giyim vitrini: tişört/hoodie/ceket bir
 * ekranda iyi durur, çorap ve takı aynı oranda öne çıkarsa aggregator "aksesuar
 * pazarı" gibi görünür (katalogda 4560 takı + 899 aksesuar var, serpme olmasa
 * ana sayfa bunlarla dolardı).
 */
const CAT_WEIGHT: Partial<Record<ProductCat, number>> = {
  "TİŞÖRT": 1,
  "HOODIE": 1,
  "SWEATSHIRT": 1,
  "CEKET": 1,
  "MONT": 0.95,
  "GÖMLEK": 0.95,
  "ELBİSE": 0.95,
  "PANTOLON": 0.9,
  "JEAN": 0.9,
  "TAKIM": 0.9,
  "UZUN KOLLU": 0.88,
  "ETEK": 0.85,
  "ŞORT": 0.85,
  "EŞOFMAN ALTI": 0.85,
  "TRİKO / KAZAK": 0.85,
  "HIRKA": 0.82,
  "YELEK": 0.8,
  "POLO": 0.8,
  "FORMA": 0.8,
  "BLUZ": 0.8,
  "KORSE / BODY": 0.8,
  "ATLET / KOLSUZ": 0.78,
  "ÜST": 0.75,
  "AYAKKABI": 0.75,
  "ÇANTA": 0.72,
  "TAYT": 0.7,
  "ŞAPKA": 0.65,
  "GÖZLÜK": 0.6,
  "TAKI": 0.55,
  "KEMER": 0.55,
  "CÜZDAN": 0.55,
  "ATKI / ELDİVEN": 0.55,
  "SAAT": 0.55,
  "ÇORAP": 0.5,
  "İÇ GİYİM": 0.5,
  "AKSESUAR": 0.5,
  "DİĞER": 0.35,
};

function catWeight(c: ProductCat): number {
  return CAT_WEIGHT[c] ?? 0.7;
}

/**
 * Ürünün kendi "vitrine yakışırlığı" (0–1) — kartın ekranda nasıl görüneceğine dair
 * elimizdeki tek somut veri. Görsel sayısı, renk zenginliği, beden/fiyat/stok bilgisinin
 * dolu olması: hepsi kartın eksiksiz görünmesini belirler.
 */
function productQuality(p: Product): number {
  let q = 0;

  // görsel: kart görselden ibaret. Hiç yoksa akışta işi yok.
  if (!p.image) return 0;
  const imgs = p.images.length;
  // 0.30/0.22/0.12'den indirildi: görsel sayısı zaten en güçlü ayrışan sinyal
  // (ölçüm: ilk 200 ürün katalog ortalamasının 1.22 katı) ve toplam bütçe
  // `Math.min(1, q)` tavanına dayanınca yeni eklenen beden sinyali köreliyordu.
  q += imgs >= 4 ? 0.26 : imgs >= 2 ? 0.19 : 0.1;

  // renk varyantı: kartta tıklanabilir renk noktaları = daha canlı kart
  // (Ağırlık 0.16/0.11/0.05'ten indirildi: beden çeşitliliği kademeli hâle gelince
  // toplam bütçe 1'i aşıp `Math.min` tavanında sinyaller birbirini köreltiyordu.)
  const colors = p.variants.length || p.colors.length;
  q += colors >= 3 ? 0.13 : colors === 2 ? 0.09 : 0.04;

  // fiyat: "—" yazan kart bozuk görünür (kaft/köstebek gibi fiyatı çekilemeyen
  // markalar bu yüzden biraz geride kalır — ceza bilerek küçük tutuldu)
  if (p.price != null) q += 0.14;

  /**
   * BEDEN ÇEŞİTLİLİĞİ — eskiden düz bir "var/yok" (0.1) idi.
   *
   * Tek bedeni kalmış bir ürünle sekiz beden üreten bir ürün akışta aynı ağırlıktaydı;
   * oysa vitrine bakan kişinin ikincisinden bir şey alabilme ihtimali kat kat yüksek.
   * `p.sizes` katalogda KALAN bedenleri gösteriyor (stok filtresi sonrası), yani bu
   * aynı zamanda "bu ürün daha yeni/daha az tükenmiş" sinyali.
   *
   * "TEK BEDEN" sayılmaz: bir çeşitlilik değil, çeşitliliğin yokluğudur — ama bedeni
   * hiç bilinmeyen üründen yine de iyidir, ona küçük bir pay bırakılıyor.
   */
  const graded = p.sizes.filter((s) => s !== "TEK BEDEN").length;
  q +=
    graded >= 6 ? 0.21
    : graded >= 4 ? 0.17
    : graded >= 2 ? 0.11
    : graded === 1 ? 0.05
    : p.sizes.length ? 0.04
    : 0;

  if (p.inStock) q += 0.1;

  // ad uzunluğu: kart başlığı 2 satırı geçince ızgara ritmi bozuluyor
  const n = p.name.length;
  q += n >= 8 && n <= 46 ? 0.12 : n <= 70 ? 0.06 : 0;

  // kategori ağırlığı son çarpan değil, toplamın bir parçası
  q += catWeight(p.category) * 0.08;

  return Math.min(1, q);
}

/**
 * Yeni ürüne geçici bonus — yoksa yeni eklenen marka/parça 54 bin ürünün dibinde
 * kaybolur, ki en çok tanıtmak istediğimiz şey odur. `day` yalnız bir kısım markada
 * gerçek olduğu için bonus küçük ve kısa ömürlü.
 */
function freshBonus(p: Product): number {
  if (p.day <= 7) return 0.08;
  if (p.day <= 21) return 0.03;
  return 0;
}

/* --------------------------------------------------- estetik / dikkat çekme -- */

/**
 * ESTETİK PUAN (0–1) — ürünün "dikkat çekiciliği".
 *
 * Bu ÖZNEL bir yargı ve öyle olduğunu kabul ediyoruz. Elimizde ürünün fotoğrafını
 * gerçekten "gören" bir model yok; olan şey şu üç sinyal:
 *
 *   1. DESEN/GRAFİK — ürünün üzerinde bir şey var mı. `styles` alanı bunu zaten
 *      taşıyor (bkz. product-styles.ts): desenli/baskılı ürün `streetwear` kazanıp
 *      `basic`i kaybediyor. Vitrinde göz düz beyaz tişörte değil, üzerinde bir şey
 *      olana takılır. Aynı sebeple `ravewear` (fileli/reflektif/payet) güçlü sinyal.
 *   2. RENK KARARLILIĞI — ürünün renk ailesi belli mi, yoksa "her şeyden biraz" mı.
 *      İki-üç aile taşıyan ürün (siyah+kırmızı) kontrastlı ve çekici; hiç etiketi
 *      olmayan ürün ise fotoğrafı okunamamış demektir. "çok-renkli" tek başına
 *      dağınıklık sinyali, ödüllendirilmiyor.
 *   3. FOTOĞRAF YATIRIMI — markanın o ürüne ayırdığı emek. Dört+ fotoğraf çeken
 *      marka o parçayı önemsiyor demektir; tek fotoğraflı ürün çoğunlukla stok
 *      görseli. Bu, kalite sinyalinden farklı olarak ÜRÜNE ÖZEL bir tercih.
 *
 * Kasten dışarıda bıraktıklarım: fiyat (pahalı ≠ çekici), marka puanı (zaten ayrı bir
 * terim, buraya karışırsa underdog mantığı çöker), ad uzunluğu (kart düzeni sinyali,
 * estetik değil).
 *
 * İleride kişiselleştirilecek (kullanıcının tıkladığı ürünlerin desen/renk profili);
 * o zaman bu fonksiyon bir TABAN olarak kalır, üstüne kişisel sapma eklenir.
 */
export function aestheticScore(p: Product): number {
  let a = 0;
  const styles = p.styles ?? [];

  // 1) Desen / grafik dili.
  if (styles.includes("streetwear")) a += 0.3;
  if (styles.includes("ravewear")) a += 0.22;
  if (styles.includes("y2k")) a += 0.2;
  if (styles.includes("techwear")) a += 0.12;
  // Sade parçalar çekici olabilir ama "dikkat çekici" değildir — küçük bir pay.
  if (styles.includes("minimalist") || styles.includes("basic")) a += 0.05;

  // 2) Renk kararlılığı. İki aile = kontrast; tek aile = net; hiç = fotoğraf okunamamış.
  const tags = p.colorTags ?? [];
  const kromatik = tags.filter((t) => t !== "cok-renkli" && t !== "siyah" && t !== "beyaz" && t !== "gri");
  if (tags.length === 0) a -= 0.08;
  else if (kromatik.length >= 2) a += 0.2;
  else if (kromatik.length === 1) a += 0.14;
  else a += 0.06; // yalnız nötrler — şık olabilir, dikkat çekici değil

  // 3) Fotoğraf yatırımı.
  const imgs = p.images.length;
  a += imgs >= 6 ? 0.24 : imgs >= 4 ? 0.18 : imgs >= 2 ? 0.08 : 0;

  // Renk seçeneği zenginliği: kartta tıklanabilir nokta = keşfedilecek bir şey daha.
  if (p.variants.length >= 4) a += 0.1;
  else if (p.variants.length >= 2) a += 0.05;

  return Math.min(1, Math.max(0, a));
}

/**
 * UNDERDOG PRİMİ — düşük/orta puanlı markanın estetik olarak güçlü ürünü.
 *
 * `spotlightBonus`tan farkı KİMİ hedeflediği: spotlight "kartı eksiksiz" ürüne bakar
 * (beden, fiyat, stok, fotoğraf sayısı — yani VERİ bütünlüğü), underdog ise ürünün
 * GÖRSEL iddiasına bakar. Bir marka puanı 2.5 olabilir ama tek bir parçası vitrinin
 * en ilginç şeyi olabilir; kullanıcının istediği tam olarak bu.
 *
 * Marka bandı spotlight'tan DAHA AŞAĞI çekildi (0.15–0.65, yani 1–5 ölçeğinde ~1.6–3.6):
 * burası gerçekten "az bilinen" tarafı. Estetik eşiği yüksek (0.62) ve tohum kapısı dar
 * (%12) — underdog bir KURAL değil, arada bir karşına çıkan sürpriz olmalı.
 */
const UNDERDOG_SHARE = 0.12;

function underdogBonus(p: Product, seed?: string): number {
  if (!seed) return 0;
  const brand = brandScore01(p.brandSlug);
  if (brand < 0.15 || brand > 0.65) return 0;
  const a = aestheticScore(p);
  if (a < 0.62) return 0;
  if (rand01(seed, `underdog:${p.id}`) > UNDERDOG_SHARE) return 0;
  return a >= 0.78 ? 0.24 : 0.16;
}

/**
 * AZ BEDEN / AZ STOK CEZASI.
 *
 * `sizeBonus` bol bedenli ürünü ödüllendiriyordu ama tek bedeni kalmış ürüne hiçbir
 * şey yapmıyordu — o ürün diğer sinyalleri güçlüyse yine ilk sayfaya çıkabiliyordu.
 * Kullanıcı tarafında bu en can sıkıcı sonuç: vitrinde gördüğü şeyi açtığında yalnız
 * "XS" kalmış oluyor.
 *
 * `p.sizes` katalogda KALAN bedenleri gösteriyor (stok filtresi sonrası), yani "1 beden
 * kaldı" aynı zamanda "tükenmek üzere" demek.
 *
 * Bedeni HİÇ OLMAYAN ürün cezalandırılmaz: takı/gözlük gibi kategorilerde beden zaten
 * yok (bkz. types.ts SIZELESS_CATS) ve bu bir eksiklik değil.
 */
function scarcityPenalty(p: Product): number {
  if (!p.sizes.length) return 0;
  const graded = p.sizes.filter((s) => s !== "TEK BEDEN").length;
  if (graded === 0) return 0; // yalnız "TEK BEDEN" — kıtlık değil, ürünün doğası
  return graded === 1 ? 0.18 : graded === 2 ? 0.06 : 0;
}

/**
 * Beden bolluğu bonusu — `freshBonus` ile aynı kalıpta, kalite bütçesinin DIŞINDA.
 *
 * Neden ayrı bir terim: `productQuality` yedi sinyali 0–1 arasına sıkıştırıyor ve
 * `baseScore` onu 0.37 ile çarpıyor; oradaki bir kademe skora en fazla ~0.06 katıyor,
 * keşfet gürültüsü ise 0.30. Ölçüm bunu doğruladı — beden ağırlığı içeride
 * artırıldığında ilk 200 ürünün beden ortalaması 1.13'ten ancak 1.14'e çıktı.
 * Bonus üstten eklenince sinyal gürültünün üstüne çıkıyor.
 *
 * Küçük ve kademeli tutuldu: amaç bedeni bol ürünü ÖNE ALMAK, vitrini bir beden
 * sıralamasına çevirmek değil.
 */
function sizeBonus(p: Product): number {
  const graded = p.sizes.filter((s) => s !== "TEK BEDEN").length;
  return graded >= 6 ? 0.09 : graded >= 4 ? 0.06 : graded >= 2 ? 0.02 : 0;
}

/* ------------------------------------------------- marka rotasyonu (tohumlu) -- */

/**
 * Bir markanın editoryal puanının tohumdan tohuma kayabileceği pay.
 *
 * Neden gerekiyordu: ürün gürültüsü (`noiseWeight`, 0.30) ürün id'sine bağlıydı, yani
 * her tazelemede AYNI markaların farklı ürünleri geliyordu. En üstteki 8–10 marka hiç
 * değişmiyordu ve "aynı feed" hissi tam olarak buradan doğuyordu — marka yorgunluğu
 * sayfa İÇİNDE çeşitlilik veriyor, sayfalar ARASINDA değil.
 *
 * Rotasyon marka düzeyinde çalışır: bir markanın bütün ürünleri aynı miktarda birlikte
 * kayar. Böylece her tazelemede vitrinin başını farklı bir marka açar, ama kayma payı
 * sınırlı olduğu için sıralamanın omurgası hâlâ editoryal puan (bkz. brand-scores.ts):
 * ±0.16, yani 1–5 ölçeğinde ±0.64 puanlık bir salınım. Puanı 5 olan marka 3'lük bir
 * markanın altına DÜŞMEZ; 4.5 ile 5 arasındaki markalar ise sırayı devreder — istenen
 * tam da bu, "ünlülerin kendi arasında" dönüşümlü öne geçmesi.
 */
const BRAND_ROTATION = 0.16;

/** Markanın bu tohumdaki etkin puanı (0–1). Tohum yoksa ham editoryal puan. */
export function brandRank(slug: string, seed?: string): number {
  const base = brandScore01(slug);
  if (!seed) return base;
  const drift = (rand01(seed, `marka:${slug}`) - 0.5) * 2 * BRAND_ROTATION;
  return Math.min(1, Math.max(0, base + drift));
}

/* ------------------------------------------------------- öne çıkan ürün ------ */

/**
 * ÖNE ÇIKAN ÜRÜN PRİMİ — orta sıradaki markanın en iyi parçasının ilk ekrana çıkma hakkı.
 *
 * Puan omurgası doğru ama tek başına şu sonucu veriyor: puanı 3 olan bir markanın
 * kusursuz ürünü (8 beden, 6 fotoğraf, 4 renk, fiyatı dolu), puanı 5 olan markanın
 * vasat ürününün arkasında kalıyor. Vitrin için bu yanlış — keşfetmenin bütün anlamı
 * "bunu nereden buldun" dedirtecek ürünü göstermek.
 *
 * `productQuality` içine ağırlık ekleyerek çözülemez: fonksiyon yedi sinyali 0–1'e
 * sıkıştırıyor, `baseScore` onu 0.37 ile çarpıyor, bir kademe skora ~0.06 katıyor ve
 * keşfet gürültüsünün (0.30) altında kalıyor (ölçüldü, bkz. docs/DEVIR-NOTU.md
 * TUZAKLAR). Bu yüzden `freshBonus`/`sizeBonus` gibi ÜSTTEN eklenen ayrı bir terim.
 *
 * Üç kapı birlikte çalışıyor:
 *   1. KALİTE — yalnız gerçekten eksiksiz kartlar (q ≥ 0.80, katalogun küçük bir dilimi).
 *   2. MARKA BANDI — prim yalnız ORTA banda verilir. Zaten en üstteki markaya (≥0.80)
 *      gerek yok; puanı çok düşük markaya (<0.25) verilmesi ise kürasyon kararını
 *      geçersiz kılmak olurdu — o puan "bu marka vitrinin yüzü olmasın" demek.
 *   3. TOHUM KAPISI — uygun ürünlerin her tohumda yalnız ~%18'i primi alır. Hepsi birden
 *      alsaydı prim bir sıralama katmanına dönüşür ve KALICI olurdu; amaç her tazelemede
 *      BAŞKA bir avuç ürünü öne çıkarmak.
 */
const SPOTLIGHT_SHARE = 0.18;

function spotlightBonus(p: Product, quality: number, seed?: string): number {
  if (!seed || quality < 0.8) return 0;
  const brand = brandScore01(p.brandSlug);
  if (brand >= 0.8 || brand < 0.25) return 0;
  if (rand01(seed, `oneçıkan:${p.id}`) > SPOTLIGHT_SHARE) return 0;
  return quality >= 0.9 ? 0.2 : 0.14;
}

/**
 * Ürünün temel skoru (0–1).
 *
 * `seed` verilirse marka rotasyonu ve öne çıkan primi devreye girer — akışı kuran
 * yol (`buildFeed`) böyle çağırır. Tohumsuz çağrı ham editoryal sıralamayı verir:
 * ARAMA sonuçlarında alaka kırıcısı olarak kullanılan hâl budur (bkz. query.ts),
 * orada rastgeleliğin işi yok.
 */
export function baseScore(p: Product, seed?: string): number {
  const brand = brandRank(p.brandSlug, seed);
  const quality = productQuality(p);
  // Estetik, marka puanından SONRA ikinci ağırlıklı terim: "yukarıda puanı yüksek
  // markalar daha fazla bulunsun ama ilginç ürünler öne çıksın" dengesi burada kuruluyor.
  // 0.22, marka payının (0.55) yarısından az — kürasyon hâlâ omurga.
  const beauty = aestheticScore(p);
  return Math.min(
    1,
    Math.max(
      0,
      brand * 0.55 +
        quality * 0.28 +
        beauty * 0.22 +
        freshBonus(p) +
        sizeBonus(p) +
        spotlightBonus(p, quality, seed) +
        underdogBonus(p, seed) -
        scarcityPenalty(p),
    ),
  );
}

/** Moda göre gürültü payı: keşfette sürpriz, kategoride bulunabilirlik esastır. */
function noiseWeight(mode: FeedMode): number {
  if (mode === "kesfet") return 0.3;
  if (mode === "markalar") return 0.22;
  return 0.12; // kategori içi — niyet belli, rastgelelik kısılır
}

/* --------------------------------------------------------- ton (parlaklık) -- */

/** Ürünün baskın renginin açık/koyu sınıfı. Bilinmiyorsa 0 (nötr). */
function toneClass(p: Product): 0 | 1 | 2 {
  const hex = p.variants[0]?.hex || p.colors[0];
  if (!hex || typeof hex !== "string") return 0;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  // algısal parlaklık (Rec. 601) — göz yeşili kırmızıdan parlak görür
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum < 0.38 ? 1 : lum > 0.62 ? 2 : 0;
}

/* ------------------------------------------------------------ dokuma ------- */

interface WeaveRules {
  /** Aynı marka en az kaç ürün arayla tekrar edebilir. */
  brandGap: number;
  /** Aynı kategoriden en fazla kaç ürün arka arkaya. 0 = kuralı uygulama. */
  catRun: number;
  /** Aynı tondan (koyu/açık) en fazla kaç ürün arka arkaya. 0 = kapalı. */
  toneRun: number;
  /**
   * Marka yorgunluğu: bir marka her göründüğünde SONRAKİ ürünlerinin etkin skoru bu
   * çarpanla azalır. Yorgunluk olmadan akışın başı, puanı en yüksek 8–10 markanın
   * dönüşümlü tekrarına dönüyordu (kural "aynı marka 4 ürün arayla" olduğu için
   * bloklaşmıyor ama çeşitlenmiyordu da). 0.86 ile güçlü marka daha SIK çıkar,
   * ama vitrini ele geçirmez — 3–4 görünümden sonra sırayı orta sıradakilere bırakır.
   */
  fatigue: number;
  /**
   * KATEGORİ YORGUNLUĞU — marka yorgunluğunun kategori karşılığı.
   *
   * `catRun` yalnız ARKA ARKAYA geleni engelliyordu: "tişört, hoodie, tişört, hoodie…"
   * kuralı hiç bozmuyor ama vitrin iki kategoriden ibaret görünüyordu. Katalog da bunu
   * körüklüyor — 14.166 tişörte karşılık 970 triko var, yani sırf sayı üstünlüğüyle
   * tişört ilk ekranı dolduruyordu.
   *
   * Bu çarpan her görünümde o kategorinin sonraki ürünlerini zayıflatır, böylece ilk
   * ekranda kategoriler BENZER ORANLARDA temsil edilir. 1 = kapalı.
   */
  catFatigue: number;
}

const RULES: Record<FeedMode, WeaveRules> = {
  // ana keşfet: en sıkı kurallar — burası vitrinin ana sayfası
  kesfet: { brandGap: 4, catRun: 2, toneRun: 3, fatigue: 0.86, catFatigue: 0.82 },
  // kategori içi: hepsi aynı kategori olduğu için catRun ve catFatigue anlamsız; niyet
  // belli olduğu için yorgunluk da daha ılımlı — kullanıcı "ceket" diyorsa iyi ceketi görsün
  kategori: { brandGap: 3, catRun: 0, toneRun: 3, fatigue: 0.92, catFatigue: 1 },
  // markalar turu: sıkı marka ayrımı (aşağıda ayrıca tur mantığı var)
  markalar: { brandGap: 8, catRun: 0, toneRun: 0, fatigue: 0.5, catFatigue: 0.94 },
};

/**
 * Akışın başında kaç ürün için dokuma yapılır. Ötesi düz skor sırasıdır.
 *
 * SABİT olması şart: istenen sayfaya göre değişseydi, 2. sayfa isteğiyle 38. sayfa
 * isteği farklı diziler üretir, kullanıcı sayfa atladıkça ürünler tekrar eder/kaybolurdu.
 * 4000 ürün = 100 sayfa; oraya kadar inen kullanıcı zaten sıralamayı değiştirmiştir.
 */
const WEAVE_LIMIT = 4000;

/**
 * DOKUMA — akışın kalbi.
 *
 * Her sıraya, kuralları bozmayan EN İYİ ürünü seçer. Alternatifi (önce sırala, sonra
 * komşulukları takasla düzelt) denendi ve kötüydü: 4560 ürünlü bir marka ile 10 ürünlü
 * bir markayı aynı ölçekte yaymak, büyük katalogların ilk ürünlerini kaçınılmaz olarak
 * en başa taşıyor — vitrinin ilk ekranı puanı en düşük pazaryeri markalarıyla doluyordu.
 *
 * Burada sıra tersine kurulur: aday havuzu her markanın SIRADAKİ EN İYİ ürünüdür
 * (marka sayısı 109, yani her adımda en fazla 109 aday). Kazanan; skoru, marka
 * yorgunluğu ve komşuluk kuralları birlikte belirler.
 */
function weave(
  scored: Array<{ p: Product; s: number }>,
  rules: WeaveRules,
  limit: number,
  seed: string,
): Product[] {
  const buckets = new Map<string, Array<{ p: Product; s: number }>>();
  for (const it of scored) {
    const arr = buckets.get(it.p.brandSlug);
    if (arr) arr.push(it);
    else buckets.set(it.p.brandSlug, [it]);
  }
  for (const arr of buckets.values()) arr.sort((a, b) => b.s - a.s);

  // marka başına: kova, okunan yer, kaç kez seçildi
  const lanes = [...buckets.entries()].map(([slug, arr]) => ({ slug, arr, at: 0, used: 0 }));
  const out: Product[] = [];
  const tone = new Map<string, number>();
  const toneOf = (p: Product) => {
    let t = tone.get(p.id);
    if (t === undefined) {
      t = toneClass(p);
      tone.set(p.id, t);
    }
    return t;
  };

  /** Son n çıktıda geçen markalar / kategori-ton serileri kurala uyuyor mu? */
  const fits = (p: Product): boolean => {
    const n = out.length;
    for (let d = 1; d <= rules.brandGap && n - d >= 0; d++) {
      if (out[n - d].brandSlug === p.brandSlug) return false;
    }
    if (rules.catRun > 0 && n >= rules.catRun) {
      let same = true;
      for (let d = 1; d <= rules.catRun; d++) {
        if (out[n - d].category !== p.category) {
          same = false;
          break;
        }
      }
      if (same) return false;
    }
    if (rules.toneRun > 0 && n >= rules.toneRun) {
      const t = toneOf(p);
      if (t !== 0) {
        let same = true;
        for (let d = 1; d <= rules.toneRun; d++) {
          if (toneOf(out[n - d]) !== t) {
            same = false;
            break;
          }
        }
        if (same) return false;
      }
    }
    return true;
  };

  // Kategori başına kaç kez seçildi — `catFatigue` bunun üzerinden işler.
  const catUsed = new Map<string, number>();

  const target = Math.min(limit, scored.length);
  while (out.length < target) {
    let best: (typeof lanes)[number] | null = null;
    let bestScore = -1;
    let fallback: (typeof lanes)[number] | null = null;
    let fallbackScore = -1;

    for (const lane of lanes) {
      if (lane.at >= lane.arr.length) continue;
      const cand = lane.arr[lane.at];
      // İki yorgunluk birlikte: MARKA (bu markadan kaç ürün geçti) ve KATEGORİ
      // (bu kategoriden kaç ürün geçti). İkincisi olmadan akış, katalogda en çok
      // ürünü olan iki-üç kategoriye kayıyordu.
      const eff =
        cand.s *
        Math.pow(rules.fatigue, lane.used) *
        (rules.catFatigue < 1
          ? Math.pow(rules.catFatigue, catUsed.get(cand.p.category) ?? 0)
          : 1);
      if (eff > fallbackScore) {
        fallbackScore = eff;
        fallback = lane;
      }
      if (eff > bestScore && fits(cand.p)) {
        bestScore = eff;
        best = lane;
      }
    }

    // Hiçbir aday kurala uymuyorsa (ör. tek markalık filtre) kural gevşetilir:
    // akışı kesmek, kuralı bozmaktan daha kötü.
    const pick = best ?? fallback;
    if (!pick) break;
    const chosen = pick.arr[pick.at].p;
    out.push(chosen);
    pick.at++;
    pick.used++;
    catUsed.set(chosen.category, (catUsed.get(chosen.category) ?? 0) + 1);
  }

  // Dokuma sınırının ötesi (100. sayfadan sonrası). Düz skor sırası burada işe yaramaz:
  // sıralama marka marka kümeleniyor ve 101. sayfada vitrin tek markaya düşüyordu.
  // Onun yerine ucuz bir ADIM (stride) serpmesi: her markanın kalan ürünleri kuyruğun
  // tamamına eşit aralıkla dağıtılır — dokuma kadar iyi değil ama O(n log n) ve
  // hiçbir sayfa tek markaya düşmüyor.
  if (out.length < scored.length) {
    const rest: Array<{ p: Product; k: number }> = [];
    let tail = 0;
    for (const lane of lanes) tail += lane.arr.length - lane.at;
    for (const lane of lanes) {
      const n = lane.arr.length - lane.at;
      if (n <= 0) continue;
      const step = tail / n;
      const offset = rand01(seed, `kuyruk:${lane.slug}`);
      for (let i = lane.at; i < lane.arr.length; i++) {
        rest.push({ p: lane.arr[i].p, k: (i - lane.at + offset) * step });
      }
    }
    rest.sort((a, b) => a.k - b.k);
    for (const r of rest) out.push(r.p);
  }
  return out;
}

/* ---------------------------------------------------------------- akış ------ */

/**
 * Akışı kurar: skorla → dokur.
 *
 * `limit` yalnız üst sınırdır; dokuma zaten WEAVE_LIMIT'te durur. Küçük sonuç
 * kümelerinde (filtrelenmiş sorgular) tamamı dokunur.
 */
export function buildFeed(
  items: Product[],
  mode: FeedMode,
  seed: string,
  limit = WEAVE_LIMIT,
): Product[] {
  if (items.length < 2) return items;

  const w = noiseWeight(mode);
  // Tohum skorun İKİ yerine birden giriyor: `baseScore` içinde MARKA düzeyinde
  // (rotasyon + öne çıkan primi, bir markanın ürünleri birlikte kayar), burada ise
  // ÜRÜN düzeyinde (gürültü, aynı markanın ürünleri kendi aralarında karışır).
  // Yalnız ürün gürültüsü varken tazeleme markaları hiç değiştirmiyordu.
  const scored = items.map((p) => ({
    p,
    s: baseScore(p, seed) * (1 - w) + rand01(seed, p.id) * w,
  }));

  if (mode === "markalar") return roundRobinByBrand(scored, seed);
  return weave(scored, RULES[mode], Math.min(WEAVE_LIMIT, Math.max(limit, 400)), seed);
}

/**
 * MARKALAR görünümü: sıkı sıra ile marka turu — her markadan bir ürün, sonra tur başa
 * döner. "Tüm ürünler"den farkı budur; burada amaç ürün keşfi değil, MARKA keşfi:
 * kullanıcı ilk ekranda 40 farklı markanın en iyi parçasını görür.
 */
function roundRobinByBrand(scored: Array<{ p: Product; s: number }>, seed: string): Product[] {
  const buckets = new Map<string, Array<{ p: Product; s: number }>>();
  for (const it of scored) {
    const arr = buckets.get(it.p.brandSlug);
    if (arr) arr.push(it);
    else buckets.set(it.p.brandSlug, [it]);
  }
  // Tur içindeki marka sırası: editoryal puan + tohumlu gürültü. Her oturumda vitrinin
  // ilk sırasına farklı bir marka geçer, ama iyi markalar hep ön turlardadır.
  const order = [...buckets.entries()].map(([slug, arr]) => {
    arr.sort((a, b) => b.s - a.s);
    // `brandRank` (tohumlu) kullanılıyor: marka turunun sırası da vitrinin geri kalanıyla
    // AYNI rotasyonu izlesin. İki yerde iki farklı marka sırası, "MARKALAR" sekmesine
    // geçen kullanıcıya vitrinin sırasıyla çelişen bir liste gösteriyordu.
    return { arr, rank: brandRank(slug, seed) * 0.7 + rand01(seed, `tur:${slug}`) * 0.3 };
  });
  order.sort((a, b) => b.rank - a.rank);

  const out: Product[] = [];
  const max = Math.max(...order.map((o) => o.arr.length));
  for (let round = 0; round < max; round++) {
    for (const o of order) {
      if (round < o.arr.length) out.push(o.arr[round].p);
    }
  }
  return out;
}
