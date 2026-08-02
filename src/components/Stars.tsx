"use client";
import { useState } from "react";
import { useLang } from "@/lib/lang";

/**
 * Yıldız — hem gösterge hem girdi.
 *
 * Yarım yıldız BİLEREK yok: puan tam sayı toplanıyor (bkz. lib/reviews.ts), ama
 * ORTALAMA kesirli. Ortalamayı gösterirken yıldızın kesirli kısmı, yıldızın üstündeki
 * dolu katmanın genişliği kırpılarak çiziliyor — yuvarlayıp "4 yıldız" demek 4.4 ile
 * 3.6'yı aynı gösterirdi.
 */

export function Stars({
  value,
  size = 13,
  /** Verilirse yıldızlar tıklanabilir olur (puan girdisi). */
  onPick,
  className,
}: {
  value: number;
  size?: number;
  onPick?: (n: number) => void;
  className?: string;
}) {
  const [hover, setHover] = useState(0);
  const { t } = useLang();
  const shown = hover || value;

  return (
    <span
      className={className}
      onMouseLeave={onPick ? () => setHover(0) : undefined}
      style={{ display: "inline-flex", gap: size * 0.16, lineHeight: 0, flex: "none" }}
    >
      {[1, 2, 3, 4, 5].map((i) => {
        // Bu yıldızın ne kadarı dolu: tam, boş ya da (yalnız ortalamada) kesirli.
        const fill = Math.max(0, Math.min(1, shown - (i - 1)));
        return (
          <span
            key={i}
            onClick={
              onPick
                ? (e) => {
                    e.stopPropagation();
                    onPick(i);
                  }
                : undefined
            }
            onMouseEnter={onPick ? () => setHover(i) : undefined}
            title={onPick ? `${i} ${t("yıldız")}` : undefined}
            style={{ position: "relative", display: "inline-block", width: size, height: size, cursor: onPick ? "pointer" : "inherit" }}
          >
            <Star size={size} color="var(--line)" />
            {fill > 0 && (
              <span style={{ position: "absolute", inset: 0, width: `${fill * 100}%`, overflow: "hidden" }}>
                <Star size={size} color="var(--grn)" />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

function Star({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ display: "block" }}>
      <path d="M12 2.4 15 9l7.2.6-5.5 4.7 1.7 7L12 17.6 5.6 21.3l1.7-7L1.8 9.6 9 9z" />
    </svg>
  );
}

/**
 * Kart üstündeki tek satırlık özet: yıldızlar + ortalama + yorum adedi.
 * Hiç yorumu olmayan üründe HİÇ ÇİZİLMEZ — "0 yorum" yazısı kartta gürültüden başka
 * bir şey değil.
 */
export function RatingLine({
  avg,
  count,
  size = 12,
  style,
}: {
  avg: number | null;
  count: number;
  size?: number;
  style?: React.CSSProperties;
}) {
  const { n } = useLang();
  if (!count || avg == null) return null;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: size,
        color: "var(--muted3)",
        ...style,
      }}
    >
      <Stars value={avg} size={size} />
      <span style={{ color: "var(--muted2)" }}>{n(avg)}</span>
      <span style={{ color: "var(--faint)" }}>({count})</span>
    </span>
  );
}
