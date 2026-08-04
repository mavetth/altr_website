"use client";

/**
 * Ürün fotoğrafından BASKIN RENK ölçümü — tarayıcıda, canvas ile.
 *
 * İki yerde kullanılıyor: renk noktalarının rengi (ColorSwatches) ve renk seçilince
 * hangi fotoğrafın gösterileceği (ProductModal). İkisi de aynı ölçümü istediği için
 * hesap burada tek yerde durur ve tek önbelleği paylaşır — aynı görsel iki kez
 * ölçülmez.
 *
 * Hesap kendi proxy'mizden gelen küçük görselle yapılır (aynı-origin, canvas kirlenmez);
 * sonuç hem modül içinde hem localStorage'da saklanır, böylece ürüne geri dönünce renk
 * sıçraması olmaz.
 *
 * ÖLÇÜMÜN GÜVENİLİRLİĞİ SINIRLI: 319 varyantlık ölçümde, ölçülen rengin varyantın
 * ADININ söylediği aileye düşme oranı %51. Stüdyo zemini ve model teni baskın kovayı
 * ele geçirebiliyor. Bu yüzden çağıran taraf ölçümü TEK BAŞINA kullanmaz, renk adıyla
 * sınar (bkz. ColorSwatches → noktaRengi).
 */

/** /api/img'in kabul ettiği en küçük basamak — ölçüm için fazlası gereksiz. */
export const OLCUM_GENISLIK = 120;

const colorCache = new Map<string, string>();
// v1 -> v2 (2026-08-04): zemin rengindeki ürünlerde ölçüm algoritması değişti (bkz.
// aşağıdaki "ZEMİN RENGİNDE ÜRÜN" notu). Anahtar sürümü atlanmazsa kullanıcıların
// cihazında ESKİ (yanlış) sonuçlar sonsuza kadar önbellekte kalır — dominantColor()
// önce önbelleğe bakıp bulduğunda YENİDEN HESAPLAMAZ, yani düzeltme koda girse bile
// daha önce siteyi ziyaret etmiş kullanıcı hiç görmez. Sürüm artışı eski depoyu
// sessizce çöpe atar, ilk ziyarette temiz ölçülür.
const LS_KEY = "altr-swatch-v2";
const LS_MAX = 4000;

/** Ölçülen renkler cihazda kalır: aynı ürüne dönünce nokta anında doğru renkte çizilir. */
export function loadPersisted(): void {
  if (typeof localStorage === "undefined" || colorCache.size) return;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, string>)) {
      colorCache.set(k, v);
    }
  } catch { /* bozuk depo: önbelleksiz devam */ }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function persistSoon(): void {
  if (typeof localStorage === "undefined" || saveTimer) return;
  // Ölçümler tek tek geliyor; her birinde JSON yazmak yerine biriktirip bir kez yazıyoruz.
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      const entries = [...colorCache.entries()].slice(-LS_MAX);
      localStorage.setItem(LS_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch { /* kota doldu: önbellek yalnız bellekte kalır */ }
  }, 800);
}

const hex2 = (x: number) =>
  Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0");

/** Ten tonu penceresi — model üzerinde çekilmiş fotoğrafta baskın renk TEN olabiliyor. */
function isSkin(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 60 || max > 245) return false;
  const sat = max === 0 ? 0 : (max - min) / max;
  return r > g && g > b && sat >= 0.12 && sat <= 0.5;
}

/** Ölçüm için proxy adresi (tek basamak: önbellek bölünmesin). */
export function olcumUrl(src: string): string {
  return `/api/img?url=${encodeURIComponent(src)}&w=${OLCUM_GENISLIK}`;
}

/**
 * Ürün fotoğrafının BASKIN rengi.
 *
 * Eskiden merkezin ORTALAMASI alınıyordu. Ortalama, desenli ya da iki renkli üründe iki
 * rengin ortasını — yani üründe hiç bulunmayan bir çamur tonunu — veriyordu; kullanıcının
 * gördüğü "yanlış renk" büyük ölçüde buydu. Artık pikseller kabaca kovalanıp EN KALABALIK
 * kovanın ortalaması alınıyor: iki renkli üründe nokta, baskın olan rengi gösteriyor.
 *
 * İki eleme var: (1) kenar çerçevesinden okunan arka plan tonuna çok yakın pikseller
 * atılır (stüdyo fotoğrafında beyaz zemin baskın renk oluyordu), (2) ten tonu kovası
 * ancak başka aday yoksa seçilir.
 */
export function dominantColor(url: string): Promise<string> {
  const hit = colorCache.get(url);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve) => {
    if (typeof document === "undefined") return resolve("");
    const img = new Image();
    img.onload = () => {
      try {
        const N = 40;
        const c = document.createElement("canvas");
        c.width = N;
        c.height = N;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve("");
        ctx.drawImage(img, 0, 0, N, N);
        const d = ctx.getImageData(0, 0, N, N).data;
        const at = (x: number, y: number) => (y * N + x) * 4;

        // Arka plan tahmini: kenar çerçevesinin ortalaması.
        let br = 0, bg = 0, bb = 0, bn = 0;
        const edge = (i: number) => {
          if (d[i + 3] < 128) return;
          br += d[i]; bg += d[i + 1]; bb += d[i + 2]; bn++;
        };
        for (let x = 0; x < N; x++) { edge(at(x, 0)); edge(at(x, N - 1)); }
        for (let y = 1; y < N - 1; y++) { edge(at(0, y)); edge(at(N - 1, y)); }
        const bgc = bn ? [br / bn, bg / bn, bb / bn] : null;

        // 4 bit/kanal kovalar: yakın tonlar tek adayda toplansın.
        const buckets = new Map<number, { r: number; g: number; b: number; n: number }>();
        const lo = Math.floor(N * 0.15);
        const hi = Math.ceil(N * 0.85);
        let pencereN = 0;
        let haricN = 0;
        const bgUzaklik = (r: number, g: number, b: number) =>
          bgc ? Math.abs(r - bgc[0]) + Math.abs(g - bgc[1]) + Math.abs(b - bgc[2]) : Infinity;
        for (let y = lo; y < hi; y++) {
          for (let x = lo; x < hi; x++) {
            const i = at(x, y);
            if (d[i + 3] < 128) continue;
            pencereN++;
            const r = d[i], g = d[i + 1], b = d[i + 2];
            // arka plana çok yakınsa (stüdyo zemini) sayma
            if (bgUzaklik(r, g, b) < 40) { haricN++; continue; }
            const k = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
            const cur = buckets.get(k) ?? { r: 0, g: 0, b: 0, n: 0 };
            cur.r += r; cur.g += g; cur.b += b; cur.n++;
            buckets.set(k, cur);
          }
        }
        if (!buckets.size) return resolve(bgc ? "#" + hex2(bgc[0]) + hex2(bgc[1]) + hex2(bgc[2]) : "");

        const ranked = [...buckets.values()].sort((a, b) => b.n - a.n);
        const pick = ranked.find((v) => !isSkin(v.r / v.n, v.g / v.n, v.b / v.n)) ?? ranked[0];

        // ZEMİN RENGİNDE ÜRÜN: beyaz zeminde beyaz bir ürünün üstündeki baskı/desen,
        // ürünün KENDİ rengi beyazla neredeyse aynı olduğu için arka plan filtresine
        // takılıyor — geriye kalan "kazanan" kova aslında baskının GÖLGELİ KENARI,
        // pencerenin küçük bir azınlığı ve zemine hâlâ yakın bir ton. ÖLÇÜLDÜ (orient-x
        // "Rose Barbed Wire Jersey" beyaz varyantı, GERÇEK /api/img w=120 boru hattından):
        // hariç tutulan piksel oranı %37, kazanan kova pencerenin yalnız %7,3'ü ve zemine
        // uzaklığı 54 (eşiğin — 40 — hemen üstü) — ürün beyazken nokta "pembe" çıkıyordu.
        // AYNI boru hattından meşru siyah bir varyantla (REDROSE) karşılaştırıldı: orada
        // hariç tutulan oran %9 ve zemine uzaklık 748 — iki koşul da geniş payla ayırt
        // ediyor. Hariç tutulan oran YÜKSEK ve kazanan HÂLÂ zemine YAKINSA bu bir baskı
        // rengi değil ölçüm gürültüsüdür; zemin rengi döndürülür. Gerçekten zeminden UZAK
        // bir renk taşıyan küçük nesneler (ör. beyaz fonda ince altın kolye) bu eşiğin
        // dışında kalır, kendi rengiyle kazanır.
        if (bgc && pencereN > 0 && haricN / pencereN > 0.25 && bgUzaklik(pick.r / pick.n, pick.g / pick.n, pick.b / pick.n) < 90) {
          const out = "#" + hex2(bgc[0]) + hex2(bgc[1]) + hex2(bgc[2]);
          colorCache.set(url, out);
          persistSoon();
          resolve(out);
          return;
        }

        const out = "#" + hex2(pick.r / pick.n) + hex2(pick.g / pick.n) + hex2(pick.b / pick.n);

        colorCache.set(url, out);
        persistSoon();
        resolve(out);
      } catch {
        resolve("");
      }
    };
    img.onerror = () => resolve("");
    img.src = url;
  });
}
