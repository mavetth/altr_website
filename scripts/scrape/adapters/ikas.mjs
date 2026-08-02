// İKAS adaptörü.
//
// Kataloğun en büyük veri kaybı buradaydı: 38 marka İkas altyapısında ama "jsonld"
// sanılıp sitemap + ürün sayfası HTML'i taranarak çekiliyordu. O yol hem yavaş, hem
// eksik (beden/renk çoğu sayfada JS ile geliyor), hem de sitemap sınırına takılıyordu.
// Örnek: voidtr.com'un kendi API'si 5010 ürün veriyor, katalogda o markadan 44 ürün vardı.
//
// İkas mağazaları Next.js; ana sayfadaki __NEXT_DATA__ içinde storefront API'sinin
// adresi ve anahtarları duruyor (apiUrl / apiKey / token / merchantId). Bunlar mağazanın
// kendi tarayıcı istemcisinin kullandığı, herkese açık storefront anahtarlarıdır.

import { get, getText, num, uniq } from "../fetch.mjs";
import { normalizeSizes, looksLikeSizeValues, SIZE_NAME_HINT } from "../../../src/lib/sizes.ts";

const PER_PAGE = 50;

/** Ana sayfadan storefront API kimlik bilgilerini çıkarır. */
export async function ikasConfig(origin) {
  const html = await getText(origin, { accept: "text/html" });
  if (!html) return null;
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  let data;
  try {
    data = JSON.parse(m[1]);
  } catch {
    return null;
  }
  const cfg = data?.props?.pageProps?.configJson;
  if (!cfg?.apiUrl || !cfg?.apiKey || !cfg?.token) return null;
  const merchantId =
    html.match(/"merchantId"\s*:\s*"([^"]+)"/)?.[1] ?? cfg.merchantId ?? null;
  return {
    apiUrl: cfg.apiUrl,
    apiKey: cfg.apiKey,
    token: cfg.token,
    cdnUrl: (cfg.cdnUrl ?? "https://cdn.myikas.com/").replace(/\/?$/, "/"),
    salesChannelId: cfg.salesChannelId ?? null,
    merchantId,
  };
}

const QUERY = `query($p: Float!, $pp: Float!) {
  searchProducts(input: { page: $p, perPage: $pp }) {
    totalCount
    results {
      id
      name
      metaData { slug }
      tags { name }
      categories { name }
      productVariantTypes { variantType { id name values { id name colorCode } } }
      variants {
        id
        isActive
        sellIfOutOfStock
        stocks { stockCount }
        prices { sellPrice discountPrice currency priceListId }
        images { id fileName isMain order }
        variantValues { variantTypeId variantValueId }
      }
    }
  }
}`;

async function gql(cfg, variables, referer) {
  const res = await get(cfg.apiUrl, {
    method: "POST",
    accept: "application/json",
    referer,
    headers: { "content-type": "application/json", "x-api-key": cfg.apiKey, authorization: cfg.token },
    body: JSON.stringify({ query: QUERY, variables }),
  });
  if (!res || !res.ok) return null;
  try {
    const j = await res.json();
    return j?.data?.searchProducts ?? null;
  } catch {
    return null;
  }
}

/** İkas görsel URL'i: {cdn}images/{merchantId}/{imageId}/{genişlik}/{dosyaAdı}.webp */
function imageUrl(cfg, img, width = 1080) {
  if (!cfg.merchantId || !img?.id) return null;
  const name = (img.fileName || "image").replace(/\.[a-z0-9]+$/i, "");
  return `${cfg.cdnUrl}images/${cfg.merchantId}/${img.id}/${width}/${name}.webp`;
}

const COLOR_TYPE = /renk|color|colour/i;

/**
 * Varyantın geçerli fiyat satırı. Bir varyant birden çok fiyat listesi (satış kanalı,
 * bayi listesi…) taşıyabiliyor; vitrinin gördüğü VARSAYILAN listenin `priceListId`'si
 * boştur. Eskiden körlemesine `prices[0]` alınıyordu.
 */
function priceRow(v) {
  const rows = v?.prices ?? [];
  return rows.find((r) => r?.priceListId == null) ?? rows[0] ?? null;
}

/**
 * MÜŞTERİNİN ÖDEDİĞİ fiyat.
 *
 * İkas'ta `sellPrice` liste (üstü çizili) fiyatı, `discountPrice` ise indirim varken
 * kasada geçerli olan fiyattır. Sorgu eskiden `discountPrice`'ı hiç istemiyordu; indirimi
 * sürekli açık olan markalarda (void: 30/30 üründe indirim, 799 ₺ yerine 359 ₺) katalog
 * baştan sona ESKİ fiyatı taşıyordu. İndirim mekanizması yazmıyoruz — ürün son hâlinde
 * kaç TL ise o gösterilir.
 */
function variantPrice(v) {
  const row = priceRow(v);
  if (!row) return null;
  const disc = num(row.discountPrice);
  return disc != null && disc > 0 ? disc : num(row.sellPrice);
}

/**
 * Beden varyant tipini bulur. Ada güvenmek yetmiyor — "Boyut"/"Ölçü" gibi adlar
 * eski regex'in dışında kalıyordu; asıl güvenilir sinyal DEĞERLERİN kendisi
 * (bkz. src/lib/sizes.ts, shopify.mjs'teki aynı kural).
 */
function pickSizeType(types) {
  const cands = (types ?? []).filter((t) =>
    looksLikeSizeValues((t.variantType?.values ?? []).map((v) => v.name)),
  );
  if (!cands.length) return null;
  return cands.find((t) => SIZE_NAME_HINT.test(t.variantType?.name ?? "")) ?? cands[0];
}

/**
 * Bir İkas ürününü VariantRecord listesine çevirir (renk başına bir kayıt).
 * İkas'ta beden ve renk ayrı "variantType"lardır; her satış varyantı ikisinin
 * kesişimidir. Renge göre gruplayıp o rengin bedenlerini topluyoruz.
 */
function toRecords(brand, p, cfg) {
  const types = p.productVariantTypes ?? [];
  const sizeType = pickSizeType(types);
  const colorType = types.find(
    (t) => COLOR_TYPE.test(t.variantType?.name ?? "") && t !== sizeType,
  );
  const valueName = new Map();
  const valueColor = new Map();
  for (const t of types) {
    for (const v of t.variantType?.values ?? []) {
      valueName.set(v.id, v.name);
      if (v.colorCode) valueColor.set(v.id, v.colorCode);
    }
  }

  const productUrl = p.metaData?.slug ? `${brand.url.replace(/\/$/, "")}/${p.metaData.slug}` : brand.url;
  const tagText = [...(p.tags ?? []).map((t) => t.name), ...(p.categories ?? []).map((c) => c.name)].join(" ");

  const variants = (p.variants ?? []).filter((v) => v.isActive !== false);
  if (!variants.length) return [];

  // renk değeri -> o renge ait satış varyantları
  const buckets = new Map();
  for (const v of variants) {
    const colorId = colorType
      ? v.variantValues?.find((x) => x.variantTypeId === colorType.variantType.id)?.variantValueId ?? ""
      : "";
    if (!buckets.has(colorId)) buckets.set(colorId, []);
    buckets.get(colorId).push(v);
  }

  // Varyant satın alınabilir mi? storefront `stocks.stockCount` GERÇEK sayı döndürüyor
  // (void'de API "stok yok" dediğinde ürün sayfası da schema.org/OutOfStock diyor — birebir
  // doğrulandı). Stok kaydı boş dizi de olabilir (= 0). `sellIfOutOfStock` açıksa marka
  // stoksuz satmaya devam ediyordur, yine "alınabilir" sayılır.
  const variantInStock = (v) =>
    v.sellIfOutOfStock === true ||
    (v.stocks ?? []).reduce((a, b) => a + (b.stockCount ?? 0), 0) > 0;

  const sizeOf = (v) => {
    if (!sizeType) return null;
    const id = v.variantValues?.find((x) => x.variantTypeId === sizeType.variantType.id)?.variantValueId;
    return id ? valueName.get(id) : null;
  };

  const out = [];
  for (const [colorId, vs] of buckets) {
    const imgs = uniq(
      vs
        .flatMap((v) => (v.images ?? []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
        .map((im) => imageUrl(cfg, im)),
    ).slice(0, 5);
    if (!imgs.length) continue;

    // Bedenler stoktakilerden alınır (shopify ile aynı kural): o renkte alınabilir beden
    // varsa yalnız onlar; hiç yoksa tükenmiş ürünün beden aralığı yine görünsün diye hepsi.
    const live = vs.filter(variantInStock);
    const sizeSrc = live.length ? live : vs;
    const sizes = sizeType ? normalizeSizes(sizeSrc.map(sizeOf)) : [];

    // Fiyat da bedenle AYNI kümeden (stoktakiler): tükenmiş bir bedenin fiyatı kartta
    // görünmesin. Hiç stok yoksa yine hepsi.
    const prices = sizeSrc.map((v) => variantPrice(v)).filter((n) => n != null && n > 0);
    const currency = sizeSrc.find((v) => priceRow(v)?.currency)?.prices.find((r) => r.currency)?.currency ?? "TRY";

    out.push({
      brand: brand.name,
      brandSlug: brand.slug,
      displayName: String(p.name ?? "").trim().slice(0, 140),
      // sınıflandırmaya yardımcı ham metin (etiketler + kategoriler)
      sourceText: tagText,
      color: colorId ? valueName.get(colorId) ?? "" : "",
      colorCode: colorId ? valueColor.get(colorId) ?? null : null,
      image: imgs[0],
      images: imgs,
      sizes,
      // GERÇEK stok: o renkte en az bir alınabilir varyant var mı?
      inStock: vs.some(variantInStock),
      price: prices.length ? Math.min(...prices) : null,
      currency,
      productUrl,
      day: 20,
      pop: 50,
    });
  }
  return out;
}

export async function fetchIkas(brand, { maxPages = 200, onPage } = {}) {
  const origin = new URL(brand.url).origin;
  const cfg = await ikasConfig(origin);
  if (!cfg) return { records: [], note: "ikas config bulunamadı" };

  // İkas'ın searchProducts'ı VARYANT düzeyinde satır döndürür: aynı ürün her rengi için
  // ayrı bir satır olarak gelir ("… - Siyah", "… - Açık Mavi") ama her satır ürünün TÜM
  // varyantlarını taşır. Satır başına renklere bölersek her rengi renk sayısı kadar
  // tekrarlarız. Bu yüzden önce ürün id'sine göre tekilleştirip sonra bölüyoruz.
  const byProduct = new Map();
  let total = null;
  for (let page = 1; page <= maxPages; page++) {
    const res = await gql(cfg, { p: page, pp: PER_PAGE }, origin);
    if (!res) break;
    total ??= res.totalCount ?? null;
    const rows = res.results ?? [];
    if (!rows.length) break;
    for (const p of rows) if (p?.id && !byProduct.has(p.id)) byProduct.set(p.id, p);
    onPage?.(page, byProduct.size, total);
    if (total != null && page * PER_PAGE >= total) break;
  }

  const records = [];
  for (const p of byProduct.values()) records.push(...toRecords(brand, p, cfg));
  return { records, note: `ikas api ${byProduct.size} ürün / ${total ?? "?"} varyant satırı` };
}
