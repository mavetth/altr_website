/**
 * Mevcut logo dosyalarındaki `inv` bayrağını YENİDEN hesaplar (indirme yok).
 *
 * `scripts/lib/logo-tone.mjs` içindeki kural nihai webp'ye uygulanır ve
 * `src/lib/brand-logos.generated.ts` ile `public/brand-logos/manifest.json`
 * yerinde güncellenir. Değişenler ekrana yazılır.
 *
 * Kullanım: node scripts/fix-logo-inv.mjs [--dry]
 */
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { decideInvert } from "./lib/logo-tone.mjs";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry");

const genPath = join(root, "src", "lib", "brand-logos.generated.ts");
let gen = await readFile(genPath, "utf8");

const manPath = join(root, "public", "brand-logos", "manifest.json");
const manifest = await readFile(manPath, "utf8")
  .then(JSON.parse)
  .catch(() => null);

const changed = [];
for (const m of [...gen.matchAll(/^(\s*"([^"]+)":\s*\{[^}]*inv:\s*)(true|false)/gm)]) {
  const slug = m[2];
  const was = m[3] === "true";
  const now = await decideInvert(sharp, join(root, "public", "brand-logos", `${slug}.webp`)).catch(
    () => was,
  );
  if (now === was) continue;
  changed.push(`${slug}: ${was} -> ${now}`);
  gen = gen.replace(m[0], m[1] + (now ? "true" : "false"));
  if (manifest?.[slug]) manifest[slug].inv = now;
}

if (!DRY) {
  await writeFile(genPath, gen);
  if (manifest) await writeFile(manPath, `${JSON.stringify(manifest, null, 2)}\n`);
}
console.log(changed.join("\n"));
console.log(`\n${changed.length} logo düzeltildi${DRY ? " (kuru çalışma)" : ""}.`);
