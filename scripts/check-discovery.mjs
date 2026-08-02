#!/usr/bin/env node
/**
 * KEŞFET DENETİMİ — akışın başı gerçekten "iyi" ürünlerle mi doluyor?
 *
 * Sıralama ağırlıklarına dokunmak kolay, sonucu görmek zor: ilk ekran 40 karttan
 * ibaret ve gözle bakınca "iyi görünüyor" demek her zaman mümkün. Bu script akışın
 * BAŞINI katalogun ORTALAMASIYLA karşılaştırıyor. İlk sayfa ortalamanın altına
 * düşüyorsa bir sinyal ters çalışıyor demektir.
 *
 * Ölçülen üç şey:
 *   - beden çeşitliliği (bu turda eklendi: bedeni çok olan ürün öne çıkmalı)
 *   - görsel sayısı ve renk varyantı (kartın eksiksiz görünmesi)
 *   - fiyatı olan ürün oranı
 *
 * Eşikler ÖLÇÜLEREK kondu, teoriyle değil: ilk sayfanın ortalamayı ne kadar geçtiğine
 * bakıp altına makul bir pay bırakıldı. Kırılırsa ağırlıklar değişmiş demektir —
 * bilerek değiştiysen eşiği de güncelle.
 */
import { readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildFeed, currentSeed } from "../src/lib/discovery.ts";
import { brandScore } from "../src/lib/brand-scores.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

// Sunucunun SERVİS ETTİĞİ katalogu ölç (bkz. src/lib/cache.ts). Sabit `catalog.json`
// okunduğu sürece denetim hafif örneği ölçüp "tamam" diyebiliyordu — oysa vitrinde
// tam katalog vardı ve ölçülen sayılar oraya ait değildi.
const SRC = process.env.ALTR_CATALOG
  ? resolve(projectRoot, process.env.ALTR_CATALOG)
  : join(projectRoot, ".data", "catalog.json");
/** İlk kaç ürüne bakılıyor — kullanıcının gerçekten göreceği ilk beş sayfa. */
const HEAD = 200;

/**
 * İlk sayfa ortalamayı en az bu kadar geçmeli.
 *
 * `MIN_SIZE_RATIO` 1.15'ten 1.12'ye indirildi (2026-07-30, öne çıkan primi turu).
 * Sebep ölçülüdür, tahmin değil — tam katalogda (56.445 stoklu ürün, ilk 200):
 *   prim kapalı → 5.38 / 4.48 = 1.201
 *   prim açık   → 5.13 / 4.48 = 1.145
 * Prim orta bandın iyi ürünlerini öne aldıkça `sizeBonus` ile aynı yeri paylaşıyor ve
 * beden ortalaması bir tık düşüyor. Kayıp kullanıcı tarafında görünmüyor (ilk sayfa
 * hâlâ katalog ortalamasının belirgin üstünde: ürün başına ~5 beden), kazanç ise
 * vitrinin tek tip markadan kurtulması. Eşik yine de 1.12'de tutuluyor: sinyalin
 * TAMAMEN sönmesi hâlâ hata sayılır.
 *
 * Not: hafif örnek katalogda aynı ölçü 1.27 çıkar (2.160 üründe kuyruk yok), yani eşik
 * iki modda da geçerli olmak zorunda.
 */
const MIN_SIZE_RATIO = 1.12;
const MIN_IMG_RATIO = 1.05;

/**
 * TAZELEME denetimi: iki ayrı tohum ilk 40'ta en fazla bu kadar ürünü paylaşabilir.
 *
 * Neden ölçülüyor: tohum eskiden yalnız ürün gürültüsüne giriyordu ve "KEŞFETİ YENİLE"
 * hissedilir bir değişiklik üretmiyordu (aynı markalar, biraz farklı ürünler). Marka
 * rotasyonu bunu çözdü; eşik o düzeltmenin geri gelmesini engelliyor.
 */
const MAX_OVERLAP = 12;
/**
 * İlk sayfanın marka puanı ortalaması katalogu en az bu kadar geçmeli.
 *
 * Eşik NEDEN bu kadar düşük: `data/brand-scores.json` çok yayvan — 163 markanın 111'i
 * 3–3.5 bandında, 4'ün üstünde yalnız 3 marka var. Yani ölçünün oynayabileceği aralık
 * baştan küçük. Ölçülen değerler (tam katalog, ilk 200): öne çıkan primi kapalıyken
 * 1.071, açıkken 1.060 — prim orta bandı yukarı taşıdığı için kaldıraç bilerek biraz
 * düşüyor. Hafif örnek katalogda aynı sayı 1.03'e kadar iniyor (2.160 üründe kuyruk
 * yok). Eşik bu yüzden 1.02: puan tablosunun tamamen ETKİSİZLEŞMESİNİ yakalar,
 * kürasyonla prim arasındaki dengeyi kilitlemez.
 *
 * Puan tablosu gerçek veriyle güncellenip yayıldığında (bkz. DEVIR-NOTU açık iş 3b) bu
 * eşik yükseltilebilir.
 */
const MIN_BRAND_LIFT = 1.02;

function graded(p) {
  return (p.sizes ?? []).filter((s) => s !== "TEK BEDEN").length;
}

function ortalama(list, f) {
  if (!list.length) return 0;
  return list.reduce((s, p) => s + f(p), 0) / list.length;
}

function main() {
  let all;
  try {
    all = JSON.parse(readFileSync(SRC, "utf8"));
  } catch {
    console.error(`Katalog okunamadi: ${SRC}`);
    process.exit(1);
  }

  // Vitrinin gerçekten gösterdiği küme: stokta olanlar (varsayılan filtre).
  const live = all.filter((p) => p.inStock);
  const feed = buildFeed(live, "kesfet", currentSeed(), HEAD);
  const head = feed.slice(0, HEAD);

  const olcum = [
    ["beden cesitliligi", graded, MIN_SIZE_RATIO],
    ["gorsel sayisi", (p) => (p.images ?? []).length, MIN_IMG_RATIO],
    ["renk varyanti", (p) => (p.variants ?? []).length, 1.0],
    ["fiyati var", (p) => (p.price != null ? 1 : 0), 1.0],
  ];

  console.log(`Katalog: ${all.length} urun · stokta ${live.length} · olculen bas ${head.length}`);
  console.log("");
  console.log("olcu                 ilk200   katalog   oran   esik");

  let fail = 0;
  for (const [ad, f, esik] of olcum) {
    const a = ortalama(head, f);
    const b = ortalama(live, f);
    const oran = b > 0 ? a / b : 0;
    const ok = oran >= esik;
    if (!ok) fail++;
    console.log(
      `${ad.padEnd(20)} ${a.toFixed(2).padStart(6)}   ${b.toFixed(2).padStart(7)}   ${oran.toFixed(2).padStart(4)}   ${esik.toFixed(2)}  ${ok ? "" : "  <-- DUSUK"}`,
    );
  }

  // Marka çeşitliliği: ilk ekran tek markanın deposu olmamalı (dokumanın asıl işi).
  const markalar = new Set(head.map((p) => p.brandSlug));
  const enCok = Math.max(
    ...[...markalar].map((m) => head.filter((p) => p.brandSlug === m).length),
  );
  console.log("");
  console.log(`ilk ${head.length} urunde ${markalar.size} marka · en cok gorunen marka ${enCok} kez`);
  if (enCok > head.length * 0.2) {
    console.log("  <-- TEK MARKA BASKIN (dokuma/fatigue bozulmus olabilir)");
    fail++;
  }

  // MARKA PUANI hâlâ omurga mı? Öne çıkan primi orta bandı yukarı taşıyor; bu ölçü
  // primin puan tablosunu EZMEDİĞİNİ gösteriyor. Oran 1'e inerse sıralama editoryal
  // kararı dinlemiyor demektir (bkz. data/brand-scores.json).
  const puanBas = ortalama(head, (p) => brandScore(p.brandSlug));
  const puanHepsi = ortalama(live, (p) => brandScore(p.brandSlug));
  const lift = puanHepsi > 0 ? puanBas / puanHepsi : 0;
  console.log(
    `marka puani: ilk${head.length} ${puanBas.toFixed(2)} · katalog ${puanHepsi.toFixed(2)} · oran ${lift.toFixed(2)} (esik ${MIN_BRAND_LIFT})`,
  );
  if (lift < MIN_BRAND_LIFT) {
    console.log("  <-- MARKA PUANI ETKISIZ (prim/gurultu omurgayi ezmis olabilir)");
    fail++;
  }

  // TAZELEME: iki tohum, iki farklı vitrin. Tohumlar SABİT yazılı (manualSeed()
  // rastgele üretir) — denetim her koşuda aynı sonucu vermeli, yoksa sınırda gezinen
  // bir eşik bazen geçip bazen kalır ve sebebi kodda aranır.
  const a = buildFeed(live, "kesfet", "e-denetim1", 400).slice(0, 40);
  const b = buildFeed(live, "kesfet", "e-denetim2", 400).slice(0, 40);
  const idsB = new Set(b.map((p) => p.id));
  const ortakUrun = a.filter((p) => idsB.has(p.id)).length;
  const markaB = new Set(b.map((p) => p.brandSlug));
  const ortakMarka = new Set(a.map((p) => p.brandSlug).filter((s) => markaB.has(s))).size;
  console.log(
    `tazeleme: iki tohumun ilk40'i ${ortakUrun} urun · ${ortakMarka} marka paylasiyor (urun esigi ${MAX_OVERLAP})`,
  );
  if (ortakUrun > MAX_OVERLAP) {
    console.log("  <-- TAZELEME ETKISIZ (tohum marka duzeyine gecmiyor olabilir)");
    fail++;
  }

  if (fail) {
    console.error(`\n${fail} olcu esigin altinda.`);
    process.exit(1);
  }
  console.log("\nTamam.");
}

main();
