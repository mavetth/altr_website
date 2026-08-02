import type { Product } from "./types";
import { readCatalog } from "./cache";
import { clearSearchIndex } from "./search-index";
import { clearOrderCache } from "./query";

// Site artık CANLI toplama yapmaz — otoriter `altr` scraper'ının çıktısı
// (`scripts/import-catalog.mjs` ile düz Product[]'e dönüştürülüp bir JSON anlık
// görüntüsüne yazılır; hangi dosya olduğu `ALTR_CATALOG` ile seçilir) SABİT olarak
// servis edilir. Böylece her açılışta aynı ürün gelir.
let memo: Product[] | null = null;

/**
 * Süren okuma. İki isteğin AYNI ANDA 121 MB'lık katalogu ayrıştırmasını engeller.
 *
 * Eskiden yoktu: soğuk açılışta gelen ilk birkaç istek (sayfa + /api/products +
 * prefetch) hepsi birden dosyayı okuyup ayrıştırıyordu. Her biri ~480 MB heap
 * demek — üç eşzamanlı istek 1,4 GB'lık geçici bir zirve üretiyor ve bu makinede
 * OOM'a giden yol tam olarak buydu. Artık ilk istek okur, diğerleri aynı sözü bekler.
 */
let inflight: Promise<Product[]> | null = null;

/**
 * BOŞ SONUÇ ÖNBELLEKLENMEZ — bu bir hata düzeltmesidir, üslup tercihi değil.
 *
 * Eski kod `memo = snap?.length ? snap : []` yazıp ardından `if (memo) return memo`
 * ile çıkıyordu. JavaScript'te BOŞ DİZİ TRUTHY olduğu için, katalog okuması bir kez
 * başarısız olduğunda (`readCatalog` her hatayı yutup `undefined` döner: disk hatası,
 * yarım yazılmış dosya, bellek baskısı) `memo` kalıcı olarak `[]`e kilitleniyordu.
 * Sonuç: sunucu ayakta ama HER istek 0 ürün dönüyor — vitrin "filtreden dolayı ürün
 * yok" gibi görünüyor, oysa katalog yerinde duruyor. Yeniden başlatmadan düzelmiyordu.
 *
 * Artık: boş/başarısız okuma önbelleğe YAZILMAZ, bir sonraki istek tekrar dener ve
 * sebep günlüğe düşer.
 */
export async function aggregateProducts(): Promise<Product[]> {
  if (memo) return memo;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const snap = await readCatalog<Product[]>();
      if (!snap?.length) {
        // Sessiz kalma: bu durumun tek görünür belirtisi boş bir vitrin olurdu.
        console.error(
          "[altr] Katalog okunamadi veya bos geldi — bu istek 0 urun donecek, sonraki istek tekrar deneyecek. " +
            `ALTR_CATALOG=${process.env.ALTR_CATALOG ?? "(varsayilan .data/catalog.json)"}`,
        );
        return [];
      }
      memo = snap;
      return snap;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** HMR/geliştirmede snapshot dosyası değişince belleği tazelemek için. */
export function clearAggregateMemo(): void {
  memo = null;
  // Arama indeksi ürün id'sine göre önbelleklenmiş metin tutuyor; katalog değişince
  // o metinler eskir (ör. renk etiketleri yeni gelmiştir).
  clearSearchIndex();
  // Sıralama önbelleği ESKİ katalogun ürün referanslarını tutuyor: temizlenmezse
  // vitrin, katalog tazelendikten sonra da eski gövdeleri göstermeye devam eder.
  clearOrderCache();
}
