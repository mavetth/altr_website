// CİNSİYET DENETİMİ — beden kalıbından çıkarılan tahminin doğruluğunu ÖLÇER.
//
// `detectGenders`in üçüncü kademesi (beden aralığı) bir TAHMİNDİR; kaynak veride
// cinsiyet alanı yok. Bu script tahmini, adında cinsiyet AÇIKÇA yazan ürünler üzerinde
// sınar: o ürünlerin gerçek etiketi bilindiği için beden kuralı bağımsız olarak
// doğrulanabiliyor.
//
// Ölçüt: isabet >= %80 ve kapsama anlamlı olmalı. Altına düşerse kural gevşetilmeli
// ya da kaldırılmalı — yanlış cinsiyet, filtreleyen kullanıcıya ürünü tamamen kaybettirir.
//
// Kullanım: node scripts/check-gender.mjs [katalog.json]

import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { detectGenders } from "../src/lib/gender.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argSrc = process.argv.slice(2).find((a) => !a.startsWith("--"));
const src = argSrc ? resolve(argSrc) : join(ROOT, ".data", "catalog.json");
const catalog = JSON.parse(await readFile(src, "utf8"));

const MIN_ACCURACY = 0.8;

// GERÇEK ETİKET: adında cinsiyet yazdığı için ilk kademede karara bağlanan ürünler.
// Bu ürünlerde beden kuralına hiç gerek yok, o yüzden bağımsız bir sınav oluşturuyorlar.
const labeled = catalog.filter((p) => {
  if (!p.sizes?.length) return false;
  const byName = detectGenders(p.name, p.category, []);
  return byName.length === 1;
});

/**
 * Adı CİNSİYET SÖZCÜKLERİNDEN arındırır — sınavın adil olması için.
 *
 * Tahmin ederken adı tamamen atmak olmaz: kural "oversize/boxy/baggy" gibi KESİM
 * bilgisine de bakıyor (bkz. LOOSE_FIT). O yüzden yalnız cinsiyet sözcükleri silinir,
 * geri kalan ad olduğu gibi kalır.
 */
const GENDER_WORDS = /kad[ıi]n|women|woman|womens|female|ladies|bayan|femme|wmns|hamile|anne|erkek|\bmen\b|\bman\b|\bmens\b|\bmen'?s\b|\bmale\b|homme|menswear|baba/gi;
const blind = (name) => String(name).replace(GENDER_WORDS, " ");

let hit = 0;
let miss = 0;
let abstain = 0;
const misses = [];
for (const p of labeled) {
  const truth = detectGenders(p.name, p.category, [])[0];
  // Cinsiyet sözcükleri silinmiş adla tahmin et: karar yalnız bedene kalsın.
  const guess = detectGenders(blind(p.name), undefined, p.sizes);
  if (guess.length >= 2) { abstain++; continue; }
  if (guess[0] === truth) hit++;
  else {
    miss++;
    if (misses.length < 15) misses.push({ p, truth, guess: guess[0] });
  }
}

const decided = hit + miss;
const acc = decided ? hit / decided : 0;
console.log(`etiketli ürün (adında cinsiyet yazan, bedenli): ${labeled.length}`);
console.log(`beden kuralı karar verdi: ${decided} (%${((100 * decided) / labeled.length).toFixed(1)}), çekimser: ${abstain}`);
console.log(`isabet: ${hit}/${decided} = %${(100 * acc).toFixed(1)}  (eşik %${100 * MIN_ACCURACY})`);

if (misses.length) {
  console.log("\nyanlış tahmin örnekleri:");
  for (const m of misses)
    console.log(`  gerçek ${m.truth.padEnd(6)} tahmin ${m.guess.padEnd(6)} ${m.p.sizes.join(",").padEnd(28)} ${m.p.name.slice(0, 44)}`);
}

// Kuralın katalog geneline etkisi: kaç ürün unisex olmaktan çıkıyor?
let moved = 0;
for (const p of catalog) {
  const withoutSizes = detectGenders(p.name, p.category, []);
  const withSizes = detectGenders(p.name, p.category, p.sizes ?? []);
  if (withoutSizes.length >= 2 && withSizes.length === 1) moved++;
}
console.log(`\nkatalog etkisi: ${moved} ürün unisex olmaktan çıktı (%${((100 * moved) / catalog.length).toFixed(1)})`);

if (decided && acc < MIN_ACCURACY) {
  console.log(`\nFAIL  isabet eşiğin altında — beden kuralı gevşetilmeli`);
  process.exit(1);
}
console.log("tamam");
