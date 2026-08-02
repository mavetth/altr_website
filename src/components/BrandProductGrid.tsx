"use client";
import type { Product } from "@/lib/types";
import { defaultVariantIndex, formatPrice } from "@/lib/query";
import { ProductImage } from "./ProductImage";
import { RestockVote } from "./RestockVote";
import { useLang } from "@/lib/lang";

/**
 * Marka sayfasının ürün ızgarası.
 *
 * Vitrinin ProductCard'ından ayrı, bilerek: orada kart bir MODAL açar (uygulama içi
 * gezinme), burada kart gerçek bir `<a>` ve markanın ürün sayfasına gider. Marka sayfası
 * arama motoruna ve paylaşıma açık kalıcı bir sayfa; içindeki bağlar da gerçek bağ olmalı.
 * Vitrin/liste etkileşimi (askı düğmesi, renk seçimi) burada yok — o mağazaya bağlı değil.
 *
 * Vitrinin İÇİNDEN (marka sekmesi) açıldığında `onOpen` verilir: sol tık ürün modalini
 * açar, orta tık / ctrl+tık yine markanın kendi sayfasına gider.
 */
export function BrandProductGrid({
  items,
  onOpen,
}: {
  items: Product[];
  onOpen?: (items: Product[], index: number) => void;
}) {
  const { t, lang } = useLang();
  const loc = lang === "en" ? "en-US" : "tr-TR";
  if (!items.length) {
    return (
      <div style={{ padding: "60px 20px", border: "1px dashed var(--line2)", textAlign: "center", color: "var(--muted3)" }}>
        {t("bu sayfada ürün yok.")}
      </div>
    );
  }

  return (
    <div
      className="brand-grid"
      style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: "30px 24px" }}
    >
      {items.map((p, i) => {
        const v = p.variants[defaultVariantIndex(p)];
        const image = (v && p.images[v.imgs[0]]) ?? p.image;
        const price = v?.price ?? p.price;
        const inStock = v ? v.inStock : p.inStock;
        const href = v?.url ?? p.productUrl;

        return (
          <article key={p.id} style={{ position: "relative" }}>
            <a
              href={href ?? "#"}
              target={onOpen ? undefined : "_blank"}
              rel="noopener noreferrer nofollow"
              onClick={
                onOpen
                  ? (e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                      e.preventDefault();
                      onOpen(items, i);
                    }
                  : undefined
              }
              style={{ display: "block", color: "inherit", textDecoration: "none" }}
            >
              <div
                className="prod-img"
                style={{
                  position: "relative",
                  aspectRatio: "1",
                  background: "var(--tex)",
                  border: "2px solid var(--fg-bright)",
                  borderRadius: 60,
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    filter: inStock ? undefined : "grayscale(1)",
                    opacity: inStock ? 1 : 0.5,
                  }}
                >
                  <ProductImage
                    src={image}
                    fallbacks={[...(v?.imgs.map((i) => p.images[i]) ?? []), ...p.images, p.image]}
                    w={480}
                    sizes="(max-width: 600px) 46vw, 240px"
                  />
                </span>
              </div>

              <div style={{ padding: "12px 4px 0", textAlign: "center" }}>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, letterSpacing: ".06em", color: "var(--fg)", textTransform: "uppercase" }}>
                  {p.name}
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, color: "var(--grn)", marginTop: 6 }}>
                  {formatPrice(price, p.currency, loc)}
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: ".14em", color: "var(--faint)", marginTop: 5 }}>
                  {t(p.category)}
                </div>
              </div>
            </a>

            {/* Tükenmişte "satın al" bağı ölü; talep düğmesi vitrindekiyle aynı sinyali toplar. */}
            {!inStock && (
              <span style={{ position: "absolute", top: 16, left: 16, zIndex: 3 }}>
                <RestockVote p={p} />
              </span>
            )}
          </article>
        );
      })}
    </div>
  );
}
