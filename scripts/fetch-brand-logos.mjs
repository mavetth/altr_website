// Marka logolarını markaların kendi sitelerinden bir kez indirir, normalize eder ve
// `public/brand-logos/<slug>.webp` altına yazar; ardından `src/lib/brand-logos.generated.ts`
// manifestini üretir.
//
// Kullanım: node scripts/fetch-brand-logos.mjs [--only slug1,slug2] [--force]
//
// Neden build-time?  Çalışma anında marka sitesine gitmek her sayfa açılışında 100+
// istek demek olurdu. Logolar yılda bir değişir — statik varlık olarak kendi
// origin'imizden servis edilir, tarayıcı da sonsuza dek cache'ler.
//
// Ton (inv) alanı: logoların çoğu tek renk. Karanlık temada karanlık logo, aydınlık
// temada aydınlık logo görünmez olur; bu yüzden her logo için "karanlık temada ters
// çevrilmeli mi" bilgisini piksellerden hesaplayıp manifeste yazıyoruz (bkz. BrandLogo).

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decideInvert } from "./lib/logo-tone.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const OUT_DIR = join(projectRoot, "public", "brand-logos");
const MANIFEST = join(projectRoot, "src", "lib", "brand-logos.generated.ts");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const argv = process.argv.slice(2);
const FORCE = argv.includes("--force");
const DRY = argv.includes("--dry"); // indirmeden aday listesini ve puanlarını yaz
const onlyIdx = argv.indexOf("--only");
const ONLY = onlyIdx >= 0 ? new Set((argv[onlyIdx + 1] || "").split(",").filter(Boolean)) : null;

// Her logonun ölçüsü/tonu burada birikir; manifest bundan üretilir. Ton, indirme anında
// (kırpma öncesi görselden) hesaplandığı için diskteki kırpılmış dosyadan yeniden
// hesaplanamaz — bu yüzden kalıcı bir yan dosyada tutuluyor.
const META = join(projectRoot, "data", "brand-logos.meta.json");

const LOGO_H = 120; // normalize edilmiş yükseklik (px)
const LOGO_MAX_W = 640;
const CONCURRENCY = 6;
const TIMEOUT_MS = 15000;

// --- küçük yardımcılar ------------------------------------------------------

async function fetchWithTimeout(url, init = {}, ms = TIMEOUT_MS) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, {
      redirect: "follow",
      ...init,
      signal: ac.signal,
      headers: { "user-agent": UA, ...(init.headers || {}) },
    });
  } finally {
    clearTimeout(t);
  }
}

function attr(tag, name) {
  const m =
    tag.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i")) ||
    tag.match(new RegExp(`\\b${name}\\s*=\\s*'([^']*)'`, "i")) ||
    tag.match(new RegExp(`\\b${name}\\s*=\\s*([^\\s>]+)`, "i"));
  return m ? m[1].trim() : null;
}

function fromSrcset(v) {
  if (!v) return null;
  // en geniş adayı seç
  const parts = v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [u, d] = s.split(/\s+/);
      const w = d && d.endsWith("w") ? parseInt(d, 10) : 0;
      return { u, w };
    })
    .filter((x) => x.u);
  if (!parts.length) return null;
  parts.sort((a, b) => b.w - a.w);
  return parts[0].u;
}

function absolutize(u, base) {
  if (!u) return null;
  const s = u.trim().replace(/&amp;/g, "&");
  if (!s || s.startsWith("data:") || s.startsWith("#")) return null;
  try {
    return new URL(s, base).toString();
  } catch {
    return null;
  }
}

function sizeBonus(sizes) {
  if (!sizes) return 0;
  const n = parseInt(String(sizes).split("x")[0], 10);
  if (!Number.isFinite(n)) return 0;
  return Math.min(20, Math.round(n / 16));
}

/** JSON-LD ağacında Organization.logo / logo alanlarını topla. */
function collectJsonLdLogos(node, out) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const x of node) collectJsonLdLogos(x, out);
    return;
  }
  const logo = node.logo ?? node.image;
  if (typeof logo === "string") out.push(logo);
  else if (logo && typeof logo === "object") {
    if (typeof logo.url === "string") out.push(logo.url);
    else if (Array.isArray(logo) && typeof logo[0] === "string") out.push(logo[0]);
  }
  for (const k of Object.keys(node)) {
    if (k === "logo" || k === "image") continue;
    collectJsonLdLogos(node[k], out);
  }
}

// Ödeme/sosyal rozetleri, kampanya şeritleri: "logo" kelimesi geçse de logo değiller.
// Sözcük sınırlı: bu kalıp tüm <img> etiketine değil YALNIZCA görselin yoluna ve alt
// metnine uygulanır. (Etiketin tamamına uygulandığında Shopify'ın `classList.add(...)`
// inline script'indeki "ssL" gibi tesadüfi eşleşmeler gerçek logoyu eliyordu.)
const JUNK =
  /(?:^|[^a-z])(?:sprite|placeholder|payment|odeme|visa|mastercard|maestro|american_?express|amex|discover|troy|iyzico|paytr|paypal|ideallogo|instagram|facebook|tiktok|twitter|whatsapp|telegram|youtube|pinterest|sponsor|banner|logo[-_]?band|slider?|kampanya|badge|guvenli|güvenli|etbis|kargo|yurtici|hero)(?:[^a-z]|$)/i;
// NOT: `logo-band` yalnız TİRELİ hâli kapsıyordu; Shopify temaları dosyayı
// `logo_band_colored_1X.png` diye ALT ÇİZGİYLE yazıyor ve o bant tam olarak ödeme
// rozetleri şerididir — le-tual ve prev markalarında marka logosu diye o seçilmişti.
// `hero` da eklendi: mahalle-boy'un og:image'ı ana sayfa hero fotoğrafıydı.

/**
 * HTML'den logo adaylarını puanlarıyla çıkarır.
 *
 * Puanlama üç saf sinyalden gelir ve pratikte hepsine ihtiyaç var:
 *  - NEREDEN geldiği (header img > apple-touch-icon > JSON-LD > favicon > og:image),
 *  - NE KADAR BÜYÜK olduğu (32px'lik bir işaret neredeyse her zaman sponsor rozetidir),
 *  - DOSYA TÜRÜ (png/svg = şeffaf zeminli işaret, jpg = fotoğraf/kampanya görseli).
 * Bu üçlü olmadan Shopify temaları düzenli olarak yanlış görseli veriyor: duyuru
 * şeridindeki .jpg kampanya görselinin de class'ında "logo" geçiyor.
 */
function candidatesFrom(html, base, slug) {
  const out = [];
  const push = (u, score, kind, order = 1e9) => {
    const abs = absolutize(u, base);
    if (abs) out.push({ url: abs, score, kind, order });
  };
  const slugTokens = slug.split("-").filter((t) => t.length > 2);

  // 1) "logo" ipucu taşıyan <img> — genellikle header'daki wordmark
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/logo/i.test(tag)) continue;
    const src =
      fromSrcset(attr(tag, "srcset")) ||
      fromSrcset(attr(tag, "data-srcset")) ||
      attr(tag, "src") ||
      attr(tag, "data-src") ||
      attr(tag, "data-original");
    if (!src) continue;
    const path = src.split("?")[0].toLowerCase();
    if (JUNK.test(path) || JUNK.test(attr(tag, "alt") || "")) continue;

    // sinyalin gücü: class/id > dosya adı > yalnızca alt (ürün adında "logo" geçiyor olabilir)
    let score;
    if (/(?:class|id)\s*=\s*["'][^"']*logo/i.test(tag)) score = 100;
    else if (/logo/.test(path)) score = 95;
    else score = 35; // sadece alt="… Logo …" — zayıf, favicon'un bile altında

    const dw = parseInt(attr(tag, "width") || "0", 10) || 0;
    if (dw >= 48) score += Math.min(15, Math.floor(dw / 40));
    else if (dw > 0) score -= 25; // 32px'lik işaret = rozet

    if (/\.svg$/.test(path)) score += 8;
    else if (/\.png$/.test(path)) score += 8;
    else if (/\.(jpe?g)$/.test(path)) score -= 20; // fotoğraf, işaret değil
    if (slugTokens.some((t) => path.includes(t))) score += 12;

    push(src, score, "img", m.index);
  }

  // 2) apple-touch-icon / icon
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    const rel = (attr(tag, "rel") || "").toLowerCase();
    const href = attr(tag, "href");
    if (!href || JUNK.test(href)) continue;
    if (rel.includes("apple-touch-icon"))
      push(href, 80 + sizeBonus(attr(tag, "sizes")), "icon", m.index);
    else if (/\bicon\b|shortcut icon|mask-icon/.test(rel))
      push(href, 45 + sizeBonus(attr(tag, "sizes")), "icon", m.index);
  }

  // 3) JSON-LD Organization.logo
  for (const m of html.matchAll(
    /<script\b[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const found = [];
      collectJsonLdLogos(JSON.parse(m[1].trim()), found);
      for (const u of found.slice(0, 3)) push(u, 70, "jsonld");
    } catch {
      /* bozuk ld+json — atla */
    }
  }

  // 4) meta og:logo / og:image
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    const prop = (attr(tag, "property") || attr(tag, "name") || "").toLowerCase();
    const content = attr(tag, "content");
    if (!content) continue;
    if (prop === "og:logo") push(content, 75, "og");
    else if (prop === "og:image" || prop === "twitter:image") push(content, 30, "og");
  }

  // 5) klasik favicon yolu (hiçbir şey bulunamazsa)
  push("/favicon.ico", 10, "icon");

  // tekilleştir; puana göre, eşitlikte belgede önce geçene göre sırala
  const seen = new Set();
  return out
    .filter((c) => (seen.has(c.url) ? false : (seen.add(c.url), true)))
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, 12);
}

// --- görsel işleme ----------------------------------------------------------

let sharpMod = null;
async function getSharp() {
  sharpMod ??= (await import("sharp")).default;
  return sharpMod;
}

/**
 * Logonun karanlık temada ters çevrilmesi gerekip gerekmediğine piksellerden karar verir.
 * - Zemin opaksa (beyaz kutu içinde koyu işaret): zemin açıksa karanlık temada ters çevrilir.
 * - Zemin şeffafsa: işaretin kendisi koyuysa karanlık temada ters çevrilir.
 *
 * Zemin, dört köşeyle değil KENAR HALKASIYLA ölçülür: yuvarlatılmış köşeli ikonlarda
 * (ör. apple-touch-icon) köşeler şeffaf olduğu için dört köşe ölçümü "şeffaf zemin"
 * yanılgısına düşüyor ve beyaz kutulu logolar karanlık temada beyaz blok gibi kalıyordu.
 */
async function analyzeTone(sharp, buf) {
  const img = sharp(buf).resize({ width: 64, height: 64, fit: "inside" }).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: ch } = info;
  const lumAt = (o) => (0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]) / 255;

  let markSum = 0;
  let markN = 0;
  for (let i = 0; i < W * H; i++) {
    const o = i * ch;
    if (data[o + 3] > 128) {
      markSum += lumAt(o);
      markN++;
    }
  }

  // 2px kalınlığında kenar halkası
  const ring = [];
  let ringOpaque = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (x > 1 && x < W - 2 && y > 1 && y < H - 2) continue;
      const o = (y * W + x) * ch;
      if (data[o + 3] > 128) {
        ring.push(lumAt(o));
        ringOpaque++;
      } else ring.push(null);
    }
  }
  const ringRatio = ring.length ? ringOpaque / ring.length : 0;

  const meanMark = markN ? markSum / markN : 0.5;
  let inv;
  let solid = false;
  if (ringRatio > 0.6) {
    // dolu zeminli görsel: zemin tonu = kenar halkasının medyanı
    const vals = ring.filter((v) => v != null).sort((a, b) => a - b);
    inv = vals[Math.floor(vals.length / 2)] > 0.5;
    solid = true;
  } else {
    // şeffaf zeminli işaret: işaret koyuysa karanlık temada ters çevir
    inv = meanMark < 0.5;
  }

  // Güvenlik ağı: kenar halkası "koyu zemin" dediği hâlde görselin tamamı zaten koyuysa
  // (ör. şeffaf üstünde siyah bloklardan oluşan piksel-art wordmark), karanlık sayfada
  // hiç görünmez. Böyle bir logoyu yine de ters çevir.
  if (!inv && meanMark < 0.28) inv = true;

  return { inv, solid };
}

/**
 * ZEMİN TEMİZLEME — logonun arkasındaki DÜZ kutuyu şeffaflaştırır.
 *
 * Marka siteleri logoyu çoğu zaman beyaz (bazen siyah) bir dikdörtgenin içine gömülü
 * PNG/JPG olarak servis ediyor. `trim()` yalnız kenardaki FAZLA boşluğu kesiyor, kutunun
 * kendisi kalıyordu: karanlık vitrinde bir düzine marka, logosu yerine parlak beyaz bir
 * blok olarak duruyordu (after-6, aperith, deer-wear, drip-house, gatso, giowear,
 * hype-cult, looza-style, lost-mind-studios, void, voyant…).
 *
 * Yöntem KENARDAN TAŞMA (flood fill), "şu rengi her yerden sil" değil: yalnız görselin
 * kenarına DEĞEN ve tohum renkten `TOL` kadar sapmayan bölge silinir. Fark önemli —
 * harflerin içindeki beyaz (ör. "O"nun göbeği kapalıysa) ya da işaretin ortasındaki
 * beyaz vurgu kenara değmediği için korunur.
 *
 * Yalnız NÖTR ve UÇ tonlarda çalışır (çok açık ya da çok koyu, doygunluğu düşük):
 * cordelia'nın kırmızı kutusu, cucire'nin lacivert kutusu, alt-kultur'un yeşili logonun
 * KENDİSİ — onlara dokunulmaz. `data/brand-logo-overrides.json` içindeki `_zemin_koru`
 * listesi ayrıca elle muafiyet verir.
 */
/**
 * İki eşik, çünkü zemin ile işaret arasında KENAR YUMUŞATMA bandı var.
 *
 * Tek eşikle (yalnız BG_TOL) çalıştırıldı ve sonuç ölçüldü: kutu kalkıyor ama harflerin
 * çevresinde 1-2 piksellik yarı-zemin renkli bir halka kalıyor. Karanlık temada beyaz
 * kutudan arta kalan o halka harflerin etrafında tırtıklı bir hâle olarak görünüyordu
 * (eilul-archives, god-heals, void, wes-wear…). Bandı da çözmek gerekiyor:
 *
 *   uzaklık ≤ BG_TOL          → tam zemin, alfa 0
 *   BG_TOL < uzaklık ≤ BG_MAX → karışım bandı, alfa oranla açılır VE rengin içindeki
 *                               zemin payı geri çıkarılır (un-premultiply), yoksa
 *                               yarı saydam gri bir gölge kalıyor
 *   uzaklık > BG_MAX          → işaretin kendisi, dokunulmaz (taşma da burada durur)
 *
 * Alt eşik SABİT DEĞİL: bazı markalar logoyu hafif GRADYANLI (ya da JPG gürültülü) bir
 * kutunun içinde veriyor — drip-house'ta zemin 200 ile 255 arasında geziniyor ve sabit
 * 26'lık bir toleransla taşma birkaç pikselde ölüyor, kutu olduğu gibi kalıyordu.
 * Eşik, kenar halkasının KENDİ yayılımından türetiliyor.
 */
const BG_TOL_MIN = 26; // kanal başına "bu piksel düpedüz zemin" taban toleransı (0-255)
const BG_BAND = 78; // tolerans ile "artık işarettir" sınırı arasındaki karışım bandı

async function stripFlatBackground(sharp, buf) {
  const { data, info } = await sharp(buf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: ch } = info;
  if (ch !== 4) return null;

  // Tohum: kenar piksellerinin ortanca rengi. Tek bir köşe yeterli değil — köşesi
  // yuvarlatılmış ikonlarda köşe şeffaf, kenarın ortası dolu.
  const edge = [];
  for (let x = 0; x < W; x++) {
    for (const y of [0, H - 1]) edge.push((y * W + x) * 4);
  }
  for (let y = 0; y < H; y++) {
    for (const x of [0, W - 1]) edge.push((y * W + x) * 4);
  }
  const opaque = edge.filter((o) => data[o + 3] > 200);
  if (opaque.length / edge.length < 0.6) return null; // zaten şeffaf zeminli

  const med = (i) => {
    const v = opaque.map((o) => data[o + i]).sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)];
  };
  const seed = [med(0), med(1), med(2)];
  const lum = (0.2126 * seed[0] + 0.7152 * seed[1] + 0.0722 * seed[2]) / 255;
  const sat = (Math.max(...seed) - Math.min(...seed)) / 255;
  // Renkli bir zemin logonun parçasıdır; yalnız nötr uçları temizle.
  if (sat > 0.12) return null;
  if (lum < 0.88 && lum > 0.1) return null;

  // Kenar halkasının kendi yayılımı: gradyanlı/gürültülü zeminde tolerans büyümeli.
  // %10-%90 yüzdelikleri kullanılıyor — tek bir aykırı piksel eşiği şişirmesin.
  const band = (i) => {
    const v = opaque.map((o) => data[o + i]).sort((a, b) => a - b);
    return v[Math.floor(v.length * 0.9)] - v[Math.floor(v.length * 0.1)];
  };
  const spread = Math.max(band(0), band(1), band(2));

  /** Verilen toleransla kenardan taşır; kaç piksel tamamen silindiğini döndürür. */
  function flood(px, tol) {
    const max = tol + BG_BAND;
    const seen = new Uint8Array(W * H);
    const stack = [];
    let cleared = 0;
    const push = (x, y) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const p = y * W + x;
      if (seen[p]) return;
      seen[p] = 1;
      const o = p * 4;
      if (px[o + 3] < 40) {
        stack.push(p); // zaten şeffaf: komşularına devam et
        return;
      }
      const d = Math.max(
        Math.abs(px[o] - seed[0]),
        Math.abs(px[o + 1] - seed[1]),
        Math.abs(px[o + 2] - seed[2]),
      );
      if (d > max) return; // işaretin kendisi: taşma burada durur

      if (d <= tol) {
        px[o + 3] = 0;
        cleared++;
      } else {
        // Karışım bandı: yalnız ALFA oranlanır, renge dokunulmaz.
        // Denendi ve VAZGEÇİLDİ: rengi "un-premultiply" ile geri kazanmak (piksel =
        // a·işaret + (1-a)·zemin denklemini işaret için çözmek) teoride doğru ama
        // pratikte JPG kaynaklarda patlıyor — a küçükken bölme gürültüyü büyütüyor ve
        // harflerin çevresinde PARLAK bir çerçeve çıkıyordu (emorpi, gatso, void'de
        // ölçüldü). Alfayı azaltmak tek başına yumuşak, doğru görünen kenar veriyor.
        px[o + 3] = Math.round(px[o + 3] * ((d - tol) / (max - tol)));
      }
      stack.push(p);
    };
    for (let x = 0; x < W; x++) {
      push(x, 0);
      push(x, H - 1);
    }
    for (let y = 0; y < H; y++) {
      push(0, y);
      push(W - 1, y);
    }
    while (stack.length) {
      const p = stack.pop();
      const x = p % W;
      const y = (p - x) / W;
      push(x - 1, y);
      push(x + 1, y);
      push(x, y - 1);
      push(x, y + 1);
    }
    return cleared;
  }

  const total = W * H;
  let px = Buffer.from(data);
  let cleared = flood(px, Math.min(70, Math.max(BG_TOL_MIN, spread + 12)));

  // İKİNCİ DENEME — kutu duruyorsa daha cömert bir toleransla tekrar.
  // Neden gerekli: bazı markalar logoyu hafif GRADYANLI ya da JPG gürültülü bir kutunun
  // içinde veriyor (drip-house, deer-wear, norv). Kenar halkasından ölçülen yayılım
  // kutunun İÇİNDEKİ değişimi göremiyor: halka düz görünüyor, tolerans küçük çıkıyor ve
  // taşma birkaç piksel sonra ölüyor — kutu olduğu gibi kalıyordu. "Kenar dolu ama
  // neredeyse hiçbir şey silinmedi" tam olarak bu durumun imzası.
  if (cleared < total * 0.15) {
    const retry = Buffer.from(data);
    const c2 = flood(retry, 96);
    if (c2 > cleared && c2 < total * 0.97) {
      px = retry;
      cleared = c2;
    }
  }

  // Hiç silinmediyse ortada temizlenecek bir zemin yokmuş.
  if (cleared < total * 0.02) return null;
  // Neredeyse her şeyi sildiysek yanlış bir şey yapmışız (düz renkli görsel) — geri al.
  if (cleared > total * 0.97) return null;

  return sharp(px, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
}

/** Adayı indirip normalize edilmiş webp'ye çevirir; uygun değilse null. */
async function tryCandidate(sharp, url, referer, keepBg = false) {
  let res;
  try {
    res = await fetchWithTimeout(url, {
      headers: { referer, accept: "image/avif,image/webp,image/*,*/*" },
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (ct && !ct.startsWith("image/") && !ct.includes("svg") && !ct.includes("octet-stream"))
    return null;

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength < 200 || buf.byteLength > 8 * 1024 * 1024) return null;

  let meta;
  try {
    // SVG'yi yüksek yoğunlukta rasterleştir ki büyütünce bulanıklaşmasın
    meta = await sharp(buf, { density: 384 }).metadata();
  } catch {
    return null;
  }
  const w = meta.width || 0;
  const h = meta.height || 0;
  if (w < 40 || h < 20) return null; // 1x1 piksel / bozuk favicon
  if (w / h > 14 || h / w > 6) return null; // şerit/banner değil, logo istiyoruz

  const resized = sharp(buf, { density: 384 }).resize({
    height: LOGO_H,
    width: LOGO_MAX_W,
    fit: "inside",
    withoutEnlargement: false,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });

  // Ton analizi KIRPMADAN ÖNCE yapılır: trim() zemin boşluğunu kestiği için kırpılmış
  // görselin kenar halkası artık zemini değil işaretin kendisini örnekler — beyaz
  // harfli/siyah kutulu bir logo o zaman "açık zemin" sanılıp ters çevriliyordu.
  const pre = await resized.clone().png().toBuffer();
  const tone = await analyzeTone(sharp, pre).catch(() => ({ inv: false, solid: false }));

  // Düz kutu zemini varsa şeffaflaştır, sonra trim(): kutu kalktığı için trim artık
  // işaretin gerçek sınırına kadar kırpıyor ve logo kendi ölçüsünde yerleşiyor.
  const stripped = keepBg ? null : await stripFlatBackground(sharp, pre).catch(() => null);
  const base = stripped ? sharp(stripped) : resized;

  const out = await base
    .trim({ threshold: 6 })
    .webp({ quality: 92, alphaQuality: 100 })
    .toBuffer({ resolveWithObject: true })
    .catch(() => null);
  if (!out) return null;

  // Invert kararı HER ZAMAN nihai dosyadan verilir (bkz. scripts/lib/logo-tone.mjs).
  // Ara ölçümler (kırpma/zemin temizliği öncesi) yanıltıyordu: trim() sonrası kenar
  // halkası zemini değil işaretin kendisini örneklediği için kalın wordmark'lar
  // "açık zeminli" sanılıp ters çevriliyor, karanlık sayfada beyaz slab çıkıyordu.
  const inv = await decideInvert(sharp, out.data).catch(() => tone.inv);

  return {
    buf: out.data,
    w: out.info.width,
    h: out.info.height,
    inv,
    solid: stripped ? false : tone.solid,
  };
}

// --- ana akış ---------------------------------------------------------------

async function loadBrands() {
  // brands.generated.ts'i TS import etmeden okumak için kaba ama yeterli bir ayrıştırma:
  // her satır  "slug": { url: "…", platform: "…" },
  const src = await readFile(join(projectRoot, "src", "lib", "brands.generated.ts"), "utf8");
  const out = [];
  for (const m of src.matchAll(/"([^"]+)":\s*\{\s*url:\s*"([^"]+)"/g)) {
    out.push({ slug: m[1], url: m[2] });
  }
  return out;
}

async function fetchHtml(url) {
  try {
    const res = await fetchWithTimeout(url, {
      headers: { accept: "text/html,application/xhtml+xml" },
    });
    return res.ok ? await res.text() : "";
  } catch {
    return ""; // ana sayfa alınamadı — yine de /favicon.ico denenecek
  }
}

async function processBrand(b, existing, overrides) {
  if (!FORCE && existing.has(b.slug)) return { slug: b.slug, skipped: true };
  const sharp = await getSharp();
  const referer = `${new URL(b.url).origin}/`;
  // zemini logonun parçası olan markalar (bkz. stripFlatBackground)
  const keepBg = (overrides._zemin_koru ?? []).includes(b.slug);

  // elle düzeltme: otomatik seçim yanlış görseli yakaladıysa data/brand-logo-overrides.json
  const ov = overrides[b.slug];
  // null = "bu markada kullanılabilir logo yok" — otomatik seçim ürün fotoğrafı/kategori
  // döşemesi getirdiğinde yanlış logo göstermektense yazıya düşmek daha doğru.
  if (ov === null) return { slug: b.slug, failed: true, reason: "override:skip" };
  if (ov) {
    const got = await tryCandidate(sharp, absolutize(ov, b.url), referer, keepBg);
    if (got) {
      await writeFile(join(OUT_DIR, `${b.slug}.webp`), got.buf);
      return { slug: b.slug, ...got, via: "override", from: ov };
    }
    console.log(`  ! ${b.slug}: override URL kullanılamadı, otomatik seçime dönülüyor`);
  }

  const html = await fetchHtml(b.url);
  for (const c of candidatesFrom(html, b.url, b.slug)) {
    const got = await tryCandidate(sharp, c.url, referer, keepBg);
    if (got) {
      await writeFile(join(OUT_DIR, `${b.slug}.webp`), got.buf);
      return { slug: b.slug, ...got, via: c.kind, from: c.url };
    }
  }
  return { slug: b.slug, failed: true };
}

/** --dry: hiçbir şey indirmeden aday sıralamasını yazdırır (yanlış logo seçimini teşhis için). */
async function dryRun(brands) {
  for (const b of brands) {
    const html = await fetchHtml(b.url);
    console.log(`\n${b.slug}  (${b.url})`);
    for (const c of candidatesFrom(html, b.url, b.slug).slice(0, 6)) {
      console.log(`   ${String(c.score).padStart(4)}  ${c.kind.padEnd(7)} ${c.url}`);
    }
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const brands = (await loadBrands()).filter((b) => !ONLY || ONLY.has(b.slug));

  if (DRY) return dryRun(brands);

  const files = await readdir(OUT_DIR).catch(() => []);
  const existing = new Set(files.filter((f) => f.endsWith(".webp")).map((f) => f.slice(0, -5)));
  // --force ELDEKİNİ SİLMEZ, yalnız üzerine yazar. Eskiden başta topluca siliyordu ve
  // ağdaki geçici bir aksaklık (marka sitesi o an cevap vermedi, hız sınırına takıldı)
  // ÇALIŞAN bir logoyu kalıcı olarak yok ediyordu: yenisi bulunamıyor, eskisi de artık
  // yok. Ölçüldü — tek turda 4 marka bu şekilde kayboldu, hepsi tek tek yeniden
  // çalıştırılınca sorunsuz geldi. Başarısız deneme artık hiçbir şeyi bozmuyor.

  const overrides = await readFile(join(projectRoot, "data", "brand-logo-overrides.json"), "utf8")
    .then((s) => JSON.parse(s))
    .catch(() => ({}));
  // önceki çalıştırmalardan biriken ölçü/ton bilgisi
  const meta = await readFile(META, "utf8")
    .then((s) => JSON.parse(s))
    .catch(() => ({}));

  console.log(`${brands.length} marka için logo aranıyor…`);

  const results = [];
  let i = 0;
  async function worker() {
    for (;;) {
      const b = brands[i++];
      if (!b) return;
      try {
        const r = await processBrand(b, FORCE ? new Set() : existing, overrides);
        results.push(r);
        const tag = r.skipped ? "atlandı" : r.failed ? "BULUNAMADI" : `${r.w}x${r.h} ${r.via}`;
        console.log(`  ${String(results.length).padStart(3)}/${brands.length} ${b.slug} — ${tag}`);
      } catch (e) {
        results.push({ slug: b.slug, failed: true });
        console.log(`  ${b.slug} — HATA: ${e.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  for (const r of results) {
    if (r.failed || r.skipped) continue;
    meta[r.slug] = { w: r.w, h: r.h, inv: r.inv, solid: r.solid, via: r.via, from: r.from };
  }

  // manifeste yalnızca diskte dosyası olan markalar girer
  const onDisk = (await readdir(OUT_DIR)).filter((f) => f.endsWith(".webp")).map((f) => f.slice(0, -5));
  const sharp = await getSharp();
  for (const slug of onDisk) {
    if (meta[slug]) continue;
    // meta'sı olmayan eski dosya: ölçüyü diskten al, tonu kabaca tahmin et
    const buf = await readFile(join(OUT_DIR, `${slug}.webp`));
    const m = await sharp(buf).metadata();
    const inv = await decideInvert(sharp, buf).catch(() => false);
    meta[slug] = { w: m.width, h: m.height, inv, via: "disk" };
  }
  await writeFile(META, `${JSON.stringify(meta, null, 2)}\n`, "utf8");

  const rows = onDisk
    .map((slug) => ({ slug, ...meta[slug] }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
  const body = rows
    .map(
      (r) =>
        `  "${r.slug}": { w: ${r.w}, h: ${r.h}, inv: ${r.inv ? "true" : "false"} },`,
    )
    .join("\n");

  await writeFile(
    MANIFEST,
    `// Bu dosya \`npm run fetch-logos\` tarafından ÜRETİLDİ — elle düzenleme.
// slug -> logonun boyutu ve "karanlık temada ters çevrilsin mi" bilgisi.
// Dosyanın kendisi: /brand-logos/<slug>.webp
export interface BrandLogoMeta {
  /** normalize edilmiş genişlik (px) */
  w: number;
  /** normalize edilmiş yükseklik (px) */
  h: number;
  /** true ise logo karanlık temada invert edilmeli (koyu işaret / açık zemin) */
  inv: boolean;
}

export const BRAND_LOGOS: Record<string, BrandLogoMeta> = {
${body}
};
`,
    "utf8",
  );

  const found = results.filter((r) => !r.failed && !r.skipped).length;
  const failed = results.filter((r) => r.failed);
  console.log(`\nyeni indirilen: ${found}   toplam manifest: ${rows.length}`);
  if (failed.length) console.log(`bulunamayan (${failed.length}): ${failed.map((f) => f.slug).join(", ")}`);
}

main().catch((e) => {
  console.error("HATA:", e);
  process.exit(1);
});
