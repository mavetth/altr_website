"use client";
import type { BrandPageData } from "@/lib/brand-page-shared";
import { useStore } from "@/store";
import { BrandPage } from "./BrandPage";
import { BrandModal } from "./BrandModal";
import { ProductModal } from "./ProductModal";

/**
 * `/<marka>` sayfasının ETKİLEŞİMLİ katmanı.
 *
 * Sayfanın kendisi sunucuda çizilir ve SEO/paylaşım için her ürün gerçek `<a>` kalır
 * (bkz. BrandProductGrid, PageChrome). Bu sarmalayıcı yalnız JS açıkken üstüne biner:
 * `onOpenProduct` verilince BrandProductGrid'in sol tık handler'ı devreye girer ve
 * ürüne tıklamak sayfadan çıkmak yerine ürün modalini açar — vitrinin marka sekmesiyle
 * (bkz. BrandViews.tsx BrandPageView) BİREBİR aynı davranış, aynı `openDetail` deseni.
 *
 * ProductModal/BrandModal burada AYRICA çizilir: `/`de App.tsx bunları global olarak
 * bir kez çiziyor, ama bu sayfa App.tsx'in dışında (bkz. PageChrome — "bilerek o
 * mağazaya bağlanmaz"), yani modallerin kendisi de burada yeniden takılmalı.
 */
export function BrandPageClient({
  data,
  page,
  urlByName,
}: {
  data: BrandPageData;
  page: number;
  urlByName: Record<string, string | null>;
}) {
  const openDetail = useStore((s) => s.openDetail);
  return (
    <>
      <BrandPage data={data} page={page} handlers={{ onOpenProduct: (items, i) => openDetail(items, i) }} />
      <BrandModal urlByName={urlByName} />
      <ProductModal />
    </>
  );
}
