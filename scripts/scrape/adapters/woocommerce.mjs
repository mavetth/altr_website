// WOOCOMMERCE adaptörü — Store API (/wp-json/wc/store/v1/products).
// Para birimi ve fiyat, API'nin kendi `prices` bloğundan gelir (minor unit'e dikkat:
// 129900 + currency_minor_unit 2 => 1299.00).

import { getJson, uniq } from "../fetch.mjs";
// Beden sözlüğü siteyle tek kopya — bkz. src/lib/sizes.ts.
import { normalizeSizes, looksLikeSizeValues, SIZE_NAME_HINT } from "../../../src/lib/sizes.ts";

const COLOR_HINT = /renk|color|colour/i;
const SIZE_HINT = SIZE_NAME_HINT;

function daysSince(iso) {
  if (!iso) return 30;
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  return Number.isFinite(d) ? Math.max(0, Math.round(d)) : 30;
}

export async function fetchWoo(brand, { maxPages = 40, onPage } = {}) {
  const out = [];
  let seen = 0;
  for (let page = 1; page <= maxPages; page++) {
    const products = await getJson(
      `${brand.url.replace(/\/$/, "")}/wp-json/wc/store/v1/products?per_page=100&page=${page}`,
      { referer: brand.url },
    );
    if (!Array.isArray(products) || !products.length) break;
    seen += products.length;

    for (const p of products) {
      const images = uniq((p.images ?? []).map((i) => i.src));
      if (!images.length) continue;
      const minor = p.prices?.currency_minor_unit ?? 2;
      const raw = p.prices?.price != null ? Number(p.prices.price) / 10 ** minor : null;
      const price = raw && raw > 0 ? raw : null;
      const currency = String(p.prices?.currency_code ?? "TRY").toUpperCase();
      const day = daysSince(p.date_created);
      const attrs = p.attributes ?? [];
      const colorAttr = attrs.find((a) => COLOR_HINT.test(a.name ?? "") || COLOR_HINT.test(a.taxonomy ?? ""));
      // Ada değil DEĞERE göre: "Boyut"/"Ölçü" adlı öznitelikler ad testinden kaçıyordu.
      const sizeAttr =
        attrs.find((a) => SIZE_HINT.test(a.name ?? "") || SIZE_HINT.test(a.taxonomy ?? "")) ??
        attrs.find((a) => looksLikeSizeValues((a.terms ?? []).map((t) => t.name)));
      const sizes = normalizeSizes((sizeAttr?.terms ?? []).map((t) => String(t.name).trim()));

      const base = {
        brand: brand.name,
        brandSlug: brand.slug,
        displayName: String(p.name ?? "").trim(),
        sourceText: (p.categories ?? []).map((c) => c.name).join(" "),
        currency,
        price,
        inStock: p.is_in_stock ?? true,
        productUrl: p.permalink ?? `${brand.url}/?p=${p.id}`,
        day,
        pop: Math.max(1, 100 - day),
        sizes,
      };
      const colors = uniq((colorAttr?.terms ?? []).map((t) => String(t.name).trim()));
      if (colors.length) {
        for (const c of colors)
          out.push({ ...base, color: c, colorCode: null, image: images[0], images: images.slice(0, 5) });
      } else {
        out.push({ ...base, color: "", colorCode: null, image: images[0], images: images.slice(0, 5) });
      }
    }
    onPage?.(page, out.length, seen);
    if (products.length < 100) break;
  }
  return { records: out, note: `woocommerce ${seen} ürün` };
}
