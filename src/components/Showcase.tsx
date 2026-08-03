"use client";
import type { Product } from "@/lib/types";
import { formatPrice, defaultVariantIndex } from "@/lib/query";
import { useStore } from "@/store";
import { useLang } from "@/lib/lang";
import { ProductImage } from "./ProductImage";
import { ColorSwatches } from "./ColorSwatches";
import { ListBar } from "./ListBar";
import { PublicLists } from "./PublicLists";
import { PublicListModal } from "./PublicListModal";

export function Showcase() {
  const tab = useStore((s) => s.vitrinTab);
  const setVitrinTab = useStore((s) => s.setVitrinTab);
  const showcase = useStore((s) => s.showcase);
  const lists = useStore((s) => s.lists);
  const activeId = useStore((s) => s.activeListId);
  const activeName = lists.find((l) => l.id === activeId)?.name ?? "VİTRİNİM";
  const openCats = useStore((s) => s.openCats);
  const toggleGroup = useStore((s) => s.toggleGroup);
  const removeShowcase = useStore((s) => s.removeShowcase);
  const openDetail = useStore((s) => s.openDetail);
  const { t, lang } = useLang();
  const loc = lang === "en" ? "en-US" : "tr-TR";

  // kategoriye göre grupla (ilk görülme sırasıyla)
  const order: string[] = [];
  const map: Record<string, Product[]> = {};
  for (const p of showcase) {
    if (!map[p.category]) {
      map[p.category] = [];
      order.push(p.category);
    }
    map[p.category].push(p);
  }

  return (
    <div style={{ padding: "4px 0 40px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap", marginBottom: 10 }}>
        <span className="vit-title" style={{ fontFamily: "'Anton', sans-serif", fontSize: 47, letterSpacing: ".02em", color: "var(--fg-bright)", textTransform: "uppercase" }}>{t(activeName)}</span>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, letterSpacing: ".16em", color: "var(--grn)" }}>{t(`${showcase.length} PARÇA`)}</span>
      </div>
      <div className="vit-intro" style={{ maxWidth: 560, fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, lineHeight: 1.75, color: "var(--muted)", borderLeft: "2px solid var(--grn)", paddingLeft: 16, marginBottom: 26 }}>
        {t("burası senin köşen.")} <span style={{ color: "var(--fg)" }}>{t("alıcı gözüyle bakıyoruz")}</span>{" "}
        {t("— beğendiğin parçaları kategorilere göre büyük büyük, sakince süzmek için buraya ayırdın. beden yok, gürültü yok; sadece parça, fiyat ve renk. birden çok liste tutabilir, herhangi birini linkle paylaşabilir ya da herkese açabilirsin.")}
      </div>

      {/* SEKMELER — kendi listelerim / herkese açık akış. View'a değil vitrinin İÇİNE
          kondu: sol menüdeki VİTRİNİM girişi ikisini birden kapsıyor. */}
      <div style={{ display: "flex", gap: 0, marginBottom: 22, borderBottom: "1px solid var(--line3)" }}>
        {([
          ["listelerim", "LİSTELERİM"],
          ["acik", "HERKESE AÇIK"],
        ] as const).map(([k, label]) => {
          const on = tab === k;
          return (
            <span
              key={k}
              className="nav-item"
              onClick={() => setVitrinTab(k)}
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 13,
                letterSpacing: ".16em",
                padding: "10px 18px",
                color: on ? "var(--fg-bright)" : "var(--muted)",
                borderBottom: `2px solid ${on ? "var(--grn)" : "transparent"}`,
                marginBottom: -1,
              }}
            >
              {t(label)}
            </span>
          );
        })}
      </div>

      {tab === "acik" && <PublicLists />}

      {tab === "listelerim" && (
        <>
          <ListBar />

          {showcase.length === 0 && (
            <div style={{ padding: "64px 20px", border: "1px dashed var(--line2)", borderRadius: 20, textAlign: "center" }}>
              <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 35, color: "var(--muted3)", textTransform: "uppercase" }}>{t("vitrin boş")}</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, color: "var(--muted3)", marginTop: 10 }}>
                {t("ürün görselinin sağ üst köşesindeki askı düğmesine bas — beğendiklerin burada birikir.")}
              </div>
            </div>
          )}

          {order.map((cat) => {
            const items = map[cat];
            const open = openCats[cat] !== false;
            return (
              <div key={cat} style={{ marginBottom: 26, borderBottom: "1px solid var(--line4)", paddingBottom: 28 }}>
                <span className="nav-item" onClick={() => toggleGroup(cat)} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                  <span style={{ fontFamily: "'Anton', sans-serif", fontSize: 27, letterSpacing: ".03em", color: "var(--fg)", textTransform: "uppercase" }}>{t(cat)}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: "var(--grn)" }}>{items.length}</span>
                  <span style={{ flex: 1, height: 1, background: "var(--line3)" }} />
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 21, color: "var(--muted)", width: 18, textAlign: "center" }}>{open ? "–" : "+"}</span>
                </span>
                {open && (
                  <div className="vit-scroll" style={{ display: "flex", gap: 22, overflowX: "auto", padding: "4px 2px 18px", scrollSnapType: "x mandatory" }}>
                    {items.map((it, idx) => (
                      <div key={it.id} className="vit-item" style={{ flex: "0 0 calc((100% - 44px) / 3)", minWidth: 220, scrollSnapAlign: "start" }}>
                        <div
                          className="vit-img"
                          onClick={() => openDetail(items, idx, defaultVariantIndex(items[idx]))}
                          style={{ position: "relative", aspectRatio: "4/5", background: "var(--tex)", border: "2px solid var(--fg-bright)", borderRadius: 20, overflow: "hidden", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                          {/*
                            `w`/`sizes` GERÇEK kart genişliğine göre kalibre edildi (bkz.
                            ProductCard.tsx SPEC'teki aynı ders, 2026-07-30). Eskiden
                            `w:480` + `sizes:"300px"` yazıyordu; 1920px'te ÖLÇÜLEN gerçek
                            kart genişliği 512px'ti (3 sütun, sabit-px sidebar payı vw'ye
                            orantısız düşüyor) — tarayıcı 300px'lik bir yuvaya 480'in
                            altını indirip BÜYÜTEREK yerleştiriyordu, "İri" ızgaradan
                            (imgW 1200) belirgin daha bulanık duruyordu. `sizes` artık
                            sidebar KAPALIYKEN bile (kart payı büyür) güvenli kalsın diye
                            biraz yukarı yuvarlanmış vw; `w` tavanı İri ile aynı 1200.
                          */}
                          <ProductImage
                            src={it.image}
                            fallbacks={it.images}
                            label={t("[ GÖRSEL ]")}
                            w={1200}
                            sizes="(max-width: 600px) 74vw, 32vw"
                          />
                          <span
                            className="vit-rm"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeShowcase(it.id);
                            }}
                            title={t("Vitrinden çıkar")}
                            style={{ position: "absolute", top: 10, right: 10, zIndex: 3, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--muted3)", background: "var(--btn-glass)", color: "var(--fg)", borderRadius: "50%", backdropFilter: "blur(3px)" }}
                          >
                            {/* metin ✕ yerine SVG: font taban çizgisine bağlı kalmadan kutunun tam ortasında durur (bkz. ProductModal CloseIcon) */}
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ display: "block" }}>
                              <path d="M5 5l14 14M19 5 5 19" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                            </svg>
                          </span>
                        </div>
                        <div style={{ padding: "14px 2px 0" }}>
                          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 18, letterSpacing: ".04em", color: "var(--fg)" }}>{it.name.toLowerCase()}</div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 9 }}>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 17, color: "var(--grn)" }}>{formatPrice(it.price, it.currency, loc)}</span>
                            {/* Ham `it.colors` hex'leri basılmıyordu: aynı ürün ızgarada
                                fotoğraftan ölçülen doğru renkte, vitrinde kaynağın (çoğu
                                zaman yanlış) hex'iyle görünüyordu. Aynı bileşen kullanılınca
                                iki yerde de aynı renk çıkıyor. Salt okunur: seçim yok. */}
                            <ColorSwatches
                              variants={it.variants}
                              images={it.images}
                              active={-1}
                              onPick={() => {}}
                              size={16}
                              max={3}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
              })}
        </>
      )}

      {/* Açılan herkese açık liste — vitrinden çıkmadan bakılıp kapatılır. */}
      <PublicListModal />
    </div>
  );
}
