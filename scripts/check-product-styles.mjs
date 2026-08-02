// ÜRÜN TARZI DENETİMİ.
//
// Kullanıcının işaret ettiği somut hata: "desenli bir kıyafet basic olamaz". Tarz
// yalnız MARKAYA yazılıyken bu kaçınılmazdı — basic bir markanın desenli tişörtü de
// basic görünüyordu. Tarz ürüne taşındıktan sonra bu ihlal SIFIR olmalı; bu script
// onu zorunlu kılar (ihlal varsa exit 1).
//
// Ayrıca dağılımı ve tarz başına örnekleri yazar: etiketleme gözle doğrulanabilsin.
//
// Kullanım: node scripts/check-product-styles.mjs [katalog.json] [--n 12]

import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { STYLES } from "../src/lib/brand-styles.ts";
import { productStyles } from "../src/lib/product-styles.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argSrc = process.argv.slice(2).find((a) => !a.startsWith("--"));
const nArg = process.argv.indexOf("--n");
const SAMPLE = nArg > 0 ? Number(process.argv[nArg + 1]) || 12 : 12;

const src = argSrc ? resolve(argSrc) : join(ROOT, ".data", "catalog.json");
const catalog = JSON.parse(await readFile(src, "utf8"));

// Desen sözcükleri — product-styles.ts'teki PATTERN ile aynı fikir, bağımsız yazıldı ki
// denetim uygulamanın kopyası olmasın (aynı hatayı iki yerde yapmayalım).
const PATTERNED = /desen|baskı|baski|çiçekli|kamuflaj|leopar|zebra|ekose|çizgili|puantiye|batik|kareli|nakış|grafik|tie.?dye|kolaj|logolu|\bprint(ed)?\b|\bgraphic\b|\bcamo\b|\bfloral\b|\bstriped\b|\bembroider/i;

let fail = 0;
const counts = Object.fromEntries(STYLES.map((s) => [s.k, 0]));
const samples = Object.fromEntries(STYLES.map((s) => [s.k, []]));
const violations = [];
let styleless = 0;

for (const p of catalog) {
  // Katalogdaki alanı KULLAN, yoksa hesapla — böylece script hem içe aktarılmış
  // katalogu hem de kuralın kendisini sınayabiliyor.
  const styles = p.styles?.length ? p.styles : productStyles(p.name, p.category, p.brandSlug);
  if (!styles.length) styleless++;
  for (const s of styles) {
    if (counts[s] === undefined) {
      console.log(`FAIL  bilinmeyen tarz "${s}" — ${p.name.slice(0, 40)}`);
      fail++;
      continue;
    }
    counts[s]++;
    samples[s].push(p);
  }
  if (PATTERNED.test(p.name) && styles.includes("basic")) {
    violations.push(p);
  }
}

console.log(`katalog: ${catalog.length} ürün · tarzsız: ${styleless}\n`);
console.log("tarz dağılımı (ürün adedi):");
for (const s of STYLES) {
  const n = counts[s.k];
  console.log(`  ${s.label.padEnd(12)} ${String(n).padStart(6)}  %${((100 * n) / catalog.length).toFixed(1).padStart(5)}`);
}

console.log("\ntarz başına örnekler (gözle doğrula):");
for (const s of STYLES) {
  if (!samples[s.k].length) continue;
  console.log(`\n  --- ${s.label}`);
  // Örnekler katalog boyunca ADIM ATLAYARAK seçilir: baştan almak tek markayı gösterir.
  const arr = samples[s.k];
  const step = Math.max(1, Math.floor(arr.length / SAMPLE));
  for (let i = 0, n = 0; i < arr.length && n < SAMPLE; i += step, n++)
    console.log(`      ${arr[i].brandSlug.padEnd(18)} ${arr[i].name.slice(0, 56)}`);
}

if (violations.length) {
  console.log(`\nFAIL  desenli olduğu hâlde "basic" etiketli ${violations.length} ürün:`);
  for (const p of violations.slice(0, 20)) console.log(`      ${p.brandSlug.padEnd(18)} ${p.name.slice(0, 60)}`);
  fail += violations.length;
} else {
  console.log("\ndesenli+basic ihlali: 0");
}

process.exit(fail ? 1 : 0);
