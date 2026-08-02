"use client";
import type { Product } from "./types";

/**
 * Dışarı yönlendirme olayını sunucuya bildirir.
 *
 * `sendBeacon` kullanılır: kullanıcı zaten başka sekmeye/siteye gidiyor, normal bir
 * fetch sayfa boşalırken iptal olabilir. Beacon tarayıcı tarafından arka planda
 * tamamlanır. Beacon yoksa keepalive'lı fetch'e düşülür.
 *
 * Ölçüm hiçbir koşulda yönlendirmeyi geciktirmez veya engellemez.
 */

const SESSION_KEY = "altr-session";

/** Oturum başına anonim, rastgele işaret. Kişisel veri taşımaz. */
function sessionId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    let s = sessionStorage.getItem(SESSION_KEY);
    if (!s) {
      s = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(SESSION_KEY, s);
    }
    return s;
  } catch {
    return undefined;
  }
}

function send(url: string, payload: unknown): void {
  try {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch(url, {
      method: "POST",
      body,
      headers: { "content-type": "application/json" },
      keepalive: true,
    });
  } catch {
    /* ölçüm hiçbir koşulda etkileşimi engellemez */
  }
}

/**
 * Ürün modalı açıldı.
 *
 * Çıkış ölçümünün PAYDASI: tek başına "kaç tıklama" bir şey söylemiyor, asıl bilgi
 * "kaç kişi ürünü açtı, kaçı mağazaya gitti" oranında. Aynı üründe ileri/geri
 * gezinmek de bir görüntülenmedir — kullanıcı o ürüne gerçekten bakmıştır.
 */
export function trackProductView(p: Product, ctx?: { cat?: string; q?: string }): void {
  if (typeof window === "undefined" || !p?.brandSlug) return;
  send("/api/view", {
    brand: p.brand,
    brandSlug: p.brandSlug,
    productId: p.id,
    productName: p.name,
    category: p.category,
    price: p.price ?? null,
    currency: p.currency,
    ctxCat: ctx?.cat,
    ctxQuery: ctx?.q,
    session: sessionId(),
  });
}

export function trackOutbound(opts: {
  url: string | null;
  brand: string;
  brandSlug?: string;
  product?: Product | null;
  ctxCat?: string;
  ctxQuery?: string;
}): void {
  if (typeof window === "undefined") return;
  const p = opts.product ?? null;
  const payload = {
    url: opts.url ?? "",
    kind: p ? "product" : "brand",
    brand: opts.brand,
    brandSlug: opts.brandSlug ?? p?.brandSlug ?? "",
    productId: p?.id,
    productName: p?.name,
    category: p?.category,
    price: p?.price ?? null,
    currency: p?.currency,
    ctxCat: opts.ctxCat,
    ctxQuery: opts.ctxQuery,
    session: sessionId(),
  };
  if (!payload.brandSlug) return;
  send("/api/outbound", payload);
}
