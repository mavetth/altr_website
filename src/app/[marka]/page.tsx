import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadBrandPage } from "@/lib/brand-page";
import { formatPrice } from "@/lib/query";
import { STYLES } from "@/lib/brand-styles";
import { CAT_LOWER, type ProductCat } from "@/lib/types";
import { PageChrome } from "@/components/PageChrome";
import { BrandPage } from "@/components/BrandPage";

/**
 * MARKA SAYFASI — `/<marka-slug>`.
 *
 * Uzantı bilerek kök seviyede ve marka adının kendisi: `altr.../void`. SEO'nun istediği
 * bu (kısa, okunur, markanın adıyla eşleşen adres) ve paylaşırken de en temizi.
 *
 * Statik yollar (`/markalar`, `/api/...`) Next'te dinamik segmentten ÖNCE eşleşir, o
 * yüzden çakışma yok; bilinmeyen bir slug 404'e düşer.
 *
 * Sayfa tamamen SUNUCUDA çizilir — ana vitrinin istemci mağazasına bağlı değil. Böylece
 * arama motoru ve link önizlemesi gerçek içerik görür (bkz. PageChrome).
 */

export const dynamic = "force-dynamic";

const STYLE_LABEL: Record<string, string> = Object.fromEntries(STYLES.map((s) => [s.k, s.label]));

type Params = Promise<{ marka: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

function pageOf(sp: Record<string, string | string[] | undefined>): number {
  const raw = Array.isArray(sp.sayfa) ? sp.sayfa[0] : sp.sayfa;
  return Math.max(1, Number(raw ?? "1") || 1);
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { marka } = await params;
  const data = await loadBrandPage(marka);
  if (!data) return { title: "Marka bulunamadı — altr" };

  const { brand, stats, styles } = data;
  const tarz = styles.map((s) => STYLE_LABEL[s] ?? s).join(", ");
  const fiyat =
    stats.priceLow != null && stats.priceHigh != null
      ? ` Fiyatlar ${formatPrice(stats.priceLow, stats.currency)}–${formatPrice(stats.priceHigh, stats.currency)}.`
      : "";

  return {
    title: `${brand.name} — ürünleri ve fiyatları | altr`,
    description:
      `${brand.name} markasının ${stats.total} parçası altr vitrininde: ` +
      // CAT_LOWER elle yazılı: otomatik küçültme "HOODIE"yi "hoodıe" yapıyor (bkz. types.ts)
      `${stats.categories.slice(0, 4).map((c) => CAT_LOWER[c.cat as ProductCat] ?? c.cat).join(", ")}.` +
      `${fiyat}${tarz ? ` Tarz: ${tarz}.` : ""}`,
    alternates: { canonical: `/${brand.slug}` },
    openGraph: {
      type: "website",
      title: `${brand.name} — altr`,
      description: `${brand.name} markasının ${stats.total} parçası, tek vitrinde.`,
      url: `/${brand.slug}`,
    },
  };
}

export default async function MarkaPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { marka } = await params;
  const page = pageOf(await searchParams);
  const data = await loadBrandPage(marka, page);
  if (!data) notFound();

  return (
    <PageChrome
      crumb={
        <>
          <a href="/markalar" style={{ color: "var(--muted3)", textDecoration: "none" }}>
            ALTR / MARKALAR
          </a>{" "}
          {/* Marka adlarında DÜZ büyütme: Türkçe kural "Studio"yu "STUDİO", "I Am Not
              Basic"i "İ AM NOT BASİC" yapıyor. Markaların çoğu Latin/İngilizce. */}
          / {data.brand.name.toUpperCase()}
        </>
      }
    >
      {/* Ekranın kendisi BrandPage'te — vitrinin marka sekmesi de aynı bileşeni çiziyor.
          Burada handler verilmiyor: bu sayfada her tıklanabilir gerçek bir bağ. */}
      <BrandPage data={data} page={page} />
    </PageChrome>
  );
}
