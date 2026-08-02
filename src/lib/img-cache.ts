/**
 * /api/img için işlenmiş görsel önbelleği.
 *
 * Önbellek olmadan her sayfa açılışı 40 ürün × (marka CDN'ine gidiş + sharp ile yeniden
 * kodlama) demekti; aynı görsel her ziyarette baştan çekiliyordu. Burada üç katman var:
 *
 *  1) süreç-içi LRU (en sıcak görseller, diske bile gitmeden)
 *  2) disk önbelleği (.data/img-cache) — süreç yeniden başlasa da kalır
 *  3) uçuştaki istek tekilleştirme — aynı görseli aynı anda isteyen 10 sekme,
 *     markanın sunucusuna 10 değil 1 istek atar
 *
 * Diske yazılamayan ortamlarda (salt-okunur serverless FS) sessizce 1. katmana düşer.
 */
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export interface CachedImage {
  body: Buffer;
  contentType: string;
  /** İçerikten türetilmiş sabit etiket — tarayıcı 304 alabilsin diye. */
  etag: string;
}

const CACHE_DIR =
  process.env.IMG_CACHE_DIR ?? path.join(process.cwd(), ".data", "img-cache");
/** Disk önbelleği tavanı (MB). Aşılınca en eski kullanılanlar silinir. */
const DISK_MAX_BYTES = Number(process.env.IMG_CACHE_MAX_MB ?? 1024) * 1024 * 1024;
/** Süreç-içi LRU tavanı (MB). Küçük tutuluyor: asıl kalıcılık disk katmanında,
 *  bu yalnız en sıcak görseller için disk okumasını atlatan ince bir kabuk. */
const MEM_MAX_BYTES = Number(process.env.IMG_MEM_CACHE_MB ?? 32) * 1024 * 1024;

const EXT_BY_TYPE: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/svg+xml": "svg",
};
const TYPE_BY_EXT: Record<string, string> = Object.fromEntries(
  Object.entries(EXT_BY_TYPE).map(([t, e]) => [e, t]),
);

export function cacheKey(url: string, width: number): string {
  return createHash("sha1").update(`${width}|${url}`).digest("hex");
}

// --- süreç-içi LRU ----------------------------------------------------------
// Map ekleme sırasını koruduğu için LRU'yu "sil + yeniden ekle" ile kuruyoruz.
const mem = new Map<string, CachedImage>();
let memBytes = 0;

function memGet(key: string): CachedImage | undefined {
  const hit = mem.get(key);
  if (!hit) return undefined;
  mem.delete(key);
  mem.set(key, hit); // en sona taşı = en son kullanılan
  return hit;
}

function memPut(key: string, val: CachedImage) {
  if (val.body.byteLength > MEM_MAX_BYTES / 4) return; // tek dev görsel LRU'yu süpürmesin
  const prev = mem.get(key);
  if (prev) {
    mem.delete(key);
    memBytes -= prev.body.byteLength;
  }
  mem.set(key, val);
  memBytes += val.body.byteLength;
  while (memBytes > MEM_MAX_BYTES) {
    const oldest = mem.keys().next();
    if (oldest.done) break;
    const dropped = mem.get(oldest.value)!;
    mem.delete(oldest.value);
    memBytes -= dropped.body.byteLength;
  }
}

// --- disk katmanı -----------------------------------------------------------
// key -> dosya adı dizini. Dizin bir kez readdir ile kurulur; sonrası O(1).
let indexPromise: Promise<Map<string, string>> | null = null;
let diskBytes = 0;
let diskUsable = true;

async function getIndex(): Promise<Map<string, string>> {
  indexPromise ??= (async () => {
    const idx = new Map<string, string>();
    try {
      await fs.mkdir(CACHE_DIR, { recursive: true });
      for (const f of await fs.readdir(CACHE_DIR)) {
        const dot = f.lastIndexOf(".");
        if (dot <= 0) continue;
        idx.set(f.slice(0, dot), f);
        try {
          diskBytes += (await fs.stat(path.join(CACHE_DIR, f))).size;
        } catch {
          /* yarış hâlinde silinmiş olabilir */
        }
      }
    } catch {
      diskUsable = false; // salt-okunur FS: yalnız bellek önbelleği çalışır
    }
    return idx;
  })();
  return indexPromise;
}

async function diskGet(key: string): Promise<CachedImage | undefined> {
  if (!diskUsable) return undefined;
  const idx = await getIndex();
  const file = idx.get(key);
  if (!file) return undefined;
  try {
    const body = await fs.readFile(path.join(CACHE_DIR, file));
    const ext = file.slice(file.lastIndexOf(".") + 1);
    return { body, contentType: TYPE_BY_EXT[ext] ?? "application/octet-stream", etag: `"${key}"` };
  } catch {
    idx.delete(key); // dosya elden gitmiş
    return undefined;
  }
}

/** Tavan aşıldıysa en eski dosyaları (mtime'a göre) silerek yer aç. */
async function evictIfNeeded(idx: Map<string, string>) {
  if (diskBytes <= DISK_MAX_BYTES) return;
  try {
    const stats = await Promise.all(
      [...idx.entries()].map(async ([key, file]) => {
        try {
          const st = await fs.stat(path.join(CACHE_DIR, file));
          return { key, file, size: st.size, at: st.mtimeMs };
        } catch {
          return null;
        }
      }),
    );
    const live = stats.filter((s): s is NonNullable<typeof s> => s !== null);
    live.sort((a, b) => a.at - b.at);
    // %20 boşluk açana kadar en eskilerden sil — her yazıda tahliye yapmayalım
    const target = DISK_MAX_BYTES * 0.8;
    for (const s of live) {
      if (diskBytes <= target) break;
      await fs.unlink(path.join(CACHE_DIR, s.file)).catch(() => {});
      idx.delete(s.key);
      diskBytes -= s.size;
    }
  } catch {
    /* tahliye başarısız olsa da servis etmeye devam */
  }
}

async function diskPut(key: string, val: CachedImage) {
  if (!diskUsable) return;
  const ext = EXT_BY_TYPE[val.contentType];
  if (!ext) return; // tanımadığımız tür: diske yazma
  const idx = await getIndex();
  const file = `${key}.${ext}`;
  const tmp = path.join(CACHE_DIR, `${key}.${process.pid}.tmp`);
  try {
    // önce geçici dosyaya, sonra rename: yarım yazılmış dosya asla servis edilmez
    await fs.writeFile(tmp, val.body);
    await fs.rename(tmp, path.join(CACHE_DIR, file));
    idx.set(key, file);
    diskBytes += val.body.byteLength;
    await evictIfNeeded(idx);
  } catch {
    await fs.unlink(tmp).catch(() => {});
    diskUsable = false;
  }
}

// --- dışa açık API ----------------------------------------------------------

const inflight = new Map<string, Promise<CachedImage | null>>();

/**
 * Önbellekten döndürür; yoksa `produce()` ile üretip iki katmana da yazar.
 * Aynı anahtar için eşzamanlı çağrılar tek bir `produce()` paylaşır.
 */
export async function withImageCache(
  key: string,
  produce: () => Promise<CachedImage | null>,
): Promise<CachedImage | null> {
  const hot = memGet(key);
  if (hot) return hot;

  const running = inflight.get(key);
  if (running) return running;

  const job = (async () => {
    const onDisk = await diskGet(key);
    if (onDisk) {
      memPut(key, onDisk);
      return onDisk;
    }
    const made = await produce();
    if (made) {
      memPut(key, made);
      await diskPut(key, made);
    }
    return made;
  })().finally(() => inflight.delete(key));

  inflight.set(key, job);
  return job;
}

/* ---------------------------------------------------------- ölü görseller -- */

/**
 * NEGATİF ÖNBELLEK — kaynağı ölmüş görselleri hatırlar.
 *
 * İki ayrı derdi birden çözüyor:
 *
 * 1. HIZ. Başarısız istek hiç önbelleklenmiyordu: kaynağı 404 veren ya da hiç cevap
 *    vermeyen bir URL, her sayfa açılışında yeniden deneniyor, her denemede 5 sn'lik
 *    timeout'a kadar bir upstream slotunu (toplam 8) işgal ediyordu. Ölü görselleri
 *    olan bir marka, sayfadaki SAĞLAM görselleri de kuyrukta bekletiyor. Artık ölü
 *    bilinen URL anında 502 döner, kaynağa hiç gidilmez.
 *
 * 2. SIRALAMA. Katalogda görseli olmayan ürün YOK (ölçüldü: 0/73.214) — kullanıcının
 *    gördüğü boş kartların hepsi URL'i ölmüş ürünler. Bunu içe aktarma anında bilmek
 *    mümkün değil; ancak bir kez istendiğinde öğreniliyor. Öğrenilen bilgi burada
 *    birikiyor ve `runQuery` bunu kullanarak o ürünleri akışın SONUNA atıyor
 *    (bkz. lib/query.ts, `deadImageRank`).
 *
 * TTL var çünkü ölüm kalıcı olmayabilir: marka CDN'i geçici olarak düşmüş olabilir,
 * bir gün sonra yeniden denenir.
 */
const DEAD_TTL_MS = Number(process.env.IMG_DEAD_TTL_HOURS ?? 12) * 3600 * 1000;
const DEAD_MAX = 20000;
const dead = new Map<string, number>(); // url -> ne zaman öldüğü

/** Bu URL şu an ölü biliniyor mu? */
export function isDeadImage(url: string): boolean {
  const at = dead.get(url);
  if (at === undefined) return false;
  if (Date.now() - at > DEAD_TTL_MS) {
    dead.delete(url);
    return false;
  }
  return true;
}

/** Kaynak bu URL'i veremedi. */
export function markDeadImage(url: string): void {
  if (dead.size >= DEAD_MAX) {
    // En eski kaydı at — sınırsız büyüyen bir Map bellek sızıntısıdır.
    const oldest = dead.keys().next();
    if (!oldest.done) dead.delete(oldest.value);
  }
  dead.set(url, Date.now());
}

/** Kaynak yeniden cevap verdi (geçici bir kesintiymiş). */
export function clearDeadImage(url: string): void {
  dead.delete(url);
}

/** Ölü bilinen URL sayısı — admin panelindeki teşhis için. */
export function deadImageCount(): number {
  return dead.size;
}

/**
 * Marka CDN'lerine aynı anda açılacak bağlantı sayısını sınırlar. Sınırsız bırakınca
 * ilk yüklemede 40 paralel istek çıkıyor, yavaş bir marka tüm sayfayı bekletiyordu.
 *
 * KUYRUK ARTIK KAYNAK BAŞINA (2026-07-30). Tek bir küresel 8'lik kuyruk vardı ve
 * kategori değiştirmeyi yavaş yapan asıl şey oydu: bir ızgarada 40 kart, 15-20 FARKLI
 * markanın CDN'inden geliyor; hepsi tek sıraya diziliyor ve yavaş cevap veren bir
 * kaynak (ya da 5 sn'lik timeout'a giden bir istek) sırayı tıkayarak hızlı kaynakları
 * da bekletiyordu. Ölçüm: soğuk bir kategoride görsellerin medyan süresi 13,4 sn.
 *
 * İki kademeli sınır doğru olan:
 *  - kaynak (host) başına {@link PER_HOST}: tek markanın sunucusunu dövmemek için —
 *    zaten nezaket sınırının asıl gerekçesi buydu.
 *  - toplam {@link MAX_UPSTREAM}: kendi soket/bellek tavanımız.
 * Farklı markalar artık birbirini beklemiyor.
 */
const MAX_UPSTREAM = Number(process.env.IMG_FETCH_CONCURRENCY ?? 32);
const PER_HOST = Number(process.env.IMG_FETCH_PER_HOST ?? 6);

let active = 0;
const globalQueue: Array<() => void> = [];
const hostActive = new Map<string, number>();
const hostQueue = new Map<string, Array<() => void>>();

async function acquire(host: string) {
  if ((hostActive.get(host) ?? 0) >= PER_HOST) {
    await new Promise<void>((r) => {
      const q = hostQueue.get(host) ?? [];
      q.push(r);
      hostQueue.set(host, q);
    });
  }
  hostActive.set(host, (hostActive.get(host) ?? 0) + 1);

  if (active >= MAX_UPSTREAM) await new Promise<void>((r) => globalQueue.push(r));
  active++;
}

function release(host: string) {
  active--;
  globalQueue.shift()?.();

  const n = (hostActive.get(host) ?? 1) - 1;
  if (n <= 0) hostActive.delete(host);
  else hostActive.set(host, n);

  const q = hostQueue.get(host);
  const next = q?.shift();
  if (next) next();
  else if (q) hostQueue.delete(host);
}

/**
 * `host` verilmezse hepsi tek havuza düşer (eski davranış) — çağıranın kaynağı
 * bildiği her yerde vermesi beklenir.
 */
export async function withUpstreamSlot<T>(fn: () => Promise<T>, host = "*"): Promise<T> {
  await acquire(host);
  try {
    return await fn();
  } finally {
    release(host);
  }
}
