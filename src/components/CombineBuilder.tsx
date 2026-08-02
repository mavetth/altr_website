"use client";
import { useMemo, useState } from "react";
import type { Product } from "@/lib/types";
import { formatPrice } from "@/lib/query";
import { shareUrl } from "@/lib/lists";
import { useStore } from "@/store";
import { ProductImage } from "./ProductImage";
import { useLang } from "@/lib/lang";

const MONO = "'IBM Plex Mono', monospace";
const SPACE = "'Space Mono', monospace";

/**
 * KOMBİN KURUCU — listeden bir kıyafet çıkarma ekranı.
 *
 * Liste paylaşımı "şunlara bak" der; kombin "şöyle giyin" der. Fark seçimde: kombinde
 * her kategoriden EN FAZLA BİR parça olur, çünkü kombin tam da budur — iki pantolonu
 * aynı anda giyemezsin. Bu yüzden seçim kategori kategori, tek seçimli.
 *
 * Aynı paylaşım altyapısı (kısa kodlar linkte, sunucu SSR'de çözer) kullanılır; karşı
 * tarafın hesabı olması gerekmez.
 */
export function CombineBuilder({ onClose }: { onClose: () => void }) {
  const showcase = useStore((s) => s.showcase);
  const lists = useStore((s) => s.lists);
  const activeId = useStore((s) => s.activeListId);
  const showToast = useStore((s) => s.showToast);
  const { t, lang } = useLang();
  const loc = lang === "en" ? "en-US" : "tr-TR";

  const listName = lists.find((l) => l.id === activeId)?.name ?? "KOMBİN";
  const [name, setName] = useState(`${listName} KOMBİNİ`);
  const [picked, setPicked] = useState<Record<string, string>>({}); // kategori -> ürün id
  const [link, setLink] = useState<string | null>(null);

  // Kategoriye göre grupla, listedeki ilk görülme sırasını koru.
  const groups = useMemo(() => {
    const order: string[] = [];
    const map: Record<string, Product[]> = {};
    for (const p of showcase) {
      if (!map[p.category]) {
        map[p.category] = [];
        order.push(p.category);
      }
      map[p.category].push(p);
    }
    return order.map((cat) => ({ cat, items: map[cat] }));
  }, [showcase]);

  const chosen = useMemo(() => {
    const ids = new Set(Object.values(picked));
    // Kombindeki sıra listedeki sıradır — kullanıcının kurduğu düzen korunur.
    return showcase.filter((p) => ids.has(p.id));
  }, [picked, showcase]);

  const total = chosen.reduce((s, p) => s + (p.price ?? 0), 0);
  const currency = chosen.find((p) => p.price != null)?.currency ?? "TRY";
  const allPriced = chosen.length > 0 && chosen.every((p) => p.price != null);

  const pick = (cat: string, id: string) =>
    setPicked((cur) => {
      const next = { ...cur };
      // aynı parçaya tekrar basmak seçimi kaldırır: kategori kombinde olmayabilir de
      if (next[cat] === id) delete next[cat];
      else next[cat] = id;
      return next;
    });

  const share = () => {
    if (!chosen.length) {
      showToast("Önce en az bir parça seç.");
      return;
    }
    const url = shareUrl(
      { name: name.trim() || "KOMBİN", ids: chosen.map((p) => p.id) },
      typeof window !== "undefined" ? window.location.origin : "",
      "kombin",
    );
    setLink(url);
    navigator.clipboard?.writeText(url).then(
      () => showToast("Kombin linki kopyalandı."),
      () => showToast("Linki elle kopyala."),
    );
  };

  return (
    <div style={{ border: "1px solid var(--grn)", padding: "20px 20px 22px", marginBottom: 26 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
        <span style={{ fontFamily: "'Anton', sans-serif", fontSize: 27, letterSpacing: ".03em", color: "var(--fg-bright)", textTransform: "uppercase" }}>
          {t("KOMBİN KUR")}
        </span>
        <span className="nav-item" onClick={onClose} style={{ fontFamily: SPACE, fontSize: 12, letterSpacing: ".14em", color: "var(--muted)" }}>
          {t("VAZGEÇ ✕")}
        </span>
      </div>
      <div style={{ fontFamily: MONO, fontSize: 12.5, lineHeight: 1.7, color: "var(--muted)", marginBottom: 18 }}>
        {t("her kategoriden bir parça seç — üstten alta bir kıyafet çıksın. seçmediğin kategori kombine girmez. link karşı tarafa kombini olduğu gibi taşır, hesap gerekmez.")}
      </div>

      {groups.length === 0 && (
        <div style={{ fontFamily: MONO, fontSize: 13, color: "var(--muted3)" }}>
          {t("listende parça yok — önce birkaç ürün ekle.")}
        </div>
      )}

      {groups.map(({ cat, items }) => (
        <div key={cat} style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
            <span style={{ fontFamily: SPACE, fontSize: 11, letterSpacing: ".24em", color: picked[cat] ? "var(--grn)" : "var(--faint)" }}>
              {t(cat)}
            </span>
            <span style={{ flex: 1, height: 1, background: "var(--line4)" }} />
          </div>
          <div className="vit-scroll" style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6 }}>
            {items.map((it) => {
              const on = picked[cat] === it.id;
              return (
                <span
                  key={it.id}
                  onClick={() => pick(cat, it.id)}
                  title={it.name}
                  style={{
                    position: "relative",
                    flex: "none",
                    width: 84,
                    height: 105,
                    border: `2px solid ${on ? "var(--grn)" : "var(--line)"}`,
                    borderRadius: 12,
                    overflow: "hidden",
                    background: "var(--tex)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    opacity: on || !picked[cat] ? 1 : 0.45,
                  }}
                >
                  <ProductImage src={it.image} fallbacks={it.images} label="·" w={240} sizes="84px" />
                  {on && (
                    <span
                      style={{
                        position: "absolute",
                        top: 5,
                        right: 5,
                        zIndex: 2,
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: "var(--grn)",
                        color: "var(--on-accent)",
                        fontFamily: SPACE,
                        fontSize: 11,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      ✓
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      ))}

      {/* seçilenlerin özeti */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", margin: "6px 0 14px", fontFamily: MONO, fontSize: 13, color: "var(--muted)" }}>
        <span>
          <span style={{ color: "var(--grn)" }}>{chosen.length}</span> {t("parça")}
        </span>
        {/* Toplam yalnız HER parçanın fiyatı biliniyorsa yazılır: eksik veriyle
            hesaplanan bir toplam, kullanıcıya yanlış bir sayı söylemek olur. */}
        {allPriced && (
          <span>
            {t("toplam")} <span style={{ color: "var(--grn)" }}>{formatPrice(total, currency, loc)}</span>
          </span>
        )}
        {chosen.length > 0 && !allPriced && (
          <span style={{ color: "var(--faint)" }}>{t("bazı parçaların fiyatı yok — toplam verilmedi")}</span>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("kombin adı")}
          style={{
            flex: 1,
            minWidth: 180,
            padding: "10px 12px",
            background: "var(--bg3)",
            border: "1px solid var(--line)",
            color: "var(--fg)",
            fontFamily: MONO,
            fontSize: 13,
            outline: "none",
          }}
        />
        <span
          className="fbox"
          onClick={share}
          style={{
            fontFamily: SPACE,
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: ".14em",
            padding: "11px 18px",
            border: "1px solid var(--grn)",
            background: chosen.length ? "var(--grn)" : "transparent",
            color: chosen.length ? "var(--on-accent)" : "var(--grn)",
          }}
        >
          {t("⇗ KOMBİNİ PAYLAŞ")}
        </span>
      </div>

      {link && (
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            style={{
              flex: 1,
              minWidth: 240,
              padding: "9px 11px",
              background: "var(--bg3)",
              border: "1px solid var(--line)",
              color: "var(--muted)",
              fontFamily: MONO,
              fontSize: 12,
              outline: "none",
            }}
          />
          <span className="fbox" onClick={() => setLink(null)} style={{ fontFamily: SPACE, fontSize: 12, letterSpacing: ".14em", padding: "9px 13px", border: "1px solid var(--line)", color: "var(--muted)" }}>
            {t("KAPAT")}
          </span>
        </div>
      )}
    </div>
  );
}
