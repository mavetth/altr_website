import type { Metadata } from "next";
import { loadBrandIndex } from "@/lib/brand-page";
import { PageChrome } from "@/components/PageChrome";
import { BrandIndex } from "@/components/BrandIndex";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Markalar — altr",
  description:
    "altr vitrinindeki tüm alternatif giyim markaları, alfabetik. Her markanın kendi sayfasında ürünleri, fiyat aralığı ve tarzı.",
  alternates: { canonical: "/markalar" },
};

/**
 * `/markalar` — marka rehberinin KALICI adresi.
 *
 * Ekranın kendisi BrandIndex'te ve vitrinin MARKALAR sekmesi de aynı bileşeni çiziyor.
 * Bu yol dışarıdan gelen ziyaretçi, paylaşılan link ve arama motoru için duruyor:
 * içerik sunucuda çiziliyor, bağlar gerçek `<a>`.
 */
export default async function MarkalarPage() {
  const rows = await loadBrandIndex();
  return (
    <PageChrome crumb="ALTR / MARKALAR">
      <BrandIndex rows={rows} />
    </PageChrome>
  );
}
