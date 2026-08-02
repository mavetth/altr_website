/**
 * YORUM ve PUAN — ürünlerin altındaki değerlendirmeler.
 *
 * Vitrin bugüne dek tek yönlüydü: ürünü gösteriyor, mağazaya yolluyordu. Yorum, aynı
 * ürüne bakan başka birinin ne düşündüğünü getiriyor — aggregator'ın markanın kendi
 * sitesinde OLMAYAN ilk şeyi. Markaların kendi yorumları da var ama onlar markanın
 * denetiminde; buradaki yorum bağımsız.
 *
 * KİŞİ BAŞI TEK YORUM. Aynı üründe ikinci kez yazmak yeni bir kayıt açmaz, öncekini
 * GÜNCELLER — yoksa puan ortalaması tekrar tekrar oy vererek şişirilebilirdi.
 *
 * Kimlik: oturum varsa kullanıcının nick'i, yoksa yayınlanan listelerdeki yöntemin
 * aynısı (cihazda üretilen gizli anahtar + istenen nick, bkz. public-lists.ts).
 * Sahiplik anahtarın SHA-256'sıyla kanıtlanır, anahtarın kendisi saklanmaz.
 *
 * Depolama restock.ts/public-lists.ts ile aynı sadelikte: tek JSON dosyası + süreç-içi
 * harita + gecikmeli toplu yazma. Salt-okunur dosya sisteminde yazma sessizce kapanır,
 * okuma çalışmaya devam eder.
 */
import { promises as fs } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";

export interface Review {
  id: string;
  /** Ürün id'si — kayıt ürün gövdesini taşımaz, katalog değişse de yorum yaşar. */
  productId: string;
  nick: string;
  /** 1–5 tam yıldız. Yarım puan yok: kaba ama karşılaştırılabilir. */
  rating: number;
  /** Serbest metin. Boş olabilir — yalnız puan vermek geçerli bir davranış. */
  text: string;
  createdAt: string;
  updatedAt: string;
  /** Sahiplik kanıtı: oturum kullanıcısı ya da cihaz anahtarının SHA-256'sı. */
  ownerHash: string;
}

export interface ReviewSummary {
  count: number;
  /** Ortalama puan, bir ondalığa yuvarlı. Yorum yoksa null. */
  avg: number | null;
}

const FILE = process.env.REVIEWS_FILE ?? path.join(process.cwd(), ".data", "reviews.json");

export const MAX_TEXT = 600;
/** Bir üründe tutulan yorum tavanı: dosya sınırsız büyümesin. */
const MAX_PER_PRODUCT = 500;

type Table = Record<string, Review[]>;

const g = globalThis as unknown as { __altrReviews?: Table | null };
let table: Table | null = g.__altrReviews ?? null;
let writable = true;
let pending: NodeJS.Timeout | null = null;

async function load(): Promise<Table> {
  if (table) return table;
  try {
    table = JSON.parse(await fs.readFile(FILE, "utf8")) as Table;
  } catch {
    table = {};
  }
  g.__altrReviews = table;
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
    writable = false;
  }
}

export const hashOwner = (key: string): string =>
  createHash("sha256").update(`yorum:${key}`).digest("hex");

/* ------------------------------------------------------------ doğrulama --- */

export function normalizeText(raw: unknown): string {
  return String(raw ?? "")
    // Satır sonları korunur (yorum paragraf olabilir), ama üçten fazlası tek boşluğa iner.
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_TEXT);
}

export function normalizeRating(raw: unknown): number | null {
  const n = Math.round(Number(raw));
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
}

/* -------------------------------------------------------------- okuma ----- */

function summarize(list: Review[] | undefined): ReviewSummary {
  if (!list?.length) return { count: 0, avg: null };
  const sum = list.reduce((s, r) => s + r.rating, 0);
  return { count: list.length, avg: Math.round((sum / list.length) * 10) / 10 };
}

/** Tek ürünün yorumları — yeniden eskiye. */
export async function listReviews(productId: string): Promise<Review[]> {
  const t = await load();
  return [...(t[productId] ?? [])].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

/**
 * Birden çok ürünün özeti tek çağrıda.
 *
 * Izgarada 40 kart var ve her kart yıldız gösteriyor; kart başına bir istek atmak bu
 * kadar ikincil bir bilgi için pahalı (bkz. RestockVote'taki aynı toplu yaklaşım).
 */
export async function summaries(ids: string[]): Promise<Record<string, ReviewSummary>> {
  const t = await load();
  const out: Record<string, ReviewSummary> = {};
  for (const id of ids) {
    const s = summarize(t[id]);
    // Yorumsuz ürün için de bir değer dönüyoruz: istemci "cevap geldi, boş" ile
    // "henüz sorulmadı"yı ayırt edebilsin, aynı id tekrar tekrar sıraya girmesin.
    out[id] = s;
  }
  return out;
}

export async function summaryOf(productId: string): Promise<ReviewSummary> {
  const t = await load();
  return summarize(t[productId]);
}

/* -------------------------------------------------------------- yazma ----- */

export type SaveResult =
  | { ok: true; review: Review; summary: ReviewSummary }
  | { ok: false; error: "puan" | "nick" | "dolu" };

export async function saveReview(input: {
  productId: string;
  nick: string;
  rating: number;
  text: string;
  ownerKey: string;
}): Promise<SaveResult> {
  const rating = normalizeRating(input.rating);
  if (rating == null) return { ok: false, error: "puan" };
  if (!input.nick) return { ok: false, error: "nick" };

  const t = await load();
  const list = (t[input.productId] ??= []);
  const ownerHash = hashOwner(input.ownerKey);
  const now = new Date().toISOString();
  const text = normalizeText(input.text);

  // Kişi başı tek yorum: varsa güncellenir.
  const cur = list.find((r) => r.ownerHash === ownerHash);
  if (cur) {
    cur.nick = input.nick;
    cur.rating = rating;
    cur.text = text;
    cur.updatedAt = now;
    scheduleFlush();
    return { ok: true, review: cur, summary: summarize(list) };
  }

  if (list.length >= MAX_PER_PRODUCT) return { ok: false, error: "dolu" };

  const review: Review = {
    id: randomUUID().slice(0, 12),
    productId: input.productId,
    nick: input.nick,
    rating,
    text,
    createdAt: now,
    updatedAt: now,
    ownerHash,
  };
  list.push(review);
  scheduleFlush();
  return { ok: true, review, summary: summarize(list) };
}

export async function deleteReview(
  productId: string,
  ownerKey: string,
): Promise<{ ok: boolean; summary: ReviewSummary }> {
  const t = await load();
  const list = t[productId];
  if (!list) return { ok: false, summary: { count: 0, avg: null } };
  const i = list.findIndex((r) => r.ownerHash === hashOwner(ownerKey));
  if (i < 0) return { ok: false, summary: summarize(list) };
  list.splice(i, 1);
  scheduleFlush();
  return { ok: true, summary: summarize(list) };
}

/** İstemciye giden biçim: sahiplik hash'i düşer, "benim mi" bayrağı eklenir. */
export function toReviewView(r: Review, ownerKey?: string) {
  const { ownerHash, ...rest } = r;
  return { ...rest, mine: !!ownerKey && ownerHash === hashOwner(ownerKey) };
}

export type ReviewView = ReturnType<typeof toReviewView>;
