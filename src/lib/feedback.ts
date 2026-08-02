import type { Attachment } from "./feedback-files";

/**
 * BİZE ULAŞIN — kullanıcıdan gelen kutu.
 *
 * Dört konu var ve üçü birbirinden farklı iş yapıyor:
 *   marka-oner     : vitrine yeni marka adayı
 *   geri-bildirim  : ürün/arayüz şikâyeti, öneri
 *   marka-kaldir   : bir işletmenin "ürünlerim burada gözükmesin" talebi — HUKUKİ,
 *                    en yüksek öncelikli kutu, e-posta zorunlu (talebi doğrulamadan
 *                    marka kaldırılamaz)
 *   diger          : geri kalan her şey
 *
 * Depo `reviews.ts` ile aynı sadelikte: tek JSON dosyası + süreç-içi kopya + gecikmeli
 * yazma. E-posta bildirimi YOK (bir SMTP bağlı değil, bkz. auth.ts deliverCode);
 * kutu admin panelinden okunuyor.
 */
import { promises as fs } from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

export const TOPICS = ["marka-oner", "geri-bildirim", "marka-kaldir", "diger"] as const;
export type Topic = (typeof TOPICS)[number];

export function isTopic(v: unknown): v is Topic {
  return typeof v === "string" && (TOPICS as readonly string[]).includes(v);
}

export interface FeedbackItem {
  id: string;
  topic: Topic;
  /** marka-oner / marka-kaldir: hangi marka. */
  brand?: string;
  /** marka-oner: site veya instagram. */
  link?: string;
  text: string;
  email?: string;
  /**
   * Gönderime iliştirilen dosyalar (yalnız geri bildirim konusunda).
   * Gövdeleri `.data/feedback-files` altında; burada yalnız metadata duruyor
   * (bkz. lib/feedback-files.ts).
   */
  attachments?: Attachment[];
  /** Oturum açıksa kim yazdı — anonim gönderimde ikisi de yok. */
  userId?: string;
  nick?: string;
  createdAt: string;
  read: boolean;
}

const FILE = process.env.FEEDBACK_FILE ?? path.join(process.cwd(), ".data", "feedback.json");

export const MAX_TEXT = 1500;
export const MAX_BRAND = 60;
export const MAX_LINK = 200;
/** Dosya sınırsız büyümesin: tavana gelince en eski kayıt düşer. */
const MAX_ITEMS = 5000;

/** Yeniden eskiye sıralı dizi. */
type Table = FeedbackItem[];

const g = globalThis as unknown as { __altrFeedback?: Table | null };
let table: Table | null = g.__altrFeedback ?? null;
let writable = true;
let pending: NodeJS.Timeout | null = null;

async function load(): Promise<Table> {
  if (table) return table;
  try {
    const parsed = JSON.parse(await fs.readFile(FILE, "utf8"));
    table = Array.isArray(parsed) ? (parsed as Table) : [];
  } catch {
    table = [];
  }
  g.__altrFeedback = table;
  return table;
}

function scheduleFlush(): void {
  if (!writable || pending) return;
  pending = setTimeout(() => {
    pending = null;
    void flush();
  }, 1200);
  pending.unref?.();
}

export async function flush(): Promise<void> {
  if (!writable || !table) return;
  try {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(table), "utf8");
  } catch {
    // Salt-okunur dosya sistemi: kutu sürecin ömrü boyunca bellekte yaşar.
    writable = false;
  }
}

/* ------------------------------------------------------------ doğrulama --- */

export function normalizeText(raw: unknown, max = MAX_TEXT): string {
  return String(raw ?? "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

/** Gevşek ama işe yarar e-posta kontrolü — auth.ts'teki kuralın aynısı. */
export function looksLikeEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(raw) && raw.length <= 254;
}

export interface NewFeedback {
  topic: Topic;
  brand?: string;
  link?: string;
  text: string;
  email?: string;
  attachments?: Attachment[];
  userId?: string;
  nick?: string;
}

export type SaveResult =
  | { ok: true; item: FeedbackItem }
  | { ok: false; error: "konu" | "metin" | "marka" | "eposta" };

/**
 * Konuya göre ZORUNLU alanlar burada — sunucuda. Arayüz de aynı kuralı uyguluyor ama
 * istemci doğrulaması bir kolaylık, kural değil.
 */
export async function addFeedback(input: NewFeedback): Promise<SaveResult> {
  if (!isTopic(input.topic)) return { ok: false, error: "konu" };

  const text = normalizeText(input.text);
  const brand = normalizeText(input.brand, MAX_BRAND);
  const link = normalizeText(input.link, MAX_LINK);
  const email = normalizeText(input.email, 254).toLowerCase();

  if ((input.topic === "marka-oner" || input.topic === "marka-kaldir") && brand.length < 2) {
    return { ok: false, error: "marka" };
  }
  // Marka önerisinde ad tek başına yeterli — "şu markaya bakın" da bir bilgidir.
  if (input.topic !== "marka-oner" && text.length < 5) return { ok: false, error: "metin" };
  if (email && !looksLikeEmail(email)) return { ok: false, error: "eposta" };
  // Kaldırma talebi doğrulanmadan işleme alınamaz: dönecek bir adres şart.
  if (input.topic === "marka-kaldir" && !email) return { ok: false, error: "eposta" };

  const t = await load();
  const item: FeedbackItem = {
    id: crypto.randomUUID().slice(0, 12),
    topic: input.topic,
    ...(brand ? { brand } : {}),
    ...(link ? { link } : {}),
    text,
    ...(email ? { email } : {}),
    ...(input.attachments?.length ? { attachments: input.attachments } : {}),
    ...(input.userId ? { userId: input.userId } : {}),
    ...(input.nick ? { nick: input.nick } : {}),
    createdAt: new Date().toISOString(),
    read: false,
  };

  t.unshift(item);
  if (t.length > MAX_ITEMS) t.length = MAX_ITEMS;
  scheduleFlush();
  return { ok: true, item };
}

export interface FeedbackPage {
  items: FeedbackItem[];
  total: number;
  /** Konu başına okunmamış sayısı — sekmedeki rozet bundan. */
  unread: Record<Topic | "hepsi", number>;
}

export async function listFeedback(opts: {
  topic?: Topic;
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}): Promise<FeedbackPage> {
  const t = await load();
  const unread: Record<string, number> = { hepsi: 0 };
  for (const k of TOPICS) unread[k] = 0;
  for (const it of t) {
    if (!it.read) {
      unread.hepsi++;
      unread[it.topic]++;
    }
  }

  let list = t;
  if (opts.topic) list = list.filter((i) => i.topic === opts.topic);
  if (opts.unreadOnly) list = list.filter((i) => !i.read);

  const offset = Math.max(0, opts.offset ?? 0);
  const limit = Math.min(200, Math.max(1, opts.limit ?? 50));
  return {
    items: list.slice(offset, offset + limit),
    total: list.length,
    unread: unread as FeedbackPage["unread"],
  };
}

export async function markRead(id: string, read: boolean): Promise<boolean> {
  const t = await load();
  const it = t.find((i) => i.id === id);
  if (!it) return false;
  it.read = read;
  scheduleFlush();
  return true;
}

/**
 * Tek kaydı getirir. Silmeden ÖNCE eklerini öğrenmek için var (bkz. api/feedback
 * DELETE) — kayıt gidince dosya adlarına ulaşılamaz ve diskte sahipsiz dosya kalır.
 * Ek okuma ucu da kaydın gerçekten var olduğunu buradan doğruluyor.
 */
export async function findFeedback(id: string): Promise<FeedbackItem | undefined> {
  if (!id) return undefined;
  return (await load()).find((x) => x.id === id);
}

export async function removeFeedback(id: string): Promise<boolean> {
  const t = await load();
  const i = t.findIndex((x) => x.id === id);
  if (i < 0) return false;
  t.splice(i, 1);
  scheduleFlush();
  return true;
}
