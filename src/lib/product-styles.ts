import type { ProductCat } from "./types";
import { brandStyles, isStyleKey, type StyleKey } from "./brand-styles.ts";

/**
 * ÜRÜN TARZI = marka önseli + ürün adından düzeltme.
 *
 * Neden ürüne taşındı: tarz yalnız markaya yazılıyken katalogun %86,6'sı "streetwear",
 * %55,6'sı "basic" oluyordu — filtre hiçbir şeyi ayırmıyordu. Daha kötüsü, DESENLİ bir
 * ürün "basic" görünüyordu; oysa basic'in tanımı sade/düz olmasıdır. Sektör pratiği de
 * tarzı ürün özniteliği sayar (görsel etiketleme servisleri ürün başına etiketler).
 *
 * Yöntem iki kademeli:
 *  1) ÖNSEL — markanın tarzları miras alınır (bkz. brand-styles.ts). Adı jenerik olan
 *     binlerce ürün tarzsız kalmasın diye şart.
 *  2) DÜZELTME — sıralı kural listesi ürün adına bakıp tarz EKLER ya da SİLER.
 *     En önemlisi: desen/baskı/grafik taşıyan üründen `basic` DÜŞER.
 *
 * Türkçe tuzakları `categorize.ts` ile aynı: JS'in `\b` sınırı ş/ç/ı/ğ'yi sözcük
 * karakteri saymaz, o yüzden özel sınır kullanılır; eşleştirme hem Türkçe hem düz
 * küçültülmüş metinde denenir ("DESENLİ" -> "desenli").
 *
 * Denetim: `npm run check-product-styles` (desenli+basic ihlali SIFIR olmalı).
 */

const L = "a-zçğıöşü0-9";
/** Sözcük sınırlı eşleşme (Türkçe harfler dahil). */
const w = (...alts: string[]) => new RegExp(`(?<![${L}])(?:${alts.join("|")})(?![${L}])`, "i");
/** Serbest (içerik) eşleşme — ek almış hâlleri de yakalasın diye. */
const c = (...alts: string[]) => new RegExp(`(?:${alts.join("|")})`, "i");

function trLower(s: string): string {
  return String(s).replace(/İ/g, "i").replace(/I/g, "ı").replace(/̇/g, "").toLowerCase();
}

function haystacks(s: string): string[] {
  const tr = trLower(s);
  const en = String(s).toLowerCase().replace(/̇/g, "");
  return tr === en ? [tr] : [tr, en];
}

const hit = (hays: string[], res: RegExp[]) => res.some((re) => hays.some((h) => re.test(h)));

/* ------------------------------------------------------------- sözlükler --- */

/**
 * DESEN / GRAFİK — üzerinde bir şey OLAN ürün. `basic` ile bağdaşmaz.
 * "baskı" serbest aranır (baskılı/baskısı/baskılıi), "print" sözcük sınırlı
 * ("sprint"/"footprint" tuzağı).
 */
const PATTERN = [
  c("desen", "baskı", "baski", "çiçekli", "cicekli", "kamuflaj", "kamuflajlı", "leopar",
    "zebra", "ekose", "çizgili", "cizgili", "puantiye", "batik", "kareli", "yıldızlı",
    "nakış", "nakis", "işleme", "grafik", "tie-dye", "tiedye", "tie dye", "kolaj",
    "logolu", "yazılı", "yazili", "sloganlı"),
  w("print", "printed", "graphic", "camo", "floral", "striped", "plaid", "checkered",
    "tartan", "paisley", "tribal", "embroidered", "embroidery", "patchwork", "slogan",
    "anime", "cartoon"),
];

/** SADE — düz renk, süssüz. `basic`in gerçek karşılığı. */
const PLAIN = [
  c("düz renk", "duz renk", "sade", "minimal", "monokrom"),
  w("plain", "solid", "blank", "basic", "temel", "essential", "essentials", "core"),
];

/** MİNİMALİST — sakin palet, temiz kesim, doğal kumaş. */
const MINIMAL = [
  c("minimalist", "minimal"),
  w("keten", "linen", "poplin", "oxford", "muslin", "monokrom", "clean", "essential"),
];

/** TEKNİK — işlevsel kumaş/donanım. */
const TECH = [
  c("kargo", "taktik", "teknik", "su geçirmez", "su gecirmez", "rüzgarlık", "ruzgarlik"),
  w("cargo", "tactical", "ripstop", "softshell", "waterproof", "windbreaker", "utility",
    "parachute", "gorpcore", "shell", "tech", "hardshell"),
];

/** RAVE — gece, kulüp, teşhir. */
const RAVE = [
  c("fileli", "transparan", "reflektif", "payet"),
  // "simli" SERBEST aranamaz: "MevSİMLİk Ceket" içinde eşleşiyordu (ölçüldü).
  // "file" da öyle — "filet"/"profile" tuzağı var.
  w("simli", "file", "mesh", "latex", "neon", "reflective", "glitter", "rave", "cyber",
    "holographic", "korse", "corset", "harness", "fishnet"),
];

/** SPOR — performans/aktif. */
const SPORT = [
  c("eşofman", "esofman", "antrenman", "performans", "koşu", "kosu"),
  w("dry-fit", "dryfit", "forma", "jersey", "futbol", "basketbol", "training", "gym",
    "athletic", "sport", "sports", "running"),
];

/** OLD MONEY — sakin lüks. */
const OLD_MONEY = [
  c("kaşmir", "kasmir", "kaşe", "triko"),
  w("polo", "blazer", "chino", "cashmere", "merino", "loafer", "knit", "cardigan"),
];

/**
 * Y2K — 2000'ler estetiği.
 *
 * Üç aile: KESİM (baggy, low-rise, crop, mini), YÜZEY (metalik, parlak, rhinestone,
 * taşlı, holografik) ve MOTİF (kelebek, yıldız, kalp, çiçek zinciri).
 *
 * "crop" ve "mini" TEK BAŞINA yetmez — 2020'lerin de kesimi. Bu yüzden aşağıdaki
 * `productStyles` kuralında bunlar YALNIZ başka bir y2k sinyaliyle birlikte sayılıyor;
 * burada güçlü ve zayıf jetonlar ayrı listelerde.
 */
const Y2K_STRONG = [
  c("y2k", "2000ler", "2000'ler", "rhinestone", "taşlı", "tasli", "kelebek", "holografik",
    "metalik", "parlak saten", "düşük bel", "dusuk bel", "dantelli kolye ucu"),
  w("baggy", "lowrise", "low-rise", "bedazzled", "butterfly", "cyber", "shimmer",
    "iridescent", "velour", "juicy", "tramp", "halter", "babytee", "trucker"),
];

/** Tek başına y2k saymayan, ama güçlü bir sinyalle birleşince sayan jetonlar. */
const Y2K_WEAK = [
  c("crop", "mini etek", "kısa etek", "kisa etek", "yıldız", "yildiz", "kalp"),
  w("cropped", "mini", "flare", "bootcut", "cargo", "denim"),
];

/* --------------------------------------------------------------- kurallar --- */

/**
 * Ürünün tarzları.
 *
 * @param name       ürün adı
 * @param category   ürün kategorisi (kategori tek başına da sinyal: EŞOFMAN ALTI -> spor)
 * @param brandSlug  marka slug'ı — önseli buradan alır
 */
/**
 * Marka önselinin TAŞIYABİLECEĞİ tarzlar — "sahne" tarzları.
 *
 * `techwear` ve `spor` bilerek dışarıda: bunlar ürünün İŞLEVİNİ anlatır, markanın
 * sahnesini değil. Önsel bunları da taşırken katalogda "Havlu Çorap = techwear",
 * "Örgü Kazak = spor" gibi saçmalıklar çıkıyordu (ölçüldü, örneklerle görüldü).
 * İşlevsel tarzlar ürünün KENDİSİNDEN kanıt ister: kargo cebi, ripstop kumaş,
 * eşofman kalıbı…
 */
const PRIOR_STYLES = new Set<StyleKey>([
  "streetwear",
  "basic",
  "ravewear",
  "old-money",
  "minimalist",
  // y2k bir SAHNE tarzı: markanın bütün kataloğu o estetikte olabilir (bkz. brand-styles.json).
  "y2k",
]);

export function productStyles(
  name: string,
  category?: ProductCat,
  brandSlug?: string,
): StyleKey[] {
  const hays = haystacks(name);
  const prior = brandSlug ? brandStyles(brandSlug).filter((s) => PRIOR_STYLES.has(s)) : [];
  const out = new Set<StyleKey>(prior);

  const patterned = hit(hays, PATTERN);

  // 1) DESENLİ ÜRÜN BASIC OLAMAZ — kullanıcının işaret ettiği asıl hata.
  //    Desen aynı zamanda grafik bir dil demek, o yüzden streetwear eklenir.
  if (patterned) {
    out.delete("basic");
    out.delete("minimalist");
    out.add("streetwear");
  }

  // 2) SADE ürün basic'tir. Desen varsa buraya hiç girilmez (yukarıda elendi).
  if (!patterned && hit(hays, PLAIN)) out.add("basic");

  // 3) MİNİMALİST — sade kesim/doğal kumaş. Yalnız desensiz üründe.
  if (!patterned && hit(hays, MINIMAL)) out.add("minimalist");

  // 4) İşlevsel/teknik parçalar.
  if (hit(hays, TECH)) out.add("techwear");

  // 5) Gece/kulüp. Kategori de sinyal: korse/body parçası adında "korse" geçmese de
  //    (ör. "Lace Up Front Detail") o sahnenin parçasıdır.
  if (hit(hays, RAVE) || category === "KORSE / BODY") out.add("ravewear");

  // 6) Spor — kategori de sinyal.
  if (hit(hays, SPORT) || category === "EŞOFMAN ALTI" || category === "FORMA" || category === "TAYT") {
    out.add("spor");
  }

  // 7) Sakin lüks. Kategori sinyali: triko/kazak ve hırka adında kumaş adı geçmese de
  //    (ör. "Erkek Boğazsız Bej Üst") bu tarafın parçasıdır. Desenli olan hariç.
  if (!patterned && (hit(hays, OLD_MONEY) || category === "TRİKO / KAZAK" || category === "HIRKA")) {
    out.add("old-money");
  }

  // 8) Y2K. Güçlü jeton tek başına yeter; zayıf jetonlar ("crop", "mini", "cargo")
  //    ancak İKİSİ BİRDEN geçerse sayılır — bunlar 2020'lerin de kesimi ve tek
  //    başlarına alınırsa katalogun yarısı y2k olur.
  const y2kStrong = hit(hays, Y2K_STRONG);
  const y2kWeakCount = Y2K_WEAK.filter((re) => hays.some((h) => re.test(h))).length;
  if (y2kStrong || y2kWeakCount >= 2) out.add("y2k");

  return [...out].filter(isStyleKey);
}
