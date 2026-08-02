"use client";
import type { CSSProperties } from "react";
import { STYLES } from "@/lib/brand-styles";
import { useStore } from "@/store";
import { useT } from "@/lib/lang";
import { PlusMinus } from "./icons";

/**
 * TARZ şeridi — ızgaranın üstünde, marka çiplerinin hemen altında.
 *
 * Filtre panelinde de aynı seçim var (bkz. FilterPanel "TARZ" bölümü), ama tarz vitrine
 * girişin ana yollarından biri: paneli açmayı gerektirirse kimse kullanmaz. Kategori
 * "ne giydiğin"i, tarz "nasıl giyindiğin"i süzer; ikisi birlikte çalışır (techwear + MONT).
 *
 * KATLANABİLİR BÖLÜM (2026-08-01) — marka şeridiyle BİREBİR aynı kalıp:
 * `.chip-sec` + başlık + artı/eksi dairesi. Mobilde çipler 3 satıra sarıp ızgaranın
 * üstünde 121px yer kaplıyordu; şimdi kapalı geliyor ve başlığa dokununca açılıyor.
 * Masaüstünde CSS bölümü her zaman açık tutar ve başlığı çiplerle AYNI SATIRA alır —
 * yani orada görüntü değişmiyor, "TARZ" etiketi eskisi gibi çiplerin solunda duruyor.
 *
 * Tarz hâlâ bir dokunuş uzakta (panel değil), yani yukarıdaki not korunuyor: kapalı
 * başlık vitrinde görünmeye devam ediyor, tarz diye bir eksenin varlığı gizlenmiyor.
 */
export function StyleRow({ className, style }: { className?: string; style?: CSSProperties }) {
  const selected = useStore((s) => s.query.styles);
  const toggleStyle = useStore((s) => s.toggleStyle);
  const setQuery = useStore((s) => s.setQuery);
  const setView = useStore((s) => s.setView);
  const open = useStore((s) => s.stylesSectionOpen);
  const toggleSection = useStore((s) => s.toggleStylesSection);
  const t = useT();

  return (
    <div className={`chip-sec style-sec${open ? " is-open" : ""}${className ? ` ${className}` : ""}`} style={style}>
      {/* mobilde dokununca açılır/kapanır (bkz. globals.css); masaüstünde her zaman açık */}
      <div className="chip-sec-head nav-item" onClick={toggleSection}>
        <span>
          {t("TARZ")}
          {/* Sayı YALNIZ MOBİLDE (globals.css .chip-sec-count): masaüstünde çipler zaten
              başlığın sağında duruyor, "8" orada sayılabilen bir şeyi tekrar söylüyordu.
              Kapalı şeritte ise bölümün ardında ne olduğunu anlatan tek işaret o. */}
          <span className="chip-sec-count">
            {" — "}
            <span style={{ color: "var(--grn)" }}>{STYLES.length}</span>
          </span>
        </span>
        {/* Seçimi temizleme: marka şeridinde olduğu gibi BAŞLIKTA duruyor — çiplerin
            arasında olsaydı bölüm kapalıyken görünmez, kullanıcı neyin açık olduğunu
            göremeden vitrinin daraldığını görürdü. */}
        {selected.length > 0 && (
          <span
            className="nav-item"
            onClick={(e) => {
              e.stopPropagation();
              setQuery({ styles: [] });
            }}
            title={t("Tarz seçimini temizle")}
            style={{ color: "var(--grn)", letterSpacing: ".14em" }}
          >
            {t(`${selected.length} SEÇİLİ`)} ✕
          </span>
        )}
        <span className="chip-sec-toggle">
          <PlusMinus open={open} />
        </span>
      </div>
      <div className={`chip-sec-grid${open ? " is-open" : ""}`} style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {STYLES.map((s) => {
          const on = selected.includes(s.k);
          return (
            <span
              key={s.k}
              className="fbox"
              title={t(s.note)}
              onClick={() => {
                setView("grid");
                toggleStyle(s.k);
              }}
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 12,
                letterSpacing: ".08em",
                padding: "6px 11px",
                border: `1px solid ${on ? "var(--grn)" : "var(--line)"}`,
                background: on ? "var(--grn)" : "transparent",
                color: on ? "var(--on-accent)" : "var(--muted)",
              }}
            >
              {on ? "✓ " : ""}
              {t(s.label)}
            </span>
          );
        })}
      </div>
    </div>
  );
}
