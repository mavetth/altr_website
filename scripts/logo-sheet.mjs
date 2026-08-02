/**
 * Logoları KARANLIK zeminde, sitedeki invert kuralıyla birlikte tek bir sayfada dizer —
 * "gece modunda gerçekte ne görünüyor" sorusunun tek bakışta cevabı.
 *
 * Kullanım: node scripts/logo-sheet.mjs [slug,slug,...] > çıktı scratch'e yazılır
 */
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "public", "brand-logos");
const OUT = process.env.SHEET_OUT || join(root, "logo-sheet.png");

// generated dosyayı TS import etmeden okumak için satır satır ayrıştırma
const META = {};
for (const m of (
  await readFile(join(root, "src", "lib", "brand-logos.generated.ts"), "utf8")
).matchAll(/"([^"]+)":\s*\{[^}]*inv:\s*(true|false)/g)) {
  META[m[1]] = { inv: m[2] === "true" };
}

const arg = process.argv[2];
const slugs = arg
  ? arg.split(",")
  : (await readdir(dir)).filter((f) => f.endsWith(".webp")).map((f) => f.slice(0, -5));

const CELL_W = 300;
const CELL_H = 90;
const COLS = 4;
const rows = Math.ceil(slugs.length / COLS);
const comps = [];

for (let i = 0; i < slugs.length; i++) {
  const slug = slugs[i];
  let img = sharp(await readFile(join(dir, `${slug}.webp`))).ensureAlpha();
  // sitedeki kural: karanlık temada inv=1 olan logolar ters çevrilir
  if (META[slug]?.inv) {
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    for (let o = 0; o < data.length; o += 4) {
      data[o] = 255 - data[o];
      data[o + 1] = 255 - data[o + 1];
      data[o + 2] = 255 - data[o + 2];
    }
    img = sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
  }
  const buf = await img
    .resize({ width: CELL_W - 20, height: CELL_H - 26, fit: "inside" })
    .png()
    .toBuffer();
  const m = await sharp(buf).metadata();
  comps.push({
    input: buf,
    left: (i % COLS) * CELL_W + 10,
    top: Math.floor(i / COLS) * CELL_H + 10 + Math.round((CELL_H - 26 - m.height) / 2),
  });
  comps.push({
    input: Buffer.from(
      `<svg width="${CELL_W}" height="16"><text x="4" y="12" font-family="monospace" font-size="11" fill="#888">${slug}</text></svg>`,
    ),
    left: (i % COLS) * CELL_W,
    top: Math.floor(i / COLS) * CELL_H + CELL_H - 16,
  });
}

await sharp({
  create: {
    width: COLS * CELL_W,
    height: rows * CELL_H,
    channels: 4,
    background: { r: 12, g: 12, b: 12, alpha: 1 },
  },
})
  .composite(comps)
  .png()
  .toBuffer()
  .then((b) => writeFile(OUT, b));
console.log(OUT);
