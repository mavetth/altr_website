"use client";
import type { CSSProperties } from "react";
import { BrandLogo, brandNameNeeded } from "./BrandLogo";
import { useT } from "@/lib/lang";

/**
 * ÇIKIŞ EKRANI — "seni şuraya götürüyoruz".
 *
 * Kaydırma onaylandıktan sonra hedef sekme AÇILANA KADAR geçen payı dolduran tam ekran
 * ara sayfa. Eskiden o pay (RITUAL_MS) boş geçiyordu: modal ekranda duruyor, hiçbir şey
 * olmuyor, sonra birden yeni sekme açılıyordu — kullanıcı için sebepsiz bir donma.
 *
 * Ekranın işi üç şeyi bir arada söylemek: (1) altr'dan ÇIKIYORSUN, (2) NEREYE
 * gidiyorsun (markanın kendi logosu ve adı), (3) bu bekleme SONLU (dolan çizgi + dönen
 * halka). Üçüncüsü olmadan 1.5 saniyelik boş ekran "takıldı" diye okunuyor.
 *
 * Kaçış kapısı da burada: tarayıcı yeni sekmeyi engellerse ya da kullanıcı beklemek
 * istemezse "uzun mu sürüyor" bağı hedefi anında açar.
 */
export function ExitScreen({
  brand,
  brandSlug,
  toProduct,
  /** Bekleme süresi (ms) — dolan çizginin süresi bununla birebir aynı olmalı. */
  ms,
  /** "uzun mu sürüyor" bağı: beklemeyi kesip hedefi hemen açar. */
  onSkip,
}: {
  brand: string;
  brandSlug?: string | null;
  toProduct?: boolean;
  ms: number;
  onSkip: () => void;
}) {
  const t = useT();

  return (
    <div
      className="exit-screen"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 95,
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
        padding: 24,
        textAlign: "center",
      }}
    >
      {/* Onay anındaki glitch flaşı: eskiden modalin üstünde patlıyordu, modal artık o an
          yerini bu ekrana bıraktığı için flaş da buraya taşındı — geçiş sert kalsın.
          Dıştaki `opacity` kasıtlı: aynı flaş 460px'lik modalde vurgu, TAM EKRANDA
          göz alan bir strobe oluyordu. Şiddeti yarıya iniyor (animasyon iç katmanın
          opaklığını sürüyor, ikisi çarpılıyor). */}
      <div className="exit-flash-wrap" style={{ position: "absolute", inset: 0, opacity: 0.45, pointerEvents: "none" }}>
        <div
          className="mg-flash go"
          style={{
            position: "absolute",
            inset: 0,
            background: "var(--grn)",
            mixBlendMode: "var(--modal-flash-blend)" as CSSProperties["mixBlendMode"],
            opacity: 0,
          }}
        />
      </div>

      {/* Süre çubuğu en üstte: "ne kadar kaldı" sorusunun cevabı göz ucuyla okunur. */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "var(--line)" }}>
        <div className="exit-bar" style={{ height: "100%", background: "var(--grn)", animationDuration: `${ms}ms` }} />
      </div>

      <span
        style={{
          fontFamily: "'Anton', sans-serif",
          fontSize: 52,
          lineHeight: 1,
          letterSpacing: ".02em",
          color: "var(--grn)",
          textShadow: "1.5px 0 rgba(255,0,120,.5), -1.5px 0 rgba(0,220,255,.5)",
        }}
      >
        altr
      </span>

      <span style={{ ...LABEL, marginTop: 22 }}>{t("seni şuraya götürüyoruz")}</span>

      <div
        style={{
          width: 108,
          height: 108,
          marginTop: 18,
          border: "2px solid var(--fg-bright)",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 13,
          background: "var(--tex)",
        }}
      >
        <BrandLogo
          slug={brandSlug ?? undefined}
          name={brand}
          h={40}
          /* daire içi: kare bir amblem çembere teğet geçmesin */
          maxW={74}
          maxH={62}
          showName={false}
          fallback={
            <span style={{ fontFamily: "'Anton', sans-serif", fontSize: 21, lineHeight: 0.95, color: "var(--fg-bright)", textTransform: "uppercase" }}>
              {brand}
            </span>
          }
        />
      </div>

      {/* Ad YALNIZCA logo sembolken yazılır: "NOMARC" gibi bir wordmark'ın altına adını
          bir kez daha basmak aynı kelimeyi alt alta iki kez göstermek demekti. Kural
          sayfanın geri kalanıyla aynı (bkz. BrandLogo `brandNameNeeded`). */}
      {brandNameNeeded(brandSlug, brand) && (
        <span
          style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: 17,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: "var(--fg-bright)",
            marginTop: 16,
          }}
        >
          {brand}
        </span>
      )}
      <span style={{ ...LABEL, color: "var(--faint)", marginTop: 14 }}>
        {toProduct ? t("HARİCİ ÜRÜN SAYFASI") : t("HARİCİ MAĞAZA")}
      </span>

      {/* Dönen halka: kesintisiz döner (sayfanın geri kalanı adımlı, burada değil —
          duran bir çark "bekleme bitti mi" sorusunu doğuruyor). */}
      <svg className="exit-spin" width="34" height="34" viewBox="0 0 34 34" style={{ marginTop: 30 }} aria-hidden>
        <circle cx="17" cy="17" r="14" fill="none" stroke="var(--line2)" strokeWidth="3" />
        <path d="M17 3a14 14 0 0 1 14 14" fill="none" stroke="var(--grn)" strokeWidth="3" strokeLinecap="round" />
      </svg>

      <span className="nav-item" onClick={onSkip} style={{ ...LABEL, marginTop: 26, borderBottom: "1px solid var(--line2)", paddingBottom: 3 }}>
        {t("uzun mu sürüyor? hemen aç")}
      </span>
      <span style={{ ...LABEL, color: "var(--faint)", letterSpacing: ".06em", marginTop: 12, fontSize: 11 }}>
        {t("yeni sekmede açılır — altr açık kalır")}
      </span>
    </div>
  );
}

const LABEL: CSSProperties = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 12,
  letterSpacing: ".2em",
  color: "var(--muted)",
};
