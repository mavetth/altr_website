import type { Gender, NavCat, Product } from "./types";
import { CATS, catInFeed } from "./types.ts";
import { baseScore, buildFeed, currentSeed, type FeedMode } from "./discovery.ts";
import { STYLES, isStyleKey, type StyleKey } from "./brand-styles.ts";
import { isColorTag } from "./color-tags.ts";
import { matches, parseSearch, relevance } from "./search-index.ts";
import { primaryName, slugify } from "./slug.ts";
// Uzantı + import attribute ŞART: bu modülü Node doğrudan çalıştırıyor (import-catalog).
import BRAND_NAMES from "./brand-names.json" with { type: "json" };

/** Tarz anahtarının görünen adı ("techwear" -> "TECHWEAR"). */
export function styleLabel(k: StyleKey): string {
  return STYLES.find((s) => s.k === k)?.label ?? k.toUpperCase();
}

export const PAGE_SIZE = 40;

/**
 * Fiyat bantları. `k` durumun anahtarı (kalıcı, kayıtlı linkler bozulmasın), `slug`
 * ise ADRESTE görünen hâli — `fiyat=2` okunamıyordu, `fiyat=2k-4k` okunuyor.
 */
export const PRICES = [
  { k: "ALL", slug: "hepsi", label: "HEPSİ", lo: 0, hi: 1e9 },
  { k: "0", slug: "0-800", label: "0–800", lo: 0, hi: 800 },
  { k: "1", slug: "800-2k", label: "800–2K", lo: 800, hi: 2000 },
  { k: "2", slug: "2k-4k", label: "2K–4K", lo: 2000, hi: 4000 },
  { k: "3", slug: "4k-ustu", label: "4K+", lo: 4000, hi: 1e9 },
] as const;

/**
 * Sıralama.
 *
 * "kesfet" NÖTR durumdur — hiçbir sıralama düğmesi basılı değilken vitrin keşfet
 * akışıyla gelir (bkz. discovery.ts). Diğer üçü ÜÇ DURUMLU düğmelerdir:
 * 1. basış → artan, 2. basış → azalan, 3. basış → nötr (keşfet).
 *
 * "POPÜLER" kaldırıldı: dayandığı `pop` alanı katalogun %58'inde sabit 50, kalanında
 * 100−day. Yani hiçbir zaman popülerlik ölçmüyordu, kullanıcıya yalan söylüyordu.
 */
export type SortKey = "kesfet" | "fiyat" | "yeni" | "marka";
export type SortDir = "asc" | "desc";

export const SORTS: Array<{ k: Exclude<SortKey, "kesfet">; label: string; asc: string; desc: string }> = [
  { k: "fiyat", label: "FİYAT", asc: "ARTAN", desc: "AZALAN" },
  { k: "yeni", label: "TARİH", asc: "ÖNCE YENİ", desc: "ÖNCE ESKİ" },
  { k: "marka", label: "MARKA", asc: "A→Z", desc: "Z→A" },
];

const SORT_KEYS = new Set<string>(["kesfet", ...SORTS.map((s) => s.k)]);

/**
 * Üç durumlu döngü: kapalı → artan → azalan → kapalı.
 * Tek yerde tanımlı; hem masaüstü ızgara başlığı hem filtre paneli bunu çağırır,
 * yoksa iki ayrı yerde iki farklı davranış oluşuyordu.
 */
export function cycleSort(
  cur: { sort: SortKey; dir: SortDir },
  k: Exclude<SortKey, "kesfet">,
): { sort: SortKey; dir: SortDir } {
  if (cur.sort !== k) return { sort: k, dir: "asc" };
  if (cur.dir === "asc") return { sort: k, dir: "desc" };
  return { sort: "kesfet", dir: "asc" };
}

/**
 * Beden listesi artık burada SABİT DEĞİL — bkz. src/lib/sizes.ts.
 *
 * Eskiden `ALLSIZES = ["XS","S","M","L","XL"]` idi ve kart/modal/filtre bu beş kutuyu
 * çiziyordu. Bunun iki sonucu vardı: (1) jean 30/32, ayakkabı 41, "TEK BEDEN" gibi
 * bedenler HİÇBİR YERDE görünmüyordu, (2) 2XL/3XL satan ürünler bedensiz sanılıyordu.
 * Kart artık ürünün YALNIZ ÜRETİLEN bedenlerini çiziyor (pencere XS'ten başlar, taşanlar
 * "+n"), filtrenin kutuları ise katalogda geçen bedenlerden türetiliyor.
 */

// Varyant seçimi (ve ona bağlı vitrin fiyatı) `variant.ts`te: import script'i de aynı
// kuralı kullanmak zorunda, oradan buraya import etmek zinciri şişiriyordu.
// Uzantı ŞART: bu dosyayı script'ler de import ediyor (import-catalog) ve Node
// uzantısız yolu çözemiyor — bundler çözüyor diye uzantısız bırakmak, katalog
// üretimini kırıyor.
export { defaultVariantIndex } from "./variant.ts";

/** Kadın/erkek seçimi. Boş dizi = seçim yok, hepsi karışık gösterilir. */
export type GenderKey = Exclude<Gender, "unisex">;

export const GENDERS: Array<{ k: GenderKey; label: string }> = [
  { k: "kadin", label: "KADIN" },
  { k: "erkek", label: "ERKEK" },
];

export interface QueryParams {
  cat: NavCat;
  q: string;
  /** Seçili marka adları — boşsa marka filtresi yok, birden çoğu "veya" ile birleşir. */
  brands: string[];
  /** Seçili cinsiyetler — boşsa hepsi. İkisi birden seçilebilir. */
  genders: GenderKey[];
  /**
   * Seçili tarzlar (streetwear/basic/techwear/…) — boşsa tarz filtresi yok, birden çoğu
   * "veya" ile birleşir. Tarz MARKAYA yazılıdır (bkz. brand-styles.ts), ürüne değil.
   */
  styles: StyleKey[];
  price: string; // PRICES key
  /**
   * Seçili bedenler — boşsa beden filtresi yok, birden çoğu "VEYA" ile birleşir.
   * ("M veya L olan ürünler" doğru okuma; bir ürünün aynı anda iki bedeni olması
   * beklenen şey, kullanıcı ise kendine uyan tek bedeni arıyor.)
   *
   * Numara bantları (bkz. sizes.ts NUM_BANDS) ayrı bir alan DEĞİL: bant tıklanınca
   * kapsadığı gerçek jetonlar bu diziye yazılır, sorgu motoru bantları hiç bilmez.
   */
  sizes: string[];
  /**
   * Seçili renk aileleri (bkz. color-tags.ts) — boşsa renk filtresi yok.
   *
   * Beden/marka/tarzın aksine bu "VE": iki renk seçildiğinde İKİSİNİ BİRDEN içeren
   * ürünler gelir. Kasıtlı ve istenen davranış — "siyah-beyaz bir şey arıyorum" diyen
   * kullanıcıya siyah ürünler + beyaz ürünler karışımı vermek işe yaramıyor.
   */
  colors: string[];
  sort: SortKey;
  /** Sıralama yönü — sort "kesfet" iken anlamsızdır. */
  dir: SortDir;
  /**
   * Yalnız stoktaki ürünler. VARSAYILAN true — vitrin bir "alınabilir ürün" listesi;
   * tükenmiş ürün alıcı için ölü bağ. Kapatınca tükenmişler de listelenir (grid'de
   * "STOKTA YOK" damgasıyla). URL'de yalnız KAPALIYKEN görünür (`tukenmis=1`), yani
   * varsayılan link temiz kalır.
   */
  inStockOnly: boolean;
  page: number;
  /**
   * Keşfet akışının rastgelelik tohumu. Aynı tohum = aynı vitrin; oturum boyunca sabit
   * kalır (sayfa 2'ye geçip dönünce ızgara titremesin), tohum penceresi dönünce vitrin
   * baştan karışır. URL'e YAZILMAZ — paylaşılan link, açan kişinin kendi penceresindeki
   * vitrini gösterir.
   */
  seed: string;
}

export const DEFAULT_QUERY: QueryParams = {
  cat: "TÜM ÜRÜNLER",
  q: "",
  brands: [],
  genders: [],
  styles: [],
  price: "ALL",
  sizes: [],
  colors: [],
  sort: "kesfet",
  dir: "asc",
  inStockOnly: true,
  page: 1,
  seed: "",
};

/** URL'de çoklu değerler virgülle taşınır; marka adlarında virgül yok (brand-names.json). */
export const MULTI_SEP = ",";

function parseList(v: string | null): string[] {
  if (!v) return [];
  return [...new Set(v.split(MULTI_SEP).map((s) => s.trim()).filter(Boolean))];
}

/* ------------------------------------------------------------ adres biçimi --- */

/**
 * ADRES ÇUBUĞU SÖZLÜĞÜ.
 *
 * Eski hâlde her tıklama şuna benzer bir adres üretiyordu:
 *   /?cat=T%C3%9CM+%C3%9CR%C3%9CNLER&brand=OATH+ISTANBUL&price=2&page=1
 * Yani: varsayılan kategori boşuna yazılıyor, `page=1` her zaman duruyor, Türkçe büyük
 * harfler yüzde-kodlanıyor ve `price=2` hiçbir şey ifade etmiyor. Paylaşılabilir bir
 * link değil, bir hata ayıklama çıktısı gibi görünüyordu.
 *
 * Yeni hâli:
 *   /?kategori=tisort&marka=oath-istanbul&fiyat=2k-4k&sayfa=3
 *
 * Üç kural:
 *   1. VARSAYILAN YAZILMAZ. Filtresiz ana sayfanın adresi çıplak `/` olur.
 *   2. Değerler SLUG. Kategori ve marka adresе slug'la girer, okuyan tarafta gerçek
 *      ada çözülür — sorgu motoru hâlâ görünen adla çalışır, değişen yalnız taşıma.
 *   3. ESKİ LİNKLER OKUNUR. Eski anahtarlar (`cat`, `brand`, `q`, `page`…) ve eski
 *      değerler (tam kategori/marka adı, `price=2`) hâlâ kabul edilir; yalnız artık
 *      ÜRETİLMEZ. Paylaşılmış bir link veya kayıtlı bir yer imi kırılmasın.
 */

/** Kategori slug'ı ↔ görünen ad. */
const CAT_SLUGS = new Map<string, NavCat>(CATS.map((c) => [slugify(c), c]));
const SLUG_BY_CAT = new Map<string, string>(CATS.map((c) => [c, slugify(c)]));

/**
 * Marka slug'ı → görünen ad. Kaynak `brand-names.json`; slug üretimi `lib/brands.ts`
 * ile AYNI kuralı izlemek zorunda (`slugify(primaryName(...))`), yoksa adresteki slug
 * marka sayfasının slug'ıyla ayrışır. `lib/brands.ts` doğrudan import EDİLMİYOR: o
 * dosya `data/`den import attribute'suz JSON çekiyor ve bu modülü Node ile doğrudan
 * çalıştıran script'leri (import-catalog) kırardı.
 */
const NAME_BY_BRAND_SLUG = new Map<string, string>(
  (BRAND_NAMES as string[]).map((n) => [slugify(primaryName(n)), n]),
);
const BRAND_SLUG_BY_NAME = new Map<string, string>(
  (BRAND_NAMES as string[]).map((n) => [n, slugify(primaryName(n))]),
);

/** Adresten gelen marka jetonunu görünen ada çözer (slug ya da eski tam ad). */
function brandFromToken(tok: string): string | null {
  const byName = BRAND_SLUG_BY_NAME.has(tok) ? tok : null;
  if (byName) return byName; // eski link: tam ad
  return NAME_BY_BRAND_SLUG.get(slugify(primaryName(tok))) ?? null;
}

/** Adresten gelen kategori jetonunu çözer (slug ya da eski tam ad). */
function catFromToken(tok: string | null): NavCat | null {
  if (!tok) return null;
  if ((CATS as readonly string[]).includes(tok)) return tok as NavCat;
  return CAT_SLUGS.get(slugify(tok)) ?? null;
}

/**
 * Kategorinin adreste görünen hâli. Vitrin dışındaki sayfalar (marka sayfası) da
 * gerçek `<a href>` üretiyor ve aynı sözlüğü kullanmak zorunda — iki yerde iki farklı
 * kodlama, tıklanınca filtresi tutmayan bir link demek.
 */
export function catSlug(cat: string): string {
  return SLUG_BY_CAT.get(cat) ?? slugify(cat);
}

/** Adresten gelen fiyat jetonunu bant anahtarına çözer (slug ya da eski `0..3`). */
function priceFromToken(tok: string | null): string {
  if (!tok) return "ALL";
  const hit = PRICES.find((p) => p.slug === tok || p.k === tok);
  return hit?.k ?? "ALL";
}

/** Bir çoklu-seçim listesinde değeri açıp kapatır. */
export function toggleIn<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

export interface QueryResult {
  items: Product[];
  total: number; // filtre öncesi toplam ürün (tüm katalog)
  matched: number; // filtreye uyan toplam
  shownCount: number; // bu sayfadaki adet
  page: number;
  pageCount: number;
  activeLabel: string;
  /** Bu sonucu üreten keşfet tohumu — istemci bunu alıp oturum boyunca geri gönderir. */
  seed: string;
}

/** URLSearchParams → QueryParams. /api/products, sunucu tarafı ilk yükleme (page.tsx)
 * ve istemci tarafı (store.ts: URL senkronizasyonu, popstate) hepsi bunu paylaşır —
 * tek doğruluk kaynağı, aksi halde üçü de birbirinden bağımsız kayabilirdi. */
export function parseQuery(sp: URLSearchParams): QueryParams {
  /** Yeni anahtarı oku, yoksa eski anahtara düş (eski linkler kırılmasın). */
  const get = (yeni: string, eski: string) => sp.get(yeni) ?? sp.get(eski);

  const rawSort = get("sirala", "sort") ?? "";
  const sort = (SORT_KEYS.has(rawSort) ? rawSort : "kesfet") as SortKey;
  const rawDir = get("yon", "dir");
  return {
    cat: catFromToken(get("kategori", "cat")) ?? DEFAULT_QUERY.cat,
    q: get("ara", "q") ?? "",
    // Adreste slug var, sorgu motoru görünen adla çalışıyor: çözülemeyen jeton
    // (kaldırılmış marka, elle yazılmış hata) sessizce düşer — yoksa hiçbir ürünle
    // eşleşmeyen bir filtre "SONUÇ YOK" gösterir ve sebebi görünmez olur.
    brands: parseList(get("marka", "brand"))
      .map(brandFromToken)
      .filter((n): n is string => n !== null),
    genders: parseList(get("cinsiyet", "gender")).filter(
      (g): g is GenderKey => g === "kadin" || g === "erkek",
    ),
    styles: parseList(sp.get("tarz")).filter(isStyleKey),
    price: priceFromToken(get("fiyat", "price")),
    // Eski linkler tek beden taşıyordu (`size=M`, ayrıca "ALL" = filtre yok):
    // parseList ikisini de doğru okur, "ALL" elenir. Beden JETONLARI slug'lanmıyor:
    // katalogda "135/54", "39,5", "4'LU SET" gibi jetonlar var ve slug bunları geri
    // çevrilemez hâle getiriyor. Çoğu ("M", "2XL", "42") adreste zaten temiz duruyor.
    sizes: parseList(get("beden", "size"))
      .map((s) => s.toUpperCase())
      .filter((s) => s !== "ALL"),
    colors: parseList(sp.get("renk")).filter(isColorTag),
    sort,
    dir: rawDir === "desc" || rawDir === "azalan" ? "desc" : "asc",
    // varsayılan stoktakiler; "stok=tumu" (eskiden "tukenmis=1") tükenmişleri de katar
    inStockOnly: sp.get("stok") !== "tumu" && sp.get("tukenmis") !== "1",
    page: Number(get("sayfa", "page") ?? "1") || 1,
    seed: sp.get("seed") ?? "",
  };
}

/**
 * QueryParams -> URLSearchParams metni. parseQuery'nin tersi; store ve fetch bunu paylaşır.
 * `withSeed`: adres çubuğuna yazarken false (tohum kullanıcıya gösterilecek bir şey değil),
 * /api/products'a giderken true — sunucunun oturumun tohumuyla aynı akışı üretmesi için.
 */
export function stringifyQuery(query: QueryParams, withSeed = false): string {
  const p = new URLSearchParams();
  // Sıra bilinçli: kullanıcının en geniş seçiminden en dar ayrıntısına doğru okunsun
  // (kategori → arama → marka → daraltmalar → sıralama → sayfa).
  if (query.cat !== DEFAULT_QUERY.cat) p.set("kategori", SLUG_BY_CAT.get(query.cat) ?? query.cat);
  if (query.q) p.set("ara", query.q);
  if (query.brands.length) {
    p.set(
      "marka",
      query.brands.map((n) => BRAND_SLUG_BY_NAME.get(n) ?? slugify(primaryName(n))).join(MULTI_SEP),
    );
  }
  if (query.genders.length) p.set("cinsiyet", query.genders.join(MULTI_SEP));
  if (query.styles.length) p.set("tarz", query.styles.join(MULTI_SEP));
  if (query.price !== "ALL") {
    p.set("fiyat", PRICES.find((x) => x.k === query.price)?.slug ?? query.price);
  }
  if (query.sizes.length) p.set("beden", query.sizes.join(MULTI_SEP));
  if (query.colors.length) p.set("renk", query.colors.join(MULTI_SEP));
  if (query.sort !== "kesfet") {
    p.set("sirala", query.sort);
    // Artan varsayılan yön: yalnız azalanı yaz, `sirala=fiyat` tek başına "artan" demek.
    if (query.dir === "desc") p.set("yon", "azalan");
  }
  // yalnız KAPALIYKEN yaz: varsayılan (stoktakiler) link/URL temiz kalsın
  if (!query.inStockOnly) p.set("stok", "tumu");
  // `sayfa=1` yazılmaz: her adreste duran ve hiçbir şey söylemeyen bir parçaydı.
  if (query.page > 1) p.set("sayfa", String(query.page));
  if (withSeed && query.seed) p.set("seed", query.seed);
  // URLSearchParams boşluğu `+` yapar; adres çubuğunda `%20` daha okunur duruyor
  // (tek etkilenen alan arama metni — "siyah kargo" gibi).
  return p.toString().replace(/\+/g, "%20");
}

/**
 * Ürün seçili kategoriye uyuyor mu.
 *
 * `feedScope`: görünüm kategorilerinde (TÜM ÜRÜNLER / MARKALAR) aksesuar ailesi
 * DIŞARIDA bırakılır — altr bir giyim vitrini ve ilk ekran anahtarlık/kolye/telefon
 * kılıfı vitrinine dönmemeli (katalogda 4.906 takı + 4.164 aksesuar + 2.558 çanta var,
 * bkz. types.ts FEED_EXCLUDED_CATS).
 *
 * ARAMADA kapsam açılır: "kolye" yazan kullanıcı kolyeyi bulmalı. Aksesuarlar sol
 * menüden kendi kategorilerinden de erişilebilir olmaya devam eder — bu bir silme
 * değil, yalnız ana akışın kapsamı.
 */
function catMatch(p: Product, cat: NavCat, feedScope: boolean): boolean {
  // İki görünüm de katalogun tamamını kapsar; aralarındaki fark SIRALAMADA
  // (bkz. discovery.ts: "markalar" modu marka turu yapar). Kategoriler ise düz eşleşme.
  if (cat === "TÜM ÜRÜNLER" || cat === "MARKALAR") return !feedScope || catInFeed(p.category);
  return p.category === cat;
}

/** Sıralama nötrken hangi keşfet akışı çalışacak. */
function feedMode(cat: NavCat): FeedMode {
  if (cat === "MARKALAR") return "markalar";
  if (cat === "TÜM ÜRÜNLER") return "kesfet";
  return "kategori";
}

/**
 * Açık sıralama karşılaştırıcıları.
 *
 * Ortak kural: EKSİK VERİ HER ZAMAN SONA gider — yönden bağımsız. Azalan fiyata
 * basıldığında fiyatsız 8 bin ürünün başa dolması sıralamayı işe yaramaz hâle
 * getiriyordu (eski kod nulls'a 1e9 verip artan sırada sona atıyor, azalanda başa
 * alıyordu). Eşitlik durumunda id ile kırılır: aynı fiyattaki ürünler her istekte
 * aynı sırada gelsin, sayfa 2'de tekrar/atlama olmasın.
 */
function compareBy(sort: SortKey, dir: SortDir): (a: Product, b: Product) => number {
  const mul = dir === "desc" ? -1 : 1;
  if (sort === "fiyat") {
    return (a, b) => {
      const an = a.price == null;
      const bn = b.price == null;
      if (an || bn) return an && bn ? cmpId(a, b) : an ? 1 : -1;
      const d = (a.price as number) - (b.price as number);
      return d !== 0 ? d * mul : cmpId(a, b);
    };
  }
  if (sort === "marka") {
    return (a, b) => {
      const d = a.brand.localeCompare(b.brand, "tr");
      if (d !== 0) return d * mul;
      const n = a.name.localeCompare(b.name, "tr");
      return n !== 0 ? n : cmpId(a, b);
    };
  }
  // "yeni": `day` = kaç gün önce, yani ARTAN day = önce yeni. Adaptörlerin bir kısmı
  // sabit 20 yazdığı için bu sıralama gerçek bir tarih sıralaması değil, "elimizdeki
  // tarih bilgisine göre" bir sıralamadır (bkz. types.ts VIEW_CATS notu).
  return (a, b) => {
    const d = a.day - b.day;
    return d !== 0 ? d * mul : cmpId(a, b);
  };
}

function cmpId(a: Product, b: Product): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/* ------------------------------------------------------- sıralama önbelleği -- */

/**
 * SIRALANMIŞ DİZİ ÖNBELLEĞİ — vitrinin en pahalı işini istek başına ödemeyi bırakır.
 *
 * Ölçüm (73.214 ürünlük katalog, 56.445 stokta): filtresiz ana sayfa isteği 118 ms
 * sürüyordu ve bunun 109 ms'i dokumaydı. Dokuma SIRALAMAYI kuruyor, yani aynı tohum ve
 * aynı filtre için sonucu her seferinde yeniden üretmenin hiçbir karşılığı yok:
 * kullanıcı sayfa 2'ye geçtiğinde 56 bin ürün baştan dokunuyordu.
 *
 * Ne saklanıyor: yalnız `Product` REFERANSLARINDAN oluşan bir dizi (ürün gövdeleri
 * katalog memo'sunda zaten duruyor, kopyalanmıyor). 56 bin elemanlı bir dizi ~450 KB
 * işaretçi; sekiz girdiyle üst sınır ~4 MB. Bellek açısından ucuz, çünkü asıl yük
 * ürünlerin kendisi ve o tek kopya.
 *
 * Anahtar SAYFAYI İÇERMEZ: sayfalama aynı diziden dilim alır. Tohum anahtarın parçası
 * olduğu için "KEŞFETİ YENİLE" doğal olarak yeni bir girdi üretir; eski girdiler LRU
 * ile düşer.
 */
const ORDER_CACHE_MAX = 8;
const orderCache = new Map<string, Product[]>();

/** Katalog değiştiğinde (import/HMR) saklanan diziler eskir — hepsi atılır. */
export function clearOrderCache(): void {
  orderCache.clear();
}

function cachedOrder(params: QueryParams, seed: string, build: () => Product[]): Product[] {
  // Sıralamayı VE filtreyi belirleyen her şey anahtarda; `page` bilerek dışarıda.
  const key = `${seed} ${stringifyQuery({ ...params, page: 1, seed: "" })}`;
  const hit = orderCache.get(key);
  if (hit) {
    // LRU tazeleme: en son kullanılan sona gitsin.
    orderCache.delete(key);
    orderCache.set(key, hit);
    return hit;
  }
  const built = build();
  orderCache.set(key, built);
  if (orderCache.size > ORDER_CACHE_MAX) {
    // Map ekleme sırasını korur; ilk anahtar en eski kullanılan.
    const oldest = orderCache.keys().next().value;
    if (oldest !== undefined) orderCache.delete(oldest);
  }
  return built;
}

/** Sunucu tarafının `runQuery`ye verebileceği ek yetenekler. */
export interface QueryOptions {
  /**
   * Bu görsel URL'i kaynağında ölü mü? Yalnız sunucuda anlamlı
   * (bkz. lib/img-cache.ts). Verilmezse görsel sıralaması uygulanmaz.
   */
  isDeadImage?: (url: string) => boolean;
}

export function runQuery(all: Product[], params: QueryParams, opts?: QueryOptions): QueryResult {
  const pr = PRICES.find((p) => p.k === params.price) ?? PRICES[0];
  // Arama artık ham `includes` değil: TR katlama + jetonlama + eşanlamlı
  // (bkz. lib/search-index.ts). null = sorgu yok.
  const q = parseSearch(params.q);

  // Çoklu seçimlerde üyelik testi Set üzerinden: 20 bin ürün × seçili marka sayısı kadar
  // dizi taraması yapmayalım.
  const brandSet = params.brands.length ? new Set(params.brands) : null;
  const genderSet = params.genders.length ? new Set<string>(params.genders) : null;
  // Tarz artık ÜRÜNÜN kendi alanı (bkz. src/lib/product-styles.ts); marka üzerinden
  // çözülmüyor. Eskiden markanın tarzı tüm katalogunu etiketliyordu ve desenli ürünler
  // "basic" filtresinde çıkıyordu.
  const styleSet = params.styles.length ? new Set<string>(params.styles) : null;
  const sizeSet = params.sizes.length ? new Set<string>(params.sizes) : null;
  // Aksesuar ailesi ana akışta yok — ama ARAMA yapılıyorsa kapsam açılır (bkz. catMatch).
  const feedScope = !q;

  let full = all.filter((p) => {
    if (q && !matches(p, q)) return false;
    if (brandSet && !brandSet.has(p.brand)) return false;
    if (styleSet && !(p.styles ?? []).some((t) => styleSet.has(t))) return false;
    // Ürün cinsiyet ETİKETLERİ taşır; unisex olan ikisini birden taşıdığı için
    // her iki seçimde de listelenir. Kesişim boş değilse ürün uyar.
    if (genderSet && !p.genders.some((g) => genderSet.has(g))) return false;
    if (params.price !== "ALL") {
      // Renge göre fiyatı değişen üründe ARALIK kesişimine bakılır: 1099-2599 ₺ arası bir
      // ürün hem "1000-1500" hem "2000+" kutusunda çıkar. Tek fiyata bakmak, kartta yazan
      // fiyatla filtrenin çelişmesine yol açıyordu.
      const lo = p.priceMin ?? p.price;
      const hi = p.priceMax ?? p.price;
      if (lo == null || hi == null) return false;
      if (!(lo < pr.hi && hi >= pr.lo)) return false;
    }
    // Beden ÇOKLU ve "veya": M seçen kullanıcı L de seçtiyse ikisinden birini üreten
    // her ürünü görmeli. Jetonlar import'ta kanonikleştiği için burada normalize
    // edilmiyor; filtre kutuları zaten katalogun kendi jetonlarından türüyor.
    if (sizeSet && !p.sizes.some((s) => sizeSet.has(s))) return false;
    // Renk "VE": iki renk seçildiyse ikisini birden taşıyan ürünler (bkz. QueryParams).
    // Etiketi olmayan ürün renk filtresi açıkken hiç görünmez — uydurma bir aileye
    // atmaktansa listelememek doğru.
    if (params.colors.length && !params.colors.every((c) => p.colorTags?.includes(c))) return false;
    if (params.inStockOnly && !p.inStock) return false;
    return catMatch(p, params.cat, feedScope);
  });

  const matched = full.length;
  const pageCount = Math.max(1, Math.ceil(matched / PAGE_SIZE));
  const page = Math.min(Math.max(1, params.page), pageCount);
  // İstemci tohum göndermediyse (ilk boyama, doğrudan link) sunucu içinde bulunduğumuz
  // tohum penceresini kullanır; sonucun içinde geri döner, istemci onu benimser.
  const seed = params.seed || currentSeed();

  // TÜKENMİŞ HER ZAMAN SONDA.
  //
  // Stok filtresi kapalıyken (TÜMÜ) tükenmiş 15 bin ürün akışın içine serpiliyordu:
  // kullanıcı ilk sayfada alamayacağı ürünlerle karşılaşıyordu. Vitrin önce ALINABİLİR
  // olanı gösterir; tükenmişler listenin en sonunda, kendi aralarında aynı kuralla
  // dizilir. Bu iki blok AYRI sıralanır, yani kural sıralamadan bağımsızdır — fiyata
  // göre azalan sıralasan bile tükenmiş ürün stoktakinin önüne geçmez.
  // Stok filtresi açıkken zaten hiç tükenmiş yok, ayrım bedavaya geliyor.
  const live = params.inStockOnly ? full : full.filter((p) => p.inStock);
  const dead = params.inStockOnly ? [] : full.filter((p) => !p.inStock);

  /**
   * GÖRSELİ ÖLÜ ÜRÜN EN SONA.
   *
   * Katalogda görseli olmayan ürün yok (ölçüldü: 0/73.214); kullanıcının gördüğü boş
   * kartlar, URL'i kaynakta ölmüş ürünler. Bunu içe aktarma anında bilmek mümkün değil,
   * ama görsel proxy'si bir kez denendiğinde öğreniyor ve hatırlıyor
   * (bkz. img-cache.ts negatif önbellek).
   *
   * Ürün ancak TÜM görselleri ölü biliniyorsa sona atılır — bir fotoğrafı düşmüş ama
   * dördü duran ürün gayet iyi görünüyor (kart zaten sıradakine geçiyor,
   * bkz. ProductImage `fallbacks`).
   *
   * Bilgi ZAMANLA birikir: hiç istenmemiş bir görsel "sağlam" sayılır. Bu kabul
   * edilebilir, çünkü sıralamanın düzeltmesi gereken yer tam da kullanıcının GÖRDÜĞÜ
   * yer — görülmemiş ürünün boş kartı da henüz kimseyi rahatsız etmemiştir.
   *
   * `isDeadImage` DIŞARIDAN VERİLİR, import edilmez: kaynağı `lib/img-cache.ts` ve o
   * modül `node:fs`/`node:crypto` kullanıyor. `query.ts` ise hem istemci paketine
   * giriyor (store.ts `stringifyQuery`/`DEFAULT_QUERY` için import ediyor) hem de
   * Node script'leri tarafından doğrudan çalıştırılıyor. Doğrudan import tarayıcı
   * derlemesini kırardı; bu yüzden sunucu tarafı (api/products, page.tsx) yeteneği
   * enjekte ediyor, veren yoksa kural sessizce devre dışı kalır.
   */
  const isDead = opts?.isDeadImage;
  const imageless = (p: Product): boolean => {
    if (!isDead) return false;
    const urls = p.images.length ? p.images : p.image ? [p.image] : [];
    if (!urls.length) return true;
    return urls.every((u) => isDead(u));
  };

  // Sıralanmış diziyi ÖNBELLEKTEN al; yoksa kur ve sakla. Anahtar sayfayı İÇERMEZ:
  // sayfa 2 aynı diziyi yeniden kullanır (bkz. orderCache).
  const ordered = cachedOrder(params, seed, () => {
    if (params.sort === "kesfet" && q) {
      // ARAMA VARKEN sıralama keşfet dokuması DEĞİL alakadır. Dokuma "sürpriz" için
      // kurulmuş bir düzen (marka yorgunluğu, ton dönüşümü); kullanıcı bir şey ARADIYSA
      // sürpriz istemiyor. Eşitlikte baseScore kırıcı: aynı alakada daha eksiksiz kart öne.
      //
      // Skor ürün başına BİR KEZ hesaplanır (süsle-sırala-soy). Eskiden `rank()`
      // doğrudan karşılaştırıcının içindeydi ve her karşılaştırmada `relevance()`
      // yeniden çalışıyordu — `relevance` da her çağrıda `searchFold(name/brand)`
      // yapıyor (NFKD normalize + harf haritası). 20 bin sonuçta bu ~280 bin katlama
      // demekti: ÖLÇÜLDÜ, tek arama 2.678 ms sürüyordu.
      const rank = new Map<string, number>();
      for (const p of live) rank.set(p.id, relevance(p, q) * 100 + baseScore(p) * 10);
      for (const p of dead) rank.set(p.id, relevance(p, q) * 100 + baseScore(p) * 10);
      const cmp = (a: Product, b: Product) => {
        const d = (rank.get(b.id) as number) - (rank.get(a.id) as number);
        return d !== 0 ? d : cmpId(a, b);
      };
      live.sort(cmp);
      dead.sort(cmp);
      return live.concat(dead);
    }
    if (params.sort === "kesfet") {
      // Dokuma SABİT sınırla kurulur (buildFeed varsayılanı = WEAVE_LIMIT).
      //
      // Eskiden sınır istenen sayfadan türüyordu (`page * 40 + 200`). Bu, devir
      // notundaki "WEAVE_LIMIT sabit olmalı" kuralını sessizce çiğniyordu: sayfa 13'e
      // tıklayarak gitmek (sınır 720) ile doğrudan sayfa 50'ye gitmek (sınır 2200)
      // aynı indekste FARKLI ürün veriyordu, çünkü dokunan bölgenin uzunluğu değişince
      // ondan sonraki serpme de kayıyor. Kullanıcı tarafında bu "ürünler tekrar ediyor /
      // kayboluyor" olarak görünür.
      //
      // Sabit sınırın maliyeti (56 bin üründe ~132 ms) artık İSTEK BAŞINA değil,
      // (tohum + filtre) başına bir kez ödeniyor.
      const mode = feedMode(params.cat);
      const head = buildFeed(live, mode, seed);
      const tail = dead.length ? buildFeed(dead, mode, seed) : dead;
      return head.concat(tail);
    }
    const cmp = compareBy(params.sort, params.dir);
    live.sort(cmp);
    dead.sort(cmp);
    return live.concat(dead);
  });

  // Görseli ölü olanlar sona — sıralama KURULDUKTAN sonra, kararlı bir bölme ile.
  // Önbelleğe girmeden önce uygulanmıyor çünkü ölü listesi zamanla değişiyor; burada
  // her istekte yeniden bölmek 40 elemanlık bir dilim için ihmal edilebilir bir maliyet.
  const withImg: Product[] = [];
  const withoutImg: Product[] = [];
  for (const p of ordered) (imageless(p) ? withoutImg : withImg).push(p);
  const finalOrder = withoutImg.length ? withImg.concat(withoutImg) : ordered;

  const items = finalOrder.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeLabel = params.brands.length
    ? params.brands.length === 1
      ? params.brands[0]
      : `${params.brands.length} MARKA`
    : params.q
      ? `“${params.q}”`
      : params.styles.length
        ? params.styles.map(styleLabel).join(" + ")
        : params.cat;

  return { items, total: all.length, matched, shownCount: items.length, page, pageCount, activeLabel, seed };
}

/** ISO 4217 kodu -> sembol. Listede olmayan kod, kodun kendisiyle gösterilir. */
const CURRENCY_SYMBOLS: Record<string, string> = {
  TRY: "₺", USD: "$", EUR: "€", GBP: "£", CHF: "CHF", SEK: "kr", NOK: "kr",
  DKK: "kr", PLN: "zł", RUB: "₽", AED: "AED", SAR: "SAR", JPY: "¥", CNY: "¥",
  CAD: "CA$", AUD: "A$", AZN: "₼", BGN: "лв", RON: "lei", UAH: "₴",
};

export function normalizeCurrency(code: string | null | undefined): string {
  const c = String(code ?? "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : "TRY";
}

/**
 * Fiyatı KAYNAĞIN KENDİ para biriminde yazar — yurt dışına satan bir markanın
 * dolarlık fiyatı TL sembolüyle gösterilmemeli.
 *
 * Not: para birimi kataloğa küçük harfle de düşebiliyor ("try"); normalize edilmeden
 * karşılaştırma yapıldığında sembol bulunamıyor ve fiyat çıplak sayı olarak çıkıyordu.
 */
export function formatPrice(n: number | null, currency = "TRY", locale = "tr-TR"): string {
  if (n == null) return "—";
  const code = normalizeCurrency(currency);
  // Binlik ayracı DİLE bağlı: aynı panelde "2,681 pieces" ile "₺5.905" yan yana
  // durunca biri yanlış görünüyordu. Varsayılan tr-TR — sunucudan (metadata) çağıran
  // yerler dili bilmiyor ve Türkçe biçim onların doğru varsayılanı.
  const amount = Math.round(n).toLocaleString(locale);
  const sym = CURRENCY_SYMBOLS[code];
  if (!sym) return `${amount} ${code}`;
  // Harf temelli semboller (CHF, AED…) sayıdan sonra ve boşlukla daha okunur durur.
  return /^[A-Za-z]/.test(sym) ? `${amount} ${sym}` : `${sym}${amount}`;
}
