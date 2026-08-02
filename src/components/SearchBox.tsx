"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { CATS } from "@/lib/types";
import { searchFold } from "@/lib/slug";
import { useStore } from "@/store";
import { useT } from "@/lib/lang";

/**
 * Arama kutusu — hem masaüstü TopBar'ında hem mobildeki bağımsız sabit arama
 * çubuğunda (bkz. App.tsx) kullanılan, kendi state'ini yöneten bileşen.
 *
 * ÖNERİ AÇILIRI: yazarken marka ve kategori adayları çıkar. Tıklanınca arama metni
 * DEĞİL doğrudan FİLTRE uygulanır (marka → brands, kategori → cat) — "nike" yazıp
 * ürün adında "nike" geçenleri görmek yerine markanın tamamını görmek istiyorsa
 * doğru yol bu. Metin de temizlenir, yoksa iki filtre üst üste biner.
 */
export function SearchBox({
  className,
  style,
  brands,
}: {
  className?: string;
  style?: CSSProperties;
  /** Öneri için marka adları. Verilmezse yalnız kategori önerilir. */
  brands?: string[];
}) {
  const q = useStore((s) => s.query.q);
  const setQuery = useStore((s) => s.setQuery);
  const toggleBrand = useStore((s) => s.toggleBrand);
  const setView = useStore((s) => s.setView);
  const t = useT();

  const [local, setLocal] = useState(q);
  const [focused, setFocused] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => setLocal(q), [q]);
  // arama debounce
  useEffect(() => {
    const t = setTimeout(() => {
      if (local !== q) setQuery({ q: local });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local]);

  // Dışarı tıklayınca açılır kapansın (blur tek başına yetmiyor: önerinin kendisine
  // tıklamak da blur tetikliyor ve tıklama kaydedilmeden liste kapanıyordu).
  useEffect(() => {
    if (!focused) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [focused]);

  const suggestions = useMemo(() => {
    const needle = searchFold(local.trim());
    if (needle.length < 2) return [];
    const out: Array<{ kind: "marka" | "kategori"; label: string }> = [];
    for (const b of brands ?? []) {
      if (searchFold(b).includes(needle)) out.push({ kind: "marka", label: b });
      if (out.length >= 5) break;
    }
    for (const c of CATS) {
      if (out.length >= 6) break;
      if (c !== "TÜM ÜRÜNLER" && c !== "MARKALAR" && searchFold(c).includes(needle)) {
        out.push({ kind: "kategori", label: c });
      }
    }
    return out;
  }, [local, brands]);

  const apply = (s: { kind: "marka" | "kategori"; label: string }) => {
    setFocused(false);
    setLocal("");
    setView("grid");
    // Metni de temizle: marka filtresi + aynı metnin araması birbirini daraltır.
    if (s.kind === "marka") {
      setQuery({ q: "" });
      toggleBrand(s.label);
    } else {
      setQuery({ q: "", cat: s.label as (typeof CATS)[number] });
    }
  };

  const showList = focused && suggestions.length > 0;

  return (
    // `search-anchor`: öneri listesi (aşağıda, position:absolute) bu kutuya göre
    // konumlanır, yani kutunun konumlandırılmış olması ŞART. Bu eskiden satır içi
    // `position: relative` ile veriliyordu ve mobildeki `position: sticky` kuralını
    // eziyordu (satır içi stil stylesheet'i yener) — arama çubuğu telefonda hiç
    // yapışmıyordu. Artık kural CSS'te: mobil sticky onu sırayla geçersiz kılabiliyor,
    // sticky de absolute çocuklar için aynı şekilde kuşatan blok kuruyor.
    <div ref={box} className={`search-anchor${className ? ` ${className}` : ""}`} style={style}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderBottom: "1px solid var(--grn)",
          paddingBottom: 5,
        }}
      >
        <span style={{ color: "var(--grn)" }}>⌕</span>
        <input
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setFocused(false);
            if (e.key === "Enter") {
              setFocused(false);
              setQuery({ q: local });
            }
          }}
          placeholder={t("ARA")}
          style={{
            flex: 1,
            minWidth: 0,
            background: "none",
            border: "none",
            color: "var(--fg)",
            fontFamily: "'Space Mono', monospace",
            fontSize: 14,
            letterSpacing: ".16em",
            outline: "none",
            textTransform: "uppercase",
          }}
        />
        {local && (
          <span
            className="nav-item"
            onClick={() => {
              setLocal("");
              setQuery({ q: "" });
            }}
            title={t("aramayı temizle")}
            style={{ color: "var(--muted3)", fontSize: 13, flex: "none" }}
          >
            ✕
          </span>
        )}
      </div>

      {showList && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 45,
            background: "var(--bg2)",
            border: "1px solid var(--line)",
            maxHeight: 260,
            overflowY: "auto",
          }}
        >
          {suggestions.map((s) => (
            <div
              key={`${s.kind}-${s.label}`}
              className="nav-item"
              onClick={() => apply(s)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "9px 12px",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 13,
                color: "var(--fg)",
                borderBottom: "1px solid var(--line4)",
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {s.kind === "kategori" ? t(s.label) : s.label}
              </span>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: ".18em", color: "var(--faint)", flex: "none" }}>
                {s.kind === "marka" ? t("MARKA") : t("KATEGORİ")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
