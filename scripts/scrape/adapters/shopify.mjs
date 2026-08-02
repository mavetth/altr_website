// SHOPIFY adaptörü — /products.json ile tam sayfalama.
//
// Eski hâlde iki şey eksikti:
//  - PARA BİRİMİ SABİT "TRY" yazılıyordu. Oysa mağazaların bir kısmı başka kurda satıyor
//    (ör. tr.punkdesign.shop = USD, katalogdaki 2284 ürünü yanlışlıkla ₺ ile gösteriliyordu).
//    Artık /meta.json'dan mağazanın gerçek para birimi okunuyor.
//  - product_type ve tags kaybediliyordu. Bunlar kategori ve cinsiyet tespitinin en
//    güvenilir sinyalleri; şimdi `sourceText` olarak taşınıyor.

import { getJson, num, sleep, uniq } from "../fetch.mjs";
// Beden sözlüğü siteyle TEK KOPYA (bkz. src/lib/sizes.ts): scraper'ın kendi
// `isSize` regex'i vardı ve "Medium", "SM", "35-38", "TEK BOYUT" gibi değerleri
// eliyordu — bunun ölçülen bedeli emorpi'de 613 kaydın 0'ı, hype-of-steps'te 125'in 0'ı.
import { normalizeSizes, knownSizes, looksLikeSizeValues, SIZE_NAME_HINT } from "../../../src/lib/sizes.ts";

const COLOR_HINT = /renk|color|colour/i;

/**
 * Bedenleri taşıyan seçeneği bulur.
 *
 * ADA GÜVENİLMEZ: mağazaların bir kısmı beden seçeneğini "Boyut" (katalogda 463 kez),
 * "Ölçü", hatta ürünün RENK ADIYLA açıyor (x-puppet-wear: "Beyaz" = [S,M,L,XL]).
 * O yüzden önce DEĞERLERE bakılır, ad yalnızca birden çok aday varsa hakemlik eder.
 */
function pickSizeOption(options) {
  const cands = (options ?? []).filter((o) => looksLikeSizeValues(o.values ?? []));
  if (!cands.length) return null;
  return cands.find((o) => SIZE_NAME_HINT.test(o.name ?? "")) ?? cands[0];
}

function daysSince(iso) {
  if (!iso) return 30;
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  return Number.isFinite(d) ? Math.max(0, Math.round(d)) : 30;
}

/** Mağazanın gerçek para birimi. Bulunamazsa TRY varsayılır. */
export async function shopCurrency(origin) {
  const meta = await getJson(`${origin}/meta.json`, { tries: 2 });
  const c = meta?.currency;
  return typeof c === "string" && /^[A-Za-z]{3}$/.test(c) ? c.toUpperCase() : "TRY";
}

function records(brand, p, currency) {
  const imgs = (p.images ?? []).map((i) => i.src);
  if (!imgs.length) return [];
  const tags = Array.isArray(p.tags) ? p.tags.join(" ") : (p.tags ?? "");
  const day = daysSince(p.published_at ?? p.created_at);
  const base = {
    brand: brand.name,
    brandSlug: brand.slug,
    displayName: String(p.title ?? "").trim(),
    // kategori/cinsiyet tespitine giden ham sinyal — eskiden atılıyordu
    sourceText: `${p.product_type ?? ""} ${tags}`.trim(),
    currency,
    day,
    pop: Math.max(1, 100 - day),
    productUrl: `${brand.url.replace(/\/$/, "")}/products/${p.handle}`,
  };

  const sizeOpt = pickSizeOption(p.options);
  // Renk seçeneği beden seçeneğinin kendisi olamaz (ikisi de "Boyut/Renk" adı taşıyan
  // mağazalarda aynı seçeneğe düşebiliyordu).
  const colorOpt = (p.options ?? []).find(
    (o) => COLOR_HINT.test(o.name ?? "") && o !== sizeOpt,
  );
  const okey = (pos) => `option${pos}`;
  const vars = p.variants ?? [];

  // Renk değerleri VARYANTLARDAN türetilir, `options[].values` listesinden DEĞİL.
  // Sebep ölçüldü (tr.punkdesign.shop): çeviri katmanı iki yeri ayrı ayrı çeviriyor —
  // `options.values` "SİYAH YEŞİL" derken varyantın `option1`'i "BLACK-GREEN" kalıyor.
  // Eşleşme tutmayınca o rengin varyant kümesi BOŞ kalıyor, dolayısıyla fiyat da beden
  // de yok oluyordu: 6.580 kaydın 5.364'ü fiyatsızdı, oysa kaynak sayfaların hepsi
  // 250/250 fiyatlı geliyor. Varyantın kendi değerini kullanmak bu bağı hiç kurdurmuyor.
  const colorValues = colorOpt
    ? uniq(vars.map((v) => String(v[okey(colorOpt.position)] ?? "").trim()).filter(Boolean))
    : [];
  const colorList = colorValues.length ? colorValues : (colorOpt?.values ?? []);

  if (colorList.length) {
    return colorList.map((cv) => {
      const vs = vars.filter((v) => String(v[okey(colorOpt.position)] ?? "").trim() === cv);
      const live = vs.filter((v) => v.available);
      const src = live.length ? live : vs;
      const sizes = sizeOpt
        ? normalizeSizes(src.map((v) => String(v[okey(sizeOpt.position)] ?? "").trim()))
        : [];
      // renge bağlı görseller: Shopify görselleri variant_ids ile ilişkilendirir
      const cImgs = uniq(
        (p.images ?? [])
          .filter((im) => im.variant_ids?.some((id) => vs.some((v) => v.id === id)))
          .map((im) => im.src),
      );
      const fallback = vs.find((v) => v.featured_image)?.featured_image?.src;
      const image = cImgs[0] ?? fallback ?? imgs[0];
      // Fiyat bedenle AYNI kümeden (`src`) gelir. Eskiden fiyat `vs`ten, beden `src`ten
      // alınıyordu: bedene göre fiyatı değişen üründe kartta TÜKENMİŞ bir bedenin fiyatı
      // yazabiliyordu. Shopify'da `variant.price` zaten güncel fiyattır — indirimin eski
      // hâli `compare_at_price`, ona bilerek bakmıyoruz.
      const prices = src.map((v) => num(v.price)).filter((n) => n != null && n > 0);
      return {
        ...base,
        color: String(cv).trim(),
        colorCode: null,
        image,
        images: uniq([image, ...cImgs, ...imgs]).slice(0, 5),
        sizes,
        inStock: vs.some((v) => v.available),
        price: prices.length ? Math.min(...prices) : null,
      };
    });
  }

  // renk seçeneği yok -> tek kayıt
  const sizes = sizeOpt
    ? normalizeSizes(sizeOpt.values ?? [])
    // Seçenek beden olarak TANINMADIYSA burası bir tahmindir: yalnız kesin bedenler
    // alınır, yoksa tek seçeneği renk olan üründe "Siyah" beden diye kataloga girer.
    : knownSizes(vars.map((v) => String(v.option1 ?? "").trim()));
  const liveVars = vars.filter((v) => v.available);
  const priceSrc = liveVars.length ? liveVars : vars;
  const prices = priceSrc.map((v) => num(v.price)).filter((n) => n != null && n > 0);
  return [
    {
      ...base,
      color: "",
      colorCode: null,
      image: imgs[0],
      images: imgs.slice(0, 5),
      sizes,
      inStock: vars.some((v) => v.available),
      price: prices.length ? Math.min(...prices) : null,
    },
  ];
}

export async function fetchShopify(brand, { maxPages = 60, onPage } = {}) {
  const origin = new URL(brand.url).origin;
  const currency = await shopCurrency(origin);
  const out = [];
  let seen = 0;
  let cutShort = false;
  let degraded = false;
  const url = (page) => `${brand.url.replace(/\/$/, "")}/products.json?limit=250&page=${page}`;
  const priced = (ps) => ps.filter((p) => (p.variants ?? []).some((v) => Number(v.price) > 0)).length;
  // Mağaza yorulduğunda 429 vermek yerine KIRPILMIŞ gövde döndürebiliyor: ürünler yerinde
  // ama varyantlarda fiyat ve seçenek yok. ÖLÇÜLDÜ (tr.punkdesign.shop): 1. sayfa 250/250
  // fiyatlı, sonraki sayfalar 0 fiyatlı — ve aynı ürünün kendi `.json`'u fiyatı veriyor.
  // Sayıya bakan hiçbir koruma bunu göremez; sayfa düzeyinde yakalamak gerekiyor.
  let firstPagePriced = 0;
  for (let page = 1; page <= maxPages; page++) {
    // Sayfalar arası kibarlık duraklaması. ÖLÇÜLDÜ: tr.punkdesign.shop 2. sayfadan
    // itibaren 429 (hız sınırı) döndürüyor ve döngü orada kırılıyordu — mağazanın
    // 5422 kaydından yalnız ilk sayfanın 279'u geliyordu.
    if (page > 1) await sleep(700);
    let data = await getJson(url(page), { referer: brand.url });
    // Hız sınırı geçici olur: sayfayı kaybetmeden önce soluklanıp yeniden dene.
    // Tek 12 sn'lik bekleme YETMİYOR — ölçüldü: estatico-design 7773 kayıtlık mağaza
    // 1327'de, after-6 8737'den 1391'de kesildi; ikisi de "sayfa alınamadı" ile.
    // Bu mağazaların penceresi dakikalarca sürüyor, o yüzden basamaklı bekleme.
    if (!data?.products) {
      for (const wait of [12000, 45000, 120000]) {
        await sleep(wait);
        data = await getJson(url(page), { referer: brand.url, tries: 3 });
        if (data?.products) break;
      }
      if (!data?.products) {
        cutShort = page > 1;
        break;
      }
    }
    let products = data.products;
    if (!Array.isArray(products) || !products.length) break;

    // KIRPILMIŞ GÖVDE: mağaza 1. sayfada fiyat veriyorken bu sayfada hiç vermiyorsa bu
    // veri değil yorgunluk. Aynı basamaklı beklemeyle tekrar iste; düzelmezse sayfayı
    // fiyatsız YAZMA — yarım kaldığını bildirip çık, dosyadaki iyi veri korunsun.
    if (page === 1) firstPagePriced = priced(products);
    else if (firstPagePriced > 0 && priced(products) === 0) {
      for (const wait of [12000, 45000, 120000]) {
        await sleep(wait);
        const retry = await getJson(url(page), { referer: brand.url, tries: 3 });
        if (retry?.products?.length && priced(retry.products) > 0) { products = retry.products; break; }
      }
      if (!priced(products)) { degraded = true; cutShort = true; break; }
    }

    seen += products.length;
    for (const p of products) out.push(...records(brand, p, currency));
    onPage?.(page, out.length, seen);
    if (products.length < 250) break;
  }
  return {
    records: out,
    note:
      `shopify ${seen} ürün / ${currency}` +
      (cutShort ? (degraded ? " · TARAMA YARIM KALDI (fiyatsız gövde geldi)" : " · TARAMA YARIM KALDI (sayfa alınamadı)") : ""),
  };
}
