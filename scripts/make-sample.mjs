// HAFİF ÖRNEK KATALOG üretir.
//
// Neden gerekiyor: gerçek katalog ~98 MB ve bu makinede `next dev`i OOM ile öldürüyor
// (bkz. docs/DEVIR-NOTU.md). Gündelik geliştirme için kategori başına birkaç düzine
// ürünlük bir örnek yetiyor — ama örnek TABAKALI olmalı: baştan N ürün almak tek
// markayı ve tek kategoriyi getirir, vitrin gerçekçi görünmez.
//
// Örnekleme kuralı: her kategoriden en fazla `--n` ürün, kategori içinde MARKALARA
// eşit yayarak (round-robin). Böylece 37 kategori de, mümkün olduğunca çok marka da
// temsil ediliyor.
//
// Kullanım:
//   node scripts/make-sample.mjs                    # catalog.json -> sample (60/kategori)
//   node scripts/make-sample.mjs --n 40
//   node scripts/make-sample.mjs --kaynak .data/catalog.new-full.json
//
// Çıktı: .data/catalog.sample.json  (ve --uygula verilirse catalog.json'a da kopyalar)

import { readFile, writeFile, copyFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i >= 0 ? process.argv[i + 1] : d;
};

const PER_CAT = Number(arg("--n", 60)) || 60;
const srcArg = arg("--kaynak", null);
const src = srcArg ? resolve(srcArg) : join(ROOT, ".data", "catalog.json");
const sampleDest = join(ROOT, ".data", "catalog.sample.json");
const liveDest = join(ROOT, ".data", "catalog.json");

const catalog = JSON.parse(await readFile(src, "utf8"));
if (!Array.isArray(catalog)) throw new Error("katalog dizi değil: " + src);

// kategori -> marka -> ürünler
const byCat = new Map();
for (const p of catalog) {
  if (!byCat.has(p.category)) byCat.set(p.category, new Map());
  const brands = byCat.get(p.category);
  if (!brands.has(p.brandSlug)) brands.set(p.brandSlug, []);
  brands.get(p.brandSlug).push(p);
}

const out = [];
for (const [, brands] of byCat) {
  // Markalar arasında sırayla dolaşarak seç: bir markanın 4000 ürünü diğerlerini ezmesin.
  const lists = [...brands.values()];
  let taken = 0;
  for (let round = 0; taken < PER_CAT; round++) {
    let ilerledi = false;
    for (const list of lists) {
      if (taken >= PER_CAT) break;
      if (round < list.length) {
        out.push(list[round]);
        taken++;
        ilerledi = true;
      }
    }
    if (!ilerledi) break; // bu kategoride ürün kalmadı
  }
}

await writeFile(sampleDest, JSON.stringify(out), "utf8");

const cats = new Set(out.map((p) => p.category)).size;
const brands = new Set(out.map((p) => p.brandSlug)).size;
const mb = (JSON.stringify(out).length / 1024 / 1024).toFixed(1);
console.log(`kaynak : ${src} (${catalog.length} ürün)`);
console.log(`örnek  : ${out.length} ürün · ${cats} kategori · ${brands} marka · ~${mb} MB`);
console.log(`yazıldı: ${sampleDest}`);

if (process.argv.includes("--uygula")) {
  await copyFile(sampleDest, liveDest);
  console.log(`uygulandı: ${liveDest} (siteyi besleyen dosya artık ÖRNEK)`);
} else {
  console.log(`\nSiteyi örnekle çalıştırmak için: node scripts/make-sample.mjs --uygula`);
}
