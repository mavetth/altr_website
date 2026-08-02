// SHOPIER adaptörü — pazaryeri altında barındırılan mağaza vitrinleri.
//
// Shopier mağazaları kendi alan adlarında değil, `shopier.com/<kullanıcı>` altında durur.
// Sitemap yok, JSON-LD yok, ürün linkleri de sayfada sadece İLK 24 tanesi var: gerisi
// sonsuz kaydırmayla geliyor. Bu yüzden iki Shopier markası (fadeback-studio,
// manic-sellout) bir dönem "kendi katalogu yok" denip arşive alınmıştı. Öyle değilmiş.
//
// Vitrinin kendi kullandığı iki uç nokta yeterli:
//
//  1) LİSTE — POST /s/api/v1/search_product/<kullanıcı>
//     Gövde: start=24&offset=<o ana kadar gösterilen>&filter=0&sort=0&…
//     Yanıt: { products:[{id,name,link,price,original_price,labels,primary_image}], show_more }
//     İKİ ŞART VAR: mağaza sayfasından alınan oturum çerezi ve `csrf-token` meta'sı
//     (`X-CSRF-TOKEN`). İkisi olmadan uç nokta 500 döndürüyor — 404/403 değil, o yüzden
//     "adaptör bozuk" gibi görünür.
//
//  2) ÜRÜN — ürün sayfasındaki satır içi JS nesnesi: `{"page":"product", …}`.
//     İçinde stok, fiyat ve VARYASYONLAR var: `variations.variation_1_name` ("Beden"/"Renk")
//     + `variation_1[{id,stock,name}]`. Beden başına GERÇEK stok verdiği için tükenmiş
//     bedenler elenebiliyor (Ticimax'taki `stokAdedi` ile aynı imkân).
//
// Fiyat: `price` zaten kasada geçerli tutar, `original_price` üstü çizili olan. İkas'ta
// yaşanan hatanın (liste fiyatını çekmek) tersini yapmamak için `price` alınır.
import { get, getText, mapLimit, num, sleep, uniq } from "../fetch.mjs";
import { normalizeSizes, looksLikeSizeValues, SIZE_NAME_HINT } from "../../../src/lib/sizes.ts";

const BASE = "https://www.shopier.com";
const PER_PAGE = 24;

/** "TL" Shopier'in gösterim kodu; ISO karşılığı TRY. */
function currencyOf(code) {
  const c = String(code ?? "").trim().toUpperCase();
  if (!c || c === "TL" || c === "₺") return "TRY";
  return /^[A-Z]{3}$/.test(c) ? c : "TRY";
}

/** brand.url = https://www.shopier.com/KullaniciAdi → "KullaniciAdi" */
function shopOf(brand) {
  return new URL(brand.url).pathname.replace(/^\/+|\/+$/g, "").split("/")[0];
}

/** Sayfadaki `{"page":"product", …}` nesnesini süslü parantez eşleyerek çıkarır. */
function inlineJson(html, anchor) {
  const i = html.indexOf(anchor);
  if (i < 0) return null;
  let depth = 0;
  for (let j = i; j < html.length; j++) {
    const ch = html[j];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(i, j + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function metaOf(html, prop) {
  const re = new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']*)["']`, "i");
  return (html.match(re) ?? [])[1] ?? "";
}

/** Varyasyon listelerini beden / renk diye ayırır (ad yalnız hakem, karar DEĞERLERDE). */
function splitVariations(v) {
  const lists = [];
  for (let n = 1; n <= 3; n++) {
    const rows = v?.[`variation_${n}`];
    if (Array.isArray(rows) && rows.length)
      lists.push({ name: String(v[`variation_${n}_name`] ?? "").trim(), rows });
  }
  const names = (l) => l.rows.map((r) => String(r.name ?? "").trim()).filter(Boolean);
  const sizeList =
    lists.filter((l) => looksLikeSizeValues(names(l))).sort((a, b) => Number(SIZE_NAME_HINT.test(b.name)) - Number(SIZE_NAME_HINT.test(a.name)))[0] ?? null;
  const colorList = lists.find((l) => l !== sizeList && /renk|color|colour/i.test(l.name)) ?? null;
  return { sizeList, colorList };
}

async function fetchProduct(brand, row, shop) {
  const html = await getText(row.link, { referer: `${BASE}/${shop}`, tries: 2 });
  const currency = currencyOf(row.price?.price_code);
  // Liste yanıtı zaten ad/fiyat/görsel/stok veriyor; ürün sayfası beden ve ek görsel için.
  const listImage = row.primary_image ? `https://cdn.shopier.app/pictures_large/${row.primary_image}` : null;
  const base = {
    brand: brand.name,
    brandSlug: brand.slug,
    displayName: String(row.name ?? "").trim().slice(0, 140),
    sourceText: "",
    color: "",
    colorCode: null,
    currency,
    productUrl: row.link,
    // Shopier yayın tarihi vermiyor; ikas/jsonld yolundaki sabitlerin aynısı
    // (bu alanlara sıralama dayandırılmıyor, bkz. types.ts VIEW_CATS notu).
    day: 20,
    pop: 50,
    price: num(row.price?.price_legacy_formatted ?? row.price?.price_formatted),
    inStock: row.labels?.out_of_stock?.enabled !== true,
    sizes: [],
    image: listImage,
    images: listImage ? [listImage] : [],
  };

  if (!html) return base.image ? [base] : [];

  const imgs = uniq([...html.matchAll(/https:\/\/cdn\.shopier\.app\/pictures_large\/[^"'\s\\]+/g)].map((m) => m[0])).slice(0, 5);
  if (imgs.length) {
    base.image = imgs[0];
    base.images = imgs;
  }
  if (!base.image) return [];

  // Ürün açıklaması kategori/cinsiyet tespitinin tek ham sinyali (Shopier'de etiket yok).
  base.sourceText = metaOf(html, "og:description").replace(/\s+/g, " ").slice(0, 300);

  const data = inlineJson(html, '{"page":"product"');
  const p = data?.product;
  if (!p) return [base];

  if (p.price?.price_legacy_formatted) base.price = num(p.price.price_legacy_formatted);
  if (typeof p.stock === "number") base.inStock = p.stock > 0;

  const { sizeList, colorList } = splitVariations(p.variations);
  if (sizeList) {
    const live = sizeList.rows.filter((r) => (r.stock ?? 0) > 0);
    const src = live.length ? live : sizeList.rows;
    base.sizes = normalizeSizes(src.map((r) => String(r.name ?? "").trim()));
    // Varyasyon stoğu ürün stoğundan daha güvenilir: hepsi 0 ise ürün tükenmiştir.
    if (sizeList.rows.some((r) => r.stock != null)) base.inStock = live.length > 0;
  }

  if (colorList) {
    // Renk varyasyonu ayrı görsel taşımıyor; renkler aynı görsel havuzunu paylaşır.
    return colorList.rows.map((r) => ({
      ...base,
      color: String(r.name ?? "").trim(),
      inStock: base.inStock && (r.stock == null || r.stock > 0),
    }));
  }
  return [base];
}

export async function fetchShopier(brand, { cap = 9000 } = {}) {
  const shop = shopOf(brand);
  const store = `${BASE}/${shop}`;

  // BASAMAKLI BEKLEME. Shopier tek origin olduğu için ard arda çekilen mağazalarda
  // hız sınırı IP düzeyinde birikiyor ve mağaza sayfası 429 + "csrf-token yok" hâline
  // düşüyor. `get`in 600ms–2.4sn'lik geri çekilmesi bu pencereyi kapatmıyor (ölçüldü:
  // 10 mağaza, hepsi 5 saniyede boş döndü). Shopify yolundaki çözümün aynısı: sınır
  // penceresi dakikalarca sürebiliyor, o yüzden uzun ve artan aralıklarla bekle.
  let html = await getText(store, { tries: 3 });
  if (!html || !/csrf-token/.test(html)) {
    for (const wait of [15000, 60000, 150000]) {
      await sleep(wait);
      html = await getText(store, { tries: 2 });
      if (html && /csrf-token/.test(html)) break;
    }
  }
  if (!html) return { records: [], note: "mağaza sayfası alınamadı (hız sınırı)" };

  const jeton = (html.match(/<meta[^>]+name=["']csrf-token["'][^>]+content=["']([^"']+)["']/i) ?? [])[1];
  const total = Number((html.match(/\$product_count\s*=\s*(\d+)/) ?? [])[1] ?? 0);
  if (!jeton) return { records: [], note: "csrf-token yok (mağaza kapalı olabilir)" };

  const rows = [];
  const seen = new Set();
  for (let offset = 0; offset < Math.min(cap, total || cap); offset += PER_PAGE) {
    const body =
      `start=${PER_PAGE}&offset=${offset}&filter=0&sort=0&filterMaxPrice=&filterMinPrice=&datesort=&pricesort=&value=`;
    const ask = () =>
      get(`${BASE}/s/api/v1/search_product/${shop}`, {
        method: "POST",
        body,
        accept: "application/json",
        referer: store,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-CSRF-TOKEN": jeton,
          "X-Requested-With": "XMLHttpRequest",
        },
      });
    let res = await ask();
    // Mağaza sayfası geçip LİSTE UCU 429 verebiliyor (ölçüldü: eilul-archives, 5 saniyede
    // boş döndü). Sayfayı kaybetmeden önce basamaklı bekle — burada kırmak markanın
    // kalan bütün ürünlerini düşürüyor.
    if (!res?.ok) {
      for (const wait of [15000, 60000, 150000]) {
        await sleep(wait);
        res = await ask();
        if (res?.ok) break;
      }
    }
    if (!res?.ok) break;
    let data = null;
    try {
      data = await res.json();
    } catch {
      break;
    }
    const page = data?.products ?? [];
    if (!page.length) break;
    for (const r of page) if (r?.id && r.link && !seen.has(r.id)) { seen.add(r.id); rows.push(r); }
    if (!data.show_more) break;
  }

  // Ürün sayfaları: beden/stok/ek görsel için birer istek.
  //
  // HIZ, marka başına ürün sayısından daha belirleyici. ÖLÇÜLDÜ: eilul-archives'ın 480
  // ürünü 159 saniyede çekildi (~3 istek/sn) ve Cloudflare bunun ardından IP'yi
  // "Hata Kodu 9009 · birkaç saat" ile kapattı — sıradaki 8 marka mağaza sayfasını bile
  // alamadı. Sınır istek/saniye üzerinden çalıştığı için çare eşzamanlılığı 1'e indirip
  // araya 1,2 sn koymak: 480 ürün ~10 dakika sürer ama pencere dolmaz.
  // Shopier markaları ayrıca `--concurrency 1` ile ve ARALARINDA beklenerek çekilmeli
  // (bkz. .data/shopier-tek-tek.sh).
  const chunks = await mapLimit(rows.slice(0, cap), 1, 1200, (r) => fetchProduct(brand, r, shop));
  const records = chunks.flat();

  return { records, note: `shopier ${rows.length} ürün / vitrinde ${total || "?"}` };
}
