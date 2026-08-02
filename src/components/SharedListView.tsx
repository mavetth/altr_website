"use client";
import { formatPrice } from "@/lib/query";
import { useStore } from "@/store";
import { ProductCard } from "./ProductCard";
import { ProductImage } from "./ProductImage";
import { BrandLogo } from "./BrandLogo";
import { useLang } from "@/lib/lang";

/**
 * Linkle gelen liste — SALT OKUNUR.
 *
 * Ürünler sunucuda çözülüp geldiği için alan kişinin hesabı, hatta bu siteyi daha önce
 * açmış olması gerekmiyor. "Kendi listelerime kopyala" dediğinde liste kendi cihazına
 * yazılır ve oradan sonrası onundur.
 */
export function SharedListView() {
  const shared = useStore((s) => s.shared);
  const importShared = useStore((s) => s.importShared);
  const setView = useStore((s) => s.setView);
  const openDetail = useStore((s) => s.openDetail);
  const { t, lang } = useLang();
  const loc = lang === "en" ? "en-US" : "tr-TR";
  if (!shared) return null;

  const items = shared.items;
  const kombin = shared.mode === "kombin";
  // Kombinde toplam ancak HER parçanın fiyatı biliniyorsa yazılır (bkz. CombineBuilder).
  const allPriced = items.length > 0 && items.every((p) => p.price != null);
  const total = items.reduce((s, p) => s + (p.price ?? 0), 0);
  const currency = items.find((p) => p.price != null)?.currency ?? "TRY";

  return (
    <div style={{ padding: "4px 0 40px" }}>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, letterSpacing: ".28em", color: "var(--grn)", marginBottom: 8 }}>
        {kombin ? t("PAYLAŞILAN KOMBİN") : t("PAYLAŞILAN LİSTE")}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap", marginBottom: 10 }}>
        <span className="vit-title" style={{ fontFamily: "'Anton', sans-serif", fontSize: 47, letterSpacing: ".02em", color: "var(--fg-bright)", textTransform: "uppercase" }}>
          {t(shared.name)}
        </span>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, letterSpacing: ".16em", color: "var(--grn)" }}>
          {t(`${items.length} PARÇA`)}
          {kombin && allPriced && ` · ${formatPrice(total, currency, loc)}`}
        </span>
      </div>

      <div className="vit-intro" style={{ maxWidth: 560, fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, lineHeight: 1.75, color: "var(--muted)", borderLeft: "2px solid var(--grn)", paddingLeft: 16, marginBottom: 26 }}>
        {kombin
          ? t("biri sana bu kombini gönderdi — her kategoriden bir parça, üstten alta bir kıyafet. hesap gerekmiyor; beğendiğin parçayı tek tek alabilir ya da kombinin tamamını kendi listelerine kopyalayabilirsin.")
          : t("biri sana bu listeyi gönderdi. hesap gerekmiyor — istersen olduğu gibi kendi listelerine kopyala, istersen tek tek beğendiklerini askı düğmesiyle al.")}
        {shared.missing > 0 && (
          <span style={{ color: "var(--muted3)" }}>
            {" "}
            ({shared.missing} {t("ürün artık katalogda yok, listeden düştü.")})
          </span>
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 32 }}>
        <span
          className="fbox"
          onClick={importShared}
          style={{
            fontFamily: "'Space Mono', monospace",
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: ".14em",
            padding: "12px 18px",
            background: "var(--grn)",
            color: "var(--on-accent)",
            border: "1px solid var(--grn)",
          }}
        >
          {kombin ? t("KOMBİNİ KENDİME KOPYALA") : t("LİSTEYİ KENDİME KOPYALA")}
        </span>
        <span
          className="fbox"
          onClick={() => setView("grid")}
          style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: 13,
            letterSpacing: ".14em",
            padding: "12px 18px",
            border: "1px solid var(--line)",
            color: "var(--muted)",
          }}
        >
          {t("VİTRİNİ KEŞFET →")}
        </span>
      </div>

      {items.length === 0 ? (
        <div style={{ padding: "64px 20px", border: "1px dashed var(--line2)", borderRadius: 20, textAlign: "center" }}>
          <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 35, color: "var(--muted3)", textTransform: "uppercase" }}>
            {kombin ? t("kombin boş") : t("liste boş")}
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, color: "var(--muted3)", marginTop: 10 }}>
            {t("linkteki ürünler katalogda bulunamadı — kaldırılmış olabilirler.")}
          </div>
        </div>
      ) : kombin ? (
        /* Kombin düzeni: parçalar üstten alta TEK SÜTUNDA, kategori etiketiyle. Izgara
           "seçenekler" hissi veriyor; kombin bir seçenek listesi değil, tek bir kıyafet. */
        <div className="kombin-col" style={{ maxWidth: 720 }}>
          {items.map((p, i) => (
            <div
              key={p.id}
              onClick={() => openDetail(items, i)}
              style={{
                display: "grid",
                gridTemplateColumns: "128px minmax(0,1fr)",
                gap: 20,
                alignItems: "center",
                padding: "16px 0",
                borderBottom: "1px solid var(--line4)",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  position: "relative",
                  aspectRatio: "4/5",
                  border: "2px solid var(--fg-bright)",
                  borderRadius: 16,
                  overflow: "hidden",
                  background: "var(--tex)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ProductImage src={p.image} fallbacks={p.images} label="·" w={360} sizes="128px" />
              </div>
              <div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: ".24em", color: "var(--grn)" }}>
                  {t(p.category)}
                </div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 19, letterSpacing: ".05em", color: "var(--fg)", textTransform: "uppercase", marginTop: 6 }}>
                  {p.name}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, color: "var(--grn)" }}>
                    {formatPrice(p.price, p.currency, loc)}
                  </span>
                  <BrandLogo
                    slug={p.brandSlug}
                    name={p.brand}
                    h={14}
                    /* 110 → 200: bkz. BrandLogo — "logo inceldi, adı da yaz" kuralı
                       kalktı, geniş wordmark'ların okunması artık tavana bağlı. */
                    maxW={200}
                    /* fiyatla aynı satırda duruyor: amblem satırı büyütmesin */
                    maxH={23}
                    fallback={
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, letterSpacing: ".1em", color: "var(--muted3)", textTransform: "uppercase" }}>
                        {p.brand}
                      </span>
                    }
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid-inner" style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: "38px 34px" }}>
          {items.map((p, i) => (
            <ProductCard key={p.id} p={p} context={items} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
