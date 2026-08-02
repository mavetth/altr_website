// Fiyat denetimi.
//
// İki bölüm var:
//  1) `num()` BİRİM TESTİ — ağdan bağımsız, `npm run check` zincirinde her zaman çalışır.
//     Buradaki hata sessizdir ve kataloğun tamamını bozar: eski hâli ABD biçimli
//     "1,799.90" fiyatını 1.799 olarak okuyordu (1000 kat küçük), çünkü noktayı binlik
//     ayracı sanıp virgülü ondalığa çeviriyordu.
//  2) CANLI ÖRNEKLEME (`--canli`) — katalogdaki fiyatı markanın kendi sayfasıyla
//     karşılaştırır. İkas'ta `discountPrice` alanının hiç istenmemesi yüzünden ~40 marka
//     ESKİ fiyatı taşıyordu; bu bölüm o sınıf hataların başka platformlarda da olup
//     olmadığını kanıtlar. Ağ gerektirdiği için `npm run check` onu çağırmaz.
//
// Kullanım:
//   node scripts/check-prices.mjs                 birim testleri
//   node scripts/check-prices.mjs --canli [--n 8] canlı örnekleme (marka başına n ürün)

import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { num, getText, getJson } from "./scrape/fetch.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/* ------------------------------------------------------- birim testi ------ */

// [ham değer, beklenen sayı]
const CASES = [
  // Türkçe biçim: nokta binlik, virgül ondalık
  ["1.799,90", 1799.9],
  ["1.799", 1799],
  ["2.500,00", 2500],
  ["1.234.567", 1234567],
  ["799,9", 799.9],
  ["0,5", 0.5],
  // ABD biçimi: virgül binlik, nokta ondalık — ESKİ HATA BURADAYDI
  ["1,799.90", 1799.9],
  ["1,799", 1799],
  ["12,345.67", 12345.67],
  ["1799.90", 1799.9],
  ["19.99", 19.99],
  // sembol / boşluk / etiket kirliliği
  ["₺1.799,90", 1799.9],
  ["$1,799.90", 1799.9],
  ["1 799,90", 1799.9],
  ["1.799,90 TL", 1799.9],
  ["TRY 899", 899],
  // ayraçsız ve sayısal girişler
  ["1799", 1799],
  [1799.9, 1799.9],
  [0, 0],
  // geçersiz
  ["", null],
  ["bedava", null],
  [null, null],
  [undefined, null],
  [NaN, null],
];

let fail = 0;
for (const [raw, want] of CASES) {
  const got = num(raw);
  const ok = Object.is(got, want) || got === want;
  if (!ok) fail++;
  console.log(
    `${ok ? "  ok" : "FAIL"}  ${String(JSON.stringify(raw)).padEnd(16)} -> ${String(got).padEnd(12)} beklenen ${want}`,
  );
}
console.log(`\n${CASES.length - fail} / ${CASES.length} geçti`);

/* ---------------------------------------------------- canlı örnekleme ------ */

if (process.argv.includes("--canli")) {
  const nArg = process.argv.indexOf("--n");
  const PER_BRAND = nArg > 0 ? Number(process.argv[nArg + 1]) || 8 : 8;
  const TOLERANCE = 0.02; // %2'den fazla sapma hata sayılır

  const catalog = JSON.parse(await readFile(join(ROOT, ".data", "catalog.json"), "utf8"));
  // Platform etiketi yalnız RAPOR için (hangi adaptörde toplanıyor). brands.ts buradan
  // import EDİLEMEZ: uzantısız import kullanıyor, Node onu çözemiyor (bkz.
  // scripts/scrape/brands.mjs aynı sebeple dosyayı metin olarak okuyor).
  const genSrc = await readFile(join(ROOT, "src", "lib", "brands.generated.ts"), "utf8");
  const platformOf = new Map();
  for (const m of genSrc.matchAll(/"([^"]+)":\s*\{\s*url:\s*"[^"]+",\s*platform:\s*"([^"]+)"/g))
    platformOf.set(m[1], m[2]);

  // Marka başına, fiyatı olan ve stokta olan ürünlerden örnek al.
  const bySlug = new Map();
  for (const p of catalog) {
    if (p.price == null || !p.inStock || !p.productUrl) continue;
    if (!bySlug.has(p.brandSlug)) bySlug.set(p.brandSlug, []);
    const arr = bySlug.get(p.brandSlug);
    if (arr.length < PER_BRAND) arr.push(p);
  }

  /** Ürünün markanın kendi sayfasındaki GÜNCEL fiyatı. */
  async function livePrice(p) {
    const html = await getText(p.productUrl, { accept: "text/html" });
    if (!html) return null;
    // JSON-LD teklifi — Shopify/Ticimax/T-Soft hepsinde güncel satış fiyatını taşıyor.
    for (const m of html.matchAll(/<script[^>]+ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
      let node;
      try { node = JSON.parse(m[1]); } catch { continue; }
      const stack = [node];
      while (stack.length) {
        const cur = stack.pop();
        if (!cur || typeof cur !== "object") continue;
        if (cur.offers) {
          const list = Array.isArray(cur.offers) ? cur.offers : [cur.offers];
          const ps = list.map((o) => num(o?.price ?? o?.lowPrice)).filter((x) => x != null && x > 0);
          if (ps.length) return Math.min(...ps);
        }
        for (const v of Object.values(cur)) if (v && typeof v === "object") stack.push(v);
      }
    }
    // Shopify: ürün JSON'u kesin kaynak.
    const j = await getJson(`${p.productUrl.split("?")[0].replace(/\/$/, "")}.json`);
    const vs = j?.product?.variants;
    if (Array.isArray(vs)) {
      const live = vs.filter((v) => v.available);
      const ps = (live.length ? live : vs).map((v) => num(v.price)).filter((x) => x != null && x > 0);
      if (ps.length) return Math.min(...ps);
    }
    return null;
  }

  const bad = [];
  let checked = 0;
  let unresolved = 0;
  for (const [slug, items] of bySlug) {
    for (const p of items) {
      const live = await livePrice(p);
      if (live == null) { unresolved++; continue; }
      checked++;
      const lo = p.priceMin ?? p.price;
      const hi = p.priceMax ?? p.price;
      // Ürünün aralığına düşüyorsa sorun yok (renge göre fiyat değişebilir).
      const inRange = live >= lo * (1 - TOLERANCE) && live <= hi * (1 + TOLERANCE);
      if (!inRange) {
        bad.push({ slug, platform: platformOf.get(slug) ?? "?", name: p.name.slice(0, 44), katalog: p.price, canli: live, oran: +(live / p.price).toFixed(3) });
      }
    }
  }

  console.log(`\ncanlı örnekleme: ${checked} ürün denetlendi, ${unresolved} sayfadan fiyat okunamadı`);
  if (!bad.length) {
    console.log("SAPMA YOK");
  } else {
    console.log(`SAPAN: ${bad.length} ürün (%${((100 * bad.length) / Math.max(1, checked)).toFixed(1)})\n`);
    // Platform kırılımı: bir platformda toplanıyorsa o adaptörde sistemik hata var.
    const byPlatform = {};
    for (const b of bad) byPlatform[b.platform] = (byPlatform[b.platform] ?? 0) + 1;
    console.log("platform kırılımı:", JSON.stringify(byPlatform));
    for (const b of bad.slice(0, 40)) {
      console.log(`  ${b.slug.padEnd(20)} ${b.name.padEnd(46)} katalog ${String(b.katalog).padStart(9)}  canlı ${String(b.canli).padStart(9)}  x${b.oran}`);
    }
    fail += bad.length;
  }
}

// `process.exit()` DEĞİL: Windows'ta stdout bir pipe'a bağlıyken (npm run),
// son `console.log`un yazımı bitmeden süreç kapatılınca libuv çöküyor
// ("Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)"). Denetim geçtiği
// hâlde `npm run check` zinciri bu yüzden kırılıyordu. `exitCode` ile süreç
// tamponu boşaltıp kendiliğinden çıkar.
process.exitCode = fail ? 1 : 0;
