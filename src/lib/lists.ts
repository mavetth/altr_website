import type { Product } from "./types";

/**
 * LİSTELER — "Vitrinim"in çok listeli, paylaşılabilir hâli.
 *
 * Depo CİHAZDA: liste verisi localStorage'da durur, hesap ZORUNLU DEĞİL. Paylaşım da
 * sunucusuz çalışır: liste, ürün KISA KODLARI olarak linke gömülür.
 *
 * Giriş yapıldığında bu veri kaybolmaz, hesaptakiyle BİRLEŞİR ve iki tarafta birden
 * tutulur (bkz. lib/sync.ts + lib/user-data.ts). Ürün nesneleri listenin İÇİNDE
 * tutulmaz, ayrı bir önbellekte durur — böylece senkronizasyonda sadece kimlikler
 * gider, 69 bin ürünlük katalog değil.
 */

export interface UserList {
  id: string;
  name: string;
  /** Product.id dizisi — en son eklenen sonda. */
  ids: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ListsState {
  lists: UserList[];
  activeId: string;
}

const LISTS_KEY = "altr-lists-v1";
const CACHE_KEY = "altr-list-cache-v1";
/** Eski tek listeli sürümün anahtarı — bir kez okunup yeni modele taşınır. */
const LEGACY_KEY = "altr-showcase";

export const DEFAULT_LIST_NAME = "VİTRİNİM";
/** Bir listede tutulabilecek ürün tavanı — localStorage kotası ve link boyu için. */
export const MAX_LIST_ITEMS = 200;

export function newId(): string {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
}

export function emptyList(name = DEFAULT_LIST_NAME): UserList {
  const now = Date.now();
  return { id: newId(), name, ids: [], createdAt: now, updatedAt: now };
}

/* ------------------------------------------------------------- depolama ---- */

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* kota dolabilir — sessizce geç, uygulama listesiz de çalışır */
  }
}

/**
 * Listeleri yükler. İlk açılışta eski tek listeli "vitrin" varsa onu VİTRİNİM adıyla
 * ilk listeye taşır — kullanıcının biriktirdiği ürünler kaybolmasın.
 */
export function loadLists(): { state: ListsState; cache: Record<string, Product> } {
  const cache = readJson<Record<string, Product>>(CACHE_KEY) ?? {};
  const stored = readJson<ListsState>(LISTS_KEY);
  if (stored?.lists?.length) {
    const activeId = stored.lists.some((l) => l.id === stored.activeId)
      ? stored.activeId
      : stored.lists[0].id;
    return { state: { lists: stored.lists, activeId }, cache };
  }

  const legacy = readJson<Product[]>(LEGACY_KEY);
  const first = emptyList();
  if (legacy?.length) {
    for (const p of legacy) {
      if (p?.id) {
        first.ids.push(p.id);
        cache[p.id] = p;
      }
    }
  }
  return { state: { lists: [first], activeId: first.id }, cache };
}

export function saveLists(state: ListsState, cache: Record<string, Product>): void {
  writeJson(LISTS_KEY, state);
  // Önbellekte yalnız bir listede geçen ürünler kalsın; silinen listelerin ürünleri
  // kotayı boşuna doldurmasın.
  const alive = new Set(state.lists.flatMap((l) => l.ids));
  const pruned: Record<string, Product> = {};
  for (const id of alive) if (cache[id]) pruned[id] = cache[id];
  writeJson(CACHE_KEY, pruned);
}

/* -------------------------------------------------------------- paylaşım --- */

/**
 * Ürün id'leri okunabilir ama uzun ("abluka::erkekdolgulufitillikadifemontfüme", 40+
 * karakter ve Türkçe harfli). 30 ürünlük bir listenin linki bunlarla 1500 karakteri
 * aşıyor ve URL kodlamasıyla iki katına çıkıyordu. Onun yerine her ürüne 7 karakterlik
 * base36 karma kodu üretiliyor; sunucu katalogdan kod → ürün tablosunu bir kez kurup
 * çözüyor. Çakışma olasılığı 54 bin ürün için ihmal edilebilir (36^7 ≈ 78 milyar);
 * çakışırsa sadece o kod ilk eşleşen ürüne düşer, liste bozulmaz.
 */
export function shortId(productId: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < productId.length; i++) {
    h ^= productId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // ikinci tur: yalnız son baytlara bakan karma, benzer id'lerde kümeleniyordu
  let h2 = Math.imul(h ^ (h >>> 15), 0x2545f491) >>> 0;
  h2 = (h2 ^ (h2 >>> 13)) >>> 0;
  return (h >>> 0).toString(36).padStart(7, "0").slice(-7) + (h2 % 36).toString(36);
}

export const SHARE_SEP = ".";

/** Liste → paylaşım kodu (URL'de `liste=` parametresinin değeri). */
export function encodeShare(ids: string[]): string {
  return ids.slice(0, MAX_LIST_ITEMS).map(shortId).join(SHARE_SEP);
}

export function decodeShare(code: string): string[] {
  return code
    .split(SHARE_SEP)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_LIST_ITEMS);
}

/**
 * Paylaşımın iki biçimi.
 *
 * - `liste`  : listenin tamamı, ızgara olarak. "Şunlara bak."
 * - `kombin` : kategori başına TEK parça, üstten alta dizilmiş bir kıyafet. "Şöyle giyin."
 *
 * Aynı link mekanizmasını paylaşırlar (kısa kodlar URL'de, sunucu SSR'de çözer); fark
 * yalnız hangi ürünlerin seçildiği ve karşı tarafın gördüğü düzendir.
 */
export type ShareMode = "liste" | "kombin";

/** Paylaşım linki. `origin` verilmezse göreli link döner (SSR'de origin bilinmiyor). */
export function shareUrl(
  list: { name: string; ids: string[] },
  origin?: string,
  mode: ShareMode = "liste",
): string {
  const p = new URLSearchParams();
  p.set("liste", encodeShare(list.ids));
  if (list.name && list.name !== DEFAULT_LIST_NAME) p.set("ad", list.name);
  if (mode === "kombin") p.set("mod", "kombin");
  return `${origin ?? ""}/?${p.toString()}`;
}

export function parseShareMode(v: string | null | undefined): ShareMode {
  return v === "kombin" ? "kombin" : "liste";
}

/**
 * Kod → ürün çözümü (sunucu tarafı). Tablo katalog başına bir kez kurulur; katalog
 * bellekte memo'lu olduğu için referans değişmediği sürece yeniden kurulmaz.
 */
let codeTable: { src: Product[]; map: Map<string, Product> } | null = null;

export function resolveShare(all: Product[], codes: string[]): Product[] {
  if (!codeTable || codeTable.src !== all) {
    const map = new Map<string, Product>();
    for (const p of all) {
      const c = shortId(p.id);
      if (!map.has(c)) map.set(c, p);
    }
    codeTable = { src: all, map };
  }
  const out: Product[] = [];
  for (const c of codes) {
    const p = codeTable.map.get(c);
    if (p) out.push(p);
  }
  return out;
}
