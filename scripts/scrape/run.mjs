#!/usr/bin/env node
/**
 * SCRAPER — markaları doğru adaptöre yönlendirir, sonucu marka başına dosyaya yazar.
 *
 *   node scripts/scrape/run.mjs [--only slug1,slug2] [--skip slug1,slug2] [--concurrency 3]
 *                               [--platform ikas]
 *                               [--cap 3000] [--dry]
 *
 * Çıktı: .data/full/<slug>.json   (VariantRecord[])
 *        .data/scrape-report.json (marka başına özet)
 * Ardından `npm run import-catalog` bunları tek katalog haline getirir.
 *
 * SON-İYİ KORUMASI: bir marka daha önce dolu veri vermişken bu sefer boş VEYA ÇOK DAHA
 * AZ dönerse dosya EZİLMEZ. Geçmişte tam bunun yüzünden veri kaybedildi — sigma-wears'ın
 * sitesinde 467 ürün varken katalogda 0 ürünü vardı, çünkü scrape anındaki geçici bir
 * hata sessizce boş dizi yazmıştı ve bir daha denenmemişti.
 *
 * Yalnız "boş" kontrolü YETMİYOR: punk-design'ın mağazası ikinci sayfadan itibaren 429
 * (hız sınırı) döndürdüğünde ilk sayfanın 279 kaydı, dosyadaki 5422 kaydın üstüne
 * sessizce yazıldı. Artık yeni sonuç eskinin %60'ından küçükse de dosyaya dokunulmuyor;
 * kasıtlı küçültme için `--force` var (import-catalog'daki kuralın aynısı).
 *
 * Sayı da tek başına yetmiyor: hız sınırı altında mağaza DOLU SAYIDA ama fiyatsız/bedensiz
 * kayıt döndürebiliyor. 2026-07-29 taramasında giesto/kostebek/fo4rbs/matt-wear/
 * diddy-studios tam sayıyla ama `fiyat 0` ile geldi ve iyi veriyi ezdi. Bu yüzden fiyat
 * ve beden KAPSAMASI da korunuyor (bkz. `scrapeBrand` içindeki `collapsed`).
 */
import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchShopify } from "./adapters/shopify.mjs";
import { fetchIkas } from "./adapters/ikas.mjs";
import { fetchWoo } from "./adapters/woocommerce.mjs";
import { fetchJsonLd } from "./adapters/jsonld.mjs";
import { fetchShopier } from "./adapters/shopier.mjs";
import { getText, sleep } from "./fetch.mjs";
import { loadBrands } from "./brands.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const FULL_DIR = join(ROOT, ".data", "full");
const REPORT = join(ROOT, ".data", "scrape-report.json");

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ONLY = (arg("--only", "") || "").split(",").filter(Boolean);
/** Bilerek atlanan markalar. abluka burada: üç denemede de V8 heap ile ölüyor ve
 *  heap büyütmek çözmüyor (bkz. docs/DEVIR-NOTU.md 6a). Mevcut dosyası korunur. */
const SKIP = (arg("--skip", "") || "").split(",").filter(Boolean);
const CONCURRENCY = Number(arg("--concurrency", 3));
// 3000'di: kostebek/sokak-butik gibi büyük Ticimax mağazalarında sitemap'te 6000+ ürün
// URL'i var, tavan bunları sessizce kesiyordu (ölçüldü: kostebek 6000 → 2495).
const CAP = Number(arg("--cap", 9000));
const PLATFORM = arg("--platform", "");
const DRY = argv.includes("--dry");
/** Küçülme emniyetini bilerek aş (marka gerçekten küçüldüyse). */
const FORCE = argv.includes("--force");

/**
 * Markanın gerçek altyapısını ana sayfadan tanır. brands.generated.ts'teki `platform`
 * alanı güvenilmez: 38 marka orada "jsonld" yazıyordu ama aslında İkas'tı ve bu yüzden
 * sitemap taramasıyla eksik/bedensiz çekiliyorlardı.
 */
export async function detectPlatform(brand) {
  // Shopier mağazası kendi alan adında değil; ana sayfa HTML'i pazaryerinin kabuğudur ve
  // hiçbir platform imzası taşımaz (jsonld sanılıp boş dönerdi). Adresten anlaşılır.
  if (/(^|\.)shopier\.com$/i.test(new URL(brand.url).hostname)) return "shopier";
  const html = await getText(brand.url, { accept: "text/html", tries: 2 });
  if (!html) return brand.platform === "none" ? "jsonld" : brand.platform;
  if (/myikas\.com|__IKAS|cdn\.myikas/i.test(html)) return "ikas";
  if (/cdn\.shopify\.com|Shopify\.theme|shopify-features/i.test(html)) return "shopify";
  if (/wp-json|woocommerce/i.test(html)) return "woocommerce";
  return "jsonld"; // ticimax / tsoft / bilinmeyen -> sitemap + sayfa
}

const ADAPTERS = {
  shopify: fetchShopify,
  ikas: fetchIkas,
  woocommerce: fetchWoo,
  shopier: fetchShopier,
  jsonld: fetchJsonLd,
};

/**
 * Dosyadaki önceki sonucun "sağlık" ölçüsü: kaç kayıt, kaçında fiyat, kaçında beden.
 * Yalnız sayı yetmiyordu — bkz. `kept` hesabındaki not.
 */
async function existingHealth(slug) {
  try {
    const s = await stat(join(FULL_DIR, `${slug}.json`));
    if (s.size <= 2) return { count: 0, priced: 0, sized: 0 };
    const arr = JSON.parse(await readFile(join(FULL_DIR, `${slug}.json`), "utf8"));
    if (!Array.isArray(arr)) return { count: 0, priced: 0, sized: 0 };
    return {
      count: arr.length,
      priced: arr.filter((r) => r?.price != null).length,
      sized: arr.filter((r) => r?.sizes?.length).length,
    };
  } catch {
    return { count: 0, priced: 0, sized: 0 };
  }
}

/**
 * Marka başına tavan (data/brand-caps.json) — komut satırındaki `--cap`ten ZAYIF,
 * varsayılandan GÜÇLÜ. Yalnız abluka gibi heap ile ölen markalar için var; sebebi ve
 * ölçümü o dosyada yazılı.
 */
let CAPS = {};
try {
  CAPS = JSON.parse(await readFile(join(ROOT, "data", "brand-caps.json"), "utf8")).tavanlar ?? {};
} catch { /* dosya yoksa tavan yok */ }
const capFor = (slug) => (argv.includes("--cap") ? CAP : (CAPS[slug] ?? CAP));

async function scrapeBrand(brand) {
  const t0 = Date.now();
  const platform = await detectPlatform(brand);
  const fn = ADAPTERS[platform] ?? fetchJsonLd;

  let records = [];
  let note = "";
  let err = null;
  try {
    const r = await fn(brand, { cap: capFor(brand.slug) });
    records = r.records ?? [];
    note = r.note ?? "";
  } catch (e) {
    err = String(e?.message ?? e);
  }

  // İkas/Shopify beklenmedik şekilde boş döndüyse genel yola bir şans daha ver.
  // Shopier HARİÇ: orada "site" pazaryerinin kendisi, sitemap taraması markanın değil
  // shopier.com'un sayfalarını gezerdi.
  if (!records.length && platform !== "jsonld" && platform !== "shopier") {
    try {
      const r = await fetchJsonLd(brand, { cap: Math.min(CAP, 3000) });
      if (r.records.length) {
        records = r.records;
        note = `${note} → fallback: ${r.note}`;
      }
    } catch { /* fallback da olmadı */ }
  }

  const had = await existingHealth(brand.slug);
  const nowPriced = records.filter((r) => r.price != null).length;
  const nowSized = records.filter((r) => r.sizes?.length).length;

  // Küçülme emniyeti: boş VEYA eskinin %60'ından az. Yarım kalmış/engellenmiş bir
  // tarama dolu veriyi ezmesin (bkz. dosya başındaki not).
  const shrank = had.count > 0 && records.length < had.count * 0.6;

  // KAPSAMA emniyeti. Sayı korumasının deliği ÖLÇÜLDÜ: 2026-07-29 tam taramasında
  // giesto 666, kostebek 9274, fo4rbs 2099, matt-wear 350, diddy-studios 203 kayıt
  // döndürdü — sayı yerindeydi, ama hepsinde `fiyat 0`. Hız sınırı altında mağaza
  // kırpılmış bir gövde veriyor (varyantlar fiyatsız); sayıya bakan koruma bunu
  // göremediği için 12.600 ürün katalogda fiyatsız kaldı. Kanıt: aynı adaptör bugün
  // giesto'da 255/255 fiyat çekiyor. Artık eskiden dolu olan bir alanın çökmesi de
  // dosyayı ezmiyor.
  const collapsed = (before, after) =>
    had.count > 0 && before >= had.count * 0.5 && after < records.length * 0.2;
  const lostPrice = collapsed(had.priced, nowPriced);
  const lostSize = collapsed(had.sized, nowSized);

  const kept = (shrank || lostPrice || lostSize) && !FORCE;

  if (!DRY && !kept) {
    await mkdir(FULL_DIR, { recursive: true });
    await writeFile(join(FULL_DIR, `${brand.slug}.json`), JSON.stringify(records), "utf8");
  }

  return {
    slug: brand.slug,
    platform,
    records: records.length,
    onceHad: had.count,
    keptPrevious: kept,
    keptReason: kept ? (shrank ? "az kayıt" : lostPrice ? "fiyat çöktü" : "beden çöktü") : null,
    withPrice: nowPriced,
    withSize: nowSized,
    currency: records[0]?.currency ?? null,
    note,
    err,
    ms: Date.now() - t0,
  };
}

async function main() {
  let brands = await loadBrands(ROOT);
  if (ONLY.length) brands = brands.filter((b) => ONLY.includes(b.slug));
  if (SKIP.length) {
    const before = brands.length;
    brands = brands.filter((b) => !SKIP.includes(b.slug));
    console.log(`atlanan marka: ${before - brands.length} (${SKIP.join(", ")})`);
  }
  if (PLATFORM) {
    const filtered = [];
    for (const b of brands) if ((await detectPlatform(b)) === PLATFORM) filtered.push(b);
    brands = filtered;
  }

  console.log(`${brands.length} marka çekiliyor (eşzamanlılık ${CONCURRENCY})…\n`);
  const results = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (;;) {
        const b = brands[i++];
        if (!b) return;
        const r = await scrapeBrand(b);
        results.push(r);
        const flag = r.keptPrevious
          ? `  [ÖNCEKİ VERİ KORUNDU (${r.keptReason}): ${r.onceHad} kayıt vardı, ${r.records} geldi]`
          : "";
        console.log(
          `  ${String(results.length).padStart(3)}/${brands.length} ${b.slug.padEnd(24)} ${r.platform.padEnd(12)} ` +
            `${String(r.records).padStart(5)} kayıt  fiyat ${r.withPrice} beden ${r.withSize}  ${r.currency ?? "-"}  ${(r.ms / 1000).toFixed(1)}s` +
            `${r.err ? "  HATA: " + r.err : ""}${flag}`,
        );
        await sleep(150);
      }
    }),
  );

  results.sort((a, b) => a.slug.localeCompare(b.slug));
  await mkdir(dirname(REPORT), { recursive: true });
  await writeFile(REPORT, JSON.stringify({ at: new Date().toISOString(), results }, null, 2), "utf8");

  const total = results.reduce((s, r) => s + r.records, 0);
  const empty = results.filter((r) => r.records === 0);
  console.log(`\ntoplam kayıt: ${total}`);
  if (empty.length) console.log(`boş dönen (${empty.length}): ${empty.map((e) => e.slug).join(", ")}`);
  console.log(`rapor: ${REPORT}`);
}

// Yalnızca doğrudan çalıştırıldığında başla — refresh.mjs bu dosyadan detectPlatform'u
// import ediyor, o import tam bir scrape tetiklememeli.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((e) => { console.error("HATA:", e); process.exit(1); });
}
