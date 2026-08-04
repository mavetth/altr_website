// GENEL FALLBACK adaptörü — sitemap + ürün sayfası (JSON-LD / OpenGraph).
// Ticimax, T-Soft ve platformu tanınmayan siteler buradan çekilir.
//
// Ticimax için özel bir kısayol var: ham HTML'de `productDetailModel` JSON'u tam varyant
// verisini (beden, beden bazlı stok, renk, renk görseli) taşıyor. Onsuz bu sitelerde
// beden/renk hemen hemen hiç çıkmıyor, çünkü seçiciler JS ile kuruluyor.

import { get, getText, mapLimit, num, sleep, uniq } from "../fetch.mjs";
import {
  normalizeSizes,
  knownSizes,
  looksLikeSizeValues,
  sizeKind,
  SIZE_NAME_HINT,
} from "../../../src/lib/sizes.ts";

const EXCLUDE_PATH =
  /(kategori|category|koleksiyon|collection|\/blog|sayfa\/|hakkimizda|\/about|iletisim|\/contact|kampanya|\/cart|sepet|\bgiris\b|\blogin\b|\bkayit\b|register|\bsss\b|\bfaq\b|kvkk|gizlilik|mesafeli|iade|degisim|sozlesme|politika|aydinlatma|hesabim|uye-|uyelik|favori|magazalar|subeler|kariyer|cerez)/i;
const INCLUDE_PATH = /\/(product|products|urun|p)\//i;
// Beden sözlüğü siteyle tek kopya (src/lib/sizes.ts). Buradaki eski yerel regex
// "Medium"/"S-M"/"35-38"/"TEK BOYUT" gibi değerleri eliyordu.
const SIZE_HINT = SIZE_NAME_HINT;
const bare = (h) => h.toLowerCase().replace(/^www\./, "");
const isXml = (u) => {
  try { return new URL(u).pathname.toLowerCase().endsWith(".xml"); } catch { return u.endsWith(".xml"); }
};
const dec = (s) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#3?9;|&#x27;/g, "'");
const abs = (base, u) => { try { return new URL(u, base).toString(); } catch { return u; } };

/**
 * Görsel adayı gerçekten bir ADRES mi?
 *
 * Mağazalar og:image alanına bazen URL yerine düz metin yazıyor. flawwears.com'da
 * her ürün sayfasının og:image'ı `https://www.flawwears.com/FLAW PANTOLON` —
 * yani bir yer tutucu. `abs()` bunu sorunsuzca çözüp geçerli görünen bir adres
 * (…/FLAW%20PANTOLON) üretiyor, kayıt kataloga giriyor ve hiçbir zaman açılmıyor.
 *
 * Kural iki kademeli, çünkü tek başına "boşluk varsa at" YANLIŞ eliyor: Shout'un
 * (o da jsonld adaptörü) 19 gerçek görselinin dosya adında boşluk var
 * ("…/1080/boring 8 ball.webp", kaynaktan 200 dönüyor).
 *   1. Yol bilinen bir görsel uzantısıyla bitiyorsa: KABUL — boşluk olsa bile,
 *      çünkü uzantı zaten dosya olduğunun kanıtı.
 *   2. Uzantı yoksa (birçok CDN uzantısız yol verir) boşluk aranır: yer tutucu
 *      metinlerde neredeyse her zaman var, gerçek uzantısız CDN adreslerinde yok.
 *
 * abs()'TEN ÖNCE çalışmalı: sonrasında boşluk %20'ye dönüşüp iz kaybolur.
 */
const GORSEL_UZANTI = /\.(jpe?g|png|webp|gif|avif|heic|heif|bmp|tiff?)(?:[?#]|$)/i;
function gorselAdayi(u) {
  if (typeof u !== "string") return false;
  const s = u.trim();
  if (!s) return false;
  if (GORSEL_UZANTI.test(s.split(/[?#]/)[0])) return true;
  return !/\s/.test(s);
}

function urlBlocks(xml) {
  const out = [];
  for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)) {
    const loc = /<loc>(?:<!\[CDATA\[)?([^<\]]+)/i.exec(m[1])?.[1]?.trim();
    if (loc) out.push({ loc, img: /<image:image>/i.test(m[1]) });
  }
  if (out.length) return out;
  return [...xml.matchAll(/<loc>(?:<!\[CDATA\[)?([^<\]]+)/gi)].map((m) => ({ loc: m[1].trim(), img: false }));
}

/**
 * Sitemap'lerden ürün sayfası adaylarını toplar.
 *
 * `budgetMs` ÖLÇÜLDÜ ve büyütüldü: 90 sn, sitemap'i onlarca parçaya bölen büyük Ticimax
 * mağazalarında (kostebek, sokak-butik, nomarc) indeksin ortasında kesiyordu — marka
 * "çekildi" görünüp katalogda binlerce ürün eksik kalıyordu. Sınıra takılan tarama
 * sessizce yarım kalmasın diye çağıran tarafa da bildiriliyor (bkz. fetchJsonLd notu).
 */
export async function sitemapProductUrls(origin, cap = 3000, budgetMs = 420000) {
  const urls = [];
  const seen = new Set();
  const deadline = Date.now() + budgetMs;

  async function read(sm, depth, parentProd) {
    if (depth > 2 || urls.length >= cap || Date.now() > deadline) return;
    const xml = await getText(sm, { accept: "application/xml,text/xml,*/*", referer: origin });
    if (!xml) return;
    const blocks = urlBlocks(xml);
    const subs = blocks.map((b) => b.loc).filter(isXml);
    if (subs.length && depth < 2) {
      for (const s of subs) {
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
        const segs = u.pathname.split("/").filter(Boolean);
        flat = bare(u.hostname) === bare(new URL(origin).hostname) && segs.length === 1 && segs[0].length > 3;
      } catch { /* geçersiz */ }
      if (INCLUDE_PATH.test(b.loc) || b.img || parentProd || flat) {
        seen.add(b.loc);
        urls.push(b.loc);
      }
    }
  }

  const roots = [];
  const robots = await getText(`${origin}/robots.txt`, { accept: "text/plain", tries: 2 });
  if (robots) for (const m of robots.matchAll(/^\s*sitemap:\s*(\S+)/gim)) roots.push(m[1].trim());
  roots.push(`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`, `${origin}/wp-sitemap.xml`);
  for (const r of uniq(roots)) {
    if (urls.length || Date.now() > deadline) break;
    await read(r, 0, false);
  }
  return urls.slice(0, cap);
}

function ldBlocks(html) {
  const out = [];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const p = JSON.parse(m[1].trim());
      if (Array.isArray(p)) out.push(...p);
      else if (p && Array.isArray(p["@graph"])) out.push(...p["@graph"]);
      else out.push(p);
    } catch { /* bozuk ld+json */ }
  }
  return out;
}
const isProduct = (n) =>
  n && typeof n === "object" && (Array.isArray(n["@type"]) ? n["@type"] : [n["@type"]]).includes("Product");

/**
 * JSON-LD ağacında Product düğümünü arar. Yalnızca ÜST seviyeye bakmak yetmiyor: bazı
 * temalar Product'ı `mainEntity`/`itemListElement`/`isPartOf` gibi alanların içine
 * gömüyor ve o sayfalar "ürün değil" sanılıp tamamen atlanıyordu.
 */
function productNode(blocks, depth = 0) {
  for (const b of blocks) {
    if (isProduct(b)) return b;
  }
  if (depth > 3) return null;
  const nested = [];
  for (const b of blocks) {
    if (!b || typeof b !== "object") continue;
    for (const v of Object.values(b)) {
      if (Array.isArray(v)) nested.push(...v.filter((x) => x && typeof x === "object"));
      else if (v && typeof v === "object") nested.push(v);
    }
  }
  return nested.length ? productNode(nested, depth + 1) : null;
}
const meta = (html, p) =>
  new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]+content=["']([^"']+)["']`, "i").exec(html)?.[1] ?? null;

function nodeImgs(node) {
  const img = node?.image;
  if (!img) return [];
  if (typeof img === "string") return [img];
  if (Array.isArray(img)) return img.map((i) => (typeof i === "string" ? i : i?.url)).filter(Boolean);
  return img?.url ? [img.url] : [];
}
function ogImages(html) {
  const out = [];
  for (const m of html.matchAll(/<meta[^>]+(?:property|name)=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/gi))
    out.push(dec(m[1]));
  return out;
}

/**
 * Sayfaya GÖMÜLÜ seçenek JSON'undan beden çıkarır.
 *
 * Sebep: Wix mağazalarında (the-mets-co, 1076 kayıt, bedenli 0) beden ne JSON-LD'de
 * ne de bir `<select>`te duruyor — sayfanın içindeki bir JS string'inde, kaçışlı
 * JSON olarak yaşıyor:
 *   \"title\":\"Beden\",\"selections\":[{\"value\":\"S\"},{\"value\":\"M\"},…]
 * Aynı kalıp (selections/values/choices/options dizisi) başka SPA temalarında da var,
 * o yüzden çözüm platforma değil KALIBA bağlandı.
 *
 * Kaçışlı ve kaçışsız yazımın ikisi de eşleşir; dizi adı beden çağrıştırmasa bile
 * DEĞERLER beden gibi duruyorsa kabul edilir (bkz. looksLikeSizeValues).
 */
function embeddedOptionSizes(html) {
  const out = [];
  const heads = /\\?"(selections|values|choices|options|sizes)\\?"\s*:\s*\[/gi;
  const field = /\\?"(?:value|name|description|title|label)\\?"\s*:\s*\\?"([^"\\]{1,24})\\?"/gi;
  for (const h of html.matchAll(heads)) {
    // Dizinin sonunu aramak yerine sabit bir pencere: 40 bedenlik bir liste bile
    // bu pencereye sığar, kapanış parantezini saymanın maliyeti ise sayfa başına
    // yüz binlerce karakter olabiliyor.
    const win = html.slice(h.index, h.index + 4000);
    // Dizinin ADI beden çağrıştırıyorsa başlıktan hemen ÖNCEKİ bağlam da ipucudur
    const before = html.slice(Math.max(0, h.index - 120), h.index);
    const vals = [];
    for (const f of win.matchAll(field)) {
      const v = dec(f[1]).trim();
      if (v && !vals.includes(v)) vals.push(v);
      if (vals.length >= 40) break;
    }
    if (!vals.length) continue;
    if (looksLikeSizeValues(vals) || (SIZE_HINT.test(before) && vals.some((v) => knownSizes(v).length)))
      out.push(...knownSizes(vals));
  }
  return out;
}

function sizesFrom(node, html) {
  const out = [];
  const push = (v) => { if (v != null) out.push(String(v).trim()); };
  if (node) {
    push(node.size);
    for (const v of Array.isArray(node.hasVariant) ? node.hasVariant : []) push(v?.size);
    for (const o of Array.isArray(node.offers) ? node.offers : node.offers ? [node.offers] : []) push(o?.size);
    for (const p of Array.isArray(node.additionalProperty) ? node.additionalProperty : [])
      if (p?.name && SIZE_HINT.test(String(p.name))) push(p.value);
  }
  // <select>: ADI beden demese de SEÇENEKLERİ beden gibi duruyorsa kabul edilir —
  // "Boyut"/"Ölçü" adlı seçiciler eskiden buradan da kaçıyordu.
  for (const m of html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)) {
    const opts = [...m[2].matchAll(/<option\b[^>]*>([\s\S]*?)<\/option>/gi)]
      .map((o) => dec(o[1].replace(/<[^>]+>/g, "").trim()))
      .filter(Boolean);
    if (!opts.length) continue;
    if (SIZE_HINT.test(m[1]) || looksLikeSizeValues(opts)) out.push(...knownSizes(opts));
  }
  // Beden düğmeleri: kısa metinli tek tek elemanlar. Burası SAF TAHMİN — sayfadaki
  // herhangi bir kısa etiket eşleşebilir — o yüzden yalnız HARFLİ merdiven jetonları
  // kabul edilir. Sayıya izin verilseydi sayfalama bağları ("12", "13") beden olurdu.
  for (const m of html.matchAll(/<(?:button|label|li|span|a|div)\b[^>]*>\s*([A-Za-z]{1,5})\s*<\/(?:button|label|li|span|a|div)>/gi))
    for (const t of knownSizes(m[1].trim())) if (sizeKind(t) === "alpha") out.push(t);

  out.push(...embeddedOptionSizes(html));
  return normalizeSizes(out).slice(0, 20);
}

const IN_STOCK_RE = /instock|in_stock|limitedavailability|preorder/i;

/**
 * JSON-LD alanını BÜYÜK/KÜÇÜK HARF GÖZETMEDEN okur.
 *
 * schema.org alan adları sözleşme gereği küçük harfle başlar (`offers`, `availability`)
 * ve adaptör onları birebir arıyordu. Wix mağazaları bu sözleşmeyi tutmuyor: kozmosize
 * .com'da blok `"Offers": { …, "Availability": "https://schema.org/OutOfStock" }` diye
 * geliyor. Sonuç sessizdi — `node.offers` undefined, dolayısıyla stok sinyali "yok"
 * sayılıp ürün varsayılan olarak STOKTA kabul ediliyordu: markanın 557 ürününün %100'ü,
 * tükenmişler dahil, satın alınabilir görünüyordu.
 */
function alan(obj, ...adlar) {
  if (!obj || typeof obj !== "object") return undefined;
  for (const ad of adlar) {
    if (obj[ad] !== undefined) return obj[ad];
    const hit = Object.keys(obj).find((k) => k.toLowerCase() === ad.toLowerCase());
    if (hit) return obj[hit];
  }
  return undefined;
}

/**
 * JSON-LD teklifinden MÜŞTERİNİN ÖDEDİĞİ fiyat.
 *
 * `offers` bir dizi olabiliyor (varyant başına bir teklif). Eskiden körlemesine ilki
 * alınıyordu; bu, temanın sıralamasına göre keyfî bir varyantın fiyatıydı. Artık önce
 * SATIN ALINABİLİR tekliflerin en düşüğü denenir — tükenmiş bir bedenin fiyatı kartta
 * görünmesin; hiçbiri alınabilir değilse tüm tekliflerin en düşüğü.
 *
 * schema.org'da `price` zaten geçerli satış fiyatıdır; indirimin eski hâli ayrı bir
 * `priceSpecification` alanındadır ve ona bilerek bakmıyoruz.
 */
function offerPrice(offers, node) {
  const list = (Array.isArray(offers) ? offers : [offers]).filter(Boolean);
  const pick = (rows) => {
    const ps = rows.map((o) => num(alan(o, "price", "lowPrice"))).filter((n) => n != null && n > 0);
    return ps.length ? Math.min(...ps) : null;
  };
  const live = list.filter((o) => IN_STOCK_RE.test(String(alan(o, "availability") ?? "")));
  return pick(live) ?? pick(list) ?? num(alan(node, "price"));
}

/** Ticimax: `productDetailModel` JSON'undan tam varyant verisi. */
function ticimaxModel(html) {
  const i = html.indexOf("productDetailModel");
  if (i < 0) return null;
  const start = html.indexOf("{", i);
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let j = start; j < html.length && j - start < 500000; j++) {
    const ch = html[j];
    if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') { inStr = true; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) { try { return JSON.parse(html.slice(start, j + 1)); } catch { return null; } } }
  }
  return null;
}

/**
 * Kayıtları HTML'den KOPARIR.
 *
 * V8, `slice`/regex yakalaması gibi işlemlerde "dilim string" üretir: yeni string kendi
 * baytlarını taşımaz, KAYNAK metni işaret eder. Yani ürün adı gibi 40 karakterlik bir
 * alan, geldiği 475 KB'lık sayfayı bellekte canlı tutabiliyor. 6000 sayfalık bir markada
 * (kostebek) bu birkaç GB'a çıkıyor ve scraper `Reached heap limit` ile ölüyordu —
 * ölçüldü, 3 GB heap yetmedi.
 *
 * JSON turu her string'i yeniden yazarak bağı koparır. Maliyeti kayıtların boyutuyla
 * orantılı (küçük); kazancı sayfanın tamamının çöpe gidebilmesi.
 */
function detach(recs) {
  return recs.length ? JSON.parse(JSON.stringify(recs)) : recs;
}

/**
 * Ticimax mağazasının GÖSTERDİĞİ fiyat.
 *
 * Bazı Ticimax temaları hiç JSON-LD basmıyor (ölçüldü: mattwear.com.tr'de
 * `application/ld+json` bloğu 0, `product:price:amount` metası da yok). O mağazalarda
 * `offerPrice` boş dönüyordu ve marka kataloğa TAMAMEN FİYATSIZ giriyordu —
 * kostebek 9.274, fo4rbs 2.099, matt-wear 350, diddy-studios 203 ürün.
 *
 * `productDetailModel`'de fiyat iki biçimde var: sayısal alanlar KDV HARİÇ
 * (`productPrice: 1317.2727`), gösterim alanları ise vitrindeki hâli
 * (`productPriceStr: "1449"`, `product.indirimliFiyatiStr: "₺1.449,00"`). Kullanıcının
 * kuralı "üründe kaç TL yazıyorsa bizde de o" olduğu için gösterim alanları öncelikli;
 * indirimli alan 0 ise satış fiyatına düşülür. KDV hariç sayısal alan en son çare.
 */
function ticimaxPrice(model) {
  if (!model) return null;
  const p = model.product ?? {};
  const cands = [
    model.productPriceStr, model.productPriceKDVIncluded,
    p.indirimliFiyatiStr, p.urunFiyatiOrjinalStr, p.satisFiyatiStr,
    model.productPrice, p.indirimliFiyati, p.satisFiyati,
  ];
  for (const c of cands) {
    const v = num(c);
    if (v != null && v > 0) return v;
  }
  return null;
}

/**
 * Ticimax mağazasının GERÇEK stok durumu.
 *
 * Bu ADAPTÖRÜN EN BÜYÜK SESSİZ YANLIŞIYDI (2026-08-04). Stok tek kaynaktan, JSON-LD'nin
 * ilk teklifindeki `availability` alanından okunuyordu; o alan yoksa `inStock` KÖRLEMESİNE
 * `true` kabul ediliyordu. Ticimax temalarının bir kısmı hiç JSON-LD basmıyor (ölçüldü:
 * kostebek.com.tr'de `application/ld+json` bloğu 0) — yani o mağazaların TAMAMI, tükenmiş
 * ürünler dahil, katalogda "stokta" görünüyordu. Ölçüm: kostebek 7.190, nuugg 2.014,
 * fo4rbs 1.126, the-mets-co 797, kozmosize 557, matt-wear 305 ürünün %100'ü stoktaydı.
 * Somut örnek: "Tokalı Kargo Cepli Kot Pantolon" — sayfadaki altı bedenin altısı da
 * `stokAdedi: 0`, `totalStockAmount: 0`, ama vitrinde satın alınabilir görünüyordu.
 *
 * Oysa doğru veri hep oradaydı: `productDetailModel` beden başına GERÇEK stok adedi
 * (`stokAdedi`) taşıyor ve beden seçenekleri için zaten okunuyordu (bkz. `buyable`) —
 * yalnız ürün düzeyindeki karara hiç bağlanmamıştı.
 *
 * Sıra: kapalı ürün → beden satırları → toplam stok. Model stok hakkında hiçbir şey
 * söylemiyorsa `null` döner ve karar eskisi gibi JSON-LD'ye kalır.
 */
function ticimaxStock(model) {
  if (!model) return null;
  if (model.productActive === false) return false;
  const p = model.product ?? {};
  if (p.aktif === false) return false;

  const vd = Array.isArray(model.productVariantData) ? model.productVariantData : [];
  const rows = vd.filter((v) => v && v.stokAdedi != null);
  if (rows.length) return rows.some((v) => v.aktif !== false && Number(v.stokAdedi) > 0);

  // Varyantsız (tek seçenekli) ürün: stok yalnız ürün düzeyinde duruyor.
  const total = num(model.totalStockAmount ?? p.stokAdedi);
  return total == null ? null : total > 0;
}

function pageRecords(brand, pageUrl, html) {
  const node = productNode(ldBlocks(html));
  const name = (node?.name ?? meta(html, "og:title"))?.toString().trim();
  const rawImgs = uniq([...(node ? nodeImgs(node) : []), ...ogImages(html)].filter(gorselAdayi));
  if (!name || !rawImgs.length) return [];

  const model = ticimaxModel(html);
  const offers = alan(node, "offers");
  const first = Array.isArray(offers) ? offers[0] : offers;
  const price = offerPrice(offers, node)
    ?? num(meta(html, "product:price:amount"))
    ?? ticimaxPrice(model);
  const ogType = (meta(html, "og:type") ?? "").toLowerCase();
  // ÜRÜN SİNYALİ ŞART: yoksa bu bir ana sayfa/hakkımızda olabilir (yalnız logo og:image'ı
  // olan sayfalar sahte ürün üretiyordu).
  if (!node && ogType !== "product" && ogType !== "product.item" && price == null) return [];

  const images = rawImgs.map((u) => abs(pageUrl, u)).slice(0, 5);
  const currency = String(
    alan(first, "priceCurrency") ?? meta(html, "product:price:currency") ?? "TRY",
  ).toUpperCase();
  // Stok: mağazanın KENDİ verisi (Ticimax `productDetailModel`) her zaman hakemdir;
  // yoksa JSON-LD teklifi; o da yoksa "stokta" (bkz. ticimaxStock).
  const avail = String(alan(first, "availability") ?? "").toLowerCase();
  const inStock =
    ticimaxStock(model) ?? (avail ? avail.includes("instock") || avail.includes("in_stock") : true);
  const base = {
    brand: brand.name,
    brandSlug: brand.slug,
    displayName: name.slice(0, 140),
    sourceText: [node?.category, ...(Array.isArray(node?.keywords) ? node.keywords : [node?.keywords])]
      .filter(Boolean).join(" "),
    currency,
    productUrl: pageUrl,
    day: 20,
    pop: 50,
  };

  // Ticimax: renk başına ayrı kayıt + beden listesi
  const vd = model?.productVariantData;
  if (Array.isArray(vd) && vd.length) {
    const typeOf = (v) => String(v?.ekSecenekTipiTanim ?? "");
    const isColorType = (v) => /renk|color/i.test(typeOf(v));
    // Seçenek tipinin ADI "Boyut"/"Ölçü" olabiliyor; renk olmayan her seçeneği aday
    // sayıp değerlerine bakmak ada bakmaktan daha güvenilir.
    // Ticimax seçenek satırları beden başına GERÇEK stok adedi taşıyor (`stokAdedi`) ve
    // bu bilgi hiç okunmuyordu — tükenmiş bedenler de listeye giriyordu. Shopify/İkas ile
    // aynı kural: satın alınabilir beden varsa yalnız onlar, hiç yoksa (ürün tamamen
    // tükenmişse) beden aralığı yine görünsün diye hepsi.
    const buyable = (v) => v?.aktif !== false && Number(v?.stokAdedi ?? 0) > 0;
    const sizeRows = vd.filter((v) => !isColorType(v));
    const liveRows = sizeRows.filter(buyable);
    const sizeSrc = liveRows.length ? liveRows : sizeRows;
    const sizeCands = sizeSrc.map((v) => String(v.tanim ?? "").trim());
    const named = sizeSrc.filter((v) => SIZE_HINT.test(typeOf(v))).map((v) => String(v.tanim ?? "").trim());
    const sizes = named.length ? normalizeSizes(named) : knownSizes(sizeCands);
    const colors = vd.filter(isColorType);
    if (colors.length) {
      // Ticimax'te renk görseli (`resimYolu`) çoğu zaman `/varyasyonresim/` altındaki DÜZ
      // RENK SWATCH'ıdır — ürün fotoğrafı değil, renk seçici için bir renk çipi. Bunu
      // primary yaparsak kartta/modalda kapkara (ya da düz renk) bir kare çıkıyor, gerçek
      // fotoğraflar arkaya düşüyordu. Swatch'ı görsele hiç katmıyoruz; renk zaten `colorCode`
      // (renkKodu) ile renk noktasında duruyor. resimYolu gerçek bir fotoğrafsa (swatch
      // değil) eskisi gibi o rengin primary'si olarak kullanılır.
      const isSwatch = (u) => /\/varyasyonresim\//i.test(u || "");
      return colors.map((cv) => {
        const cImg = cv.resimYolu ? abs(pageUrl, cv.resimYolu) : null;
        const usable = cImg && !isSwatch(cImg);
        return {
          ...base,
          color: String(cv.tanim ?? "").trim(),
          colorCode: cv.renkKodu || null,
          image: usable ? cImg : images[0],
          images: usable ? uniq([cImg, ...images]).slice(0, 5) : images.slice(0, 5),
          sizes,
          inStock,
          price,
        };
      });
    }
    return [{ ...base, color: "", colorCode: null, image: images[0], images, sizes, inStock, price }];
  }

  return [
    {
      ...base,
      color: node?.color ? String(node.color).split(/[\/,]/)[0].trim() : "",
      colorCode: null,
      image: images[0],
      images,
      sizes: sizesFrom(node, html),
      inStock,
      price,
    },
  ];
}

/**
 * SON ÇARE: mağazanın kendi `/api/products` uç noktası.
 *
 * Kendi yazılımını kullanan (çoğu Next.js) mağazalarda ne sitemap var ne de sayfada
 * ürün linki — ürünler tarayıcıda bu uç noktadan çekiliyor ve sunucudan gelen HTML
 * bomboş. mahalle-boy'da ölçüldü: sitemap 404, ana sayfada tek bir ürün linki yok,
 * `/api/products?page=1&limit=…` ise ad/fiyat/görsel/beden/stoku tam veriyor.
 *
 * Yanıt biçimi doğrulanmadan kabul edilmez (ad + görsel şart), çünkü aynı yolda
 * bambaşka bir şey döndüren siteler olabilir.
 */
async function customApiRecords(brand, origin, cap) {
  const PER = 100;
  const rows = [];
  for (let page = 1; page <= Math.ceil(cap / PER); page++) {
    const data = await getJsonSafe(`${origin}/api/products?page=${page}&limit=${PER}`, brand.url);
    const items = Array.isArray(data?.items) ? data.items : Array.isArray(data?.products) ? data.products : null;
    if (!items?.length) break;
    rows.push(...items);
    if (items.length < PER) break;
  }
  const ok = rows.filter((p) => p?.name && (p.images?.length || p.image));
  if (ok.length < Math.max(3, rows.length * 0.5)) return [];

  return ok.map((p) => {
    const imgs = uniq(
      (p.images ?? [])
        .slice()
        .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((im) => abs(origin, im.url ?? im.src ?? im)),
    ).slice(0, 5);
    const vars = Array.isArray(p.variants) ? p.variants : [];
    const live = vars.filter((v) => (v.stock ?? 0) > 0);
    const src = live.length ? live : vars;
    return {
      brand: brand.name,
      brandSlug: brand.slug,
      displayName: String(p.name).trim().slice(0, 140),
      sourceText: [p.category?.name, p.category, p.type].filter((x) => typeof x === "string").join(" "),
      color: "",
      colorCode: null,
      image: imgs[0] ?? null,
      images: imgs,
      sizes: normalizeSizes(src.map((v) => v.size ?? v.name)),
      inStock: vars.length ? live.length > 0 : p.is_active !== false,
      price: num(p.price),
      currency: (p.currency ?? "TRY").toUpperCase(),
      productUrl: p.slug ? `${origin}/urun/${p.slug}` : brand.url,
      day: 20,
      pop: 50,
    };
  });
}

async function getJsonSafe(url, referer) {
  try {
    const res = await get(url, { accept: "application/json", referer, tries: 2 });
    if (!res?.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchJsonLd(brand, { concurrency = 5, delayMs = 120, cap = 3000, onPage } = {}) {
  const origin = new URL(brand.url).origin;
  const pages = await sitemapProductUrls(origin, cap);
  if (!pages.length) {
    const api = await customApiRecords(brand, origin, cap);
    if (api.length) return { records: api, note: `mağazanın kendi /api/products'ı · ${api.length} ürün` };
    return { records: [], note: "sitemap'ten ürün URL'i çıkmadı" };
  }
  // Tavana dayandıysak sitemap'te daha fazlası var demektir; rapora yaz ki "eksik çekildi"
  // bir daha sessizce geçmesin (bkz. sitemapProductUrls notu).
  const capped = pages.length >= cap;

  const out = [];
  const seen = new Set();
  let done = 0;
  // Sayfa başına iki ayrı kayıp türü AYRI sayılır; ikisi de eskiden sessizce yutuluyordu
  // ve "marka çekildi" görünüp katalogda ürünlerin yarısı eksik kalıyordu (ölçüldü:
  // gotham sitemap'te 734 ürün URL'i, hamda 200).
  //   bosSayfa  = HTML geldi ama içinden ürün çıkmadı (ayrıştırma sorunu / ürün değil)
  //   dusenSayfa = HTML hiç gelmedi (ağ hatası, 5xx, zaman aşımı)
  let bosSayfa = 0;
  let dusenSayfa = 0;
  const failed = [];
  const fetchPage = async (pageUrl) => {
    try {
      return await getText(pageUrl, { referer: brand.url, tries: 2 });
    } catch {
      // bu sayfa alınamadı — markanın geri kalanını düşürme
      return null;
    }
  };
  await mapLimit(pages, concurrency, delayMs, async (pageUrl) => {
    const html = await fetchPage(pageUrl);
    done++;
    if (done % 25 === 0) onPage?.(done, out.length, pages.length);
    if (!html) {
      dusenSayfa++;
      failed.push(pageUrl);
      return;
    }
    const recs = detach(pageRecords(brand, pageUrl, html));
    if (!recs.length) bosSayfa++;
    for (const r of recs) {
      // aynı ürün birden çok URL'den gelebiliyor (beden başına ayrı sayfa üreten platformlar)
      const sig = `${r.displayName.toLowerCase()}|${r.color.toLowerCase()}|${r.image}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      out.push(r);
    }
  });
  // İKİNCİ TUR: düşen sayfaları bir kez daha, TEK AKIŞTA ve yavaşça dene. Düşmelerin
  // çoğu sitenin eşzamanlı istek altında bağlantı kesmesinden; sıra sıra istendiğinde
  // aynı sayfalar sorunsuz geliyor (ölçüldü). Bunu yapmayınca kayıp kalıcı oluyordu.
  if (failed.length) {
    for (const pageUrl of failed) {
      const html = await fetchPage(pageUrl);
      if (!html) continue;
      dusenSayfa--;
      const recs = detach(pageRecords(brand, pageUrl, html));
      if (!recs.length) bosSayfa++;
      for (const r of recs) {
        const sig = `${r.displayName.toLowerCase()}|${r.color.toLowerCase()}|${r.image}`;
        if (seen.has(sig)) continue;
        seen.add(sig);
        out.push(r);
      }
      await sleep(150);
    }
  }

  const kayip = dusenSayfa + bosSayfa;
  return {
    records: out,
    note:
      `${pages.length} sayfa tarandı` +
      (capped ? " (CAP'e dayandı — daha fazlası var)" : "") +
      (kayip ? ` · KAYIP ${kayip} sayfa (${dusenSayfa} alınamadı, ${bosSayfa} boş)` : ""),
  };
}
