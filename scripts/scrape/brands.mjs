// Marka listesi okuma — brand-names.json (görünen adlar) + brands.generated.ts (url/platform).
// Script'ler TS import edebiliyor ama bu dosya sade tutuluyor: scraper'ın site koduna
// bağımlılığı yalnız sınıflandırma katmanında olsun.
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const TR_MAP = { ç: "c", Ç: "c", ğ: "g", Ğ: "g", ı: "i", İ: "i", ö: "o", Ö: "o", ş: "s", Ş: "s", ü: "u", Ü: "u", â: "a", î: "i", û: "u" };

export function slugify(input) {
  return input
    .split("")
    .map((ch) => TR_MAP[ch] ?? ch)
    .join("")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’`]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const primaryName = (name) => name.split("/")[0].trim();

export async function loadBrands(root) {
  const names = JSON.parse(await readFile(join(root, "src", "lib", "brand-names.json"), "utf8"));
  const gen = await readFile(join(root, "src", "lib", "brands.generated.ts"), "utf8");
  const G = {};
  for (const m of gen.matchAll(/"([^"]+)":\s*\{\s*url:\s*"([^"]+)",\s*platform:\s*"([^"]+)"/g))
    G[m[1]] = { url: m[2], platform: m[3] };

  // ARŞİVLİ markalar çekilmez. Site tarafı (src/lib/brands.ts) bu listeyi zaten
  // BRANDS'ten eliyordu ama scraper ona hiç bakmıyor, her turda o markaları da
  // deniyordu — 3 saatlik tam taramada boşa giden zaman ve gereksiz istek.
  let archived = {};
  try {
    archived = JSON.parse(await readFile(join(root, "data", "brands-archived.json"), "utf8"));
  } catch { /* dosya yoksa eleme yok */ }
  const isArchived = (slug) => Object.hasOwn(archived, slug) && !slug.startsWith("_");

  return names
    .map((name) => {
      const slug = slugify(primaryName(name));
      return { name, slug, url: G[slug]?.url ?? null, platform: G[slug]?.platform ?? "none" };
    })
    .filter((b) => b.url && !isArchived(b.slug));
}
