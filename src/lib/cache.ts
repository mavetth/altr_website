/**
 * Taşınabilir metadata önbelleği.
 *
 * - Görseller ASLA burada tutulmaz; sadece küçük JSON metadata (isim/fiyat/görsel URL).
 * - Vercel'de: adaptörler ayrıca fetch(revalidate) ile Next Data Cache'e yaslanır;
 *   bu sarmalayıcı da süreç-içi bellek olarak çalışır (best-effort).
 * - Kendi sunucunda: REDIS_URL verilirse Redis kullanılır (çok-instance için doğru çözüm).
 */

type Entry = { value: unknown; expires: number };

// HMR/çoklu-import'ta tek Map kalsın diye globalThis'e tuttur.
const g = globalThis as unknown as { __altrCache?: Map<string, Entry> };
const mem: Map<string, Entry> = g.__altrCache ?? (g.__altrCache = new Map());

const REDIS_URL = process.env.REDIS_URL;

// ioredis opsiyonel bir bağımlılık; literal olmayan specifier ile import edilir ki
// paket kurulu değilse tsc/webpack modül-çözümleme hatası vermesin.
let redisPromise: Promise<any> | null = null;
async function getRedis(): Promise<any | null> {
  if (!REDIS_URL) return null;
  if (!redisPromise) {
    const spec = "ioredis";
    redisPromise = import(spec)
      .then((m: any) => new (m.default ?? m)(REDIS_URL))
      .catch((e: unknown) => {
        console.warn("[cache] Redis yüklenemedi, belleğe düşülüyor:", e);
        return null;
      });
  }
  return redisPromise;
}

async function rawGet(key: string): Promise<unknown | undefined> {
  const redis = await getRedis();
  if (redis) {
    const s = await redis.get(key);
    return s ? JSON.parse(s) : undefined;
  }
  const e = mem.get(key);
  if (!e) return undefined;
  if (e.expires < Date.now()) {
    mem.delete(key);
    return undefined;
  }
  return e.value;
}

async function rawSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const redis = await getRedis();
  if (redis) {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
    return;
  }
  mem.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
}

/** key için önbellekli üretim: varsa döndür, yoksa fn() çalıştır + sakla. */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>,
): Promise<T> {
  const hit = (await rawGet(key)) as T | undefined;
  if (hit !== undefined) return hit;
  const value = await fn();
  // Boş sonuçları da kısa süre saklayıp marka sitesini dövmemek için yine de yazıyoruz.
  await rawSet(key, value, ttlSeconds).catch(() => {});
  return value;
}

// --- Sabit katalog anlık görüntüsü (disk) ---------------------------------
// Site artık CANLI toplama yapmaz; otoriter `altr` scraper'ının çıktısı
// `scripts/import-catalog.mjs` ile düz Product[]'e dönüştürülüp .data/catalog.json'a
// yazılır. Bu dosya süreç ömrü boyunca bir kez okunur (aggregate.ts memo'lar).
let fsModPromise: Promise<typeof import("node:fs/promises")> | null = null;
let pathModPromise: Promise<typeof import("node:path")> | null = null;
async function nodeFs() {
  fsModPromise ??= import("node:fs/promises");
  pathModPromise ??= import("node:path");
  const [fs, path] = await Promise.all([fsModPromise, pathModPromise]);
  return { fs, path };
}

/**
 * Servis edilecek katalog dosyası.
 *
 * Varsayılan `.data/catalog.json`; `ALTR_CATALOG` ile değiştirilebilir (mutlak yol ya da
 * proje köküne göre görece). Neden env: geliştirmede HAFİF ÖRNEK
 * (`catalog.sample.json`, 2.160 ürün) yeterli ve az bellek yiyor, vitrinin GERÇEK hâli
 * ise `catalog.new-full.json` (73.214 ürün, ~480 MB heap). Eskiden ikisi arasında geçiş
 * dosyayı ÜZERİNE KOPYALAMAKLA yapılıyordu — hangisinin canlı olduğu dosya adından
 * anlaşılmıyor ve `make-sample --uygula` gerçek kataloğu sessizce eziyordu.
 */
async function catalogPath(): Promise<string> {
  const { path } = await nodeFs();
  const custom = process.env.ALTR_CATALOG?.trim();
  if (custom) {
    return path.isAbsolute(custom) ? custom : path.join(process.cwd(), custom);
  }
  return path.join(process.cwd(), ".data", "catalog.json");
}

/**
 * Katalogu diskten okur. Hata SESSİZCE YUTULMAZ — sebep günlüğe yazılır.
 *
 * Eskiden `catch { return undefined }` idi ve okuma hatası hiçbir iz bırakmıyordu:
 * vitrin boş geliyor, sunucu günlüğü tertemiz görünüyordu. Boş vitrinin sebebini
 * aramanın tek yolu buradan geçiyor (çağıran taraf için bkz. lib/aggregate.ts).
 */
export async function readCatalog<T>(): Promise<T | undefined> {
  const p = await catalogPath();
  try {
    const { fs } = await nodeFs();
    return JSON.parse(await fs.readFile(p, "utf8")) as T;
  } catch (e) {
    console.error(`[altr] Katalog okunamadi: ${p}`, e);
    return undefined;
  }
}

export const CFG = {
  productsTtl: Number(process.env.PRODUCTS_TTL ?? 900),
  sourceTimeoutMs: Number(process.env.SOURCE_TIMEOUT_MS ?? 5000),
  concurrency: Number(process.env.FETCH_CONCURRENCY ?? 6),
  maxPerBrand: Number(process.env.MAX_PRODUCTS_PER_BRAND ?? 100),
  imgMaxWidth: Number(process.env.IMG_MAX_WIDTH ?? 1200),
};
