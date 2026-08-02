/**
 * LOGO ZEMİN DENETİMİ — zemin temizliğinin BOZDUĞU logoları bulur.
 *
 * `stripFlatBackground` kenardan taşarak beyaz kutuyu siliyor; ama taşma harflerin
 * İÇİNE giremiyor (kapalı gözler: O, A, D, B…) ve kutunun harf aralarında kalan,
 * kenara değmeyen adacıkları da duruyor. Sonuç: koyu işaret + arta kalan beyaz
 * lekeler. Karanlık temada bu logo invert ediliyor (işaret beyazlaşıyor) ve o beyaz
 * kalıntılar SİYAH lekelere dönüyor — harflerin içi delik görünüyor (void, abluka).
 *
 * Ölçüt: opak piksellerin hem AÇIK (lum>.82) hem KOYU (lum<.3) tarafında ciddi kütle
 * varsa logo tek tonlu değildir; invert bunlardan yalnız birini doğru çevirebilir.
 * Böyle logoların zemini hiç kaldırılmamalı (`_zemin_koru`), kutu olduğu gibi kalsın.
 *
 * Kullanım: node scripts/audit-logo-bg.mjs
 */
import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "public", "brand-logos");

const rows = [];
for (const f of (await readdir(dir)).filter((f) => f.endsWith(".webp"))) {
  const { data, info } = await sharp(await readFile(join(dir, f)))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let opaque = 0;
  let light = 0;
  let dark = 0;
  for (let o = 0; o < data.length; o += 4) {
    if (data[o + 3] < 160) continue;
    opaque++;
    const l = (0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]) / 255;
    if (l > 0.82) light++;
    else if (l < 0.3) dark++;
  }
  if (!opaque) continue;
  const total = info.width * info.height;
  rows.push({
    slug: f.replace(/\.webp$/, ""),
    // kutu duruyor mu: opak piksel oranı (kutulu logoda ~1)
    fill: opaque / total,
    light: light / opaque,
    dark: dark / opaque,
  });
}

// Karışık tonlu (hem beyaz hem siyah kütlesi olan) logolar — invert bunları çözemez.
const bad = rows
  .filter((r) => Math.min(r.light, r.dark) > 0.12)
  .sort((a, b) => Math.min(b.light, b.dark) - Math.min(a.light, a.dark));

for (const r of bad) {
  console.log(
    `${r.slug.padEnd(28)} açık=${(r.light * 100).toFixed(0).padStart(3)}%  koyu=${(r.dark * 100)
      .toFixed(0)
      .padStart(3)}%  dolu=${(r.fill * 100).toFixed(0)}%`,
  );
}
console.log(`\n${bad.length} / ${rows.length} logo karışık tonlu.`);
console.log(JSON.stringify(bad.map((r) => r.slug)));
