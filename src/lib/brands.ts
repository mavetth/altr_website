import type { Brand } from "./types";
import { slugify, primaryName } from "./slug";
import { GENERATED } from "./brands.generated";
import NAMES from "./brand-names.json";
import ARCHIVED from "../../data/brands-archived.json";

export const BRAND_NAMES: string[] = NAMES;

/**
 * Vitrinde gösterilmeyen markalar (data/brands-archived.json).
 * Sebep her marka için o dosyada yazılı — siteleri ölü değil, çekilebilir katalogları yok
 * (Wix'te sitemap'e düşmeyen ürünler, Shopier pazaryeri vitrini, kapsam dışı perakendeci).
 * Anahtarı "_" ile başlayan satır açıklamadır, marka değil.
 */
export const ARCHIVED_BRANDS: Record<string, string> = Object.fromEntries(
  Object.entries(ARCHIVED as Record<string, string>).filter(([k]) => !k.startsWith("_")),
);

const ALL: Brand[] = BRAND_NAMES.map((name) => {
  const slug = slugify(primaryName(name));
  const gen = GENERATED[slug];
  return {
    name,
    slug,
    url: gen?.url ?? null,
    platform: gen?.platform ?? "none",
  };
});

export const BRANDS: Brand[] = ALL.filter((b) => !ARCHIVED_BRANDS[b.slug]);

export const BRANDS_BY_SLUG = new Map(BRANDS.map((b) => [b.slug, b]));

/** Gerçek kaynağı çözülmüş, canlı çekilebilecek markalar. */
export const LIVE_BRANDS: Brand[] = BRANDS.filter((b) => b.url && b.platform !== "none");

export function brandBySlug(slug: string): Brand | undefined {
  return BRANDS_BY_SLUG.get(slug);
}

export function brandByName(name: string): Brand | undefined {
  const slug = slugify(primaryName(name));
  return BRANDS_BY_SLUG.get(slug);
}
