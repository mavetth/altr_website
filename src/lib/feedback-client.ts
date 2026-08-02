"use client";
/**
 * Geri bildirim kutusunun İSTEMCİ yüzü.
 *
 * Tipler burada YENİDEN tanımlı (lib/feedback.ts'ten import edilmiyor): o dosya
 * `node:fs` çekiyor ve bir istemci bileşeninden değer olarak import edilirse tüm zincir
 * tarayıcı paketine giriyor — tsc bunu yakalamıyor, derleme patlıyor (aynı sebeple
 * reviews-client.ts de ReviewSummary'yi kendi tanımlıyor).
 */

export const TOPICS = ["marka-oner", "geri-bildirim", "marka-kaldir", "diger"] as const;
export type Topic = (typeof TOPICS)[number];

export const MAX_TEXT = 1500;

/* --- ek dosyalar ---------------------------------------------------------
   Bu sabitler `lib/feedback-files.ts` ile AYNI olmak zorunda; oradan import
   EDİLEMEZ çünkü o dosya `node:fs`/`node:crypto` çekiyor ve istemci paketine
   giremez (dosyanın başındaki nota bakınız). Sunucu her durumda kendi kuralını
   ayrıca uyguluyor — buradakiler yalnız kullanıcıya erken geri bildirim için. */

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES = 4;

const UPLOAD_TYPES = [
  "image/png", "image/jpeg", "image/webp", "image/gif", "image/avif",
  "video/mp4", "video/webm", "video/quicktime", "application/pdf",
];

export const UPLOAD_ACCEPT = UPLOAD_TYPES.join(",");

export function isAllowedUploadType(mime: string): boolean {
  return UPLOAD_TYPES.includes(mime);
}

export interface Attachment {
  file: string;
  name: string;
  mime: string;
  size: number;
}

/** Admin panelinde eki açan adres. Uç admine özel (bkz. api/feedback/dosya). */
export function attachmentUrl(itemId: string, file: string): string {
  return `/api/feedback/dosya?id=${encodeURIComponent(itemId)}&dosya=${encodeURIComponent(file)}`;
}

export interface FeedbackItem {
  id: string;
  topic: Topic;
  brand?: string;
  link?: string;
  text: string;
  email?: string;
  attachments?: Attachment[];
  userId?: string;
  nick?: string;
  createdAt: string;
  read: boolean;
}

export interface FeedbackPage {
  items: FeedbackItem[];
  total: number;
  unread: Record<Topic | "hepsi", number>;
}

export interface SendInput {
  topic: Topic;
  brand?: string;
  link?: string;
  text?: string;
  email?: string;
  /** Honeypot — insan doldurmaz, dolu gelirse sunucu kaydı sessizce atar. */
  website?: string;
  /** Ekler (yalnız geri bildirimde). Varsa istek multipart olarak gider. */
  files?: File[];
}

export async function sendFeedback(input: SendInput): Promise<void> {
  const { files, ...fields } = input;

  // Ek varsa multipart, yoksa düz JSON. İkisini de aynı uç karşılıyor; JSON yolu
  // korunuyor çünkü gönderimlerin çoğunda ek yok ve multipart gereksiz bir yük.
  let init: RequestInit;
  if (files?.length) {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) {
      if (typeof v === "string" && v) form.append(k, v);
    }
    for (const f of files.slice(0, MAX_FILES)) form.append("dosya", f);
    init = { method: "POST", body: form }; // Content-Type'ı tarayıcı sınırla birlikte kurar
  } else {
    init = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    };
  }

  const res = await fetch("/api/feedback", init);
  if (res.status === 204) return; // honeypot: bot olduğumuz sanıldı, sessizce bitir
  const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
  if (!res.ok) throw new Error(data.message ?? data.error ?? "Gönderilemedi.");
}

/** Admin kutusu — admin olmayan 404 alır (uç gizli). */
export async function fetchFeedback(params: {
  topic?: Topic | "";
  unreadOnly?: boolean;
  limit?: number;
}): Promise<FeedbackPage> {
  const sp = new URLSearchParams();
  if (params.topic) sp.set("topic", params.topic);
  if (params.unreadOnly) sp.set("okunmamis", "1");
  sp.set("limit", String(params.limit ?? 100));
  const res = await fetch(`/api/feedback?${sp}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Kutu okunamadı.");
  return res.json();
}

export async function setFeedbackRead(id: string, read: boolean): Promise<void> {
  await fetch("/api/feedback", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, read }),
  });
}

export async function deleteFeedback(id: string): Promise<void> {
  await fetch(`/api/feedback?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}
