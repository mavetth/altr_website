// altr'ın otoriter statik katalogunu (ProductGroup[]) bu projenin Product[] modeline
// dönüştürür ve .data/catalog.json'a yazar.
//
// Kullanım:
//   node scripts/import-catalog.mjs [kaynak-catalog.json]
// Varsayılan kaynak: ../_archive/altr/.data/catalog.json (altr 2026-07-23'te arşivlendi).
// Yeniden scrape gerekiyorsa arşivdeki altr'da `npm run scrape:full` çalıştır, sonra buradan bu scripti.
//
// İki iş yapar:
//
// 1) RENK VARYANTLARINI KORUR. Eskiden her ProductGroup düz bir Product'a indirgeniyor,
//    varyantların görselleri tek bir `images` havuzunda eriyordu; kartta gösterilen renk
//    noktaları da bu yüzden hiçbir şeye bağlı değildi (tıklanınca bir şey olmuyordu).
//    Artık her varyant `variants[]` içinde kendi görsel indeksleri, bedenleri, fiyatı ve
//    ürün linkiyle duruyor — arayüz renge basınca o rengin fotoğrafını gösterebiliyor.
//
// 2) RENGE GÖRE BÖLÜNMÜŞ ÜRÜNLERİ BİRLEŞTİRİR. Bazı markalar aynı ürünü her renk için
//    ayrı ürün sayfası olarak yayınlıyor ("PİLİLİ PANTOLON - GRİ", "… - HAKİ"). Bunlar
//    vitrinde yan yana neredeyse aynı üç kart olarak görünüyordu. Adından renk sözcüğü
//    atıldığında aynı ada inen, aynı markaya ait gruplar tek ürüne katlanıyor.

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
// Sınıflandırma/etiketleme SİTEYLE AYNI koddan gelir — script kendi kopyasını taşırsa
// katalogdaki kategori ile arayüzün beklediği kategori sessizce ayrışıyor.
// (Node 24 .ts dosyalarını doğrudan çalıştırır: tipler çalışma anında soyulur.)
import { categorize, isNonWearable, looksLikeSneaker, trLower } from "../src/lib/categorize.ts";
import { detectGenders } from "../src/lib/gender.ts";
import { normalizeCurrency } from "../src/lib/query.ts";
import { displayPrice, priceRange } from "../src/lib/variant.ts";
// Bedenler BURADA da normalize edilir, yalnız scraper'da değil: ham dosyalar aylar
// önce çekilmiş olabiliyor ve sözlük değiştiğinde 3 saatlik bir scrape beklemeden
// katalogu düzeltebilmek gerekiyor ("XXL" ile "2XL" ayrı filtre kutusuydu).
import { normalizeSizes, dropAgeSizes } from "../src/lib/sizes.ts";
import { isKidsProduct } from "../src/lib/kids.ts";
import { productStyles } from "../src/lib/product-styles.ts";
import { ARCHIVE_CATS, catHasSizes } from "../src/lib/types.ts";
// Arşivli marka ARTIK ÜRÜN DÜZEYİNDE de eleniyor. Eskiden yalnız `src/lib/brands.ts`
// markayı BRANDS dizisinden çıkarıyordu; bu, marka hiç ürün vermediği sürece yetiyordu.
// selsil (silikon/yapıştırıcı üreticisi) 131 ürünle gelince delik görüldü: marka
// listelerde yoktu ama ürünleri ızgarada duruyordu.
// (brands.ts uzantısız import kullandığı için Node'dan çözülmüyor; kaynak JSON aynı.)
import ARCHIVED_JSON from "../data/brands-archived.json" with { type: "json" };
const ARCHIVED_BRANDS = Object.fromEntries(
  Object.entries(ARCHIVED_JSON).filter(([k]) => !k.startsWith("_")),
);
import { buildGroups } from "./scrape/group.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

// Renk etiketleri AYRI bir dosyada duruyor ve import onu yalnız OKUR: üretimi ~30 bin
// görsel indirmek demek (bkz. scripts/tag-colors.mjs), her import'ta tekrarlanamaz.
// Dosya yoksa katalog etiketsiz üretilir ve renk filtresi hiçbir şey göstermez —
// sessiz bir yanlış değil, görünür bir eksik.
const COLOR_TAGS = JSON.parse(
  await readFile(join(projectRoot, "data", "color-tags.json"), "utf8").catch(() => "{}"),
);

// Kaynak seçimi:
//   (varsayılan) .data/full/*.json  -> fork'un kendi scraper'ının çıktısı
//   <dosya yolu>                    -> tek bir ProductGroup[] dosyası (ör. arşivdeki altr)
// Bayraklar konum argümanı sayılmasın (`--force` bir dosya yolu değil).
const argSrc = process.argv.slice(2).find((a) => !a.startsWith("--"));
const FULL_DIR = join(projectRoot, ".data", "full");
const dest = join(projectRoot, ".data", "catalog.json");
// Vitrin dışı bırakılan ürünler (ayakkabı + çocuk). Silinmiyorlar: kural gevşetilip
// yeniden import edilirse geri gelirler.
const archiveDest = join(projectRoot, ".data", "catalog.archived.json");

const MAX_VARIANTS = 12;
const MAX_IMGS_PER_VARIANT = 5;
const MAX_IMAGES = 20;

function uniq(arr) {
  return [...new Set(arr.filter(Boolean))];
}

/**
 * Markanın kendi CDN'inde ürünün ana görsel slotu boş kaldığında servis edilen
 * jenerik "resim yok" görselleri. Bunlar GERÇEK görsel gibi yüklenir (bizim metin
 * fallback'imize düşmezler), o yüzden kart/modal onları ürün fotoğrafı sanıp gösterir —
 * ör. Ticimax'in `resim-hazirlaniyor/tr.jpg`'i. Katalogdaki tek fiilî kalıp bu (hepsi
 * Ticimax); diğerleri ileriye dönük savunma. Görseller kaynak sırasıyla geldiği için bu
 * placeholder çoğu üründe İLK sıraya (primary) düşüyordu; eleyince arkadaki gerçek foto
 * primary olur. Sadece placeholder taşıyan ürün görselsiz kalır ve zaten elenir.
 */
const PLACEHOLDER_IMG =
  /resim-hazirlaniyor|coming-soon|no[-_]?image|noimage|placeholder|urun-yok|default-product/i;

/**
 * Ürün FOTOĞRAFI olmayan görseller. Ticimax `/varyasyonresim/` = renk seçicideki DÜZ RENK
 * SWATCH'ı (kapkara/düz bir kare, ~1KB), ürün fotoğrafı değil. Kaynak sırasında ilk sıraya
 * düşüp primary oluyor, gerçek fotoğraflar arkaya kalıyordu. Rengi zaten variant.hex
 * (renk noktası) taşıyor, swatch'a görsel olarak gerek yok — eleyince gerçek foto primary olur.
 */
const NON_PHOTO_IMG = /\/varyasyonresim\//i;

/** Ürün fotoğrafı olmayan URL'leri (placeholder + renk swatch'ı) ayıklar. Sırayı korur. */
function stripPlaceholders(urls) {
  return urls.filter((u) => !PLACEHOLDER_IMG.test(u) && !NON_PHOTO_IMG.test(u));
}

// Ad içinde geçen renk sözcükleri — mükerrer kart birleştirmesi bunlara göre yapılır.
// Liste kaynak katalogdaki varyant renk adlarının frekans sıralamasından çıkarıldı.
const COLOR_WORDS = [
  "siyah", "black", "beyaz", "white", "ekru", "ecru", "krem", "cream", "gri", "gray", "grey",
  "melanj", "antrasit", "lacivert", "navy", "mavi", "mavisi", "blue", "yeşil", "yesil", "green",
  "haki", "khaki", "kırmızı", "kirmizi", "red", "bordo", "burgundy", "kahverengi", "kahve",
  "brown", "coffee", "taba", "camel", "bej", "beige", "sarı", "sari", "yellow", "turuncu",
  "orange", "portakal", "mor", "purple", "pembe", "pink", "lila", "lilac", "leylak",
  "turkuaz", "petrol", "vizon", "somon", "salmon", "metalik", "gümüş", "gumus", "silver",
  "altın", "altin", "gold", "füme", "fume", "kiremit", "mercan", "indigo", "mint", "nane",
  "hardal", "vişne", "visne", "mürdüm", "murdum", "fuşya", "fusya", "çelik", "celik",
  "saks", "stone", "camo", "renkli",
];
const COLOR_MODS = ["açık", "acik", "koyu", "light", "dark", "neon", "pastel", "antik", "buz", "soft"];
// Değiştirici (açık/koyu/…) yalnızca hemen ardından bir renk geliyorsa atılır: "AÇIK MAVİ"
// tamamen silinsin ama "AÇIK YAKA GÖMLEK"teki "açık" yerinde kalsın.
const COLOR_RE = new RegExp(
  `(?:^|[^a-zçğıöşü0-9])((?:${COLOR_MODS.join("|")})\\s+)?(${COLOR_WORDS.join("|")})(?=[^a-zçğıöşü0-9]|$)`,
  "gi",
);

/**
 * Addan renk ifadelerini çıkarır. Eşleştirme Türkçe'ye duyarlı küçük harfli kopya üzerinde
 * yapılır (JS'in `i` bayrağı "GRİ" ile "gri"yi eşleştirmez), ama kesme ORİJİNAL metinden
 * yapılır — trLower karakter sayısını değiştirmediği için indeksler birebir örtüşür.
 */
function stripColors(name) {
  const low = trLower(name);
  let out = "";
  let last = 0;
  for (const m of low.matchAll(COLOR_RE)) {
    const phrase = (m[1] ?? "") + m[2];
    const start = m.index + (m[0].length - phrase.length);
    out += name.slice(last, start) + " ";
    last = start + phrase.length;
  }
  return out + name.slice(last);
}

/** Ad -> renk sözcükleri atılmış, boşlukları/ayraçları sadeleştirilmiş anahtar. */
function colorlessKey(name) {
  return trLower(stripColors(name))
    .replace(/[^a-zçğıöşü0-9]+/g, " ")
    .trim();
}

/** Addaki ilk renk sözcüğü (varyant adı boşsa renk etiketi olarak kullanılır). */
function colorInName(name) {
  const m = trLower(name).match(new RegExp(COLOR_RE.source, "i"));
  return m ? m[2] : null;
}

/** Görünen ad: renk sözcüklerini ve arta kalan ayraçları temizler. */
function cleanName(name) {
  const out = stripColors(name)
    .replace(/\s*[-–—/|]\s*$/g, "")
    .replace(/^\s*[-–—/|]\s*/g, "")
    .replace(/\s*([-–—/|])\s*\1*/g, " $1 ")
    .replace(/\s*[-–—/|]\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return out.length >= 3 ? out : name.trim();
}

/**
 * Bir ProductGroup'un varyantlarını, ortak görsel havuzuna indeksleyen bir listeye çevirir.
 * `images` dizisi çağrı boyunca büyütülür (aynı görsel iki varyantta geçiyorsa tek kopya).
 */
function pushVariants(g, images, imgIndex, into) {
  const variants = Array.isArray(g.variants) ? g.variants : [];
  // g.colorLabel: ad-eki birleştirmesinden gelen renk etiketi ("Mürdüm", "Nefti Yeşili"),
  // sözlükte olmadığı için colorInName'in bulamayacağı marka-uydurması renk adları.
  const fallbackColor = g.colorLabel || colorInName(g.name || "");

  for (const v of variants) {
    if (into.length >= MAX_VARIANTS) break;
    const vImgs = stripPlaceholders(uniq([v.image, ...(v.images || [])])).slice(0, MAX_IMGS_PER_VARIANT);
    const idxs = [];
    for (const u of vImgs) {
      let i = imgIndex.get(u);
      if (i === undefined) {
        if (images.length >= MAX_IMAGES) continue;
        i = images.length;
        images.push(u);
        imgIndex.set(u, i);
      }
      idxs.push(i);
    }
    if (!idxs.length) continue;

    const color = (v.color && v.color !== "-" ? String(v.color) : fallbackColor) || "";
    into.push({
      color: color.trim(),
      hex: v.hex || "#7d7d75",
      imgs: idxs,
      sizes: normalizeSizes(v.sizes),
      inStock: !!v.inStock,
      price: typeof v.price === "number" ? v.price : null,
      url: v.productUrl ?? null,
    });
  }
}

/** Aynı ürünün renge göre bölünmüş gruplarını tek Product'a katlar. */
function mergeGroups(groups) {
  const images = [];
  const imgIndex = new Map();
  const variants = [];
  for (const g of groups) pushVariants(g, images, imgIndex, variants);

  // Görünen ad: en kısa ad (genelde renksiz olan) temizlenerek kullanılır.
  const base = groups.reduce((a, b) => (b.name.length < a.name.length ? b : a));
  const name = groups.length > 1 ? cleanName(base.name) : base.name;

  // Kategori BURADA yeniden hesaplanır, kaynağın yazdığı kategori kullanılmaz: taksonomi
  // bu projeye ait ve değişiyor; yeniden scrape beklemeden yeniden sınıflandırabilmeliyiz.
  //
  // Yalnızca ÜRÜN ADINA bakılır. Kaynağın eski kategorisini ipucu olarak eklemek sonucu
  // bozuyor: eski kova adı "ÜST / FORMA" metninde "forma" geçtiği için o kovadaki her şey
  // FORMA'ya düşüyordu (1298 ürün), gömlekler 35'e iniyordu.
  //
  // TEK İSTİSNA: ad hiçbir kurala uymadıysa (DİĞER) kaynağın etiket metnine BİR KEZ
  // bakılır. Ölçüldü (140.555 ham kayıt): adı sınıflandırılamayan 4.784 kaydın 599'u
  // burada gerçek kategorisini buluyor — "Air Max 270" → sourceText "Sneaker",
  // "Born Free V2" → "Tshirt". Yukarıdaki bozulma bu sırada YAŞANMAZ, çünkü etikete
  // yalnız ad SUSTUĞUNDA bakılıyor; adı "Gömlek" olan ürün etikette ne yazarsa yazsın
  // gömlek kalır.
  //
  // Giyilemez koruması ÖNCE gelir: "The Swing / Fragonard Kanvas Tablo"nun etiketinde
  // "Jean-Honoré Fragonard" geçiyor ve tabloyu JEAN yapıyordu. Daha kötüsü, kupa/parfüm
  // gibi ürünler AKSESUAR'a terfi edip giyilemez filtresinden büsbütün kaçıyordu
  // (filtre yalnız DİĞER'e uygulanır).
  let category = categorize(name);
  if (category === "DİĞER" && !isNonWearable(name, category) && base.sourceText) {
    // 200 karakter: etiket çorbasının kuyruğu marka sloganı/kampanya metni oluyor.
    const hint = categorize(String(base.sourceText).slice(0, 200));
    if (hint !== "DİĞER") category = hint;
  }
  // SNEAKER MODEL ADLARI — en son bakılır, yalnız hâlâ sınıflandırılamamış üründe.
  // "Nike Air Force 1", "SB Dunk Low ‘Panda’", "Adidas Samba OG" gibi adlar jenerik
  // ayakkabı sözcüğü içermediği için DİĞER'e düşüyor, oradan da arşiv filtresinden
  // kaçıp vitrinde ayakkabı olarak görünüyordu (ölçüldü: 36 ürün, 8 marka).
  // En sonda olması ŞART: "Air Force Nakışlı Şapka" önce ŞAPKA olarak yakalanmalı.
  if (category === "DİĞER" && looksLikeSneaker(name)) category = "AYAKKABI";

  // VİTRİN FİYATI = kartta açılışta görünen varyantın fiyatı (bkz. src/lib/variant.ts).
  // Eskiden burada tüm renklerin MİNİMUMU alınıyordu; kart ise seçili varyantı yazdığı
  // için kartla filtre/sıralama çelişiyordu. Aralık ayrı alanlarda taşınıyor.
  const groupPrices = groups
    .map((g) => g.priceMin ?? (g.variants || []).find((v) => v.price != null)?.price)
    .filter((p) => typeof p === "number");
  const range = priceRange(variants);
  const price = displayPrice(variants, groupPrices.length ? Math.min(...groupPrices) : null);
  // Ürün düzeyindeki beden listesi varyantlardan da beslenir: renge göre bölünmüş
  // kartlar katlandığında `sizesAll` yalnız bir grubun bedenlerini taşıyabiliyor.
  const sizes = normalizeSizes([
    ...groups.flatMap((g) => (Array.isArray(g.sizesAll) ? g.sizesAll : [])),
    ...variants.flatMap((v) => v.sizes),
  ]);
  const colors = uniq(variants.map((v) => v.hex)).slice(0, 6);

  return {
    id: base.id,
    brand: base.brand,
    brandSlug: base.brandSlug,
    name,
    category,
    // Cinsiyet ada + kaynağın etiketlerine bakar: "Erkek Giyim"/"Kadın" etiketi ürün
    // adında geçmese de kaynakta duruyor ve tek başına ad bakınca katalogun %84'ü
    // unisex kalıyordu.
    // Üçüncü kademe olarak BEDEN aralığı da veriliyor: ad ve kategori susuyorsa
    // merdivenin uçları konuşuyor (ölçüm: %86 isabet, bkz. npm run check-gender).
    genders: detectGenders(`${name} ${base.sourceText ?? ""}`, category, sizes),
    // Tarz: markanın tarzı ÖNSEL, ürün adı düzeltir. Kaynağın etiket metni de okunur —
    // "desenli" bilgisi çoğu zaman adda değil etikette duruyor.
    styles: productStyles(`${name} ${base.sourceText ?? ""}`, category, base.brandSlug),
    price,
    priceMin: range.min,
    priceMax: range.max,
    // Kaynak bazen küçük harf ("try") veriyor; normalize edilmezse arayüz sembolü bulamıyor.
    currency: normalizeCurrency(base.currency),
    image: images[variants[0]?.imgs[0] ?? 0] ?? null,
    images,
    sizes,
    colors,
    colorTags: COLOR_TAGS[base.id]?.tags ?? [],
    variants,
    productUrl:
      variants.find((v) => v.url)?.url ??
      groups.map((g) => (g.variants || []).find((v) => v.productUrl)?.productUrl).find(Boolean) ??
      null,
    inStock: variants.some((v) => v.inStock),
    pop: Math.max(...groups.map((g) => g.pop ?? 0)),
    day: Math.min(...groups.map((g) => g.day ?? 0)),
    source: base.source === "seed" ? "seed" : "live",
  };
}

// Ad ekinin renk DEĞİL, başka bir ürün olduğunu gösteren sözcükler. Bunlardan biri geçen
// ekler birleştirilmez ("Basic Tişört" ile "Basic Tişört Uzun Kol" ayrı ürünlerdir).
const NOT_A_COLOR = new Set([
  "uzun", "kısa", "kisa", "kol", "kollu", "yaka", "yakalı", "yakali", "fit", "oversize",
  "slim", "regular", "relaxed", "crop", "croplu", "baskılı", "baskili", "nakışlı", "nakisli",
  "kapüşonlu", "kapusonlu", "kapşonlu", "fermuarlı", "fermuarli", "cepli", "desenli",
  "işlemeli", "islemeli", "düğmeli", "dugmeli", "bol", "dar", "paça", "paca", "paçalı",
  "seti", "set", "takım", "takim", "takımı", "çocuk", "cocuk", "kadın", "kadin", "erkek",
  "unisex", "beden", "büyük", "buyuk", "mini", "midi", "maxi", "kalın", "kalin", "ince",
  "astarlı", "astarli", "şardonlu", "sardonlu", "yıkamalı", "yikamali", "tişört", "tisort",
  "tshirt", "sweat", "hoodie", "gömlek", "gomlek", "pantolon", "şort", "sort", "ceket",
  "mont", "elbise", "etek", "atlet", "çanta", "canta", "şapka", "sapka", "çorap", "corap",
  "xs", "s", "m", "l", "xl", "xxl", "2xl", "3xl", "4xl", "no", "cm",
]);

function normName(s) {
  return trLower(s).replace(/[^a-zçğıöşü0-9]+/g, " ").trim();
}

/**
 * İKİNCİ GEÇİŞ: renk sözlüğünün yakalayamadığı, marka-uydurması renk adlarıyla bölünmüş
 * ürünleri birleştirir. Markalar "Basic Tişört", "Basic Tişört Mürdüm", "Basic Tişört
 * Duman" diye ayrı ürün sayfaları açıyor; "Mürdüm"/"Duman" hiçbir renk sözlüğünde yok.
 *
 * Yanlış birleştirmeye karşı üç koruma: (a) çıplak ad ürün olarak GERÇEKTEN var olmalı,
 * (b) ek en fazla 2 sözcük ve hiçbiri NOT_A_COLOR olmamalı, (c) aynı çıplak ada bağlanan
 * en az 2 farklı ek bulunmalı — tek ek, renk varyantından çok "farklı ürün" işaretidir.
 */
function linkColorSuffixes(entries) {
  const byBrand = new Map();
  for (const e of entries) {
    const arr = byBrand.get(e.brandSlug);
    if (arr) arr.push(e);
    else byBrand.set(e.brandSlug, [e]);
  }

  const links = []; // { child, base, label }
  for (const list of byBrand.values()) {
    const byName = new Map();
    for (const e of list) if (!byName.has(e.norm)) byName.set(e.norm, e);

    for (const e of list) {
      const words = e.norm.split(" ");
      for (let k = 1; k <= 2 && k < words.length; k++) {
        const tail = words.slice(words.length - k);
        if (tail.some((w) => NOT_A_COLOR.has(w) || /^\d+$/.test(w))) continue;
        const base = byName.get(words.slice(0, words.length - k).join(" "));
        if (!base || base === e || base.category !== e.category) continue;
        links.push({ child: e, base, label: tail.join(" ") });
        break; // en kısa ek kazanır
      }
    }
  }

  // zincirleme bağları kes: bir çocuk aynı anda başkasının tabanı olamaz
  const isChild = new Set(links.map((l) => l.child));
  const kept = links.filter((l) => !isChild.has(l.base));

  const children = new Map(); // base -> [link]
  for (const l of kept) {
    const arr = children.get(l.base);
    if (arr) arr.push(l);
    else children.set(l.base, [l]);
  }

  const absorbed = new Set();
  let folded = 0;
  for (const [base, ls] of children) {
    if (new Set(ls.map((l) => l.label)).size < 2) continue; // tek ek = riskli, dokunma
    for (const l of ls) {
      // ek, o kaydın varyantlarına renk etiketi olarak geçer (kaynakta adı boş olabilir)
      for (const g of l.child.groups) g.colorLabel = g.colorLabel || l.child.tailLabel(l.label);
      base.groups.push(...l.child.groups);
      absorbed.add(l.child);
      folded++;
    }
  }
  return { entries: entries.filter((e) => !absorbed.has(e)), folded };
}

/** Scraper çıktısını (marka başına VariantRecord[]) ProductGroup[]'a çevirir. */
async function groupsFromScrape() {
  const files = (await readdir(FULL_DIR)).filter((f) => f.endsWith(".json"));
  const out = [];
  for (const f of files) {
    let recs;
    try {
      recs = JSON.parse(await readFile(join(FULL_DIR, f), "utf8"));
    } catch {
      continue;
    }
    if (Array.isArray(recs) && recs.length) out.push(...buildGroups(recs));
  }
  return { groups: out, label: `${FULL_DIR} (${files.length} marka dosyası)` };
}

async function loadSource() {
  if (argSrc) {
    const p = resolve(argSrc);
    const groups = JSON.parse(await readFile(p, "utf8"));
    if (!Array.isArray(groups)) throw new Error("Kaynak bir dizi değil.");
    return { groups, label: p };
  }
  return groupsFromScrape();
}

async function main() {
  const { groups, label } = await loadSource();
  const src = label;

  // 1. geçiş: marka + renk sözcükleri atılmış ad -> aynı ürünün parçaları
  const buckets = new Map();
  for (const g of groups) {
    if (!g || !g.name) continue;
    const key = `${g.brandSlug}|${colorlessKey(g.name)}`;
    const arr = buckets.get(key);
    if (arr) arr.push(g);
    else buckets.set(key, [g]);
  }

  let mergedAway = 0;
  let entries = [];
  for (const arr of buckets.values()) {
    if (arr.length > 1) mergedAway += arr.length - 1;
    const base = arr.reduce((a, b) => (b.name.length < a.name.length ? b : a));
    const display = arr.length > 1 ? cleanName(base.name) : base.name;
    entries.push({
      brandSlug: base.brandSlug,
      category: base.category,
      norm: normName(display),
      groups: arr,
      // ek etiketini orijinal yazımıyla (büyük harfli) döndür — normName küçültüyor
      tailLabel: (label) => {
        const w = display.split(/\s+/);
        return w.slice(w.length - label.split(" ").length).join(" ");
      },
    });
  }

  // 2. geçiş: sözlük dışı renk adlarıyla bölünmüş ürünler
  const linked = linkColorSuffixes(entries);
  entries = linked.entries;
  mergedAway += linked.folded;

  const products = [];
  const archived = [];
  let dropped = 0;
  const archiveCats = new Set(ARCHIVE_CATS);
  for (const e of entries) {
    const p = mergeGroups(e.groups);
    if (!p.image) continue; // görselsizleri ele
    // Bazı markalar aynı vitrinde tablo/perde/halı/kupa da satıyor — burası giyim vitrini.
    if (isNonWearable(p.name, p.category)) {
      dropped++;
      continue;
    }

    // ARŞİV — kapsam dışı ürünler silinmez, ayrı dosyaya ayrılır. Eleme TEK NOKTADA
    // burada yapılır: böylece runQuery/discovery/kategori sayaçları/marka sayfaları
    // hiçbir filtre tekrarı taşımaz, katalogda o ürün hiç yoktur.
    const reason = ARCHIVED_BRANDS[p.brandSlug]
      ? "MARKA"
      : archiveCats.has(p.category)
        ? "AYAKKABI"
        : isKidsProduct(p.name, p.sizes, p.brand)
          ? "COCUK"
          : null;
    if (reason) {
      archived.push({ ...p, archiveReason: reason });
      continue;
    }

    // Hayatta kalan üründe YAŞ bedeni kalmamalı: çocuk kararı yukarıda verildi, buradan
    // sonrası yetişkin vitrini. Tek tük yaş jetonu taşıyan yetişkin ürünü (kaynağın
    // seçenek listesine karışmış) filtreyi ve baloncukları kirletmesin.
    p.sizes = dropAgeSizes(p.sizes);
    for (const v of p.variants) v.sizes = dropAgeSizes(v.sizes);

    // BEDENİ OLAMAYAN KATEGORİLER (takı, gözlük, saat, cüzdan, aksesuar): beden alanı
    // tamamen boşaltılır. Sayısal adet seçicileri `normalizeSizes` zaten ayıklıyor
    // (bkz. sizes.ts MIN_NUMERIC_SIZE); burası ikinci savunma hattı — o kategorilerde
    // alfabetik beden de anlamsız (bkz. types.ts SIZELESS_CATS).
    if (!catHasSizes(p.category)) {
      p.sizes = [];
      for (const v of p.variants) v.sizes = [];
    }

    products.push(p);
  }

  // EMNİYET: yarım kalmış bir scrape'in çıktısıyla dolu katalogu ezme. Scraper marka
  // marka yazdığı için, tarama sürerken import çalıştırılırsa katalog birkaç markaya
  // düşerdi. Kasıtlı küçültme için --force var.
  let prevCount = 0;
  try {
    prevCount = JSON.parse(await readFile(dest, "utf8")).length;
  } catch { /* ilk kez */ }
  const shrink = prevCount > 0 && products.length < prevCount * 0.6;
  if (shrink && !process.argv.includes("--force")) {
    console.error(
      `\nİPTAL: yeni katalog ${products.length} ürün, mevcut ${prevCount}. ` +
        `Bu %${Math.round(100 - (100 * products.length) / prevCount)} kayıp demek — ` +
        `muhtemelen scrape hâlâ sürüyor.\nGerçekten istiyorsan: npm run import-catalog -- --force`,
    );
    process.exit(2);
  }

  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, JSON.stringify(products), "utf8");
  await writeFile(archiveDest, JSON.stringify(archived), "utf8");

  const withPrice = products.filter((p) => p.price != null).length;
  const withSize = products.filter((p) => p.sizes.length).length;
  const inStock = products.filter((p) => p.inStock).length;
  const multiColor = products.filter((p) => p.variants.length > 1).length;
  const brands = new Set(products.map((p) => p.brandSlug)).size;
  const gcount = { kadin: 0, erkek: 0, unisex: 0 };
  for (const p of products) {
    if (p.genders.length >= 2) gcount.unisex++;
    else gcount[p.genders[0]]++;
  }
  const cats = {};
  for (const p of products) cats[p.category] = (cats[p.category] ?? 0) + 1;
  const curr = {};
  for (const p of products) curr[p.currency] = (curr[p.currency] ?? 0) + 1;

  console.log(`kaynak : ${src}`);
  console.log(`hedef  : ${dest}`);
  console.log(`grup   : ${groups.length}  ->  ürün: ${products.length} (görselli)`);
  console.log(`renge göre bölünmüş ${mergedAway} mükerrer kart tek ürüne katlandı`);
  console.log(`giyilemez (tablo/perde/halı/kupa vb.) elenen: ${dropped}`);
  const archCounts = {};
  for (const a of archived) archCounts[a.archiveReason] = (archCounts[a.archiveReason] ?? 0) + 1;
  console.log(`arşive ayrılan : ${archived.length}  ${JSON.stringify(archCounts)}  -> ${archiveDest}`);
  console.log(`marka  : ${brands}   çok renkli ürün: ${multiColor}`);
  console.log(`fiyatlı: ${withPrice}  bedenli: ${withSize}  stokta: ${inStock}`);
  console.log(`cinsiyet: kadin ${gcount.kadin} / erkek ${gcount.erkek} / unisex ${gcount.unisex}`);
  console.log(`para birimi: ${Object.entries(curr).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  console.log(`\nkategoriler (${Object.keys(cats).length}):`);
  for (const [k, v] of Object.entries(cats).sort((a, b) => b[1] - a[1]))
    console.log(`  ${k.padEnd(16)} ${String(v).padStart(6)}`);
}

main().catch((e) => {
  console.error("HATA:", e.message);
  process.exit(1);
});
