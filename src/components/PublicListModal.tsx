"use client";
import { useStore } from "@/store";
import { formatPrice, defaultVariantIndex } from "@/lib/query";
import { ProductImage } from "./ProductImage";
import { ColorSwatches } from "./ColorSwatches";
import { useLang } from "@/lib/lang";

/**
 * Açılan HERKESE AÇIK liste — salt okunur.
 *
 * `SharedListView` linkle gelen listeler için tüm sayfayı kaplıyor ve store'un `shared`
 * alanına bağlı; burada vitrinden çıkmadan bakıp kapanabilmek gerekiyor, o yüzden ayrı
 * ve hafif bir katman. Ürün kartına basınca normal ürün modalı açılır — yani listeden
 * ürüne geçiş her yerdeki gibi çalışır.
 */
export function PublicListModal() {
  const open = useStore((s) => s.openPublic);
  const close = useStore((s) => s.closePublicList);
  const openDetail = useStore((s) => s.openDetail);
  const toggleShowcase = useStore((s) => s.toggleShowcase);
  const { t, lang } = useLang();
  const loc = lang === "en" ? "en-US" : "tr-TR";

  if (!open) return null;
  const { list, items } = open;
  const missing = list.ids.length - items.length;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 70, display: "flex", justifyContent: "center" }}>
      <div onClick={close} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.82)" }} />
      <div
        className="panel-anim"
        style={{
          position: "relative",
          width: "min(1100px, 94vw)",
          height: "100%",
          overflowY: "auto",
          background: "var(--bg2)",
          borderLeft: "2px solid var(--fg-bright)",
          borderRight: "2px solid var(--fg-bright)",
          padding: "26px 28px 60px",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 8 }}>
          <div>
            <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 40, letterSpacing: ".02em", color: "var(--fg-bright)", textTransform: "uppercase", lineHeight: 1.1 }}>
              {list.name}
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, letterSpacing: ".05em", color: "var(--muted)", marginTop: 8 }}>
              <span style={{ color: "var(--grn)" }}>@{list.nick}</span>
              <span style={{ color: "var(--muted3)" }}> · </span>
              {items.length} {t("parça")}
              {missing > 0 && (
                <span style={{ color: "var(--muted3)" }}> · {missing} {t("ürün artık satışta değil")}</span>
              )}
            </div>
          </div>
          <span
            className="nav-item"
            onClick={close}
            style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, letterSpacing: ".14em", color: "var(--muted)", flex: "none" }}
          >
            {t("KAPAT ✕")}
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
            gap: 24,
            marginTop: 26,
          }}
        >
          {items.map((it, idx) => (
            <div key={it.id}>
              <div
                onClick={() => openDetail(items, idx, defaultVariantIndex(it))}
                style={{
                  position: "relative",
                  aspectRatio: "4/5",
                  background: "var(--tex)",
                  border: "2px solid var(--fg-bright)",
                  borderRadius: 18,
                  overflow: "hidden",
                  cursor: "pointer",
                }}
              >
                <ProductImage src={it.image} fallbacks={it.images} label={t("[ GÖRSEL ]")} w={480} sizes="(max-width: 700px) 46vw, 240px" />
                {/* Başkasının listesinden kendi vitrinine parça alabilmek, bu sekmenin
                    asıl işlevi: keşfet -> beğen -> kendi listene at. */}
                <span
                  className="nav-item"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleShowcase(it);
                  }}
                  title={t("Kendi listeme ekle")}
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    zIndex: 3,
                    width: 28,
                    height: 28,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid var(--muted3)",
                    background: "var(--btn-glass)",
                    color: "var(--fg)",
                    borderRadius: "50%",
                    backdropFilter: "blur(3px)",
                    fontFamily: "'Space Mono', monospace",
                    fontSize: 15,
                  }}
                >
                  +
                </span>
              </div>
              <div style={{ padding: "12px 2px 0" }}>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, letterSpacing: ".03em", color: "var(--fg)" }}>
                  {it.name.toLowerCase()}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 8 }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 15, color: "var(--grn)" }}>
                    {formatPrice(it.price, it.currency, loc)}
                  </span>
                  <ColorSwatches variants={it.variants} images={it.images} active={-1} onPick={() => {}} size={15} max={3} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {!items.length && (
          <div style={{ padding: "64px 20px", border: "1px dashed var(--line2)", borderRadius: 20, textAlign: "center", marginTop: 26 }}>
            <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 30, color: "var(--muted3)", textTransform: "uppercase" }}>
              {t("bu listedeki ürünler artık satışta değil")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
