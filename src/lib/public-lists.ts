/**
 * HERKESE AÇIK LİSTELER — kullanıcıların yayınladığı vitrinler.
 *
 * Listeler bugüne dek yalnız cihazda (localStorage) yaşıyordu; paylaşım linki ürün
 * id'lerini URL'e gömüyordu (bkz. lists.ts). O yol hâlâ duruyor ve anlık paylaşım için
 * yeterli, ama "herkese açık" bir vitrin sekmesi için listenin BİR YERDE durması gerek:
 * başkasının listesi ancak sunucuda kayıtlıysa görülebilir.
 *
 * HESAP YOK (bilerek, ilk sürüm). Yayınlarken yalnız bir NICK sorulur; sahiplik cihazda
 * saklanan gizli bir anahtarla kanıtlanır (anahtarın kendisi sunucuya gitmez, SHA-256'sı
 * saklanır). Hesap sistemi bağlandığında değişecek tek şey `ownerHash`in nereden geldiği —
 * API ve arayüz aynı kalır.
 *
 * Depolama restock.ts ile aynı sadelikte: tek JSON dosyası + süreç-içi harita, gecikmeli
 * toplu yazma. Veritabanı yok. Salt-okunur dosya sisteminde (Vercel) yazma sessizce
 * kapanır; okuma çalışmaya devam eder.
 */
import { promises as fs } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";

export interface PublicList {
  id: string;
  /** Yayınlayanın seçtiği takma ad. Hesap değil, yalnız atıf. */
  nick: string;
  name: string;
  /** Ürün id'leri — gövde katalogdan çözülür (liste kendi ürün kopyasını taşımaz). */
  ids: string[];
  /** Kapak kolajı için ilk dört ürünün görseli; katalog değişse de kart çizilebilsin. */
  covers: string[];
  createdAt: string;
  updatedAt: string;
  /** Sahiplik kanıtı: cihazdaki gizli anahtarın SHA-256'sı. */
  ownerHash: string;
  views: number;
}

const FILE = process.env.PUBLIC_LISTS_FILE ?? path.join(process.cwd(), ".data", "public-lists.json");

/** lists.ts'teki MAX_LIST_ITEMS ile aynı tavan. */
export const MAX_ITEMS = 200;
const MAX_LISTS = 2000;
const MAX_NAME = 60;

type Table = Record<string, PublicList>;

const g = globalThis as unknown as { __altrPublicLists?: Table | null };
let table: Table | null = g.__altrPublicLists ?? null;
let writable = true;
let pending: NodeJS.Timeout | null = null;

async function load(): Promise<Table> {
  if (table) return table;
  try {
    table = JSON.parse(await fs.readFile(FILE, "utf8")) as Table;
  } catch {
    table = {};
  }
  g.__altrPublicLists = table;
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

export const hashKey = (key: string): string => createHash("sha256").update(key).digest("hex");

/* ------------------------------------------------------------- doğrulama --- */

/**
 * Nick kuralları. Kısıtlı tutuluyor: sunucuda hesap yok, yani nick tekil DEĞİL —
 * yalnız bir imza. Uzun/görünmez karakterli adlar listeyi bozmasın.
 */
const NICK_RE = /^[a-z0-9](?:[a-z0-9._-]{1,18})[a-z0-9]$/;

/** Kaba küfür/spam süzgeci — moderasyon aracı gelene kadarki asgari koruma. */
const BANNED = /(?:amk|aq|orospu|piç|pic|sik|yarrak|göt|got|pezeven|fuck|shit|bitch|nigg|admin|altr)/i;

export function normalizeNick(raw: string): string | null {
  const n = String(raw ?? "").trim().toLowerCase().replace(/\s+/g, "-");
  if (!NICK_RE.test(n)) return null;
  if (BANNED.test(n)) return null;
  return n;
}

export function normalizeName(raw: string): string {
  const s = String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_NAME);
  return s || "İSİMSİZ LİSTE";
}

/* ---------------------------------------------------------------- işlemler --- */

export interface PublishInput {
  /** Var olan bir yayını güncellerken dolu gelir. */
  id?: string;
  nick: string;
  name: string;
  ids: string[];
  covers: string[];
  ownerKey: string;
}

export type PublishResult =
  | { ok: true; list: PublicList }
  | { ok: false; error: "nick" | "bos" | "dolu" | "sahip" | "yok" };

export async function publish(input: PublishInput): Promise<PublishResult> {
  const t = await load();
  const nick = normalizeNick(input.nick);
  if (!nick) return { ok: false, error: "nick" };

  const ids = [...new Set(input.ids.filter(Boolean))].slice(0, MAX_ITEMS);
  if (!ids.length) return { ok: false, error: "bos" };

  const ownerHash = hashKey(input.ownerKey);
  const now = new Date().toISOString();

  if (input.id) {
    const cur = t[input.id];
    if (!cur) return { ok: false, error: "yok" };
    // Sahiplik: yalnız yayınlayan cihaz güncelleyebilir.
    if (cur.ownerHash !== ownerHash) return { ok: false, error: "sahip" };
    cur.nick = nick;
    cur.name = normalizeName(input.name);
    cur.ids = ids;
    cur.covers = input.covers.filter(Boolean).slice(0, 4);
    cur.updatedAt = now;
    scheduleFlush();
    return { ok: true, list: cur };
  }

  if (Object.keys(t).length >= MAX_LISTS) return { ok: false, error: "dolu" };

  const list: PublicList = {
    id: randomUUID().slice(0, 12),
    nick,
    name: normalizeName(input.name),
    ids,
    covers: input.covers.filter(Boolean).slice(0, 4),
    createdAt: now,
    updatedAt: now,
    ownerHash,
    views: 0,
  };
  t[list.id] = list;
  scheduleFlush();
  return { ok: true, list };
}

export async function unpublish(id: string, ownerKey: string): Promise<boolean> {
  const t = await load();
  const cur = t[id];
  if (!cur || cur.ownerHash !== hashKey(ownerKey)) return false;
  delete t[id];
  scheduleFlush();
  return true;
}

export type PublicSort = "yeni" | "populer";

/** Vitrin akışı. `ownerHash` istemciye SIZDIRILMAZ — çağıran taraf ayıklar. */
export async function listPublic(
  sort: PublicSort = "yeni",
  limit = 60,
  offset = 0,
): Promise<{ items: PublicList[]; total: number }> {
  const t = await load();
  const all = Object.values(t);
  all.sort((a, b) =>
    sort === "populer" ? b.views - a.views || cmpDate(a, b) : cmpDate(a, b),
  );
  return { items: all.slice(offset, offset + limit), total: all.length };
}

const cmpDate = (a: PublicList, b: PublicList) => (a.updatedAt < b.updatedAt ? 1 : -1);

export async function getPublic(id: string): Promise<PublicList | null> {
  const t = await load();
  return t[id] ?? null;
}

/** Görüntülenme sayacı — liste açıldığında artar. */
export async function bumpViews(id: string): Promise<void> {
  const t = await load();
  const cur = t[id];
  if (!cur) return;
  cur.views++;
  scheduleFlush();
}

/** İstemciye giden biçim: sahiplik hash'i düşürülür, "benim mi" bayrağı eklenir. */
export function toPublicView(l: PublicList, ownerKey?: string) {
  const { ownerHash, ...rest } = l;
  return { ...rest, mine: !!ownerKey && ownerHash === hashKey(ownerKey) };
}
