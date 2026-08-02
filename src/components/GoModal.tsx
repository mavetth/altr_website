"use client";
import { useEffect, useRef } from "react";
import { useStore } from "@/store";
import { BrandLogo } from "./BrandLogo";
import { ExitScreen } from "./ExitScreen";
import { useT } from "@/lib/lang";

/**
 * DIŞARI ÇIKIŞ KAPISI — "kaydır ve git" modali.
 *
 * Vitrindeki marka modali (BrandModal) ile marka sayfasındaki MAĞAZAYA GİT düğmesi
 * (StoreGate) AYNI ritüeli kullanır: kaydırma onayı → CTA glitch flaşı → kasıtlı
 * gecikme → yeni sekme. Eskiden bu akış yalnız BrandModal'ın içinde yazılıydı ve marka
 * sayfasındaki düğme düz bir `<a target="_blank">` idi; iki farklı çıkış davranışı
 * oluyordu. Ritüel tek yerde durur, iki çağıran da buradan geçer.
 *
 * Hedef HER ZAMAN yeni sekmede açılır: altr'ın kendi sekmesi kaybolmasın.
 */

/**
 * Onaydan sonra sayfanın açılmasını geciktiren "ritüel" payı (bkz. marka kimliği).
 *
 * 850 → 1600ms (2026-08-01): bu pay artık boş geçmiyor, tam ekran ÇIKIŞ EKRANI
 * (ExitScreen) çiziliyor — nereye gittiğin logosuyla birlikte okunacak kadar durmalı.
 * Üst sınır tarayıcı: `window.open` kullanıcı hareketinden kopunca engelleniyor,
 * Chrome'un "geçici etkinlik" penceresi 5sn. 1.6sn o pencerenin epey içinde.
 */
const RITUAL_MS = 1600;

export function GoModal({
  brand,
  brandSlug,
  destUrl,
  /** true: hedef ürünün kendi sayfası, false: markanın mağaza ana sayfası. */
  toProduct = false,
  going,
  setGoing,
  onConfirm,
  onClose,
  /** Markanın altr sayfasına giden bağ. Verilmezse bölüm hiç çizilmez. */
  brandPageHref,
  /** Uygulama içindeyken sayfa değiştirmek yerine sekme değiştirmek için. */
  onBrandPage,
}: {
  brand: string;
  brandSlug?: string | null;
  destUrl: string | null;
  toProduct?: boolean;
  going: boolean;
  setGoing: (v: boolean) => void;
  /** Kaydırma tamamlandığı AN çağrılır (ölçüm) — gecikmeyi beklemez. */
  onConfirm?: () => void;
  onClose: () => void;
  brandPageHref?: string | null;
  onBrandPage?: () => void;
}) {
  const showToast = useStore((s) => s.showToast);
  const t = useT();

  const handleRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const goTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (goTimer.current) clearTimeout(goTimer.current);
    };
  }, []);

  /** Hedefi aç ve kapan. Hem sayaç dolunca hem "hemen aç" bağından çağrılır. */
  function openNow() {
    if (goTimer.current) {
      clearTimeout(goTimer.current);
      goTimer.current = null;
    }
    if (destUrl) window.open(destUrl, "_blank", "noopener,noreferrer");
    else showToast("Bu markanın bağlı mağazası yok.");
    onClose();
  }

  function confirmGo(maxX: number) {
    const handle = handleRef.current;
    const fill = fillRef.current;
    if (handle) handle.style.left = `${4 + maxX}px`;
    if (fill) fill.style.width = "100%";
    // Gidilecek yer yoksa ritüel de yok: "seni şuraya götürüyoruz" deyip 1.6 saniye
    // sonra "mağaza yok" demek kullanıcıyı boşuna bekletmek olurdu.
    if (!destUrl) {
      showToast("Bu markanın bağlı mağazası yok.");
      onClose();
      return;
    }
    setGoing(true);
    // Çıkış olayı BURADA kaydedilir — kullanıcının dışarı gitmeyi onayladığı tek nokta.
    // Beacon ile gönderilir, açılışı geciktirmez.
    onConfirm?.();
    // marka kimliği: glitch flaşı + kasıtlı gecikmeli açılış. Flaş artık çıkış
    // ekranının üstünde patlıyor (modal o an yerini ona bırakıyor).
    goTimer.current = setTimeout(openNow, RITUAL_MS);
  }

  function slideStart(e: React.PointerEvent) {
    if (going) return;
    e.preventDefault();
    const handle = handleRef.current;
    const track = trackRef.current;
    const fill = fillRef.current;
    const label = labelRef.current;
    if (!handle || !track) return;
    const trackW = track.clientWidth;
    const hw = handle.offsetWidth;
    const maxX = trackW - hw - 8;
    const startX = e.clientX;
    handle.setPointerCapture?.(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      const x = Math.max(0, Math.min(maxX, ev.clientX - startX));
      handle.style.left = `${4 + x}px`;
      if (fill) fill.style.width = `${hw + x}px`;
      const pct = x / maxX;
      if (label) label.style.opacity = String(1 - pct * 1.4);
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const x = Math.max(0, Math.min(maxX, ev.clientX - startX));
      if (x >= maxX - 4) confirmGo(maxX);
      else {
        handle.style.left = "4px";
        if (fill) fill.style.width = "56px";
        if (label) label.style.opacity = "1";
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // Onaydan sonrası artık modalin işi değil: tam ekran çıkış ekranı devralır.
  if (going)
    return (
      <ExitScreen
        brand={brand}
        brandSlug={brandSlug}
        toProduct={toProduct}
        ms={RITUAL_MS}
        onSkip={openNow}
      />
    );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.8)" }} />
      <div
        className="modal-anim scanlines"
        style={{
          position: "relative",
          width: 460,
          maxWidth: "92vw",
          background: "var(--bg2)",
          border: "2px solid var(--fg-bright)",
          borderRadius: 26,
          overflow: "hidden",
        }}
      >
        <div className="bm-pad" style={{ position: "relative", padding: "34px 32px 30px" }}>
          <span className="nav-item" onClick={onClose} style={{ position: "absolute", top: 16, right: 20, fontFamily: "'Space Mono', monospace", fontSize: 14, letterSpacing: ".14em", color: "var(--muted)" }}>
            ✕
          </span>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 26 }}>
            <div
              style={{
                width: 120,
                height: 120,
                border: "2px solid var(--fg-bright)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 14,
                marginBottom: 18,
                background: "var(--tex)",
              }}
            >
              <BrandLogo
                slug={brandSlug ?? undefined}
                name={brand}
                h={44}
                /* 120px'lik dairenin içi: kare bir amblem daireye teğet geçmesin diye
                   kutu daireden bir tık dar tutulur. */
                maxW={84}
                maxH={70}
                /* daire içinde tek başına durur; marka adı zaten hemen altındaki
                   metinde geçiyor, ikinci kez yazmak daireyi taşırırdı */
                showName={false}
                fallback={
                  <span style={{ fontFamily: "'Anton', sans-serif", fontSize: 24, lineHeight: 0.95, letterSpacing: ".02em", color: "var(--fg-bright)", textTransform: "uppercase" }}>
                    {brand}
                  </span>
                }
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "'Space Mono', monospace", fontSize: 12, letterSpacing: ".28em", color: "var(--grn)" }}>
              {destUrl && <span className="live" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--grn)", flex: "none" }} />}
              {toProduct
                ? t("HARİCİ ÜRÜN SAYFASI")
                : destUrl
                  ? t("HARİCİ MAĞAZA")
                  : t("MAĞAZA BAĞLI DEĞİL")}
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, letterSpacing: ".06em", color: "var(--muted3)", marginTop: 6 }}>
              {toProduct
                ? t("altr.com seni ürünün markadaki kendi sayfasına yönlendiriyor")
                : destUrl
                  ? t("altr.com seni bu markanın kendi mağazasına yönlendiriyor")
                  : t("bu marka için henüz canlı kaynak tanımlı değil")}
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: ".06em", color: "var(--faint)", marginTop: 4 }}>
              {t("yeni sekmede açılır — altr açık kalır")}
            </div>

            {/* Markanın altr'daki kalıcı sayfası — dışarı çıkmadan önce markayı bir
                bütün olarak görme yolu. Uygulama içindeyken (onBrandPage) sayfa
                yüklemeden sekme değiştirir; dışarıda gerçek <a> olarak kalır. */}
            {brandPageHref &&
              (onBrandPage ? (
                <span className="nav-item" onClick={onBrandPage} style={brandPageLinkStyle}>
                  {t("markanın altr sayfası →")}
                </span>
              ) : (
                <a href={brandPageHref} className="nav-item" style={{ ...brandPageLinkStyle, textDecoration: "none" }}>
                  {t("markanın altr sayfası →")}
                </a>
              ))}
          </div>

          <div ref={trackRef} style={{ position: "relative", height: 60, border: "1px solid var(--line)", borderRadius: 14, background: "var(--bg3)", overflow: "hidden", userSelect: "none" }}>
            {/* dolgu: kaydırdıkça genişleyen vurgu zemin */}
            <div ref={fillRef} style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 56, background: "var(--grn)", opacity: 0.16 }} />
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
              <span
                ref={labelRef}
                className="slide-label"
                style={{ display: "inline-flex", alignItems: "center", gap: 10, fontFamily: "'Space Mono', monospace", fontSize: 14, letterSpacing: ".22em", color: "var(--muted2)", textTransform: "uppercase" }}
              >
                {t("KAYDIR")}
                <span style={{ display: "inline-flex", letterSpacing: 0, color: "var(--grn)", fontWeight: 700 }}>
                  {[0, 1, 2].map((i) => (
                    <i key={i} className="chev-i" style={{ animationDelay: `${i * 0.15}s` }}>
                      ›
                    </i>
                  ))}
                </span>
                {toProduct ? t("ÜRÜNE GİT") : t("MAĞAZAYA GİT")}
              </span>
            </div>
            <div ref={handleRef} className="slide-handle" onPointerDown={slideStart} style={{ position: "absolute", left: 4, top: 4, bottom: 4, width: 72, background: "var(--grn)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3, color: "var(--on-accent)" }}>
              {/* SVG oklar: kutunun tam ortasında ››› dizisi */}
              {[0, 1, 2].map((i) => (
                <svg key={i} width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ display: "block", marginLeft: i ? -9 : 0 }}>
                  <path d="m8 4.5 8 7.5-8 7.5" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" strokeLinecap="round" />
                </svg>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const brandPageLinkStyle: React.CSSProperties = {
  display: "inline-block",
  marginTop: 14,
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 12,
  letterSpacing: ".1em",
  color: "var(--muted)",
  borderBottom: "1px solid var(--line2)",
  paddingBottom: 3,
};
