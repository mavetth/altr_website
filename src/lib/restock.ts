/**
 * STOK TALEBİ — "bu tükendi, geri gelsin" oyları.
 *
 * Tükenmiş ürün bugün vitrinde ölü bir kart. Oy düğmesi onu bir SİNYALE çeviriyor:
 * kaç kişi bu parçayı istiyor. İki yere yarar — kullanıcı sesini duyurmuş olur, biz de
 * markaya götürebileceğimiz somut bir talep listesi biriktiririz (aggregator'ın markaya
 * verebileceği ilk gerçek değer bu).
 *
 * Depolama events.ts'le aynı sadelikte: tek bir JSON dosyası + süreç-içi harita.
 * Veritabanı yok, çünkü yazma hacmi düşük ve tek düğümlüyüz. Disk yazılamıyorsa
 * (salt-okunur FS) sayaçlar bellekte yaşar, vitrin çalışmaya devam eder.
 *
 * Mükerrer oy: her ziyaretçiye anonim bir işaret (çerez) verilir ve ürün başına bir kez
 * sayılır. Hesap sistemine bağlanmadı — bilerek: oy vermek için üye olmak gerekseydi
 * sinyalin çoğunu kaybederdik. Hesap geldiğinde `voterId` kullanıcı id'sine bağlanabilir.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

export interface RestockEntry {
  /** Tekil oy sayısı. */
  count: number;
  /** Oy veren anonim işaretler — mükerrer oyu engellemek için. */
  voters: string[];
  /** Son oyun anı (ISO) — talebin tazeliği. */
  last: string;
  /** Rapor için, ürünü tekrar aramak zorunda kalmayalım. */
  brandSlug?: string;
  name?: string;
}

const FILE = process.env.RESTOCK_FILE ?? path.join(process.cwd(), ".data", "restock.json");

/** Bir üründe tutulan oy verenlerin tavanı: dosya sınırsız büyümesin. */
const MAX_VOTERS = 5000;

type Table = Record<string, RestockEntry>;

// HMR'de tek harita kalsın diye globalThis'e tuttur (bkz. lib/cache.ts aynı yöntem).
const g = globalThis as unknown as { __altrRestock?: Table | null };

let table: Table | null = g.__altrRestock ?? null;
let writable = true;
let pending: NodeJS.Timeout | null = null;

async function load(): Promise<Table> {
  if (table) return table;
  try {
    table = JSON.parse(await fs.readFile(FILE, "utf8")) as Table;
  } catch {
    table = {};
  }
  g.__altrRestock = table;
  return table;
}

/**
 * Yazmayı topluca yap: arka arkaya gelen oylarda her istekte diske yazmak yerine kısa bir
 * pencerede biriktirip tek sefer yazar. Süreç ölürse en fazla o penceredeki oylar kaybolur.
 */
function scheduleFlush(): void {
  if (!writable || pending) return;
  pending = setTimeout(() => {
    pending = null;
    void flush();
  }, 1500);
  // Node'un çıkışını bu zamanlayıcı geciktirmesin.
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

export interface VoteResult {
  count: number;
  /** Bu ziyaretçi daha önce oy vermiş miydi (istek bir şeyi değiştirdi mi). */
  already: boolean;
}

export async function voteRestock(
  productId: string,
  voterId: string,
  meta?: { brandSlug?: string; name?: string },
): Promise<VoteResult> {
  const t = await load();
  const e = (t[productId] ??= { count: 0, voters: [], last: "", ...meta });
  if (meta?.brandSlug) e.brandSlug = meta.brandSlug;
  if (meta?.name) e.name = meta.name;

  if (e.voters.includes(voterId)) return { count: e.count, already: true };

  e.voters.push(voterId);
  if (e.voters.length > MAX_VOTERS) e.voters.splice(0, e.voters.length - MAX_VOTERS);
  e.count++;
  e.last = new Date().toISOString();
  scheduleFlush();
  return { count: e.count, already: false };
}

/** Oyu geri al — düğme açma/kapama olarak çalışsın diye. */
export async function unvoteRestock(productId: string, voterId: string): Promise<VoteResult> {
  const t = await load();
  const e = t[productId];
  if (!e) return { count: 0, already: false };
  const i = e.voters.indexOf(voterId);
  if (i < 0) return { count: e.count, already: false };
  e.voters.splice(i, 1);
  e.count = Math.max(0, e.count - 1);
  scheduleFlush();
  return { count: e.count, already: true };
}

/** Verilen ürünlerin oy sayıları + bu ziyaretçinin oy verdikleri. */
export async function readCounts(
  ids: string[],
  voterId?: string,
): Promise<{ counts: Record<string, number>; mine: string[] }> {
  const t = await load();
  const counts: Record<string, number> = {};
  const mine: string[] = [];
  for (const id of ids) {
    const e = t[id];
    if (!e) continue;
    if (e.count > 0) counts[id] = e.count;
    if (voterId && e.voters.includes(voterId)) mine.push(id);
  }
  return { counts, mine };
}

/** En çok istenen tükenmiş ürünler — talep raporu (admin/marka görüşmesi için). */
export async function topRequested(limit = 100): Promise<
  Array<{ productId: string; count: number; last: string; brandSlug?: string; name?: string }>
> {
  const t = await load();
  return Object.entries(t)
    .map(([productId, e]) => ({
      productId,
      count: e.count,
      last: e.last,
      brandSlug: e.brandSlug,
      name: e.name,
    }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
