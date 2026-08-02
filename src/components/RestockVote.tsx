"use client";
import { useEffect, useState } from "react";
import type { Product } from "@/lib/types";
import { useStore } from "@/store";
import { useT } from "@/lib/lang";

/**
 * "STOĞA GELSİN" — tükenmiş üründe talep düğmesi.
 *
 * Yalnız tükenmiş varyantlarda çizilir. Sayaç ilk boyamada gösterilmez, ürün ekranda
 * görününce tek bir toplu istekte gelir (bkz. useRestockCounts): 40 kartlık bir sayfada
 * 40 ayrı istek atmak sayaç gibi ikincil bir bilgi için fazla pahalı.
 */

/* --------------------------------------------------------- toplu sayaç --- */

type Store = { counts: Record<string, number>; mine: Set<string> };

const cache: Store = { counts: {}, mine: new Set() };
let queue: string[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

/** Aynı kareye düşen istekleri tek çağrıda topla — 40 kart = 1 istek. */
function enqueue(id: string) {
  if (id in cache.counts || queue.includes(id)) return;
  queue.push(id);
  if (timer) return;
  timer = setTimeout(async () => {
    const ids = queue;
    queue = [];
    timer = null;
    try {
      const res = await fetch(`/api/restock?ids=${encodeURIComponent(ids.join(","))}`);
      const data = (await res.json()) as { counts: Record<string, number>; mine: string[] };
      // İstenen her id için bir değer yaz: 0 da bir cevaptır, yoksa aynı id tekrar tekrar
      // sıraya girer.
      for (const id of ids) cache.counts[id] = data.counts[id] ?? 0;
      for (const id of data.mine) cache.mine.add(id);
      notify();
    } catch {
      /* sayaç gelmezse düğme yine çalışır, sadece sayı görünmez */
    }
  }, 60);
}

function useRestockCounts(id: string): { count: number; voted: boolean } {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    enqueue(id);
    return () => {
      listeners.delete(l);
    };
  }, [id]);
  return { count: cache.counts[id] ?? 0, voted: cache.mine.has(id) };
}

/* ------------------------------------------------------------- düğme ----- */

export function RestockVote({
  p,
  size = "sm",
  className,
}: {
  p: Product;
  /** "sm" kart üstü rozet, "lg" ürün modalindeki tam genişlik düğme. */
  size?: "sm" | "lg";
  className?: string;
}) {
  const { count, voted } = useRestockCounts(p.id);
  const [busy, setBusy] = useState(false);
  const showToast = useStore((s) => s.showToast);
  const t = useT();

  const vote = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const on = !voted;
    try {
      const res = await fetch("/api/restock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: p.id, on, brandSlug: p.brandSlug, name: p.name }),
      });
      const data = (await res.json()) as { count: number };
      cache.counts[p.id] = data.count;
      if (on) cache.mine.add(p.id);
      else cache.mine.delete(p.id);
      notify();
      showToast(on ? "Talebin kaydedildi." : "Talebin geri alındı.");
    } catch {
      showToast("Talep gönderilemedi.");
    } finally {
      setBusy(false);
    }
  };

  const lg = size === "lg";

  return (
    <span
      className={`fbox ${className ?? ""}`}
      onClick={vote}
      title={
        voted
          ? t("Bu ürünü stoğa istedin — geri almak için tekrar bas")
          : t("Stoğa gelmesini iste; talep markaya iletilir")
      }
      style={{
        display: lg ? "flex" : "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        width: lg ? "100%" : undefined,
        fontFamily: "'Space Mono', monospace",
        fontWeight: lg ? 700 : 400,
        fontSize: lg ? 14 : 11,
        letterSpacing: lg ? ".14em" : ".1em",
        padding: lg ? "14px 0" : "6px 10px",
        borderRadius: lg ? 10 : 999,
        border: `1px solid ${voted ? "var(--grn)" : "var(--muted3)"}`,
        background: voted ? "var(--grn)" : "var(--btn-glass)",
        color: voted ? "var(--on-accent)" : "var(--fg-bright)",
        backdropFilter: lg ? undefined : "blur(4px)",
        opacity: busy ? 0.6 : 1,
        whiteSpace: "nowrap",
      }}
    >
      <BellIcon size={lg ? 15 : 12} />
      {voted ? t("İSTEDİN") : t("STOĞA GELSİN")}
      {count > 0 && (
        <span
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: lg ? 13 : 11,
            padding: lg ? "2px 8px" : "1px 6px",
            borderRadius: 999,
            border: `1px solid ${voted ? "var(--on-accent)" : "var(--line)"}`,
            opacity: 0.85,
          }}
        >
          {count}
        </span>
      )}
    </span>
  );
}

/** Talep sayacının yanındaki çan — SVG, font taban çizgisine bağlı kalmasın diye. */
function BellIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: "block", flex: "none" }}>
      <path
        d="M12 3a6 6 0 0 0-6 6c0 3.5-1 5-2 6h16c-1-1-2-2.5-2-6a6 6 0 0 0-6-6Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
