#!/usr/bin/env node
/**
 * MARKA AVANTAJLARI — markanın kendi sitesinde duyurduğu alışveriş koşulları.
 *
 *   node scripts/fetch-brand-perks.mjs [--only slug1,slug2] [--dry]
 *   çıktı: data/brand-perks.json   { at, markalar: { slug: [{ tip, metin }] } }
 *
 * NEDEN: marka sayfası şimdiye kadar yalnız "kaç parça, hangi fiyat" diyordu. Bir
 * kullanıcının markaya gitmeden önce merak ettiği asıl şey ise kargonun bedava olup
 * olmadığı, taksit, iade süresi. Bu bilgi zaten her mağazanın duyuru şeridinde yazılı.
 *
 * TASARIM KARARI — METİN MARKANIN KENDİ CÜMLESİ. Eşiği (2000 TL) ayrıştırıp kendi
 * cümlemizi kurmuyoruz: kampanya koşulu markadan markaya değişiyor ("sadece kartla",
 * "İstanbul içi") ve bizim özetimiz yanlış bir taahhüt hâline gelir. Yalnız duyurunun
 * kendisi kısaltılıp taşınır, `tip` sadece ikon/sıra için.
 *
 * Ana sayfa duyuru şeridi + varsa kargo/iade sayfasının başlığı taranır. Bulunamayan
 * marka için dosyada satır olmaz; sayfa o bölümü hiç çizmez (uydurma avantaj YOK).
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getText, mapLimit } from "./scrape/fetch.mjs";
import { loadBrands } from "./scrape/brands.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "brand-perks.json");

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ONLY = (arg("--only", "") || "").split(",").filter(Boolean);
const DRY = argv.includes("--dry");

/**
 * HTML -> görünen metin.
 *
 * Blok etiketleri ve bağlantılar "|" ayracına çevrilir, satır içi biçim etiketleri
 * (span/b/strong…) silinir. Hepsini boşluk yapmak duyuruyu KOMŞUSUNA yapıştırıyordu:
 * "7 iş günü içerisinde iade" cümlesi menüdeki "Sipariş Takibi" bağlantısıyla birleşip
 * marka sayfasına yarım bir cümle olarak çıkıyordu. Kalıplar "|" içermeyen parça arar,
 * yani ayraç doğal bir cümle sonu görevi görüyor.
 */
function visibleText(html) {
  // Shopier duyurusunu ÖZNİTELİK taşıyor: `<… msg="2.500 TL'lik ürüne ücretsiz kargo">`.
  // Etiketler silindiğinde bu metin de gidiyordu; 13 Shopier markasında avantaj
  // bulunamamasının sebebi buydu. Öznitelik değerleri metnin başına ayraçla eklenir.
  const attrs = [...html.matchAll(/\smsg="([^"]{6,120})"/gi)].map((m) => m[1]);
  return (attrs.length ? attrs.join(" | ") + " | " : "") + html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/?(?:span|b|strong|em|i|u|small|font|mark|abbr|label)\b[^>]*>/gi, "")
    .replace(/<[^>]+>/g, " | ")
    .replace(/&nbsp;?/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#x27;|&#39;/gi, "'")
    .replace(/\s+/g, " ");
}

/**
 * Cümleyi duyuru şeridi uzunluğuna indir ve havada kalan bağlacı at.
 * Kuyruk sözcük sözcük kesildiği için cümle "…iade edebilir ya da" diye bitebiliyor.
 */
const DANGLING = /\s+(?:ve|ya|da|de|ile|veya|için|hem|ayrıca|olarak|kadar|üzeri|üzerinde)$/i;
function tidy(s) {
  let out = s.replace(/\s+/g, " ").replace(/^[^\p{L}\p{N}₺%]+/u, "").replace(/[|•·,]+$/, "").trim().slice(0, 90);
  for (let i = 0; i < 3 && DANGLING.test(out); i++) out = out.replace(DANGLING, "");
  return out.trim();
}

/**
 * Kalıplar. Her biri metinden BİR cümle çıkarır; `tip` yalnız ikon ve sıralama için.
 * Sıra = marka sayfasında görünecek sıra.
 */
// Kuyruklar SÖZCÜK SÖZCÜK tüketilir (`T(n)`), karakter sayısıyla değil: karakter sınırı
// cümleyi kelimenin ortasında kesiyordu ("30 gün içerisinde iade edebilir ya da deği").
const T = (n) => `(?:\\s+[^\\s|.!?•]+){0,${n}}`;
const re = (s) => new RegExp(s, "i");

const PATTERNS = [
  // "2000 TL ve üzeri ücretsiz kargo" ve tersi "ücretsiz kargo 2000 TL üzeri"
  // Birim kelimeye BİTİŞİK ek alabiliyor: Shopier'in duyurusu "1.800 TL'lik ürüne
  // ücretsiz kargo". `(?:tl|₺)` hemen ardından boşluk beklediği için bu cümle eşleşmiyor
  // ve eşiksiz kalıba düşüyordu; `[^\s|]*` eki yutuyor.
  ["kargo", re(`\\d[\\d.,]*\\s*(?:tl|₺)[^\\s|]*${T(4)}\\s+(?:ücretsiz|bedava)\\s*kargo`)],
  ["kargo", re(`(?:ücretsiz|bedava)\\s*kargo${T(3)}\\s+\\d[\\d.,]*\\s*(?:tl|₺)${T(2)}`)],
  ["kargo", /(?:ücretsiz|bedava)\s*kargo/i],
  ["kargo", /kargo\s*(?:bedava|ücretsiz)/i],
  ["hizli", /(?:aynı gün|1 gün(?:de)?|24 saat(?:te)?|ertesi gün)\s*(?:içinde\s*)?kargo(?:ya verilir)?/i],
  ["taksit", re(`\\d{1,2}\\s*taksit${T(3)}`)],
  ["taksit", re(`taksit(?:li)?\\s*(?:seçenek|imkan|avantaj)[^\\s|.!?•]*${T(2)}`)],
  ["kapida", re(`kapıda ödeme${T(2)}`)],
  ["iade", re(`\\d{1,2}\\s*(?:iş\\s*)?gün(?:ü)?${T(3)}\\s+(?:iade|değişim)${T(3)}`)],
  ["iade", re(`(?:koşulsuz|ücretsiz|kolay)\\s*iade${T(3)}`)],
  ["indirim", re(`(?:ilk|yeni)\\s*(?:üyelik|üye|üyelere|alışveriş|sipariş)${T(6)}\\s+(?:indirim|kupon)${T(2)}`)],
  ["indirim", re(`%\\s?\\d{1,2}\\s*indirim\\s*kupon${T(3)}`)],
];

/** Bir tipten yalnız İLK (en spesifik) eşleşme alınır: "ücretsiz kargo" kalıbı hem
 *  eşikli hem eşiksiz tutuyor, ikisini birden yazmak duyuruyu tekrar ettirirdi. */
function perksFrom(text) {
  const out = [];
  const seen = new Set();
  for (const [tip, re] of PATTERNS) {
    if (seen.has(tip)) continue;
    const m = text.match(re);
    if (!m) continue;
    const metin = tidy(m[0]);
    // Çöp eşleşme: JS/JSON kırıntısı ya da anlamsız kısa parça
    if (metin.length < 8 || /[{}<>\\]|":/.test(metin)) continue;
    seen.add(tip);
    out.push({ tip, metin });
  }
  return out;
}

async function forBrand(b) {
  const html = await getText(b.url, { accept: "text/html", tries: 2 });
  if (!html) return { slug: b.slug, perks: [], err: "sayfa alınamadı" };
  return { slug: b.slug, perks: perksFrom(visibleText(html)) };
}

let brands = await loadBrands(ROOT);
if (ONLY.length) brands = brands.filter((b) => ONLY.includes(b.slug));

console.log(`${brands.length} markanın avantajları taranıyor…\n`);
const results = await mapLimit(brands, 6, 120, forBrand);

let prev = { markalar: {} };
try {
  prev = JSON.parse(await readFile(OUT, "utf8"));
} catch { /* ilk çalıştırma */ }

const markalar = { ...prev.markalar };
let found = 0;
for (const r of results.sort((a, b) => a.slug.localeCompare(b.slug))) {
  if (r.perks.length) {
    markalar[r.slug] = r.perks;
    found++;
  }
  console.log(`  ${r.slug.padEnd(24)} ${r.perks.map((p) => p.tip).join(", ") || (r.err ?? "—")}`);
}

if (!DRY) {
  await writeFile(
    OUT,
    JSON.stringify(
      {
        _aciklama:
          "MARKA AVANTAJLARI — markanın KENDİ sitesindeki duyurudan alınmış cümleler. scripts/fetch-brand-perks.mjs üretir; elle de düzenlenebilir. Cümle markanın kendi ifadesidir, özetlenmez (kampanya koşulu markaya göre değişiyor).",
        at: new Date().toISOString(),
        markalar,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
}

console.log(`\n${found}/${brands.length} markada avantaj bulundu${DRY ? " (KURU ÇALIŞMA)" : ` → ${OUT}`}`);
