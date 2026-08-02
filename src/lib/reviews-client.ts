"use client";
import { useEffect, useState } from "react";
import { ownerKey } from "./public-lists-client";

/**
 * YORUMLAR — istemci tarafı.
 *
 * Sunucu tarafı `reviews.ts`te. Burada iki şey var: ızgaradaki yıldız özetlerini TOPLU
 * çeken küçük bir önbellek ve yazma/silme çağrıları.
 *
 * Özetler neden toplu: bir sayfada 40 kart var ve her biri "kaç yorum, kaç puan"
 * soruyor. Kart başına istek atmak bu kadar ikincil bir bilgi için pahalı — aynı
 * kareye düşen sorular tek çağrıda birleşiyor (bkz. RestockVote'taki aynı yöntem).
 */

/**
 * Sunucudaki `ReviewSummary` ile aynı biçim. `reviews.ts`ten import EDİLMİYOR: o modül
 * `node:fs` kullanıyor ve tip importu bugün silinse de yarın oradan bir sabit almak
 * tüm katalog/fs zincirini tarayıcı paketine sokar (bkz. brand-page-shared.ts'te aynı
 * ders). İki tanım birlikte değişmeli.
 */
export interface ReviewSummary {
  count: number;
  avg: number | null;
}

/**
 * Metin tavanı — `reviews.ts`teki MAX_TEXT ile AYNI olmalı. Oradan import edilmiyor
 * çünkü o modül `node:fs` kullanıyor ve istemci paketine giremez; sunucu gelen metni
 * zaten kendi tavanına göre kırpıyor, buradaki değer yalnız sayaç ve `maxLength` için.
 */
export const MAX_TEXT_CLIENT = 600;

export interface ReviewView {
  id: string;
  productId: string;
  nick: string;
  rating: number;
  text: string;
  createdAt: string;
  updatedAt: string;
  mine: boolean;
}

const EMPTY: ReviewSummary = { count: 0, avg: null };

const cache: Record<string, ReviewSummary> = {};
let queue: string[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

/** Özeti dışarıdan tazele (yorum yazıldıktan sonra kartlar da güncellensin). */
export function setSummary(id: string, s: ReviewSummary): void {
  cache[id] = s;
  notify();
}

function enqueue(id: string) {
  if (id in cache || queue.includes(id)) return;
  queue.push(id);
  if (timer) return;
  timer = setTimeout(async () => {
    const ids = queue;
    queue = [];
    timer = null;
    try {
      const res = await fetch(`/api/reviews?ids=${encodeURIComponent(ids.join(","))}`);
      const data = (await res.json()) as { summaries: Record<string, ReviewSummary> };
      // İstenen her id için bir değer yaz: "yorumu yok" da bir cevaptır, yoksa aynı id
      // her boyamada tekrar sıraya girer.
      for (const id of ids) cache[id] = data.summaries?.[id] ?? EMPTY;
      notify();
    } catch {
      /* özet gelmezse kart yıldızsız çizilir, başka bir şey bozulmaz */
    }
  }, 60);
}

/** Ürünün yıldız özeti — ilk çağrıda toplu isteğe katılır. */
export function useReviewSummary(id: string): ReviewSummary {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    enqueue(id);
    return () => {
      listeners.delete(l);
    };
  }, [id]);
  return cache[id] ?? EMPTY;
}

/* ------------------------------------------------------------------ API --- */

const headers = () => ({ "content-type": "application/json", "x-owner-key": ownerKey() });

export async function fetchReviews(
  productId: string,
): Promise<{ items: ReviewView[]; summary: ReviewSummary }> {
  try {
    const res = await fetch(`/api/reviews?id=${encodeURIComponent(productId)}`, {
      headers: headers(),
    });
    if (!res.ok) return { items: [], summary: EMPTY };
    const data = await res.json();
    const summary = (data.summary ?? EMPTY) as ReviewSummary;
    cache[productId] = summary;
    return { items: (data.items ?? []) as ReviewView[], summary };
  } catch {
    return { items: [], summary: EMPTY };
  }
}

export type ReviewError = "puan" | "nick" | "dolu" | "urun" | "anahtar" | "ag";

export async function submitReview(input: {
  productId: string;
  rating: number;
  text: string;
  /** Oturum açıksa yok sayılır — sunucu nick'i hesaptan alır. */
  nick: string;
}): Promise<{ ok: true; review: ReviewView; summary: ReviewSummary } | { ok: false; error: ReviewError }> {
  try {
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: (data?.error ?? "ag") as ReviewError };
    setSummary(input.productId, data.summary as ReviewSummary);
    return { ok: true, review: data.review as ReviewView, summary: data.summary as ReviewSummary };
  } catch {
    return { ok: false, error: "ag" };
  }
}

export async function removeReview(productId: string): Promise<ReviewSummary | null> {
  try {
    const res = await fetch(`/api/reviews?id=${encodeURIComponent(productId)}`, {
      method: "DELETE",
      headers: headers(),
    });
    if (!res.ok) return null;
    const data = await res.json();
    setSummary(productId, data.summary as ReviewSummary);
    return data.summary as ReviewSummary;
  } catch {
    return null;
  }
}

/** Yorum hatalarının kullanıcıya gösterilen karşılığı. */
export const REVIEW_ERROR: Record<ReviewError, string> = {
  puan: "Önce bir puan seç (1–5 yıldız).",
  nick: "Nick 3-20 karakter olmalı (harf, rakam, . _ -).",
  dolu: "Bu üründe yorum kotası dolu.",
  urun: "Ürün bulunamadı.",
  anahtar: "Tarayıcı kimliği alınamadı.",
  ag: "Yorum gönderilemedi.",
};
