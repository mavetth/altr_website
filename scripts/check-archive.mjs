// Arşiv denetimi — vitrinden çıkarılan ürünleri sayar ve ÖRNEKLERİNİ yazar.
//
// İki eleme kuralı var ve ikisi de geri döndürülebilir (ürünler silinmiyor,
// `.data/catalog.archived.json`'a ayrılıyor):
//   AYAKKABI — kategori kararı (bkz. src/lib/categorize.ts).
//   COCUK    — yaş bedeni ya da addaki güçlü sözcük (bkz. src/lib/kids.ts).
//
// Bu script kuralları KATALOĞA UYGULAYIP ne eleneceğini gösterir; asıl ayırma
// import-catalog'da yapılır. Yanlış pozitif avlamak için örnekleri gözle okumak şart:
// "Bebek Mavi" bir renk, "Cry Baby" bir grup adıdır.
//
// Kullanım:
//   node scripts/check-archive.mjs [katalog.json] [--n 25]

import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isKidsProduct, kidsReason } from "../src/lib/kids.ts";
import { isAgeSize } from "../src/lib/sizes.ts";
import { ARCHIVE_CATS } from "../src/lib/types.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argSrc = process.argv.slice(2).find((a) => !a.startsWith("--"));
const nArg = process.argv.indexOf("--n");
const SAMPLE = nArg > 0 ? Number(process.argv[nArg + 1]) || 25 : 25;

const src = argSrc ? resolve(argSrc) : join(ROOT, ".data", "catalog.json");
const catalog = JSON.parse(await readFile(src, "utf8"));

const archiveCats = new Set(ARCHIVE_CATS);
const buckets = { AYAKKABI: [], COCUK: [] };
const byBrand = { AYAKKABI: new Map(), COCUK: new Map() };
const kidsBySignal = new Map();

for (const p of catalog) {
  let reason = null;
  if (archiveCats.has(p.category)) reason = "AYAKKABI";
  else if (isKidsProduct(p.name, p.sizes ?? [], p.brand)) reason = "COCUK";
  if (!reason) continue;
  buckets[reason].push(p);
  byBrand[reason].set(p.brandSlug, (byBrand[reason].get(p.brandSlug) ?? 0) + 1);
  if (reason === "COCUK") {
    const sig = kidsReason(p.name, p.sizes ?? [], p.brand) ?? "?";
    kidsBySignal.set(sig, (kidsBySignal.get(sig) ?? 0) + 1);
  }
}

const total = catalog.length;
const removed = buckets.AYAKKABI.length + buckets.COCUK.length;
console.log(`katalog: ${total} ürün`);
console.log(`arşive ayrılacak: ${removed} (%${((100 * removed) / total).toFixed(2)})`);
console.log(`  AYAKKABI: ${buckets.AYAKKABI.length}`);
console.log(`  COCUK   : ${buckets.COCUK.length}  ${JSON.stringify(Object.fromEntries(kidsBySignal))}`);

for (const [reason, items] of Object.entries(buckets)) {
  if (!items.length) continue;
  const top = [...byBrand[reason]].sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log(`\n--- ${reason} · en çok etkilenen markalar: ${top.map(([s, n]) => `${s}:${n}`).join("  ")}`);
  // Örnek seçimi rastgele değil ADIM ATLAYARAK: liste marka sırasında geldiği için
  // baştan 25 almak tek markayı gösterirdi.
  const step = Math.max(1, Math.floor(items.length / SAMPLE));
  for (let i = 0, shown = 0; i < items.length && shown < SAMPLE; i += step, shown++) {
    const p = items[i];
    const sig = reason === "COCUK" ? ` [${kidsReason(p.name, p.sizes ?? [], p.brand) ?? "?"}]` : "";
    console.log(`  ${p.brandSlug.padEnd(20)} ${p.name.slice(0, 58).padEnd(59)}${sig}`);
  }
}

// Hayatta kalan üründe yaş bedeni kalmamalı — kalırsa temizleme adımı atlanmış demektir.
const strayAge = catalog.filter(
  (p) => !archiveCats.has(p.category) && !isKidsProduct(p.name, p.sizes ?? [], p.brand) && (p.sizes ?? []).some(isAgeSize),
);
if (strayAge.length) {
  console.log(`\nUYARI: arşive girmeyen ${strayAge.length} üründe hâlâ YAŞ bedeni var (import temizlemeli):`);
  for (const p of strayAge.slice(0, 10)) console.log(`  ${p.brandSlug} · ${p.name.slice(0, 50)} · ${p.sizes.join(",")}`);
}
