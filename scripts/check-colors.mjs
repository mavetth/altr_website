#!/usr/bin/env node
/**
 * RENK ETİKETİ DENETİMİ.
 *
 * Renk etiketleri gözle denetlenmesi gereken bir veri: bir ürünün "mavi" olup olmadığı
 * ancak fotoğrafına bakınca anlaşılır. Bu script otomatik olarak SAPMALARI yakalar,
 * doğruluğu değil:
 *
 *   1. KAPSAMA — katalogun ne kadarı etiketli. Düşükse `npm run tag-colors` eksik.
 *   2. TEK RENK BASKINLIĞI — "siyah" katalogun yarısından fazlasını kaplıyorsa arka
 *      plan/gölge elemesi bozulmuş demektir (ölçümle geldi: eleme kapalıyken her şey
 *      nötre düşüyordu).
 *   3. ÇOK RENKLİ ORANI — %25'i aşıyorsa desen eşiği fazla gevşek.
 *   4. BİLİNMEYEN ETİKET — taksonomi dışı bir değer sızmış mı.
 *
 * `--ornek` bayrağı gözle denetim için rastgele 20 ürünü URL'siyle basar.
 */
import { readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { COLOR_TAGS } from "../src/lib/color-tags.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const CATALOG = join(projectRoot, ".data", "catalog.json");
const TAGS = join(projectRoot, "data", "color-tags.json");

/** Katalogun en az bu kadarı etiketli olmalı. */
const MIN_COVERAGE = 0.8;
/** Tek bir aile katalogun bundan fazlasını kaplamamalı. */
const MAX_SINGLE = 0.6;
/** "çok renkli" oranı tavanı. */
const MAX_MULTI = 0.25;

const VALID = new Set(COLOR_TAGS.map((c) => c.k));

function main() {
  let all;
  try {
    all = JSON.parse(readFileSync(CATALOG, "utf8"));
  } catch {
    console.error(`Katalog okunamadi: ${CATALOG}`);
    process.exit(1);
  }

  let tags = {};
  try {
    tags = JSON.parse(readFileSync(TAGS, "utf8"));
  } catch {
    console.error(`UYARI: ${TAGS} yok — once "npm run tag-colors" calistir.`);
    process.exit(1);
  }

  const tagged = all.filter((p) => (p.colorTags ?? []).length > 0);
  const coverage = all.length ? tagged.length / all.length : 0;

  const dagilim = {};
  let bilinmeyen = 0;
  for (const p of all) {
    for (const t of p.colorTags ?? []) {
      if (!VALID.has(t)) bilinmeyen++;
      dagilim[t] = (dagilim[t] ?? 0) + 1;
    }
  }

  console.log(`Katalog : ${all.length} urun`);
  console.log(`Etiketli: ${tagged.length} (%${(coverage * 100).toFixed(1)})`);
  console.log(`Etiket dosyasi: ${Object.keys(tags).length} kayit`);
  console.log("");
  console.log("aile          urun     pay");
  const sirali = Object.entries(dagilim).sort((a, b) => b[1] - a[1]);
  for (const [k, n] of sirali) {
    console.log(`${k.padEnd(14)}${String(n).padStart(6)}   %${((n / (all.length || 1)) * 100).toFixed(1)}`);
  }

  let fail = 0;
  console.log("");

  if (coverage < MIN_COVERAGE) {
    console.log(`<-- KAPSAMA DUSUK: %${(coverage * 100).toFixed(1)} (esik %${MIN_COVERAGE * 100})`);
    fail++;
  }

  const [enCok, enCokN] = sirali[0] ?? ["", 0];
  if (all.length && enCokN / all.length > MAX_SINGLE) {
    console.log(`<-- "${enCok}" katalogun %${((enCokN / all.length) * 100).toFixed(1)}'i — arka plan/golge elemesi bozulmus olabilir`);
    fail++;
  }

  const multi = dagilim["cok-renkli"] ?? 0;
  if (all.length && multi / all.length > MAX_MULTI) {
    console.log(`<-- "cok-renkli" %${((multi / all.length) * 100).toFixed(1)} — desen esigi fazla gevsek`);
    fail++;
  }

  if (bilinmeyen) {
    console.log(`<-- ${bilinmeyen} taksonomi disi etiket`);
    fail++;
  }

  if (process.argv.includes("--ornek")) {
    console.log("\nGOZLE DENETIM (rastgele 20):");
    const havuz = [...tagged];
    for (let i = 0; i < 20 && havuz.length; i++) {
      const p = havuz.splice(Math.floor(Math.random() * havuz.length), 1)[0];
      console.log(`  ${(p.colorTags ?? []).join(",").padEnd(26)} ${p.name.slice(0, 42).padEnd(44)} ${p.image ?? ""}`);
    }
  }

  if (fail) {
    console.error(`\n${fail} sorun.`);
    process.exit(1);
  }
  console.log("Tamam.");
}

main();
