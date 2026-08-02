#!/usr/bin/env node
/**
 * MARKA TEŞHİSİ — her markayı canlı yoklar ve "neden çekilemiyor"un cevabını verir.
 *
 * Kullanım:
 *   node scripts/audit-brands.mjs [--only slug1,slug2] [--concurrency 6]
 * Çıktı: data/brand-audit.json  +  konsolda özet tablo
 *
 * Her marka için sırayla:
 *  1) site ayakta mı (DNS/HTTP/yönlendirme/park domain)
 *  2) hangi platform (Shopify / WooCommerce / İkas / Ticimax / T-Soft / IdeaSoft / bilinmiyor)
 *  3) yapılandırılmış ürün API'si var mı ve kaç ürün veriyor
 *  4) sitemap'ten kaç ürün URL'i çıkıyor
 *  5) örnek bir üründe fiyat / beden / renk / görsel / para birimi çıkarılabiliyor mu
 *
 * Böylece "veri eksik" şikayeti üç ayrı kova haline gelir: SİTE ÖLÜ, PLATFORM YANLIŞ
 * TESPİT EDİLMİŞ, ya da VERİ SAYFADA JS İLE GELİYOR (statik HTML'de yok).
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT = join(ROOT, "data", "brand-audit.json");

const argv = process.argv.slice(2);
const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const ONLY = (arg("--only") ?? "").split(",").filter(Boolean);
const CONCURRENCY = Number(arg("--concurrency") ?? 6);

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Çerez kavanozu: bazı TR siteleri çerez verip yönlendiriyor, saklanmazsa sonsuz döngü.
const JAR = new Map();
function jarFor(url) {
  const h = new URL(url).hostname.replace(/^www\./, "");
  let m = JAR.get(h);
  if (!m) { m = new Map(); JAR.set(h, m); }
  return m;
}

async function fetchT(url, accept = "text/html", referer, timeout = 20000) {
  let current = url;
  const trail = [];
  try {
    for (let i = 0; i <= 8; i++) {
      const jar = jarFor(current);
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), timeout);
      let res;
      try {
        res = await fetch(current, {
          redirect: "manual",
          signal: c.signal,
          headers: {
            "User-Agent": UA,
            Accept: accept,
            "Accept-Language": "tr,en;q=0.8",
            ...(jar.size ? { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") } : {}),
            ...(referer ? { Referer: referer } : {}),
          },
        });
      } finally { clearTimeout(t); }
      for (const line of res.headers.getSetCookie?.() ?? []) {
        const pair = line.split(";")[0];
        const idx = pair.indexOf("=");
        if (idx > 0) jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
      }
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return { res, trail };
        current = new URL(loc, current).toString();
        trail.push(current);
        continue;
      }
      return { res, trail, finalUrl: current };
    }
    return { res: null, trail, err: "too many redirects" };
  } catch (e) {
    return { res: null, trail, err: e?.cause?.code || e?.name || String(e?.message || e) };
  }
}

/** Ana sayfa HTML'inden altyapıyı tanı. */
function detectPlatform(html, headers) {
  const h = (headers?.get?.("x-powered-by") ?? "") + " " + (headers?.get?.("server") ?? "");
  const hay = html.slice(0, 400000);
  const hits = [];
  if (/cdn\.shopify\.com|Shopify\.theme|shopify-features/i.test(hay)) hits.push("shopify");
  if (/wp-content|wp-json|woocommerce/i.test(hay)) hits.push("woocommerce");
  if (/myikas\.com|ikas\.app|__IKAS|cdn\.myikas/i.test(hay)) hits.push("ikas");
  if (/ticimax|static\.ticimax\.cloud|productDetailModel/i.test(hay)) hits.push("ticimax");
  if (/tsoft|tsoftcdn/i.test(hay)) hits.push("tsoft");
  if (/ideasoft|idealsoft|\/srv\/ideasoft/i.test(hay + h)) hits.push("ideasoft");
  if (/platformcdn|projesoft/i.test(hay)) hits.push("platform");
  if (/shopier/i.test(hay)) hits.push("shopier");
  return hits;
}

/** Park/kapanmış domain mi? */
function looksParked(html, title) {
  return (
    /alan\s*ad[ıi].*sat[ıi]l[ıi]k|domain (?:is )?for sale|this domain|parked|bu alan ad[ıi]|sedo|godaddy|hostinger.*park/i.test(
      title + " " + html.slice(0, 4000),
    ) || html.length < 800
  );
}

const isXml = (u) => { try { return new URL(u).pathname.toLowerCase().endsWith(".xml"); } catch { return u.endsWith(".xml"); } };
const EXCLUDE_PATH =
  /(kategori|category|koleksiyon|collection|\/blog|sayfa\/|hakkimizda|\/about|iletisim|\/contact|kampanya|\/cart|sepet|\bgiris\b|\blogin\b|\bkayit\b|register|\bsss\b|\bfaq\b|kvkk|gizlilik|mesafeli|iade|degisim|sozlesme|politika|aydinlatma|hesabim|uye-|uyelik|favori|magazalar|subeler|kariyer|cerez)/i;
const INCLUDE_PATH = /\/(product|products|urun|p)\//i;
const bare = (h) => h.toLowerCase().replace(/^www\./, "");

function urlBlocks(xml) {
  const out = [];
  for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)) {
    const loc = /<loc>(?:<!\[CDATA\[)?([^<\]]+)/i.exec(m[1])?.[1]?.trim();
    if (loc) out.push({ loc, img: /<image:image>/i.test(m[1]) });
  }
  if (out.length) return out;
  return [...xml.matchAll(/<loc>(?:<!\[CDATA\[)?([^<\]]+)/gi)].map((m) => ({ loc: m[1].trim(), img: false }));
}

async function sitemapProducts(origin, cap = 400) {
  const urls = [];
  const seen = new Set();
  const deadline = Date.now() + 45000;
  let rootsTried = 0;
  async function read(sm, depth, parentProd) {
    if (depth > 2 || urls.length >= cap || Date.now() > deadline) return;
    const { res } = await fetchT(sm, "application/xml,text/xml,*/*", origin, 20000);
    if (!res || !res.ok) return;
    const xml = await res.text();
    const blocks = urlBlocks(xml);
    const subs = blocks.map((b) => b.loc).filter(isXml);
    if (subs.length && depth < 2) {
      for (const s of subs.slice(0, 25)) {
        if (urls.length >= cap || Date.now() > deadline) break;
        await read(s, depth + 1, /product|urun|shop|magaza|katalog/i.test(s));
      }
    }
    for (const b of blocks) {
      if (urls.length >= cap) break;
      if (isXml(b.loc) || seen.has(b.loc) || EXCLUDE_PATH.test(b.loc)) continue;
      let flat = false;
      try {
        const u = new URL(b.loc);
        flat = bare(u.hostname) === bare(new URL(origin).hostname) &&
          u.pathname.split("/").filter(Boolean).length === 1 &&
          u.pathname.split("/").filter(Boolean)[0]?.length > 3;
      } catch { /* geçersiz url */ }
      if (INCLUDE_PATH.test(b.loc) || b.img || parentProd || flat) { seen.add(b.loc); urls.push(b.loc); }
    }
  }
  const roots = [];
  const { res: rb } = await fetchT(`${origin}/robots.txt`, "text/plain", origin, 15000);
  if (rb?.ok) {
    const txt = await rb.text();
    for (const m of txt.matchAll(/^\s*sitemap:\s*(\S+)/gim)) roots.push(m[1].trim());
  }
  roots.push(`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`, `${origin}/wp-sitemap.xml`);
  for (const r of [...new Set(roots)]) {
    if (urls.length || Date.now() > deadline) break;
    rootsTried++;
    await read(r, 0, false);
  }
  return { urls, rootsTried };
}

function ldBlocks(html) {
  const out = [];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const p = JSON.parse(m[1].trim());
      if (Array.isArray(p)) out.push(...p);
      else if (p && Array.isArray(p["@graph"])) out.push(...p["@graph"]);
      else out.push(p);
    } catch { /* bozuk */ }
  }
  return out;
}
const productNode = (bs) => bs.find((b) => (Array.isArray(b?.["@type"]) ? b["@type"] : [b?.["@type"]]).includes("Product")) ?? null;
const meta = (html, p) => new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]+content=["']([^"']+)["']`, "i").exec(html)?.[1] ?? null;
const SIZE_HINT = /beden|size|numara|\bus\b|\beu\b|\buk\b/i;
const SIZE_TOKEN = /^(xxs|xs|s|m|l|xl|xxl|xxxl|2xl|3xl|4xl)$/i;

/** Örnek ürün sayfasında hangi alanlar STATİK HTML'den çıkarılabiliyor? */
function probeProductPage(html) {
  const node = productNode(ldBlocks(html));
  const offers = node?.offers;
  const first = Array.isArray(offers) ? offers[0] : offers;
  const price = first?.price ?? first?.lowPrice ?? node?.price ?? meta(html, "product:price:amount");
  const currency = first?.priceCurrency ?? meta(html, "product:price:currency") ?? null;

  let sizeSelect = false;
  for (const m of html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)) {
    if (SIZE_HINT.test(m[1])) { sizeSelect = true; break; }
  }
  let sizeButton = false;
  for (const m of html.matchAll(/<(?:button|label|li|span|a|div)\b[^>]*>\s*([A-Za-z0-9]{1,4})\s*<\/(?:button|label|li|span|a|div)>/gi)) {
    if (SIZE_TOKEN.test(m[1].trim())) { sizeButton = true; break; }
  }
  const sizeInLd = Boolean(
    node?.size ||
      (Array.isArray(node?.hasVariant) && node.hasVariant.some((v) => v?.size)) ||
      (Array.isArray(node?.additionalProperty) && node.additionalProperty.some((p) => SIZE_HINT.test(String(p?.name ?? "")))),
  );

  return {
    jsonld: Boolean(node),
    ogType: (meta(html, "og:type") ?? "").toLowerCase() || null,
    price: price != null ? String(price) : null,
    currency: currency ? String(currency) : null,
    color: Boolean(node?.color || (Array.isArray(node?.additionalProperty) && node.additionalProperty.some((p) => /renk|color/i.test(String(p?.name ?? ""))))),
    sizeInLd,
    sizeSelect,
    sizeButton,
    image: Boolean(meta(html, "og:image") || node?.image),
    ticimaxModel: /productDetailModel/.test(html),
    ikasState: /__IKAS|window\.__NEXT_DATA__/.test(html),
  };
}

async function auditBrand(b) {
  const r = { slug: b.slug, name: b.name, url: b.url, platformKayitli: b.platform };

  // 1) site ayakta mı
  const { res, err, finalUrl, trail } = await fetchT(b.url, "text/html", undefined, 20000);
  if (!res) { r.durum = "ULAŞILAMIYOR"; r.hata = err; return r; }
  r.http = res.status;
  if (!res.ok) { r.durum = `HTTP ${res.status}`; return r; }
  const html = await res.text();
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? "";
  r.baslik = title.slice(0, 70);
  r.sonUrl = finalUrl && bare(new URL(finalUrl).hostname) !== bare(new URL(b.url).hostname) ? finalUrl : undefined;
  if (trail?.length) r.yonlendirme = trail.length;
  if (looksParked(html, title)) { r.durum = "PARK/KAPALI"; return r; }

  // 2) platform tespiti
  r.platformTespit = detectPlatform(html, res.headers);

  // 3) yapılandırılmış API
  const origin = new URL(b.url).origin;
  if (r.platformTespit.includes("shopify") || b.platform === "shopify") {
    const { res: sr } = await fetchT(`${origin}/products.json?limit=250&page=1`, "application/json", b.url, 20000);
    if (sr?.ok) {
      try {
        const j = await sr.json();
        r.shopifyApi = Array.isArray(j?.products) ? j.products.length : 0;
      } catch { r.shopifyApi = "json parse hatası"; }
    } else r.shopifyApi = sr ? `HTTP ${sr.status}` : "yok";
  }
  if (r.platformTespit.includes("woocommerce") || b.platform === "woocommerce") {
    const { res: wr } = await fetchT(`${origin}/wp-json/wc/store/v1/products?per_page=100&page=1`, "application/json", b.url, 20000);
    if (wr?.ok) {
      try { const j = await wr.json(); r.wooApi = Array.isArray(j) ? j.length : 0; } catch { r.wooApi = "json parse hatası"; }
    } else r.wooApi = wr ? `HTTP ${wr.status}` : "yok";
  }

  // 4) sitemap
  const { urls, rootsTried } = await sitemapProducts(origin);
  r.sitemapUrunUrl = urls.length;
  r.sitemapKokDenendi = rootsTried;

  // 5) örnek ürün sayfası
  const sample = urls[Math.min(3, urls.length - 1)];
  if (sample) {
    r.ornekUrun = sample;
    const { res: pr } = await fetchT(sample, "text/html", b.url, 20000);
    if (pr?.ok) r.ornek = probeProductPage(await pr.text());
    else r.ornek = { hata: pr ? `HTTP ${pr.status}` : "ulaşılamadı" };
  }

  r.durum = "CANLI";
  return r;
}

async function main() {
  const gen = await readFile(join(ROOT, "src", "lib", "brands.generated.ts"), "utf8");
  const names = JSON.parse(await readFile(join(ROOT, "src", "lib", "brand-names.json"), "utf8"));
  const G = {};
  for (const m of gen.matchAll(/"([^"]+)":\s*\{\s*url:\s*"([^"]+)",\s*platform:\s*"([^"]+)"/g))
    G[m[1]] = { url: m[2], platform: m[3] };

  // slug -> görünen ad
  const slugOf = (n) =>
    n.split("/")[0].trim().split("").map((c) => ({ ç: "c", Ç: "c", ğ: "g", Ğ: "g", ı: "i", İ: "i", ö: "o", Ö: "o", ş: "s", Ş: "s", ü: "u", Ü: "u" }[c] ?? c)).join("")
      .toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/['’`]/g, "").replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  let brands = names
    .map((n) => ({ name: n, slug: slugOf(n) }))
    .map((b) => ({ ...b, url: G[b.slug]?.url ?? null, platform: G[b.slug]?.platform ?? "none" }))
    .filter((b) => b.url);
  if (ONLY.length) brands = brands.filter((b) => ONLY.includes(b.slug));

  console.log(`${brands.length} marka yoklanıyor (eşzamanlılık ${CONCURRENCY})…\n`);
  const results = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (;;) {
        const b = brands[i++];
        if (!b) return;
        let r;
        try { r = await auditBrand(b); }
        catch (e) { r = { slug: b.slug, name: b.name, url: b.url, durum: "HATA", hata: String(e?.message || e) }; }
        results.push(r);
        const tag =
          r.durum === "CANLI"
            ? `${(r.platformTespit ?? []).join("+") || "?"} | api:${r.shopifyApi ?? r.wooApi ?? "-"} | sitemap:${r.sitemapUrunUrl}`
            : `${r.durum}${r.hata ? " (" + r.hata + ")" : ""}`;
        console.log(`  ${String(results.length).padStart(3)}/${brands.length} ${b.slug.padEnd(24)} ${tag}`);
        await sleep(80);
      }
    }),
  );

  results.sort((a, b) => a.slug.localeCompare(b.slug));
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(results, null, 2), "utf8");
  console.log(`\nyazıldı: ${OUT}`);
}

main().catch((e) => { console.error("HATA:", e); process.exit(1); });
