"use client";
import type { ReactNode } from "react";
import { useT } from "@/lib/lang";
import { Toast } from "./Toast";

/**
 * Kalıcı sayfaların (markalar, marka sayfası) ortak çerçevesi.
 *
 * Ana vitrin tek sayfalık bir uygulama (App.tsx + zustand); bu sayfalar ise SUNUCUDA
 * çizilir ve bilerek o mağazaya bağlanmaz. Sebebi SEO ve paylaşım: marka sayfası
 * arama motoruna ve link önizlemesine gerçek HTML olarak görünmeli, bir istemci
 * store'unun hidrate olmasını beklememeli. Tıklanabilirler de gerçek `<a>` burada.
 */
export function PageChrome({
  children,
  crumb,
}: {
  children: ReactNode;
  /** Başlığın altındaki yol izi ("MARKALAR" gibi). */
  crumb?: ReactNode;
}) {
  // "use client": bu çerçeve yalnız METİN çeviriyor, veri okumuyor. `children` hâlâ
  // SUNUCUDA çiziliyor (bir istemci bileşenine prop olarak geçen sunucu düğümleri
  // sunucuda kalır) — yani marka sayfasının SEO'su bundan etkilenmiyor.
  const t = useT();
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)", fontFamily: "'IBM Plex Mono', monospace" }}>
      <header
        className="page-pad"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
          padding: "18px 40px",
          // .page-pad: dar ekranda yatay boşluk kısılır (bkz. globals.css ≤820px)
          borderBottom: "1px solid var(--line3)",
          fontFamily: "'Space Mono', monospace",
          fontSize: 13,
          letterSpacing: ".16em",
        }}
      >
        <a
          href="/"
          style={{
            fontFamily: "'Anton', sans-serif",
            fontSize: 30,
            letterSpacing: ".02em",
            color: "var(--grn)",
            textDecoration: "none",
            textTransform: "lowercase",
          }}
        >
          altr
        </a>
        <nav style={{ display: "flex", gap: 26, alignItems: "center" }}>
          <a href="/" className="nav-item" style={{ color: "var(--muted)", textDecoration: "none" }}>
            {t("VİTRİN")}
          </a>
          <a href="/markalar" className="nav-item" style={{ color: "var(--muted)", textDecoration: "none" }}>
            {t("MARKALAR")}
          </a>
        </nav>
      </header>

      {crumb && (
        <div className="page-pad" style={{ padding: "16px 40px 0", fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: ".24em", color: "var(--faint)" }}>
          {crumb}
        </div>
      )}

      <main className="page-pad" style={{ padding: "22px 40px 90px" }}>{children}</main>

      {/* Bu sayfalarda da geri bildirim veren tek şey var: stok talebi düğmesi.
          Toast olmadan basıldığında hiçbir şey olmamış gibi görünüyordu. */}
      <Toast />

      <footer
        className="page-pad"
        style={{
          padding: "26px 40px 40px",
          borderTop: "1px solid var(--line4)",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 12,
          color: "var(--faint)",
          lineHeight: 1.8,
        }}
      >
        {t("altr — alternatif giyim vitrini. ürünler markaların kendi sitelerinde satılır; satın alma markanın sayfasında tamamlanır.")}
      </footer>
    </div>
  );
}
