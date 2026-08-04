import type { StyleKey } from "./brand-styles.ts";

/**
 * Ürün kategorileri — DÜZ taksonomi.
 *
 * Sınıflandırma hâlâ düzdür: bir ürünün `category` alanı doğrudan TİŞÖRT / HOODIE /
 * GÖMLEK'tir, "ÜST / FORMA" gibi bir sepet değil. Çatı kategoriler (aşağıdaki
 * CAT_GROUPS) yalnızca SOL MENÜNÜN görünümüdür — filtreye girmez, üründe saklanmaz.
 * Böylece taksonomi tek katman kalırken 36 kalemlik liste gezilebilir hâle gelir.
 *
 * Sıralama sol menüdeki görünme sırasıdır: üst giyim, alt giyim, dış giyim,
 * elbise-etek, aksesuar, iç giyim ve en sonda sınıflandırılamayanlar.
 */
export const PRODUCT_CATS = [
  // üst giyim
  "TİŞÖRT",
  "UZUN KOLLU",
  "SWEATSHIRT",
  "HOODIE",
  "GÖMLEK",
  "POLO",
  "FORMA",
  "ATLET / KOLSUZ",
  "BLUZ",
  "KORSE / BODY",
  "TRİKO / KAZAK",
  "HIRKA",
  "ÜST",
  // alt giyim
  "PANTOLON",
  "JEAN",
  "EŞOFMAN ALTI",
  "ŞORT",
  "TAYT",
  "İÇ GİYİM",
  // dış giyim
  "CEKET",
  "MONT",
  "YELEK",
  // elbise / etek / takım
  "ELBİSE",
  "ETEK",
  "TAKIM",
  // aksesuar
  "ÇANTA",
  "ŞAPKA",
  "ÇORAP",
  "TAKI",
  "KEMER",
  "GÖZLÜK",
  "SAAT",
  "CÜZDAN",
  "ATKI / ELDİVEN",
  "AYAKKABI",
  "AKSESUAR",
  // sınıflandırılamayan
  "DİĞER",
] as const;

export type ProductCat = (typeof PRODUCT_CATS)[number];

/**
 * VİTRİNDE HİÇ GÖSTERİLMEYEN kategoriler.
 *
 * Ayakkabı 2026-07-29'da kapsam dışına alındı: numaralandırma (37-46) giyim
 * bedenleriyle aynı eksende değil, iade/uyum davranışı bambaşka ve katalogdaki payı
 * %0,8. Kategori TAKSONOMİDE KALIR — `categorize()` ürünü hâlâ AYAKKABI'ya koyar ve
 * `import-catalog` tam da bu etikete bakarak onu `.data/catalog.archived.json`'a
 * ayırır. Yani veri korunur, yalnız vitrine çıkmaz; kuralı gevşetip yeniden import
 * etmek geri almak için yeterlidir.
 */
export const ARCHIVE_CATS = ["AYAKKABI"] as const satisfies readonly ProductCat[];

/** Menüde/filtrede görünen kategoriler — arşivlikler düşülmüş hâli. */
export const NAV_CATS = PRODUCT_CATS.filter(
  (c) => !(ARCHIVE_CATS as readonly string[]).includes(c),
) as Exclude<ProductCat, (typeof ARCHIVE_CATS)[number]>[];

/**
 * BEDENİ OLAMAYAN kategoriler — bu ürünlerde beden alanı tamamen boşaltılır.
 *
 * Bir yüzüğün, gözlüğün, cüzdanın ya da saatin konfeksiyon bedeni yoktur. Katalogda
 * yine de vardı ve sebebi ölçüldü: kaynak sitelerin bir kısmında ADET SEÇİCİ
 * (1,2,3…10) beden seçeneği olarak işaretlenmiş. Sayısal ayıklama `sizes.ts`te
 * (`MIN_NUMERIC_SIZE`) yapılıyor; bu liste ikinci savunma hattı — o kategorilerde
 * ALFABETİK beden de ("S/M/L" yazan bir kolye) anlamsız.
 *
 * BURADA OLMAYANLAR bilerek dışarıda: ŞAPKA ve KEMER'de S/M/L gerçekten var
 * (ölçüldü: kemerlerin 212'si S, 212'si M), ÇORAP ayakkabı numarası taşıyor
 * (40:341, 42:341), ATKI / ELDİVEN'de eldiven bedeni olabiliyor. ÇANTA'nın
 * çoğunluğu "TEK BEDEN" ve o zararsız bir bilgi.
 */
export const SIZELESS_CATS = [
  "TAKI",
  "GÖZLÜK",
  "SAAT",
  "CÜZDAN",
  "AKSESUAR",
] as const satisfies readonly ProductCat[];

const SIZELESS_SET = new Set<string>(SIZELESS_CATS);

/** Bu kategorinin ürünlerinde beden bilgisi tutulmalı mı? */
export function catHasSizes(cat: string): boolean {
  return !SIZELESS_SET.has(cat);
}

/**
 * ANA SAYFA (KEŞFET) KAPSAMI — vitrinin ana akışında hangi kategoriler çıkabilir.
 *
 * altr bir GİYİM vitrini. Katalogda 4.906 takı, 4.164 aksesuar, 2.558 çanta var; bunlar
 * ana akışa girdiğinde ilk ekran anahtarlık/kolye/telefon kılıfı vitrinine dönüyor ve
 * aggregator "giyim" olmaktan çıkıyor. Kategori ağırlıkları (discovery.ts CAT_WEIGHT)
 * bunu yalnız AZALTIYORDU; kullanıcı hiç görmek istemiyor.
 *
 * Bu bir SİLME DEĞİL, yalnız ana akışın kapsamı: aksesuarlar sol menüden kendi
 * kategorilerinden, aramadan ve marka sayfalarından erişilebilir olmaya devam eder.
 */
export const FEED_EXCLUDED_CATS = [
  "ÇANTA",
  "ŞAPKA",
  "ÇORAP",
  "TAKI",
  "KEMER",
  "GÖZLÜK",
  "SAAT",
  "CÜZDAN",
  "ATKI / ELDİVEN",
  "AKSESUAR",
  "DİĞER",
] as const satisfies readonly ProductCat[];

const FEED_EXCLUDED_SET = new Set<string>(FEED_EXCLUDED_CATS);

/** Ürün ana sayfadaki keşfet akışına girebilir mi? */
export function catInFeed(cat: string): boolean {
  return !FEED_EXCLUDED_SET.has(cat);
}

/**
 * ÇATI KATEGORİLER — sol menünün açılır kapanır bölümleri.
 *
 * Yalnızca bir GÖRÜNÜM katmanı: ürünün kendi kategorisi değişmez, sorguya bir alan
 * eklenmez. 36 kalemlik düz liste sidebar'ın tamamını kaplıyor ve kendi içinde
 * kaydırılıyordu; artık beş kapalı başlık duruyor, istenen açılıyor.
 *
 * Buradaki listeler NAV_CATS'in TAMAMINI kapsamalı — eksik kalan bir kategori
 * menüden tamamen kaybolurdu. `npm run check-cat-groups` bunu denetler. ARŞİV
 * kategorileri (ARCHIVE_CATS) bilerek dışarıdadır: o ürünler kataloga hiç girmez.
 */
export const CAT_GROUPS = [
  {
    key: "ust",
    label: "ÜST GİYİM",
    cats: [
      "TİŞÖRT", "UZUN KOLLU", "SWEATSHIRT", "HOODIE", "GÖMLEK", "POLO", "FORMA",
      "ATLET / KOLSUZ", "BLUZ", "KORSE / BODY", "TRİKO / KAZAK", "HIRKA", "ÜST",
    ],
  },
  {
    key: "alt",
    label: "ALT GİYİM",
    cats: ["PANTOLON", "JEAN", "EŞOFMAN ALTI", "ŞORT", "TAYT"],
  },
  { key: "dis", label: "DIŞ GİYİM", cats: ["CEKET", "MONT", "YELEK"] },
  { key: "elbise", label: "ELBİSE & TAKIM", cats: ["ELBİSE", "ETEK", "TAKIM"] },
  {
    key: "aksesuar",
    label: "AKSESUAR",
    cats: [
      "ÇANTA", "ŞAPKA", "ÇORAP", "TAKI", "KEMER", "GÖZLÜK", "SAAT", "CÜZDAN",
      "ATKI / ELDİVEN", "AKSESUAR",
    ],
  },
  // İÇ GİYİM kendi başlığı: alt giyimin altında ararken bulunmuyordu ve boxer/külot
  // ürünlerinin çoğu da o dönem sınıflandırılamayıp DİĞER'e düşüyordu. Tek kalemlik
  // bir çatı olması sorun değil — burada aranan şey menüde GÖRÜNMESİ. Sıradaki yeri
  // kuyruk: ana giyim çatıları (üst/alt/dış/elbise) ve aksesuardan sonra gelir.
  { key: "ic", label: "İÇ GİYİM", cats: ["İÇ GİYİM"] },
  { key: "diger", label: "SINIFLANDIRILMAMIŞ", cats: ["DİĞER"] },
] as const satisfies ReadonlyArray<{ key: string; label: string; cats: readonly ProductCat[] }>;

export type CatGroupKey = (typeof CAT_GROUPS)[number]["key"];

/** Bir ürün kategorisinin hangi çatının altında olduğu. */
export function groupOfCat(cat: string): CatGroupKey | null {
  for (const g of CAT_GROUPS) if ((g.cats as readonly string[]).includes(cat)) return g.key;
  return null;
}

/**
 * Kategorilerin KÜÇÜK HARFLİ hâli — elle yazılı, çünkü otomatik küçültme bu listede
 * çalışmıyor.
 *
 * Türkçe küçültme ("tr" locale) her büyük I'yı noktasız ı yapar: "HIRKA" → "hırka" doğru
 * ama "HOODIE" → "hoodıe" yanlış. Düz küçültme tam tersini yapar: "hoodie" doğru,
 * "hirka" yanlış. Listede iki türden de kelime var, yani tek bir kural yok — bu yüzden
 * doğru hâller burada sabit duruyor. (Aynı tuzağın sınıflandırıcıdaki hâli için
 * bkz. categorize.ts, 3 numaralı not.)
 *
 * Kullanım yeri: cümle içinde kategori adı geçen metinler (marka sayfası meta açıklaması).
 */
export const CAT_LOWER: Record<ProductCat, string> = {
  "TİŞÖRT": "tişört",
  "UZUN KOLLU": "uzun kollu",
  "SWEATSHIRT": "sweatshirt",
  "HOODIE": "hoodie",
  "GÖMLEK": "gömlek",
  "POLO": "polo",
  "FORMA": "forma",
  "ATLET / KOLSUZ": "atlet",
  "BLUZ": "bluz",
  "KORSE / BODY": "korse",
  "TRİKO / KAZAK": "triko",
  "HIRKA": "hırka",
  "ÜST": "üst",
  "PANTOLON": "pantolon",
  "JEAN": "jean",
  "EŞOFMAN ALTI": "eşofman altı",
  "ŞORT": "şort",
  "TAYT": "tayt",
  "İÇ GİYİM": "iç giyim",
  "CEKET": "ceket",
  "MONT": "mont",
  "YELEK": "yelek",
  "ELBİSE": "elbise",
  "ETEK": "etek",
  "TAKIM": "takım",
  "ÇANTA": "çanta",
  "ŞAPKA": "şapka",
  "ÇORAP": "çorap",
  "TAKI": "takı",
  "KEMER": "kemer",
  "GÖZLÜK": "gözlük",
  "SAAT": "saat",
  "CÜZDAN": "cüzdan",
  "ATKI / ELDİVEN": "atkı",
  "AYAKKABI": "ayakkabı",
  "AKSESUAR": "aksesuar",
  "DİĞER": "diğer",
};

/**
 * Sol menüdeki "görünüm"ler — gerçek ürün kategorisi değildirler.
 *
 * "YENİ" buradan KALDIRILDI: `day` alanı yalnız shopify/woocommerce markalarında gerçek,
 * ikas/jsonld adaptörleri sabit 20 yazıyor. Yani "YENİ" katalogun %64'ünü hiç göremeyen,
 * birkaç markadan ibaret 630 ürünlük yanlı bir listeydi ve ana sayfa oydu. Yerine
 * TÜM ÜRÜNLER geldi.
 *
 * Aynı yanlılık "sadece canlı drop" filtresini de sakatlıyordu: `drop` yalnız
 * shopify/woocommerce adaptörlerinde hesaplanıyor, ikas/jsonld sabit `false` yazıyordu —
 * yani katalogun yarısı o filtreden yapısal olarak geçemiyordu. Alan da filtre de
 * 2026-07-29'da tamamen kaldırıldı; "yeni"lik yalnız YENİ sıralamasında kalıyor.
 */
export const VIEW_CATS = ["TÜM ÜRÜNLER", "MARKALAR"] as const;

/** Sol menünün tamamı: görünümler + tüm ürün kategorileri. */
export const CATS = ["TÜM ÜRÜNLER", ...NAV_CATS, "MARKALAR"] as const;

export type NavCat = (typeof CATS)[number];

/**
 * Markanın altyapısı. Bu alan yalnız bir İPUCU: scraper her çalıştırmada ana sayfadan
 * yeniden tespit ediyor (bkz. scripts/scrape/run.mjs detectPlatform) — 38 marka bir
 * dönem burada "jsonld" yazıyordu ama aslında İkas'tı ve eksik çekiliyordu.
 * "shopier" özel: mağaza kendi alan adında değil, shopier.com/<kullanıcı> altında durur.
 */
export type Platform = "shopify" | "ikas" | "woocommerce" | "shopier" | "jsonld" | "none";

/** Ürünün hedef kitlesi. Sinyal yoksa veya iki taraf da geçiyorsa "unisex". */
export type Gender = "erkek" | "kadin" | "unisex";

/** Etiket olarak taşınan cinsiyet — unisex ürün ikisini birden taşır. */
export type GenderTag = "kadin" | "erkek";

export interface Brand {
  /** Görünen ad (tasarım listesindeki isim). */
  name: string;
  /** URL/anahtar için normalize edilmiş slug. */
  slug: string;
  /** Markanın sitesinin origin'i, ör. https://lesbenjamins.com — yoksa null. */
  url: string | null;
  platform: Platform;
}

/**
 * Ürünün bir renk varyantı. `imgs`, ürünün `images` dizisine indekslerdir — aynı görsel
 * birden çok varyantta geçebildiği için URL'leri tekrarlamak yerine havuza işaret ediyoruz
 * (katalog 20 bin ürün; tekrar eden URL'ler yükü gereksiz büyütüyordu).
 */
export interface Variant {
  /** Markanın yazdığı renk adı ("Siyah", "Buz Mavisi"). Bilinmiyorsa boş. */
  color: string;
  /** Renk noktası için hex. */
  hex: string;
  /** Bu rengin görsellerinin `Product.images` içindeki indeksleri (en az bir tane). */
  imgs: number[];
  sizes: string[];
  inStock: boolean;
  price: number | null;
  /** Bu rengin markadaki kendi ürün sayfası (varsa). */
  url: string | null;
  /**
   * İçe aktarma zamanında işaretlenir: bu ürünün 2+ varyantı BİREBİR aynı renk adını
   * taşıyor. Genelde markanın kaynak verisindeki bir hataya işaret eder — ör. iki ayrı
   * Shopify ürünü ("...-black-jersey" ve "...-jersey") tek karta katlanmış ama ikisinin
   * de "Renk" seçeneği kaynakta "Beyaz" girilmiş. Böyle bir üründe renk ADI güvenilmez
   * olduğu için isim, ölçümü geçersiz kılan hakem OLAMAZ (bkz. ColorSwatches →
   * noktaRengi) — bu alan true olduğunda ölçüm isme öncelenir.
   */
  colorSuspect?: boolean;
}

export interface Product {
  id: string;
  brand: string;
  brandSlug: string;
  name: string;
  category: ProductCat;
  /**
   * Cinsiyet etiketleri. Unisex ürün ["kadin","erkek"] taşır — yani her iki filtrede de
   * çıkar. Tek etiketli ürün yalnızca o filtrede görünür.
   */
  genders: GenderTag[];
  /**
   * Ürünün TARZ etiketleri. Marka tarzı önsel olarak miras alınır, sonra ürün adına
   * bakan kural motoru düzeltir (bkz. src/lib/product-styles.ts) — desenli bir ürün
   * "basic" olamaz.
   */
  styles: StyleKey[];
  /**
   * VİTRİN FİYATI: kartta açılışta görünen varyantın fiyatı (bkz. `src/lib/variant.ts`).
   * Bilinmiyorsa null. İndirim mekanizması YOK — ürün kaynakta kaça satılıyorsa o.
   */
  price: number | null;
  /** Renkler arası fiyat aralığı; fiyat filtresi bu aralıkla kesişime bakar. */
  priceMin: number | null;
  priceMax: number | null;
  /** ISO 4217 kodu, BÜYÜK harf (TRY/USD/EUR/GBP…). Kaynağın kendi para birimi. */
  currency: string;
  /** Ana görsel (markanın CDN'indeki ham URL). Panelde /api/img ile yansıtılır. */
  image: string | null;
  images: string[];
  sizes: string[];
  /** Renk noktaları (hex) — `variants`ın kısayolu; vitrin gibi hafif yerlerde kullanılır. */
  colors: string[];
  /**
   * FİLTRELENEBİLİR renk aileleri ("siyah", "mavi", "cok-renkli" — bkz. color-tags.ts).
   *
   * `colors`tan farkı: o bir hex listesi, yani çizilecek bir nokta; bu bir TAKSONOMİ.
   * Import zamanında `data/color-tags.json`dan okunur (üretimi `npm run tag-colors`);
   * etiketi çıkarılamamış üründe boş dizidir — renk filtresi böyle ürünleri elemekten
   * başka bir şey yapmaz, uydurma bir aileye atmaz.
   */
  colorTags: string[];
  /** Renk varyantları. Tek renkli üründe tek eleman olur, hiç yoksa boş dizi. */
  variants: Variant[];
  /** Ürünün markanın sitesindeki gerçek sayfası (satın al / mağazaya git). */
  productUrl: string | null;
  inStock: boolean;
  /** Popülerlik sıralaması için kaba puan. */
  pop: number;
  /** "Yeni" sıralaması için: kaç gün önce (küçük = daha yeni). */
  day: number;
  /** Veri kaynağı: canlı marka sitesi mi, tasarım seed'i mi. */
  source: "live" | "seed";
  /** Bu kaydın kaynaktan en son tazelendiği an (ISO). Canlı tazeleme hattı yazar. */
  updatedAt?: string;
}
