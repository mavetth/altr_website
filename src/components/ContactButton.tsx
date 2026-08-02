"use client";
import { useStore } from "@/store";
import { useT } from "@/lib/lang";

/**
 * Sağ alt köşedeki sabit "BİZE ULAŞIN" düğmesi.
 *
 * Sağ alt bilerek seçildi: o köşe boştu. Toast alt-ORTADA (z90), mobildeki vitrin
 * hatırlatıcısı da alt-ortada (z55). z-index 50 → panellerin (60/70/80) ve toast'un
 * altında, sayfa içeriğinin üstünde: hiçbir modalin önüne geçmez.
 *
 * Bir modal açıkken düğme çizilmez — üst üste iki katmanlı bir ekran kurmanın anlamı
 * yok, ayrıca body kilitliyken sabit düğme yerinden kayıyor.
 */
export function ContactButton() {
  const open = useStore((s) => s.openContact);
  const busy = useStore(
    (s) => s.contactOpen || s.authOpen || s.filterOpen || Boolean(s.detail) || Boolean(s.modalBrand),
  );
  const t = useT();

  if (busy) return null;

  return (
    <span
      className="contact-fab cta-btn"
      onClick={open}
      title={t("öneri, geri bildirim, marka önerisi veya kaldırma talebi")}
      style={{
        position: "fixed",
        right: 22,
        bottom: 22,
        zIndex: 50,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "12px 18px",
        borderRadius: 999,
        background: "var(--grn)",
        color: "var(--on-accent)",
        border: "1px solid var(--grn)",
        fontFamily: "'Space Mono', monospace",
        fontWeight: 700,
        fontSize: 12,
        letterSpacing: ".14em",
        cursor: "pointer",
        boxShadow: "0 6px 24px rgba(0,0,0,.45)",
      }}
    >
      <EnvelopeMark />
      <span className="contact-fab-label">{t("BİZE ULAŞIN")}</span>
    </span>
  );
}

/** Zarf — dış kaynak yüklemeden, tek satır SVG. */
function EnvelopeMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ display: "block", flex: "none" }}>
      <rect x="2.5" y="5" width="19" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M3 6.5 12 13l9-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
