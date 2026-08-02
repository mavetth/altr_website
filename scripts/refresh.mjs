#!/usr/bin/env node
/**
 * CANLI TAZELEME — ürün özelliklerini (fiyat, para birimi, stok, beden, renk) kaynaktan
 * yeniden çeker ve katalogu günceller. Hedef: bir ürünün verisi en fazla 1 SAAT bayat.
 *
 *   node scripts/refresh.mjs [--max-age-min 60] [--concurrency 4] [--budget-min 45]
 *                            [--only slug1,slug2] [--force]
 *
 * Neden ayrı bir komut (tam scrape değil):
 *   Markaların ~%75'i yapılandırılmış API veriyor (Shopify /products.json, İkas GraphQL,
 *   Woo Store API) — bunlar saniyeler sürer. Geri kalanı sayfa sayfa HTML taranıyor ve
 *   marka başına dakikalar alıyor. Hepsini her saat baştan taramak ne gerekli ne kibarca.
 *   Bu yüzden:
 *     - API'li markalar HER çalıştırmada tazelenir (ucuz),
 *     - HTML'li markalar en eski tazelenenden başlayarak, zaman bütçesi dolana kadar
 *       sırayla alınır (round-robin). Böylece hiçbir marka aç kalmaz.
 *
 * Tazeleme .data/full/<slug>.json dosyalarını yeniden yazar, sonra katalog yeniden
 * üretilir. Boş sonuç ASLA dolu veriyi ezmez (bkz. scrape/run.mjs).
 */
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { fetchShopify } from "./scrape/adapters/shopify.mjs";
import { fetchIkas } from "./scrape/adapters/ikas.mjs";
import { fetchWoo } from "./scrape/adapters/woocommerce.mjs";
import { fetchJsonLd } from "./scrape/adapters/jsonld.mjs";
import { loadBrands } from "./scrape/brands.mjs";
import { detectPlatform } from "./scrape/run.mjs";
import { sleep } from "./scrape/fetch.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const FULL_DIR = join(ROOT, ".data", "full");
const STATE = join(ROOT, ".data", "refresh-state.json");

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const MAX_AGE_MIN = Number(arg("--max-age-min", 60));
const CONCURRENCY = Number(arg("--concurrency", 4));
const BUDGET_MS = Number(arg("--budget-min", 45)) * 60000;
const ONLY = (arg("--only", "") || "").split(",").filter(Boolean);
const FORCE = argv.includes("--force");

const FAST = new Set(["shopify", "ikas", "woocommerce"]);
const ADAPTERS = { shopify: fetchShopify, ikas: fetchIkas, woocommerce: fetchWoo, jsonld: fetchJsonLd };

async function loadState() {
  try {
    return JSON.parse(await readFile(STATE, "utf8"));
  } catch {
    return { brands: {} };
  }
}

async function fileAgeMin(slug) {
  try {
    const s = await stat(join(FULL_DIR, `${slug}.json`));
    return (Date.now() - s.mtimeMs) / 60000;
  } catch {
    return Infinity;
  }
}

async function refreshBrand(brand, platform) {
  const fn = ADAPTERS[platform] ?? fetchJsonLd;
  const t0 = Date.now();
  let records = [];
  let err = null;
  try {
    const r = await fn(brand, { cap: 2500 });
    records = r.records ?? [];
  } catch (e) {
    err = String(e?.message ?? e);
  }

  // dolu veriyi boş sonuçla ezme
  let had = 0;
  try {
    const prev = JSON.parse(await readFile(join(FULL_DIR, `${brand.slug}.json`), "utf8"));
    had = Array.isArray(prev) ? prev.length : 0;
  } catch { /* ilk kez */ }

  const kept = records.length === 0 && had > 0;
  if (!kept) {
    await mkdir(FULL_DIR, { recursive: true });
    await writeFile(join(FULL_DIR, `${brand.slug}.json`), JSON.stringify(records), "utf8");
  }
  return { slug: brand.slug, platform, count: records.length, kept, err, ms: Date.now() - t0 };
}

function runImport() {
  return new Promise((res, rej) => {
    const p = spawn(process.execPath, ["--no-warnings=MODULE_TYPELESS_PACKAGE_JSON", join(ROOT, "scripts", "import-catalog.mjs")], {
      cwd: ROOT,
      stdio: "inherit",
    });
    p.on("exit", (code) => (code === 0 ? res() : rej(new Error(`import-catalog çıkış kodu ${code}`))));
  });
}

async function main() {
  const started = Date.now();
  let brands = await loadBrands(ROOT);
  if (ONLY.length) brands = brands.filter((b) => ONLY.includes(b.slug));

  // platformları bir kez tespit et (durum dosyasında saklanır, her saat yeniden bakılmaz)
  const state = await loadState();
  const plan = [];
  for (const b of brands) {
    let platform = state.brands?.[b.slug]?.platform;
    if (!platform) {
      platform = await detectPlatform(b);
      state.brands[b.slug] = { ...(state.brands[b.slug] ?? {}), platform };
    }
    plan.push({ brand: b, platform, age: await fileAgeMin(b.slug) });
  }

  const fast = plan.filter((p) => FAST.has(p.platform));
  // yavaşlar: en bayat olan önce
  const slow = plan.filter((p) => !FAST.has(p.platform)).sort((a, b) => b.age - a.age);
  const due = FORCE ? [...fast, ...slow] : [...fast.filter((p) => p.age >= MAX_AGE_MIN * 0.5 || FORCE), ...slow];

  console.log(
    `${brands.length} marka | hızlı API: ${fast.length}, sayfa taraması: ${slow.length} | ` +
      `bütçe ${(BUDGET_MS / 60000).toFixed(0)} dk\n`,
  );

  const results = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (;;) {
        const item = due[i++];
        if (!item) return;
        // Bütçe dolduysa yavaş markaları bırak — sıradakiler bir sonraki turda,
        // en bayat olandan başlanacağı için hiçbiri sürekli atlanmaz.
        if (Date.now() - started > BUDGET_MS && !FAST.has(item.platform)) {
          console.log(`  … bütçe doldu, ${item.brand.slug} sonraki tura kaldı`);
          continue;
        }
        const r = await refreshBrand(item.brand, item.platform);
        results.push(r);
        state.brands[item.brand.slug] = {
          platform: item.platform,
          at: new Date().toISOString(),
          count: r.count,
        };
        console.log(
          `  ${String(results.length).padStart(3)}/${due.length} ${item.brand.slug.padEnd(24)} ` +
            `${item.platform.padEnd(12)} ${String(r.count).padStart(5)} kayıt ${(r.ms / 1000).toFixed(1)}s` +
            `${r.kept ? "  [ÖNCEKİ KORUNDU]" : ""}${r.err ? "  HATA: " + r.err : ""}`,
        );
        await sleep(120);
      }
    }),
  );

  state.lastRun = new Date().toISOString();
  await mkdir(dirname(STATE), { recursive: true });
  await writeFile(STATE, JSON.stringify(state, null, 2), "utf8");

  console.log(`\ntazelenen marka: ${results.length}, süre ${((Date.now() - started) / 60000).toFixed(1)} dk`);
  console.log("katalog yeniden üretiliyor…\n");
  await runImport();

  const stale = plan
    .map((p) => ({ slug: p.brand.slug, at: state.brands[p.brand.slug]?.at }))
    .filter((x) => !x.at || (Date.now() - new Date(x.at).getTime()) / 60000 > MAX_AGE_MIN);
  if (stale.length) console.log(`\n${MAX_AGE_MIN} dk'dan bayat kalan: ${stale.length} marka (${stale.slice(0, 12).map((s) => s.slug).join(", ")}…)`);
  else console.log(`\ntüm markalar ${MAX_AGE_MIN} dk içinde tazelendi.`);
}

main().catch((e) => { console.error("HATA:", e); process.exit(1); });
