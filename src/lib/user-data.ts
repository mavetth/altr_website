/**
 * HESABA BAĞLI VERİ — listeler + görünüm tercihleri.
 *
 * Cihazdaki localStorage kaybolmadı, ikinci bir kopya oldu: giriş yapan kullanıcının
 * verisi burada da tutulur, iki taraf giriş anında BİRLEŞTİRİLİR (bkz. lib/sync.ts).
 * Sunucu tarafı bilerek "aptal": birleştirme kuralı istemcide, burası sadece son hâli
 * saklıyor. Böylece çevrimdışı kurulan bir liste de, ikinci cihazdan eklenen bir ürün
 * de kaybolmuyor.
 *
 * ÜRÜN GÖVDELERİ BURADA DURMAZ — yalnız id'ler. Kart çizmek için gereken gövdeler
 * okuma anında katalogdan çözülür (api/lists/route.ts'teki yöntemin aynısı); aksi
 * hâlde her kullanıcı için katalogun bir kopyası diske yazılırdı.
 *
 * Depo `reviews.ts` kalıbı: tek JSON + süreç-içi kopya + gecikmeli yazma.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

/** Tercih değerleri burada YENİDEN yazılı: `@/store` bir istemci modülü, sunucu
 *  tarafındaki bu dosyanın ona bağlanacak bir işi yok. Değişirlerse iki yerde de
 *  değişmeli — bilinçli, küçük bir tekrar. */
type Theme = "dark" | "light";
type Layout = "izgara" | "buyuk" | "sik" | "liste";
const LAYOUTS: Layout[] = ["izgara", "buyuk", "sik", "liste"];

export interface SyncList {
  id: string;
  name: string;
  ids: string[];
  createdAt: number;
  updatedAt: number;
}

export interface UserPrefs {
  theme?: Theme;
  layout?: Layout;
  /** Sol bar açık mı. */
  sidebar?: boolean;
}

export interface UserData {
  lists: SyncList[];
  activeId: string;
  /** yerelListeId -> yayınlanmış liste id'si (public-lists-client.ts ile aynı harita). */
  published: Record<string, string>;
  prefs: UserPrefs;
  /** Son yazma zamanı — çakışma tespiti bunun üzerinden. */
  updatedAt: string;
}

const DIR = process.env.AUTH_DIR ?? path.join(process.cwd(), ".data", "auth");
const FILE = path.join(DIR, "user-data.json");

/** Hesap başına tavanlar: dosya sınırsız büyümesin. */
export const MAX_LISTS = 40;
export const MAX_ITEMS = 200;
export const MAX_NAME = 60;

type Table = Record<string, UserData>;

const g = globalThis as unknown as { __altrUserData?: Table | null };
let table: Table | null = g.__altrUserData ?? null;
let writable = true;
let pending: NodeJS.Timeout | null = null;

async function load(): Promise<Table> {
  if (table) return table;
  try {
    table = JSON.parse(await fs.readFile(FILE, "utf8")) as Table;
  } catch {
    table = {};
  }
  g.__altrUserData = table;
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
    await fs.mkdir(DIR, { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(table), "utf8");
  } catch {
    writable = false;
  }
}

export const EMPTY: UserData = {
  lists: [],
  activeId: "",
  published: {},
  prefs: {},
  updatedAt: "1970-01-01T00:00:00.000Z",
};

export async function getUserData(userId: string): Promise<UserData> {
  const t = await load();
  return t[userId] ?? EMPTY;
}

/* ------------------------------------------------------------ doğrulama --- */

const str = (v: unknown, max: number): string => (typeof v === "string" ? v.slice(0, max) : "");

/**
 * İstemciden gelen gövdeyi daraltır. İstemci doğrulaması bir kolaylık, kural değil:
 * 10 bin id'lik bir liste ya da 4 MB'lık bir ad buradan geçmez.
 */
export function sanitize(raw: unknown): Omit<UserData, "updatedAt"> {
  const body = (raw ?? {}) as Partial<UserData>;
  const lists: SyncList[] = [];

  for (const l of Array.isArray(body.lists) ? body.lists : []) {
    const id = str((l as SyncList)?.id, 40);
    if (!id) continue;
    const ids = Array.isArray((l as SyncList).ids)
      ? [...new Set((l as SyncList).ids.filter((x) => typeof x === "string"))].slice(0, MAX_ITEMS)
      : [];
    const now = Date.now();
    lists.push({
      id,
      name: str((l as SyncList).name, MAX_NAME) || "LİSTE",
      ids,
      createdAt: Number((l as SyncList).createdAt) || now,
      updatedAt: Number((l as SyncList).updatedAt) || now,
    });
    if (lists.length >= MAX_LISTS) break;
  }

  const published: Record<string, string> = {};
  const rawPub = (body.published ?? {}) as Record<string, unknown>;
  for (const [k, v] of Object.entries(rawPub).slice(0, MAX_LISTS)) {
    if (typeof v === "string") published[str(k, 40)] = str(v, 40);
  }

  const p = (body.prefs ?? {}) as UserPrefs;
  const prefs: UserPrefs = {};
  if (p.theme === "dark" || p.theme === "light") prefs.theme = p.theme;
  if (p.layout && LAYOUTS.includes(p.layout)) prefs.layout = p.layout;
  if (typeof p.sidebar === "boolean") prefs.sidebar = p.sidebar;

  const activeId = str(body.activeId, 40);
  return {
    lists,
    activeId: lists.some((l) => l.id === activeId) ? activeId : (lists[0]?.id ?? ""),
    published,
    prefs,
  };
}

export type PutResult =
  | { ok: true; data: UserData }
  | { ok: false; reason: "eski"; current: UserData };

/**
 * Yazma. `baseUpdatedAt` istemcinin elindeki sürüm; sunucudaki daha yeniyse yazma
 * REDDEDİLİR ve mevcut hâl döner — istemci birleştirip tekrar dener. Aksi hâlde iki
 * cihazda açık iki sekmeden biri diğerinin listesini sessizce siler.
 */
export async function putUserData(
  userId: string,
  raw: unknown,
  baseUpdatedAt?: string,
): Promise<PutResult> {
  const t = await load();
  const current = t[userId];
  if (current && baseUpdatedAt && current.updatedAt > baseUpdatedAt) {
    return { ok: false, reason: "eski", current };
  }

  const data: UserData = { ...sanitize(raw), updatedAt: new Date().toISOString() };
  t[userId] = data;
  scheduleFlush();
  return { ok: true, data };
}
