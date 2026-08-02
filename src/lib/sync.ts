"use client";
/**
 * HESAP SENKRONU — cihazdaki listeler/tercihler ile hesaptakini birleştirir.
 *
 * Kural: GİRİŞ YAPMAK HİÇBİR ŞEYİ SİLMEZ.
 * Kullanıcı giriş yapmadan liste kurar (site böyle çalışıyor, hesap zorunlu değil);
 * sonra giriş yaptığında o emeğin kaybolması kabul edilemez. Bu yüzden ilk temasta
 * iki taraf BİRLEŞTİRİLİR, sonra sunucu kaynak olur.
 *
 * Birleştirme:
 *   - aynı id'li listeler → ürün id'leri birleşir (önce sunucudakiler, sonra yalnız
 *     cihazda olanlar), ad/aktiflik `updatedAt`ı yeni olandan
 *   - id farklı ama AD aynı → yine birleşir. Bu, "cihazda VİTRİNİM vardı, hesapta da
 *     VİTRİNİM var" durumudur; iki ayrı VİTRİNİM göstermek kullanıcı için anlamsız
 *   - kalanlar olduğu gibi eklenir
 * Tercihlerde (tema/düzen/sol bar) alan alan değil BLOK olarak yenisi kazanır: yarısı
 * bir cihazdan yarısı diğerinden gelen bir görünüm kimsenin istediği şey değil.
 *
 * Sunucu tarafı: lib/user-data.ts + app/api/me/data/route.ts.
 */
import type { Product } from "./types";
import { MAX_LIST_ITEMS, type ListsState, type UserList } from "./lists";
import { readPublished, writePublished } from "./public-lists-client";

export type Theme = "dark" | "light";
export type Layout = "izgara" | "buyuk" | "sik" | "liste";

export interface UserPrefs {
  theme?: Theme;
  layout?: Layout;
  sidebar?: boolean;
}

export interface UserData {
  lists: UserList[];
  activeId: string;
  published: Record<string, string>;
  prefs: UserPrefs;
  updatedAt: string;
}

export interface PullResult {
  data: UserData;
  products: Product[];
}

/** Sunucudaki son yazmanın damgası — çakışma tespiti (409) için taşınır. */
let lastKnown = "";

/**
 * Cihazdaki verinin SAHİBİ (kullanıcı id'si) — birleştirme yalnız doğru durumda yapılsın.
 *
 * Olmadan şu olur: guap listesini kurar, çıkar, aynı tarayıcıda maveth girer ve guap'ın
 * listesi maveth'in hesabına BİRLEŞİR. Birleştirme "sahipsiz" veri için doğru davranış
 * (giriş yapmadan biriktirilmiş liste kaybolmasın), başkasının verisi için değil.
 *
 * Boş = sahipsiz (hiç giriş yapılmamış cihaz) → birleştir.
 * Aynı kullanıcı → birleştir (aynı verinin iki kopyası).
 * Başka kullanıcı → birleştirme; hesabın kendi verisi cihazdakinin YERİNE geçer.
 */
const OWNER_KEY = "altr-sync-owner";

function syncOwner(): string {
  try {
    return localStorage.getItem(OWNER_KEY) ?? "";
  } catch {
    return "";
  }
}

function setSyncOwner(userId: string): void {
  try {
    localStorage.setItem(OWNER_KEY, userId);
  } catch {
    /* kota */
  }
}

export function resetSync(): void {
  lastKnown = "";
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = null;
  queued = null;
}

/* ------------------------------------------------------------ birleştirme --- */

function mergeOne(remote: UserList, local: UserList): UserList {
  const ids = [...remote.ids];
  const have = new Set(ids);
  for (const id of local.ids) {
    if (!have.has(id)) {
      ids.push(id);
      have.add(id);
    }
  }
  const newer = local.updatedAt > remote.updatedAt ? local : remote;
  return {
    id: remote.id,
    name: newer.name,
    // Tavan aşılırsa BAŞTAN kesilir: liste "en son eklenen sonda" sırasında,
    // yani baştakiler en eski eklenenler.
    ids: ids.length > MAX_LIST_ITEMS ? ids.slice(ids.length - MAX_LIST_ITEMS) : ids,
    createdAt: Math.min(remote.createdAt, local.createdAt),
    updatedAt: Math.max(remote.updatedAt, local.updatedAt),
  };
}

const nameKey = (s: string): string => s.trim().toLocaleLowerCase("tr");

export function mergeLists(
  remote: UserList[],
  local: UserList[],
): { lists: UserList[]; map: Record<string, string> } {
  const out: UserList[] = [];
  const byId = new Map(remote.map((l) => [l.id, l]));
  const byName = new Map(remote.map((l) => [nameKey(l.name), l]));
  const used = new Set<string>();
  /** yerel liste id -> birleşince kullanılan id. Yayın haritası bununla taşınır. */
  const map: Record<string, string> = {};

  for (const l of local) {
    const match = byId.get(l.id) ?? byName.get(nameKey(l.name));
    if (match && !used.has(match.id)) {
      used.add(match.id);
      out.push(mergeOne(match, l));
      map[l.id] = match.id;
    } else if (!match) {
      out.push({ ...l });
      map[l.id] = l.id;
    } else {
      // Aynı sunucu listesine iki yerel liste eşleşti (aynı ad): ikincisi ayrı kalsın.
      out.push({ ...l });
      map[l.id] = l.id;
    }
  }
  for (const r of remote) if (!used.has(r.id)) out.push({ ...r });

  return { lists: out, map };
}

function mergePrefs(remote: UserData, localPrefs: UserPrefs, localStamp: number): UserPrefs {
  const remoteStamp = Date.parse(remote.updatedAt) || 0;
  return remoteStamp >= localStamp ? { ...localPrefs, ...remote.prefs } : { ...remote.prefs, ...localPrefs };
}

/* ------------------------------------------------------------------- ağ ---- */

export async function pull(): Promise<PullResult | null> {
  const res = await fetch("/api/me/data", { cache: "no-store" });
  if (!res.ok) return null;
  const body = (await res.json()) as PullResult;
  lastKnown = body.data.updatedAt;
  return body;
}

interface PushBody {
  lists: UserList[];
  activeId: string;
  published: Record<string, string>;
  prefs: UserPrefs;
}

async function put(data: PushBody): Promise<{ ok: boolean; conflict?: PullResult }> {
  const res = await fetch("/api/me/data", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data, base: lastKnown }),
  });
  if (res.status === 409) {
    const body = (await res.json()) as PullResult & { error: string };
    lastKnown = body.data.updatedAt;
    return { ok: false, conflict: { data: body.data, products: body.products } };
  }
  if (!res.ok) return { ok: false };
  const body = (await res.json()) as { data: UserData };
  lastKnown = body.data.updatedAt;
  return { ok: true };
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let queued: PushBody | null = null;

/**
 * Sunucuya yaz — 1500 ms geciktirilir. Listeye arka arkaya beş ürün eklemek beş istek
 * değil, tek istek olsun.
 */
export function schedulePush(body: PushBody, onConflict?: (c: PullResult) => void): void {
  queued = body;
  if (pushTimer) return;
  pushTimer = setTimeout(() => {
    pushTimer = null;
    const b = queued;
    queued = null;
    if (!b) return;
    void put(b).then((r) => {
      if (!r.ok && r.conflict && onConflict) onConflict(r.conflict);
    });
  }, 1500);
}

/**
 * Giriş anındaki ilk temas: sunucudan çek, cihazdakiyle birleştir, sonucu HEM
 * localStorage'a HEM sunucuya yaz.
 *
 * Yayın haritası (`altr-published-v1`) de taşınır: liste id'leri birleşme sırasında
 * değişebiliyor, harita eski id'ye bakmaya devam ederse "yayında mı" sorusu yanlış
 * cevaplanır.
 */
export async function mergeOnLogin(
  userId: string,
  localState: ListsState,
  localPrefs: UserPrefs,
  localStamp: number,
): Promise<{ state: ListsState; prefs: UserPrefs; products: Product[] } | null> {
  const remote = await pull();
  if (!remote) return null;

  const owner = syncOwner();
  setSyncOwner(userId);

  // Cihazdaki veri BAŞKA bir hesaba ait: birleştirme, hesabın kendi verisini getir.
  // (Aynı tarayıcıdan ikinci bir hesaba girmek, birincinin listesini taşımamalı.)
  if (owner && owner !== userId) {
    const foreign = remote.data.lists as UserList[];
    const activeId = foreign.some((l) => l.id === remote.data.activeId)
      ? remote.data.activeId
      : (foreign[0]?.id ?? "");
    writePublished(remote.data.published ?? {});
    return {
      state: { lists: foreign, activeId },
      prefs: remote.data.prefs,
      products: remote.products,
    };
  }

  const { lists, map } = mergeLists(remote.data.lists as UserList[], localState.lists);
  const activeId =
    map[localState.activeId] ??
    (lists.some((l) => l.id === remote.data.activeId) ? remote.data.activeId : lists[0]?.id) ??
    "";
  const prefs = mergePrefs(remote.data, localPrefs, localStamp);

  // Yayın haritası: yereldeki kayıtlar yeni id'lere taşınır, sunucudakiler eklenir.
  const localPub = readPublished();
  const published: Record<string, string> = { ...remote.data.published };
  for (const [listId, pubId] of Object.entries(localPub)) published[map[listId] ?? listId] = pubId;
  writePublished(published);

  const body: PushBody = { lists, activeId, published, prefs };
  const r = await put(body);
  // Çakışma (başka bir sekme araya girdi): gelen hâlle bir kez daha birleştirip yaz.
  if (!r.ok && r.conflict) {
    const again = mergeLists(r.conflict.data.lists as UserList[], lists);
    await put({ ...body, lists: again.lists });
    return { state: { lists: again.lists, activeId }, prefs, products: r.conflict.products };
  }

  return { state: { lists, activeId }, prefs, products: remote.products };
}
