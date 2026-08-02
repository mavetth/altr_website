#!/usr/bin/env node
/**
 * YENİ MARKA EKLEME — tek elden.
 *
 * Marka eklemek beş dosyaya birden dokunuyor ve elle yapıldığında biri hep unutuluyor
 * (slug uyuşmazlığı `check-brand-styles` ile ancak sonradan yakalanıyor). Bu script
 * `data/new-brands.json` içindeki listeyi okuyup hepsini tutarlı yazar:
 *
 *   data/brands.csv              — ham keşif kaynağı (ad, tarz, url)
 *   src/lib/brand-names.json     — görünen adlar (roster'ın kendisi)
 *   src/lib/brands.generated.ts  — slug -> { url, platform }
 *   data/brand-styles.json       — slug -> tarz kovaları
 *   data/brand-scores.json       — slug -> editoryal puan (yoksa varsayılan 3.0)
 *
 * Zaten var olan slug ATLANIR (tekrar çalıştırmak güvenli).
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { slugify, primaryName } from "./scrape/brands.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APPLY = process.argv.includes("--uygula");

const list = JSON.parse(await readFile(join(ROOT, "data", "new-brands.json"), "utf8"));

const namesPath = join(ROOT, "src", "lib", "brand-names.json");
const genPath = join(ROOT, "src", "lib", "brands.generated.ts");
const stylesPath = join(ROOT, "data", "brand-styles.json");
const scoresPath = join(ROOT, "data", "brand-scores.json");
const csvPath = join(ROOT, "data", "brands.csv");

const names = JSON.parse(await readFile(namesPath, "utf8"));
const styles = JSON.parse(await readFile(stylesPath, "utf8"));
const scores = JSON.parse(await readFile(scoresPath, "utf8"));
const genSrc = await readFile(genPath, "utf8");
const csv = await readFile(csvPath, "utf8");

const gen = {};
for (const m of genSrc.matchAll(/"([^"]+)":\s*\{\s*url:\s*"([^"]+)",\s*platform:\s*"([^"]+)"/g))
  gen[m[1]] = { url: m[2], platform: m[3] };

const added = [];
const skipped = [];
for (const b of list) {
  const slug = slugify(primaryName(b.name));
  if (gen[slug] || names.includes(b.name)) { skipped.push(slug); continue; }
  names.push(b.name);
  gen[slug] = { url: b.url, platform: b.platform };
  if (b.styles?.length) styles.tarzlar[slug] = b.styles;
  if (b.score != null) scores.puanlar[slug] = b.score;
  added.push({ slug, ...b });
}

// brand-names.json alfabetik dursun (roster gözle okunuyor).
names.sort((a, b) => a.localeCompare(b, "tr"));

const genOut =
  genSrc.slice(0, genSrc.indexOf("export const GENERATED")) +
  "export const GENERATED: Record<string, { url: string; platform: Platform }> = {\n" +
  Object.keys(gen)
    .sort()
    .map((s) => `  "${s}": { url: "${gen[s].url}", platform: "${gen[s].platform}" },\n`)
    .join("") +
  "};\n";

const csvOut =
  csv.replace(/\n+$/, "") +
  "\n" +
  added.map((b) => `${b.name},${b.csvStyle ?? ""},${b.url}`).join("\n") +
  "\n";

if (APPLY) {
  await writeFile(namesPath, JSON.stringify(names, null, 2) + "\n", "utf8");
  await writeFile(genPath, genOut, "utf8");
  await writeFile(stylesPath, JSON.stringify(styles, null, 2) + "\n", "utf8");
  await writeFile(scoresPath, JSON.stringify(scores, null, 2) + "\n", "utf8");
  await writeFile(csvPath, csvOut, "utf8");
}

console.log(`${added.length} marka eklendi${APPLY ? "" : " (KURU ÇALIŞMA — yazmak için --uygula)"}`);
for (const b of added) console.log(`  ${b.slug.padEnd(24)} ${b.platform.padEnd(12)} ${b.url}`);
if (skipped.length) console.log(`zaten vardı (${skipped.length}): ${skipped.join(", ")}`);
console.log(`toplam marka: ${names.length}`);
