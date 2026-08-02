"use client";
import { useStore } from "@/store";
import { useT } from "@/lib/lang";

export function Toast() {
  const toast = useStore((s) => s.toast);
  // Bildirim metinleri store içindeki eylemlerde TÜRKÇE üretiliyor; çeviri burada,
  // GÖSTERİM anında yapılıyor. Sözlük Türkçe metnin kendisiyle anahtarlandığı için
  // store'a dil bilgisi taşımaya gerek yok (bkz. lib/i18n.ts).
  const t = useT();
  if (!toast) return null;
  return (
    <div
      className="toast-anim"
      style={{
        position: "fixed",
        left: "50%",
        bottom: 34,
        transform: "translateX(-50%)",
        zIndex: 90,
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "var(--fg-bright)",
        color: "var(--bg)",
        fontFamily: "'Space Mono', monospace",
        fontSize: 14,
        letterSpacing: ".12em",
        padding: "12px 20px",
        borderRadius: 999,
        boxShadow: "0 8px 30px rgba(0,0,0,.5)",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", background: "var(--grn)", color: "var(--on-accent)", fontSize: 13 }}>
        ✓
      </span>
      <span>{t(toast)}</span>
    </div>
  );
}
