#!/usr/bin/env node
/**
 * data/brand-styles.json denetimi: her aktif markanın bir tarzı var mı, dosyada
 * artık var olmayan bir slug kalmış mı, geçersiz tarz adı yazılmış mı.
 *
 * Not: brands.ts uzantısız import kullanıyor (bundler çözüyor, Node çözmüyor), o yüzden
 * marka listesi burada brand-names.json + slug.ts'ten kuruluyor — aynı kaynak, aynı sonuç.
 */
import { slugify, primaryName } from "../src/lib/slug.ts";
import { STYLES, brandStyles, brandStyleCounts, untaggedBrands } from "../src/lib/brand-styles.ts";
import NAMES from "../src/lib/brand-names.json" with { type: "json" };
import ARCHIVED from "../data/brands-archived.json" with { type: "json" };
import RAW from "../data/brand-styles.json" with { type: "json" };

const archived = new Set(Object.keys(ARCHIVED).filter((k) => !k.startsWith("_")));
const slugs = NAMES.map((n) => slugify(primaryName(n))).filter((s) => !archived.has(s));
const known = new Set(slugs);
const missing = untaggedBrands(slugs);
const orphan = Object.keys(RAW.tarzlar).filter((s) => !known.has(s));
const valid = new Set(STYLES.map((s) => s.k));
const bad = [];
for (const [slug, list] of Object.entries(RAW.tarzlar)) {
  for (const s of list) if (!valid.has(s)) bad.push(`${slug} -> ${s}`);
}

console.log(`aktif marka: ${slugs.length}  ·  tarzı olan: ${slugs.length - missing.length}`);
console.log("\ntarz dağılımı (marka sayısı):");
for (const [k, n] of Object.entries(brandStyleCounts())) console.log(`  ${k.padEnd(12)} ${n}`);
if (missing.length) console.log(`\nTARZI YOK (${missing.length}): ${missing.join(", ")}`);
if (orphan.length) console.log(`\nARTIK YOK OLAN SLUG (${orphan.length}): ${orphan.join(", ")}`);
if (bad.length) console.log(`\nGEÇERSİZ TARZ (${bad.length}): ${bad.join(", ")}`);
console.log("\nörnek: void ->", brandStyles("void").join(", "));
// `process.exit()` DEĞİL: Windows'ta stdout bir pipe'a bağlıyken (npm run),
// son `console.log`un yazımı bitmeden süreç kapatılınca libuv çöküyor
// ("Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)"). Denetim geçtiği
// hâlde `npm run check` zinciri bu yüzden kırılıyordu. `exitCode` ile süreç
// tamponu boşaltıp kendiliğinden çıkar.
process.exitCode = missing.length || orphan.length || bad.length ? 1 : 0;
