import type { Product } from "./types";
import type { UserList } from "./lists";

/**
 * HERKESE AÇIK LİSTELER — istemci tarafı.
 *
 * Sunucu tarafı `public-lists.ts`te; burada yalnız cihazın SAHİPLİK ANAHTARI ve API
 * çağrıları var. Anahtar bir kez üretilip localStorage'da kalır: sunucuda hesap
 * olmadığı için "bu liste benim" iddiasının tek kanıtı budur. Anahtar kaybolursa
 * (tarayıcı verisi silinirse) liste yayında kalır ama artık düzenlenemez — hesap
 * sistemi tam olarak bunu çözecek.
 */

const OWNER_KEY = "altr-owner-v1";
/** Yayınladığım listelerin id'leri: liste kimliğini cihazda da tutuyoruz ki
 *  "yayında mı" sorusu ağa çıkmadan cevaplanabilsin. */
const PUBLISHED_KEY = "altr-published-v1";

export interface PublicListView {
  id: string;
  nick: string;
  name: string;
  ids: string[];
  covers: string[];
  createdAt: string;
  updatedAt: string;
  views: number;
  /** Bu cihaz mı yayınladı (sunucu, anahtarın hash'iyle karşılaştırıp söylüyor). */
  mine: boolean;
}

export function ownerKey(): string {
  if (typeof localStorage === "undefined") return "";
  let k = localStorage.getItem(OWNER_KEY);
  if (!k) {
    k = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).replace(/[^a-z0-9-]/gi, "");
    localStorage.setItem(OWNER_KEY, k);
  }
  return k;
}

/* --------------------------------------------- yerel yayın kaydı (liste->id) --- */

type PublishedMap = Record<string, string>; // yerel liste id -> yayın id

/** Yayın haritasının tamamı — hesap senkronu bunu da taşıyor (bkz. lib/sync.ts). */
export function readPublished(): PublishedMap {
  if (typeof localStorage === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(PUBLISHED_KEY) ?? "{}") as PublishedMap;
  } catch {
    return {};
  }
}

export function writePublished(m: PublishedMap): void {
  try {
    localStorage.setItem(PUBLISHED_KEY, JSON.stringify(m));
  } catch { /* kota */ }
}

/** Bu yerel listenin yayın id'si (yayında değilse null). */
export function publishedIdOf(listId: string): string | null {
  return readPublished()[listId] ?? null;
}

function rememberPublish(listId: string, publicId: string): void {
  const m = readPublished();
  m[listId] = publicId;
  writePublished(m);
}

function forgetPublish(listId: string): void {
  const m = readPublished();
  delete m[listId];
  writePublished(m);
}

/* ------------------------------------------------------------------- API ---- */

const headers = () => ({ "content-type": "application/json", "x-owner-key": ownerKey() });

export type PublishError = "nick" | "bos" | "dolu" | "sahip" | "yok" | "ag";

export async function publishList(
  list: UserList,
  nick: string,
  items: Product[],
): Promise<{ ok: true; list: PublicListView } | { ok: false; error: PublishError }> {
  // Kapaklar sunucuda saklanıyor: katalog değişse ya da ürün kaybolsa bile kart çizilsin.
  const covers = items.map((p) => p.image).filter((u): u is string => !!u).slice(0, 4);
  try {
    const res = await fetch("/api/lists", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        id: publishedIdOf(list.id) ?? undefined,
        nick,
        name: list.name,
        ids: list.ids,
        covers,
      }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: (data?.error ?? "ag") as PublishError };
    rememberPublish(list.id, data.list.id);
    return { ok: true, list: data.list as PublicListView };
  } catch {
    return { ok: false, error: "ag" };
  }
}

export async function unpublishList(listId: string): Promise<boolean> {
  const pid = publishedIdOf(listId);
  if (!pid) return true;
  try {
    const res = await fetch(`/api/lists?id=${encodeURIComponent(pid)}`, {
      method: "DELETE",
      headers: headers(),
    });
    if (res.ok) forgetPublish(listId);
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchPublicLists(
  sort: "yeni" | "populer" = "yeni",
): Promise<PublicListView[]> {
  try {
    const res = await fetch(`/api/lists?sort=${sort}`, { headers: headers() });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items ?? []) as PublicListView[];
  } catch {
    return [];
  }
}

/**
 * Tek liste + ürün gövdeleri. Ürünleri sunucu çözüyor: istemcide katalog yok ve
 * listede yalnız id'ler duruyor (bkz. api/lists/route.ts).
 */
export async function fetchPublicList(
  id: string,
): Promise<{ list: PublicListView; items: Product[]; missing: number } | null> {
  try {
    const res = await fetch(`/api/lists?id=${encodeURIComponent(id)}`, { headers: headers() });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.list) return null;
    return {
      list: data.list as PublicListView,
      items: (data.items ?? []) as Product[],
      missing: Number(data.missing ?? 0),
    };
  } catch {
    return null;
  }
}
