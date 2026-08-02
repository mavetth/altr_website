/**
 * BEDEN — kanonik sözlük, normalizasyon ve önizleme kuralları.
 *
 * Tek kopya: scraper adaptörleri (.mjs), import-catalog ve arayüz aynı fonksiyonları
 * çağırır. Eskiden her yerde ayrı bir `isSize` regex'i vardı ve üçü de farklı şey
 * kabul ediyordu; sonuç, katalogun yarısının bedensiz kalmasıydı.
 *
 * ÖLÇÜLEN KAYIP (2026-07-28, .data/full taraması, 117 bin ham kayıt):
 *   - "Medium" / "Large" / "X Large" / "Xxlarge" gibi YAZIYLA yazılmış bedenler
 *     tamamen eleniyordu (overdrive-rock, dantelions, fleak, wes-wear, god-heals).
 *   - "SM", "S-M", "S/M", "L-XL", "35-38", "30-32" gibi ARALIKLAR eleniyordu
 *     (punk-design 5422 kaydın 437'si, hype-of-steps 125 kaydın 0'ı bedenliydi).
 *   - "TEK BOYUT" / "OneSize" / "Standart" / "TekEbat" eleniyordu.
 *   - "XL (M-L BEDENE TEKABUL EDER)" gibi parantezli notlar eleniyordu.
 * Bu dosya bunların hepsini tek bir kanonik jetona indiriyor.
 *
 * KANONİK BİÇİM: merdiven jetonları "2XL/3XL" yazımıyla tutulur ("XXL" DEĞİL) —
 * katalogda iki yazım birden vardı (XXL 21.523 kayıt, 2XL 4.508) ve aynı bedenin iki
 * ayrı filtre kutusu olarak görünmesine yol açıyordu.
 */

/** Kanonik alfabetik beden merdiveni — küçükten büyüğe. Sıralamanın tek kaynağı. */
export const SIZE_LADDER = [
  "4XS", "3XS", "2XS", "XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL", "6XL",
] as const;

export type LadderSize = (typeof SIZE_LADDER)[number];

/** Bedeni olmayan ama "tek beden" diye satılan ürünlerin kanonik jetonu. */
export const ONE_SIZE = "TEK BEDEN";

/**
 * Kartta en fazla kaç baloncuk çizilir.
 *
 * Katalogdaki beden frekansı (2026-07-28 ölçümü, kaç üründe geçiyor):
 *   S 36.917 · M 36.817 · L 36.371 · XL 33.245 · 2XL 15.393 · XS 9.155 · 3XL 3.365 ·
 *   2XS 1.964 · TEK BEDEN 1.571
 * Beş slot tipik bir ürünün beden aralığını tam karşılıyor; taşan uçlar "+n" oluyor.
 *
 * NOT: burada bir `CORE_SIZES` sabiti vardı (S·M·L·XL·2XL) ve kart bu beşini HER ÜRÜNDE
 * çizip olmayanları sönük bırakıyordu. Kaldırıldı — sönük baloncuk "bu beden tükendi"
 * diye okunuyordu, oysa veri "tükendi" ile "hiç üretilmedi"yi ayırmıyor.
 */
export const PREVIEW_SLOTS = 5;

/* --------------------------------------------------------- normalizasyon --- */

/** Türkçe harfleri düz karşılıklarına indirir — anahtar kelime eşleştirmesi için. */
function fold(s: string): string {
  return s
    .replace(/[ıİi]/g, "I")
    .replace(/[şŞ]/g, "S")
    .replace(/[ğĞ]/g, "G")
    .replace(/[üÜ]/g, "U")
    .replace(/[öÖ]/g, "O")
    .replace(/[çÇ]/g, "C")
    .toUpperCase();
}

/** Yazıyla yazılmış bedenler ve yazım varyantları -> merdiven jetonu. */
const WORD_SIZES: Record<string, LadderSize> = {
  "XSMALL": "XS", "X SMALL": "XS", "X-SMALL": "XS", "EXTRA SMALL": "XS",
  "SMALL": "S", "SM ALL": "S",
  "MEDIUM": "M", "MED": "M",
  "LARGE": "L",
  "XLARGE": "XL", "X LARGE": "XL", "X-LARGE": "XL", "EXTRA LARGE": "XL",
  "XXSMALL": "2XS", "XX SMALL": "2XS", "XX-SMALL": "2XS",
  "XXLARGE": "2XL", "XX LARGE": "2XL", "XX-LARGE": "2XL",
  "XXXLARGE": "3XL", "XXX LARGE": "3XL",
};

/** "TEK BEDEN" anlamına gelen yazımlar. */
const ONE_SIZE_WORDS = new Set([
  "TEK BEDEN", "TEKBEDEN", "TEK BOYUT", "TEKBOYUT", "TEK EBAT", "TEKEBAT",
  "TEK OLCU", "STANDART", "STANDARD", "STD", "ONE SIZE", "ONESIZE", "OS",
  "FREE SIZE", "FREESIZE", "UNIVERSAL", "UNI", "TEK", "TEK NUMARA",
]);

/** Değerin başında takılan, bedenle ilgisi olmayan sözcükler ("BEDEN: M"). */
const NOISE_HEAD = /^(BEDEN|BEDENI|BEDENLER|BOYUT|OLCU|OLCUSU|SIZE|NUMARA|NO|NR)\s*[:.-]?\s*/;
/** Sonda takılanlar ("STANDART BEDEN", "42 NUMARA"). */
const NOISE_TAIL = /\s*(BEDEN|BEDENI|BOYUT|OLCU|OLCUSU|SIZE|NUMARA)\s*$/;

/** Bir merdiven jetonuysa kanonik hâlini ver ("XXL" -> "2XL", "Xl" -> "XL"). */
function ladderToken(t: string): LadderSize | null {
  const s = t.replace(/[\s._-]/g, "");
  // XXL / XXXL / XXXXL biçimi -> 2XL / 3XL / 4XL
  const m = /^(X{1,6})(S|L)$/.exec(s);
  if (m) {
    const n = m[1].length;
    const base = m[2] === "S" ? "XS" : "XL";
    if (n === 1) return base as LadderSize;
    const tok = `${n}${m[2] === "S" ? "XS" : "XL"}`;
    return (SIZE_LADDER as readonly string[]).includes(tok) ? (tok as LadderSize) : null;
  }
  // 2XL / 3XS biçimi
  const n = /^([2-6])X(S|L)$/.exec(s);
  if (n) {
    const tok = `${n[1]}X${n[2]}`;
    return (SIZE_LADDER as readonly string[]).includes(tok) ? (tok as LadderSize) : null;
  }
  if (s === "S" || s === "M" || s === "L") return s as LadderSize;
  return null;
}

/**
 * Sayısal beden makul aralıkta mı.
 * Alt uç 1 (çocuk/yüzük), üst uç 130 — kemer/şapka santim ölçüleri de bu ölçekte
 * satılıyor ("105", "120"). 130'un üstü ürün kodu/fiyat olma ihtimali yüksek.
 */
/**
 * SAYISAL BEDENİN ALT SINIRI. 16'dan küçük sayı bu katalogda ASLA beden değildir.
 *
 * Neden: kaynak sitelerin bir kısmında ADET SEÇİCİ (1,2,3…10) beden seçeneği gibi
 * işaretlenmiş ve olduğu gibi kataloga giriyor. Ölçüldü (2026-07-30, tam katalog):
 * **66.026 sahte jeton, 6.882 üründe** — takıların %58'i, aksesuarların %35'i,
 * cüzdanların %77'si "1..10 beden" taşıyordu. Bir kolyenin "7 beden"i yok.
 *
 * Sınırın 16 olmasının dayanağı ölçekler: jean beli 24'ten, kadın konfeksiyonu 34'ten,
 * ayakkabı numarası 35'ten başlıyor. 16 ile 24 arasında da gerçek beden yok, ama sınır
 * bilerek düşük tutuldu — kural "adet seçiciyi ayıkla" olsun, "beden aralığını daralt"
 * olmasın. Çocuk YAŞ bedenleri bu kuraldan etkilenmez, onlar "9-10 YAŞ" gibi ayrı
 * jetonlar (bkz. `ageSize`).
 */
const MIN_NUMERIC_SIZE = 16;

function numericSize(t: string): string | null {
  if (!/^\d{1,3}$/.test(t)) return null;
  const n = Number(t);
  return n >= MIN_NUMERIC_SIZE && n <= 130 ? String(n) : null;
}

/**
 * DENİM bel/boy bedeni: "W30 L32", "W30L32", "W 30 L 32" -> "W30/L32".
 *
 * Jean satan markaların büyük kısmı bedeni böyle yazıyor (Zeph Culture'ın 233 ürününün
 * neredeyse tamamı). Kural yokken bu değerler "tanınmayan jeton" olarak korunuyor ama
 * `looksLikeSizeValues` onları beden saymadığı için ürünün beden seçeneği hiç
 * bulunamıyordu — yani beden listesi TAMAMEN kayboluyordu.
 */
function waistLengthSize(up: string): string | null {
  const m = /^W\s*(\d{2})\s*[\/xX-]?\s*L\s*(\d{2})$/.exec(up.replace(/\s+/g, " ").trim());
  return m ? `W${m[1]}/L${m[2]}` : null;
}

/** "9-10 YAŞ" / "5-6 Yas" -> "9-10 YAŞ" */
function ageSize(up: string): string | null {
  const m = /^(\d{1,2})\s*[-–/]\s*(\d{1,2})\s*(YAS|YAŞ|YASH|Y)$/.exec(up.replace(/\s+/g, " "));
  if (m) return `${m[1]}-${m[2]} YAŞ`;
  const s = /^(\d{1,2})\s*(YAS|YAŞ|Y)$/.exec(up);
  return s ? `${s[1]} YAŞ` : null;
}

/** Merdivende iki jeton arasını doldurur: "S-M" -> [S, M], "S-XL" -> [S, M, L, XL]. */
function ladderSpan(a: LadderSize, b: LadderSize): string[] {
  const i = SIZE_LADDER.indexOf(a);
  const j = SIZE_LADDER.indexOf(b);
  const [lo, hi] = i <= j ? [i, j] : [j, i];
  // 4 adımdan uzun "aralık" gerçek bir aralık değil, muhtemelen ayrıştırma hatası
  if (hi - lo > 4) return [SIZE_LADDER[lo], SIZE_LADDER[hi]];
  return SIZE_LADDER.slice(lo, hi + 1) as unknown as string[];
}

const MAX_SPAN = 8;

/**
 * Ham beden metnini KANONİK jetonlara çevirir.
 *
 * Bir metin birden çok jeton üretebilir: "S-M" iki bedene birden uyar, "28 (XXS)"
 * hem bel ölçüsü hem harf karşılığı taşır. Filtre bu yüzden dizi bekler — S arayan
 * kişi "S-M" satılan ürünü bulmalı.
 *
 * Tanınmayan ama makul uzunluktaki metinler OLDUĞU GİBİ korunur (büyük harfe
 * çevrilerek): markanın yazdığı gerçek beden bilgisini atmaktansa göstermek yeğdir.
 * Tanınmayan jetonlar önizlemeye çıkmaz, modalda ve filtrede görünür.
 */
export function normalizeSize(raw: unknown): string[] {
  if (raw == null) return [];
  let s = String(raw).replace(/ /g, " ").trim();
  if (!s || s.length > 48) return [];

  const out: string[] = [];
  const push = (t: string | null | undefined) => {
    if (t && !out.includes(t)) out.push(t);
  };

  // Parantezli ek: "28 (XXS)" -> hem 28 hem 2XS; "XL (M-L BEDENE TEKABUL EDER)" -> yalnız XL
  const paren = /^([^()]+)\(([^()]{1,24})\)\s*$/.exec(s);
  let note: string | null = null;
  if (paren) {
    s = paren[1].trim();
    note = paren[2].trim();
  }

  const up0 = fold(s).replace(/\s+/g, " ").trim();
  // "ONE SIZE" gibi ifadelerde "SIZE" gürültü DEĞİL, ifadenin parçası — bu yüzden
  // tek beden sözlüğüne gürültü ayıklamasından ÖNCE bakılır.
  if (ONE_SIZE_WORDS.has(up0)) return [ONE_SIZE];

  let up = up0.replace(NOISE_HEAD, "").replace(NOISE_TAIL, "").trim();
  if (!up) return [];
  // Ölçü birimi eki: "105CM" -> 105, "42 NO" zaten NOISE_TAIL'de düştü
  up = up.replace(/^(\d{1,3})\s*(CM|MM|NUMARA|BEDEN)$/, "$1");

  // "Default Title" gibi Shopify varsayılanları beden değildir
  if (/^(DEFAULT|DEFAULT TITLE|VARSAYILAN|TITLE|SECINIZ|SEÇINIZ|SELECT)$/.test(up)) return [];

  if (ONE_SIZE_WORDS.has(up)) {
    push(ONE_SIZE);
  } else if (ageSize(up)) {
    push(ageSize(up));
  } else if (waistLengthSize(up)) {
    push(waistLengthSize(up));
  } else if (WORD_SIZES[up]) {
    push(WORD_SIZES[up]);
  } else if (ladderToken(up)) {
    push(ladderToken(up));
  } else if (numericSize(up)) {
    push(numericSize(up));
  } else {
    // Ayraçlı biçimler: "S-M", "S/M", "35-38", "30/32", "SM"
    const parts = up.split(/\s*[-–—/|]\s*/).filter(Boolean);
    if (parts.length === 2) {
      const [a, b] = parts;
      const la = ladderToken(a) ?? WORD_SIZES[a];
      const lb = ladderToken(b) ?? WORD_SIZES[b];
      const na = numericSize(a);
      const nb = numericSize(b);
      if (la && lb) {
        for (const t of ladderSpan(la, lb)) push(t);
      } else if (na && nb) {
        // "30/32" = bel/boy (jean), "35-38" = numara aralığı. Ayraç ikisini ayırır:
        // "/" ise İLK sayı beldir, "-" ise gerçek bir aralıktır.
        if (/\//.test(up)) {
          push(na);
        } else {
          const lo = Math.min(+na, +nb);
          const hi = Math.max(+na, +nb);
          if (hi - lo <= MAX_SPAN) for (let n = lo; n <= hi; n++) push(String(n));
          else { push(String(lo)); push(String(hi)); }
        }
      } else if (la) push(la);
      else if (lb) push(lb);
    } else if (parts.length === 1) {
      // "SM" gibi ayraçsız ikili ("SMALL" değil — o WORD_SIZES'ta yakalandı)
      const pair = /^(XS|S|M|L|XL)(XS|S|M|L|XL)$/.exec(up);
      if (pair) {
        const la = ladderToken(pair[1]);
        const lb = ladderToken(pair[2]);
        if (la && lb) for (const t of ladderSpan(la, lb)) push(t);
      }
    }
  }

  // Parantez içi ("28 (XXS)") tanınırsa ikinci jeton olarak eklenir; not ise atılır.
  if (note) {
    const f = fold(note).replace(/\s+/g, " ").trim();
    const t = ONE_SIZE_WORDS.has(f) ? ONE_SIZE : (WORD_SIZES[f] ?? ladderToken(f) ?? numericSize(f));
    push(t);
  }

  // Hiçbir kurala uymadı: markanın yazdığını olduğu gibi koru (kısa ise).
  //
  // ÇIPLAK SAYI HARİÇ. `numericSize` alt sınırın (MIN_NUMERIC_SIZE) altındaki sayıya
  // null döndürüyor; buraya düşmesine izin verilseydi "7" jetonu "tanınmayan ama
  // korunan" yoldan yine kataloga girer ve ayıklama hiçbir işe yaramazdı.
  if (!out.length && /^\d{1,3}$/.test(up)) return out;
  if (!out.length && up.length <= 12 && /[A-Z0-9]/.test(up)) push(up);
  return out;
}

/** Bir liste ham bedeni kanonik, tekilleştirilmiş, sıralı listeye çevirir. */
export function normalizeSizes(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
  const out: string[] = [];
  for (const r of list) for (const t of normalizeSize(r)) if (!out.includes(t)) out.push(t);
  return sortSizes(out);
}

/**
 * `normalizeSizes`in KATI hâli: yalnız tanınan bedenler kalır.
 *
 * Bir listenin beden listesi olduğundan emin olmadığımız yerlerde (HTML'den seçici
 * taraması, "seçenek adı yok, ilk seçeneği deneyelim" yolu) bu kullanılır — yoksa
 * "Siyah"/"Lacivert" gibi renk adları beden diye kataloga girer.
 */
export function knownSizes(raw: unknown): string[] {
  return normalizeSizes(raw).filter(isKnownSize);
}

/* ------------------------------------------------------------ sınıflama --- */

export type SizeKind = "alpha" | "num" | "wl" | "age" | "one" | "other";

export function sizeKind(t: string): SizeKind {
  if ((SIZE_LADDER as readonly string[]).includes(t)) return "alpha";
  if (/^\d{1,3}$/.test(t)) return "num";
  if (/^W\d{2}\/L\d{2}$/.test(t)) return "wl";
  if (/YAŞ$/.test(t)) return "age";
  if (t === ONE_SIZE) return "one";
  return "other";
}

/** Beden olarak TANINDI mı — "other" jetonlar korunur ama tanınmış sayılmaz. */
export function isKnownSize(t: string): boolean {
  return sizeKind(t) !== "other";
}

/**
 * YAŞ bedeni mi ("9-10 YAŞ")?
 *
 * Yaş jetonları vitrine ÇIKMAZ — katalog yalnız yetişkin giyimi listeliyor (bkz.
 * `src/lib/kids.ts`). Ama jetonun kendisi scraper'dan import'a kadar KORUNUR, çünkü
 * çocuk ürününü ayıklamanın en kesin sinyali odur. `import-catalog` önce bu sinyalle
 * ürünü arşive ayırır, hayatta kalan üründe kalmış yaş jetonlarını sonra siler.
 */
export function isAgeSize(t: string): boolean {
  return sizeKind(t) === "age";
}

/** Yaş jetonlarını listeden çıkarır — katalogda yalnız yetişkin bedenleri kalsın. */
export function dropAgeSizes(list: readonly string[]): string[] {
  return list.filter((t) => !isAgeSize(t));
}

/* ------------------------------------------------------- numara bantları -- */

/**
 * SAYISAL BEDEN ARALIKLARI.
 *
 * Katalogda 1–130 arası her sayı ayrı bir jeton olabiliyor; filtre bunları tek tek
 * çizince NUMARA bölümü 30+ kutuya çıkıp okunmaz hâle geliyordu. Kullanıcı da zaten
 * "38" değil "orta beden pantolon" arıyor.
 *
 * Bantlar ÖLÇEK KARIŞIMINI gizlemez, sadece azaltır: 30 hem jean beli hem kadın
 * konfeksiyon bedeni olabiliyor ve bu belirsizlik kaynak veride var, burada
 * çözülemez. Bant tıklanınca sorguya bandın kapsadığı GERÇEK jetonlar yazılır —
 * yani `runQuery` tarafında hiçbir şey değişmiyor, tam eşleşme korunuyor.
 */
export const NUM_BANDS: ReadonlyArray<{ k: string; label: string; lo: number; hi: number }> = [
  { k: "n24", label: "≤24", lo: 1, hi: 24 },
  { k: "n30", label: "26–30", lo: 25, hi: 30 },
  { k: "n36", label: "32–36", lo: 31, hi: 36 },
  { k: "n42", label: "38–42", lo: 37, hi: 42 },
  { k: "n48", label: "44–48", lo: 43, hi: 48 },
  { k: "n50", label: "50+", lo: 49, hi: 130 },
];

/**
 * Jetonun düştüğü bandın anahtarı. Sayısal bedende sayının kendisine, bel/boy
 * bedeninde BEL ölçüsüne bakar ("W30/L32" → 30). Diğerlerinde null.
 */
export function bandOf(token: string): string | null {
  const kind = sizeKind(token);
  let n: number | null = null;
  if (kind === "num") n = Number(token);
  else if (kind === "wl") n = Number(token.slice(1, 3));
  if (n == null || !Number.isFinite(n)) return null;
  return NUM_BANDS.find((b) => n! >= b.lo && n! <= b.hi)?.k ?? null;
}

const KIND_RANK: Record<SizeKind, number> = { alpha: 0, num: 1, wl: 2, age: 3, one: 4, other: 5 };

/** Merdiven sırası, sonra sayısal artan, bel/boy, yaş, tek beden, bilinmeyen. */
export function sortSizes(list: string[]): string[] {
  return [...list].sort((a, b) => {
    const ka = sizeKind(a);
    const kb = sizeKind(b);
    if (ka !== kb) return KIND_RANK[ka] - KIND_RANK[kb];
    if (ka === "alpha") return SIZE_LADDER.indexOf(a as LadderSize) - SIZE_LADDER.indexOf(b as LadderSize);
    if (ka === "num") return Number(a) - Number(b);
    return a.localeCompare(b, "tr");
  });
}

/**
 * Bir seçenek listesi BEDEN listesi mi?
 *
 * Ad'a bakmak yetmiyor: markaların bir kısmı beden seçeneğini renk adıyla
 * ("Beyaz" = [S,M,L,XL] — x-puppet-wear), ürün koduyla ("HRM-BRD-TRACKSUIT") veya
 * "Boyut"/"Ölçü" gibi SIZE_HINT'in kaçırdığı adlarla açıyor. Değerlere bakınca
 * bu adların hepsi tek kuralla çözülüyor.
 */
export function looksLikeSizeValues(values: unknown[]): boolean {
  const vals = values.map((v) => String(v ?? "").trim()).filter(Boolean);
  if (!vals.length) return false;
  let known = 0;
  for (const v of vals) if (normalizeSize(v).some(isKnownSize)) known++;
  return known / vals.length >= 0.6;
}

/** Seçenek ADI beden çağrıştırıyor mu (değer testine ek ipucu). */
export const SIZE_NAME_HINT = /beden|boyut|ölçü|olcu|size|numara|\bus\b|\beu\b|\buk\b/i;

/* ---------------------------------------------------------- önizleme ------ */

/**
 * Baloncuğa sığacak kısa etiket. Kart üzerindeki daire 27px; "9-10 YAŞ" ya da
 * "TEK BEDEN" oraya sığmıyor, ürün modalı ve filtre uzun hâli gösteriyor.
 */
export function shortSizeLabel(t: string): string {
  if (t === ONE_SIZE) return "TEK";
  const age = /^(\d{1,2}(?:-\d{1,2})?)\s*YAŞ$/.exec(t);
  if (age) return age[1];
  // "W30/L32" baloncuğa sığmaz; bel/boy çifti "30/32" olarak okunur.
  const wl = /^W(\d{2})\/L(\d{2})$/.exec(t);
  if (wl) return `${wl[1]}/${wl[2]}`;
  return t;
}

export interface SizePreview {
  /** Çizilecek baloncuklar — HEPSİ üründe gerçekten var. */
  slots: string[];
  /** Önizlemeye sığmayan beden adedi. */
  extra: number;
  /** Sığmayan bedenlerin kendisi — "+n" rozetinin ipucu metninde adları geçsin. */
  hidden: string[];
}

/** Önizlemenin başladığı merdiven basamağı — bundan küçükleri "+n"e düşer. */
export const PREVIEW_START = "XS";

/**
 * Kartta gösterilecek baloncuklar — YALNIZ ÜRETİLEN BEDENLER.
 *
 * Eskiden çekirdek beş beden (S·M·L·XL·2XL) her kartta çizilir, üründe olmayanlar sönük
 * bırakılırdı. Bu YANLIŞ bilgi veriyordu: sönük baloncuk "bu beden tükendi" diye okunuyor
 * ama veri "tükendi" ile "hiç üretilmedi"yi ayırt etmiyor — bir üründe S bedeninin
 * olmaması çoğu zaman o bedenin hiç üretilmemesidir. Artık ürünün kendi bedenleri neyse
 * o çizilir, sönük durum yoktur.
 *
 * Pencere XS'ten başlar: 2XS/3XS/4XS gibi uçlar ve beşinci slottan sonrası "+n"e toplanır.
 * Modal hepsini gösterir, filtre hepsini sunar.
 *
 * Örnek: [XS,S,M,L,XL,2XL] -> XS·S·M·L·XL  +1
 *        [2XS,S,M]         -> S·M          +1
 *        [30,31,32,33,34]  -> 30·31·32·33·34
 */
export function previewSizes(sizes: string[]): SizePreview {
  const have = sortSizes([...new Set(sizes.filter(Boolean))]);
  if (!have.length) return { slots: [], extra: 0, hidden: [] };

  const startIdx = SIZE_LADDER.indexOf(PREVIEW_START as LadderSize);
  const belowStart = (t: string) => {
    const i = SIZE_LADDER.indexOf(t as LadderSize);
    return i >= 0 && i < startIdx;
  };

  const small = have.filter(belowStart);
  const pool = have.filter((t) => !belowStart(t));
  const slots = pool.slice(0, PREVIEW_SLOTS);
  const hidden = sortSizes([...small, ...pool.slice(PREVIEW_SLOTS)]);
  return { slots, extra: hidden.length, hidden };
}

/**
 * Kartta beden satırı çizilmeli mi?
 *
 * TEK BEDEN üretilen üründe beden yazmanın bilgi değeri yok — satır yalnız kartı
 * kalabalıklaştırıyor. Bedeni hiç bilinmeyen üründe de gösterilecek bir şey yok.
 */
export function hasSizeInfo(sizes: readonly string[]): boolean {
  if (sizes.length > 1) return true;
  return sizes.length === 1 && sizes[0] !== ONE_SIZE;
}
