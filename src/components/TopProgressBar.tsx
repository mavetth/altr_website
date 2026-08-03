"use client";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/store";

/**
 * SAYFA TEPESİNDE İNCE YÜKLENİYOR ÇUBUĞU — filtre/kategori/sayfa değişince
 * (store.loading) ya da herkese açık akış yenilenirken (publicLoading) görünür.
 *
 * Süre baştan bilinmediği için NPROGRESS usulü sahte ilerleme: istek başlar
 * başlamaz hızla %85'e kadar yavaşlayarak ilerler, gerçek sonuç gelince ANINDA
 * %100'e tamamlanıp söner — "az kaldı" hissi hiç bitmeyen bir yüzdeden daha iyi.
 * App.tsx'te BİR KEZ, en üstte, her zaman monte edilir.
 */
export function TopProgressBar() {
  const loading = useStore((s) => s.loading);
  const publicLoading = useStore((s) => s.publicLoading);
  const active = loading || publicLoading;

  const [pct, setPct] = useState(0);
  const [visible, setVisible] = useState(false);
  const wasActive = useRef(false);

  useEffect(() => {
    const timers: number[] = [];
    if (active && !wasActive.current) {
      setVisible(true);
      setPct(0);
      timers.push(
        window.setTimeout(() => setPct(35), 30),
        window.setTimeout(() => setPct(65), 240),
        window.setTimeout(() => setPct(85), 700),
      );
    } else if (!active && wasActive.current) {
      setPct(100);
      timers.push(
        window.setTimeout(() => setVisible(false), 260),
        window.setTimeout(() => setPct(0), 420),
      );
    }
    wasActive.current = active;
    return () => timers.forEach(clearTimeout);
  }, [active]);

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        height: 3,
        width: `${pct}%`,
        background: "var(--grn)",
        boxShadow: "0 0 10px var(--grn)",
        opacity: visible ? 1 : 0,
        transition: pct === 0 ? "opacity .2s ease" : "width .35s ease, opacity .25s ease",
        zIndex: 300,
        pointerEvents: "none",
      }}
    />
  );
}
