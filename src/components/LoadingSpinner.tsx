/**
 * Dönen halka — ExitScreen'deki "seni şuraya götürüyoruz" halkasıyla AYNI çizim
 * (bkz. globals.css `.exit-spin`/`exitspin`). Vitrin genelinde tek bir "yükleniyor"
 * göstergesi olsun diye buraya çıkarıldı: LoadingOverlay ve marka sekmesinin ilk
 * yüklemesi aynı bileşeni kullanır.
 */
export function LoadingSpinner({ size = 34, label }: { size?: number; label?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <svg className="exit-spin" width={size} height={size} viewBox="0 0 34 34" aria-hidden>
        <circle cx="17" cy="17" r="14" fill="none" stroke="var(--line2)" strokeWidth="3" />
        <path d="M17 3a14 14 0 0 1 14 14" fill="none" stroke="var(--grn)" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {label && (
        <span
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 12,
            letterSpacing: ".2em",
            color: "var(--muted)",
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
