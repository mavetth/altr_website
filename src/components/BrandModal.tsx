"use client";
import { useStore } from "@/store";
import { trackOutbound } from "@/lib/track";
import { GoModal } from "./GoModal";
import { brandLogoSlug } from "./BrandLogo";

/**
 * Vitrindeki marka/ürün çıkış modali — store'a bağlı ince sarmalayıcı.
 *
 * Kaydırma ritüelinin kendisi GoModal'da; marka sayfasındaki MAĞAZAYA GİT düğmesi
 * (StoreGate) de aynı bileşeni kullanır, böylece iki çıkış yolu birebir aynı davranır.
 */
export function BrandModal({ urlByName }: { urlByName: Record<string, string | null> }) {
  const brand = useStore((s) => s.modalBrand);
  const target = useStore((s) => s.modalTarget);
  const product = useStore((s) => s.modalProduct);
  const query = useStore((s) => s.query);
  const going = useStore((s) => s.going);
  const setGoing = useStore((s) => s.setGoing);
  const close = useStore((s) => s.closeBrandModal);
  const openMarka = useStore((s) => s.openMarka);

  if (!brand) return null;

  const destUrl = target || urlByName[brand] || null;
  // Marka modalı bazen ürün olmadan açılıyor (marka çipi) — o zaman slug'ı addan üret.
  const brandPageSlug = product?.brandSlug ?? brandLogoSlug(brand);

  return (
    <GoModal
      brand={brand}
      brandSlug={brandPageSlug}
      destUrl={destUrl}
      toProduct={Boolean(target)}
      going={going}
      setGoing={setGoing}
      onClose={close}
      onConfirm={() =>
        trackOutbound({
          url: destUrl,
          brand,
          brandSlug: product?.brandSlug,
          product,
          ctxCat: query.cat,
          ctxQuery: query.q || undefined,
        })
      }
      brandPageHref={brandPageSlug ? `/${brandPageSlug}` : null}
      // Vitrin içindeyken marka sayfası bir SEKME — sayfa yeniden yüklenmez.
      onBrandPage={
        brandPageSlug
          ? () => {
              close();
              openMarka(brandPageSlug);
            }
          : undefined
      }
    />
  );
}
