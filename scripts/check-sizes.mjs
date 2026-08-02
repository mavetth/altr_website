#!/usr/bin/env node
/**
 * BEDEN DENETİMİ — sizes.ts için elle toplanmış doğruluk listesi.
 *
 * Buradaki her ham değer katalogda GERÇEKTEN geçiyor (.data/full taraması, 215 farklı
 * jeton). Hepsi bir zamanlar ya tamamen eleniyordu ya da yanlış jetona düşüyordu.
 * Normalizasyona dokunduğunda bunu çalıştır.
 *
 * `--tara` bayrağı ile ham veriyi de tarar: hangi jeton hâlâ tanınmıyor, kaç kayıtta.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeSize, isKnownSize, previewSizes, sortSizes,
  hasSizeInfo, isAgeSize, dropAgeSizes,
} from "../src/lib/sizes.ts";

const CASES = [
  // --- yazıyla yazılmış bedenler (overdrive-rock, dantelions, fleak, wes-wear)
  ["Small", ["S"]],
  ["MEDIUM", ["M"]],
  ["Large", ["L"]],
  ["X Large", ["XL"]],
  ["XLarge", ["XL"]],
  ["Xxlarge", ["2XL"]],
  ["X-SMALL", ["XS"]],
  ["Xsmall", ["XS"]],

  // --- yazım varyantları
  ["Xl", ["XL"]],
  ["s", ["S"]],
  ["XXL", ["2XL"]],
  ["XXXL", ["3XL"]],
  ["XXS", ["2XS"]],
  ["2XL", ["2XL"]],
  ["4XL", ["4XL"]],

  // --- aralıklar (punk-design, hype-of-steps, only-trend-wear, solid-bruises)
  ["S-M", ["S", "M"]],
  ["S/M", ["S", "M"]],
  ["SM", ["S", "M"]],
  ["L-XL", ["L", "XL"]],
  ["L/XL", ["L", "XL"]],
  ["2XL-3XL", ["2XL", "3XL"]],
  ["Small-Medium", ["S", "M"]],
  ["Large-XLarge", ["L", "XL"]],
  ["35-38", ["35", "36", "37", "38"]],
  ["28-30", ["28", "29", "30"]],
  // bel/boy: "/" ayracı aralık değil, ilk sayı beldir (that-way)
  ["30/32", ["30"]],
  ["32-32", ["32"]],

  // --- tek beden
  ["TEK BOYUT", ["TEK BEDEN"]],
  ["OneSize", ["TEK BEDEN"]],
  ["One Size", ["TEK BEDEN"]],
  ["ONE SIZE", ["TEK BEDEN"]],
  ["Standart", ["TEK BEDEN"]],
  ["STANDART", ["TEK BEDEN"]],
  ["TekEbat", ["TEK BEDEN"]],
  ["STD", ["TEK BEDEN"]],
  ["OS", ["TEK BEDEN"]],
  // sondaki "beden" sözcüğü ayıklanır, kalan "STANDART" tek bedendir
  ["Standart beden", ["TEK BEDEN"]],
  ["Standart Beden", ["TEK BEDEN"]],

  // --- parantezli notlar (from-cult) ve harf karşılığı (so-high)
  ["XL (M-L BEDENE TEKABUL EDER)", ["XL"]],
  ["2XL (L-XL BEDENE TEKABUL EDER)", ["2XL"]],
  ["28 (XXS)", ["28", "2XS"]],
  ["32 (S)", ["32", "S"]],

  // --- çocuk (only-trend-wear, efex-wear)
  ["9-10 YAŞ", ["9-10 YAŞ"]],
  ["5-6 Yaş", ["5-6 YAŞ"]],

  // --- sayısal
  ["30", ["30"]],
  ["42", ["42"]],
  ["105CM", ["105"]], // kemer/şapka santimi de bir bedendir
  // denim bel/boy: Shopier'deki jean mağazalarının standart yazımı
  ["W30 L32", ["W30/L32"]],
  ["W28L30", ["W28/L30"]],
  ["w36 l32", ["W36/L32"]],

  // --- beden OLMAYANLAR
  ["Default Title", []],
  ["", []],
  ["Siyah", ["SIYAH"]], // renk: "other" olarak korunur, isKnownSize false
];

let fail = 0;
for (const [raw, want] of CASES) {
  const got = normalizeSize(raw);
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "  ok" : "FAIL"}  ${JSON.stringify(raw).padEnd(34)} -> ${JSON.stringify(got).padEnd(28)} beklenen ${JSON.stringify(want)}`);
}

// "Siyah" beden olarak TANINMAMALI (korunması ayrı şey, tanınması ayrı)
if (normalizeSize("Siyah").some(isKnownSize)) {
  console.log("FAIL  renk adı beden sayıldı: Siyah");
  fail++;
}
/* --- önizleme: YALNIZ ÜRETİLEN bedenler, pencere XS'ten başlar, kalanı "+n" --- */

// [bedenler, beklenen slotlar, beklenen extra]
const PREVIEW_CASES = [
  // XS'ten başlar, beşinci slottan sonrası "+n"
  [["XS", "S", "M", "L", "XL", "2XL", "3XL"], ["XS", "S", "M", "L", "XL"], 2],
  // XS altı uçlar önizlemeye ÇIKMAZ, "+n"e düşer
  [["2XS", "S", "M"], ["S", "M"], 1],
  [["4XS", "3XS", "2XS", "XS", "S"], ["XS", "S"], 3],
  // olmayan beden sönük çizilmez: üründe ne varsa o
  [["S", "XL"], ["S", "XL"], 0],
  [["M"], ["M"], 0],
  // harfsiz ürün: kendi numaraları
  [["30", "31", "32", "33", "34", "36"], ["30", "31", "32", "33", "34"], 1],
  [["TEK BEDEN"], ["TEK BEDEN"], 0],
  [[], [], 0],
];

for (const [input, wantSlots, wantExtra] of PREVIEW_CASES) {
  const pv = previewSizes(input);
  const ok = JSON.stringify(pv.slots) === JSON.stringify(wantSlots) && pv.extra === wantExtra;
  if (!ok) {
    console.log(
      `FAIL  önizleme ${JSON.stringify(input)} -> ${JSON.stringify(pv.slots)} +${pv.extra}` +
        `  beklenen ${JSON.stringify(wantSlots)} +${wantExtra}`,
    );
    fail++;
  }
}

// kartta beden satırı: tek bedende hiç çizilmez
for (const [input, want] of [
  [["S", "M"], true],
  [["M"], true],
  [["TEK BEDEN"], false],
  [[], false],
]) {
  if (hasSizeInfo(input) !== want) {
    console.log(`FAIL  hasSizeInfo(${JSON.stringify(input)}) = ${hasSizeInfo(input)}, beklenen ${want}`);
    fail++;
  }
}

// yaş bedeni artık vitrine çıkmaz
if (!isAgeSize("9-10 YAŞ") || isAgeSize("XL")) {
  console.log("FAIL  isAgeSize yanlış");
  fail++;
}
if (JSON.stringify(dropAgeSizes(["S", "9-10 YAŞ", "M"])) !== JSON.stringify(["S", "M"])) {
  console.log("FAIL  dropAgeSizes yaş jetonunu düşürmedi");
  fail++;
}

console.log(`\n${CASES.length - fail} / ${CASES.length} geçti`);

/* ------------------------------------------------- ham veri taraması ------ */

if (process.argv.includes("--tara")) {
  const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const dir = join(ROOT, ".data", "full");
  const counts = new Map();
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    let arr;
    try { arr = JSON.parse(readFileSync(join(dir, f), "utf8")); } catch { continue; }
    if (!Array.isArray(arr)) continue;
    for (const r of arr) for (const s of r.sizes ?? []) counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  let unknown = 0;
  let total = 0;
  const bad = [];
  for (const [t, n] of counts) {
    total += n;
    const r = normalizeSize(t);
    if (!r.length || !r.every(isKnownSize)) { unknown += n; bad.push([t, n]); }
  }
  bad.sort((a, b) => b[1] - a[1]);
  console.log(`\nham veri: ${counts.size} farklı jeton / ${total} kayıt`);
  console.log(`tanınmayan: ${bad.length} jeton / ${unknown} kayıt (%${(100 * unknown / total).toFixed(2)})`);
  console.log(bad.slice(0, 40).map(([t, n]) => `${JSON.stringify(t)}:${n}`).join("  "));
}

process.exit(fail ? 1 : 0);
