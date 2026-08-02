#!/usr/bin/env node
/**
 * Marka keşif script'i.
 *
 * brand-names.json'daki her marka için aday domain'ler üretir, internetten probe eder:
 *   1) <origin>/products.json  -> geçerli Shopify feed'i mi? (yüksek güven)
 *   2) değilse ana sayfa 200 + başlık/og:site_name marka adını içeriyor mu? -> jsonld adayı
 * Sonuçları src/lib/brands.generated.ts'e yazar. Yeniden çalıştırılabilir.
 *
 * Kullanım: node scripts/discover-brands.mjs [--limit N] [--only slug1,slug2]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const NAMES = JSON.parse(readFileSync(join(ROOT, "src/lib/brand-names.json"), "utf8"));

const argv = process.argv.slice(2);
const getArg = (k) => {
  const i = argv.indexOf(k);
  return i >= 0 ? argv[i + 1] : undefined;
};
const LIMIT = Number(getArg("--limit") ?? NAMES.length);
const ONLY = (getArg("--only") ?? "").split(",").filter(Boolean);

const TR_MAP = { ç:"c",Ç:"c",ğ:"g",Ğ:"g",ı:"i",İ:"i",ö:"o",Ö:"o",ş:"s",Ş:"s",ü:"u",Ü:"u",â:"a",î:"i",û:"u" };
function slugify(s) {
  return s.split("").map((c) => TR_MAP[c] ?? c).join("")
    .toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/['’`]/g, "").replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
const primaryName = (n) => n.split("/")[0].trim();

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function fetchT(url, { timeout = 7000, accept = "*/*" } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "User-Agent": UA, Accept: accept, "Accept-Language": "tr,en;q=0.8" },
    });
  } finally {
    clearTimeout(t);
  }
}

function candidates(name) {
  const base = slugify(primaryName(name));
  const compact = base.replace(/-/g, "");
  const slugs = [...new Set([base, compact])].filter(Boolean);
  const tlds = ["com", "com.tr", "co"];
  const out = [];
  for (const s of slugs) for (const t of tlds) out.push(`https://${s}.${t}`);
  return out;
}

async function probeShopify(origin) {
  try {
    const res = await fetchT(`${origin}/products.json?limit=1`, { accept: "application/json" });
    if (!res.ok) return false;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("json")) return false;
    const data = await res.json();
    return Array.isArray(data?.products);
  } catch {
    return false;
  }
}

async function probeHomepageMatch(origin, name) {
  try {
    const res = await fetchT(origin, { accept: "text/html" });
    if (!res.ok) return false;
    const html = (await res.text()).slice(0, 200000).toLowerCase();
    const token = slugify(primaryName(name)).replace(/-/g, "");
    const title = (/<title>([^<]*)<\/title>/i.exec(html)?.[1] ?? "").replace(/[^a-z0-9]/g, "");
    const site = (/og:site_name["'][^>]+content=["']([^"']+)/i.exec(html)?.[1] ?? "").replace(/[^a-z0-9]/g, "");
    const hasProductLd = html.includes("application/ld+json") && html.includes('"product"');
    const nameMatch = token.length >= 4 && (title.includes(token) || site.includes(token));
    return nameMatch && hasProductLd;
  } catch {
    return false;
  }
}

async function discover(name) {
  const slug = slugify(primaryName(name));
  for (const origin of candidates(name)) {
    if (await probeShopify(origin)) return { slug, url: origin, platform: "shopify" };
  }
  // shopify yoksa: sadece güçlü isim eşleşmesi + ürün ld+json olan ana sayfayı jsonld say
  for (const origin of candidates(name).slice(0, 2)) {
    if (await probeHomepageMatch(origin, name)) return { slug, url: origin, platform: "jsonld" };
  }
  return { slug, url: null, platform: "none" };
}

async function pool(items, size, fn) {
  const ret = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        ret[idx] = await fn(items[idx], idx);
      }
    }),
  );
  return ret;
}

async function main() {
  let list = NAMES.slice(0, LIMIT);
  if (ONLY.length) list = NAMES.filter((n) => ONLY.includes(slugify(primaryName(n))));

  console.log(`[discover] ${list.length} marka taranıyor…`);
  let done = 0;
  const results = await pool(list, 8, async (name) => {
    const r = await discover(name);
    done++;
    if (r.platform !== "none") console.log(`  ✓ ${name} -> ${r.url} [${r.platform}]`);
    if (done % 20 === 0) console.log(`  … ${done}/${list.length}`);
    return { name, ...r };
  });

  const found = results.filter((r) => r.platform !== "none");
  // mevcut generated'ı koru (elle eklenenler / geçici probe hatasında kaybolmasın),
  // yeni bulunanları üzerine birleştir
  const entries = {};
  try {
    const cur = readFileSync(join(ROOT, "src/lib/brands.generated.ts"), "utf8");
    for (const m of cur.matchAll(/"([^"]+)": \{ url: "([^"]+)", platform: "([^"]+)" \}/g)) {
      entries[m[1]] = { url: m[2], platform: m[3] };
    }
  } catch {
    /* ilk çalıştırma: mevcut dosya yok */
  }
  for (const r of found) entries[r.slug] = { url: r.url, platform: r.platform };

  const lines = Object.keys(entries)
    .sort()
    .map((slug) => `  ${JSON.stringify(slug)}: { url: ${JSON.stringify(entries[slug].url)}, platform: ${JSON.stringify(entries[slug].platform)} },`);

  const out = `import type { Platform } from "./types";

// Bu dosya \`npm run discover\` tarafından ÜRETİLDİ. Elle de düzenleyebilirsin.
// slug -> { url (origin), platform }.
export const GENERATED: Record<string, { url: string; platform: Platform }> = {
${lines.join("\n")}
};
`;
  writeFileSync(join(ROOT, "src/lib/brands.generated.ts"), out, "utf8");

  const shopify = found.filter((r) => r.platform === "shopify").length;
  const jsonld = found.filter((r) => r.platform === "jsonld").length;
  console.log(`\n[discover] bitti. ${found.length}/${list.length} çözüldü (shopify: ${shopify}, jsonld: ${jsonld}).`);
  console.log("[discover] src/lib/brands.generated.ts güncellendi.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
