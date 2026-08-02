// ÜRÜNLERİ RENGE GÖRE ETİKETLER — `data/color-tags.json` üretir.
//
// Kullanım:
//   npm run tag-colors                       # eksikleri tamamlar (varsayilan)
//   npm run tag-colors -- --force            # her seyi bastan hesapla
//   npm run tag-colors -- --only <slug>      # tek marka
//   npm run tag-colors -- --kaynak <dosya>   # baska bir katalog dosyasi
//   npm run tag-colors -- --limit 500        # deneme icin
//
// HİBRİT YÖNTEM. Ürün başına iki yol var ve sırası önemli:
//
//   1. RENK ADI. Marka "Siyah" yazmışsa bu en güvenilir kaynaktır — fotoğrafın arka
//      planı, ışığı, modelin teni yanıltmaz. `nameToTags` tanıdıysa görsel hiç
//      indirilmez (hem hızlı hem doğru).
//   2. GÖRSEL. Ad yoksa, "-" ise ya da sözlükte tanınmıyorsa ürün fotoğrafı indirilip
//      piksel histogramı çıkarılır. Ayrıca ÇOK RENKLİLİK ancak buradan anlaşılır:
//      kaç ailenin kayda değer bir pay tuttuğu.
//
// Görsel yolunda üç eleme var, üçü de ölçülerek kondu:
//   - ARKA PLAN: kenar çerçevesinin ortalaması alınır, ona yakın pikseller atılır.
//     Ürün fotoğraflarının çoğu beyaz/stüdyo zeminli; elenmezse katalogun tamamı
//     "beyaz" çıkar.
//   - TEN TONU: modelin kolu/yüzü ürünün rengi değildir.
//   - MERKEZ PENCERESİ: karenin %12–%88'i. Kenarlardaki gölge/çerçeve payı düşer.
//
// Çıktı neden ayrı dosya: `catalog.json` her import'ta baştan yazılıyor. Etiketler
// katalogun içinde tutulsaydı her import'tan sonra 69 bin görsel yeniden indirilirdi.
// Ayrı dosyada durunca `import-catalog` onu okuyup ürüne yazıyor, iş bir kez yapılıyor.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { nameToTags, rgbToHsl, rgbToTag } from "../src/lib/color-tags.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

/* ------------------------------------------------------------ ayarlar ----- */

function flag(k, d = null) {
  const i = process.argv.indexOf(k);
  return i >= 0 ? process.argv[i + 1] : d;
}
const has = (k) => process.argv.includes(k);

const OUT = join(projectRoot, "data", "color-tags.json");
const SRC = flag("--kaynak") ?? defaultSource();
const ONLY = flag("--only");
const LIMIT = Number(flag("--limit", "0")) || 0;
const FORCE = has("--force");
const CONCURRENCY = Number(flag("--concurrency", "8")) || 8;

/** Bir ailenin etiketlenmesi için gereken en küçük piksel payı. */
const MIN_SHARE = 0.12;
/**
 * "çok renkli" işareti: en az kaç KROMATİK aile bu payı tutuyorsa.
 *
 * Kromatik şartı ölçümle geldi: nötrler (siyah/beyaz/gri/bej) sayılınca düz beyaz bir
 * tişört bile "çok renkli" oluyordu — gölge griye, parlama beyaza düşüyor ve üç aile
 * kolayca doluyor. Desen ancak GERÇEK renkler yan yana geldiğinde vardır.
 */
const MULTI_SHARE = 0.1;
const MULTI_MIN_FAMILIES = 3;
/** Ürün başına en fazla kaç aile. */
const MAX_TAGS = 3;

/**
 * Nötr eksen. Bunlar TEK bir kovada toplanıp sonra aralarında en baskın olan seçilir:
 * aynı beyaz kumaşın ışıklı yeri "beyaz", gölgesi "gri", sarımsı ışığı "bej" okunuyor
 * ve üçe bölününce hiçbiri eşiği geçemiyordu.
 */
const NEUTRAL = new Set(["siyah", "beyaz", "gri", "bej"]);

/**
 * Bu doygunluğun altındaki piksel bir RENK değil, ışığın kumaş üstündeki tonudur.
 * Gri eksenine indirilir; yoksa beyaz tişörtün mavimsi gölgesi "mavi" etiketi
 * kazandırıyor.
 */
const PALE_S = 0.2;

const FETCH_TIMEOUT_MS = 12000;

function defaultSource() {
  // Gerçek katalog tercih edilir; yoksa canlıdaki (belki örnek) dosya.
  const full = join(projectRoot, ".data", "catalog.new-full.json");
  return full;
}

/* -------------------------------------------------------------- sharp ----- */

let sharpMod;
async function getSharp() {
  if (sharpMod !== undefined) return sharpMod;
  try {
    sharpMod = (await import("sharp")).default;
  } catch {
    sharpMod = null;
  }
  return sharpMod;
}

/* ------------------------------------------------------------- görsel ----- */

function isSkin(r, g, b) {
  // Basit ten tonu kutusu: kırmızı baskın, mavi en düşük, ikisi arası makul fark.
  return r > 95 && g > 40 && b > 20 && r > g && g > b && r - b > 15 && r - g < 80;
}

function near(a, b, tol) {
  return Math.abs(a[0] - b[0]) < tol && Math.abs(a[1] - b[1]) < tol && Math.abs(a[2] - b[2]) < tol;
}

/**
 * Görselden aile paylarını çıkarır.
 * Döner: { paylar: Map<aile, oran>, toplam: kalan piksel sayısı }
 */
async function analyze(buf) {
  const sharp = await getSharp();
  if (!sharp) return null;

  const N = 64;
  const { data } = await sharp(buf)
    .resize(N, N, { fit: "cover" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const at = (x, y) => {
    const i = (y * N + x) * 3;
    return [data[i], data[i + 1], data[i + 2]];
  };

  // Arka plan tahmini: kenar çerçevesinin ortalaması.
  let br = 0, bg = 0, bb = 0, bn = 0;
  for (let x = 0; x < N; x++) {
    for (const y of [0, 1, N - 2, N - 1]) {
      const p = at(x, y);
      br += p[0]; bg += p[1]; bb += p[2]; bn++;
    }
  }
  for (let y = 2; y < N - 2; y++) {
    for (const x of [0, 1, N - 2, N - 1]) {
      const p = at(x, y);
      br += p[0]; bg += p[1]; bb += p[2]; bn++;
    }
  }
  const bgc = [br / bn, bg / bn, bb / bn];

  const lo = Math.floor(N * 0.12);
  const hi = Math.ceil(N * 0.88);
  const counts = new Map();
  let total = 0;
  let skin = 0;

  for (let y = lo; y < hi; y++) {
    for (let x = lo; x < hi; x++) {
      const p = at(x, y);
      if (near(p, bgc, 26)) continue;
      if (isSkin(p[0], p[1], p[2])) {
        skin++;
        continue;
      }
      let tag = rgbToTag(p[0], p[1], p[2]);
      if (!NEUTRAL.has(tag)) {
        const [, s] = rgbToHsl(p[0], p[1], p[2]);
        // Soluk piksel: kumaşın rengi değil ışığın tonu. Gri eksenine indir.
        if (s < PALE_S) {
          const v = Math.round((p[0] + p[1] + p[2]) / 3);
          tag = rgbToTag(v, v, v);
        }
      }
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
      total++;
    }
  }

  // Ürün karesinin neredeyse tamamı elendiyse (düz zeminli, ürün küçük) ölçüm
  // güvenilmez — bir şey uydurmaktansa boş dönmek doğru.
  if (total < (hi - lo) * (hi - lo) * 0.08) return null;

  const shares = new Map();
  for (const [k, v] of counts) shares.set(k, v / total);
  return { shares, total, skin };
}

function tagsFromShares(shares) {
  // Nötrleri TEK kovada topla: aynı kumaşın ışıklı/gölgeli yüzü üç aileye bölünüp
  // hiçbiri eşiği geçemiyordu. Kovanın payı toplam, adı içindeki en baskın olan.
  let neutralSum = 0;
  let neutralTop = null;
  let neutralTopShare = 0;
  const chromatic = [];

  for (const [k, s] of shares) {
    if (NEUTRAL.has(k)) {
      neutralSum += s;
      if (s > neutralTopShare) {
        neutralTopShare = s;
        neutralTop = k;
      }
    } else {
      chromatic.push([k, s]);
    }
  }

  const merged = [...chromatic];
  if (neutralTop) merged.push([neutralTop, neutralSum]);
  merged.sort((a, b) => b[1] - a[1]);

  const tags = merged.filter(([, s]) => s >= MIN_SHARE).slice(0, MAX_TAGS).map(([k]) => k);
  // Hiçbiri eşiği geçemediyse en baskın olanı yine de al: ürünün bir rengi vardır.
  if (!tags.length && merged.length) tags.push(merged[0][0]);

  // Desen ancak GERÇEK renkler yan yana geldiğinde vardır (bkz. MULTI_SHARE notu).
  const spread = chromatic.filter(([, s]) => s >= MULTI_SHARE).length;
  if (spread >= MULTI_MIN_FAMILIES && !tags.includes("cok-renkli")) tags.push("cok-renkli");
  return tags;
}

async function fetchImage(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        // Bazı CDN'ler user-agent'sız isteği 403 ile kesiyor.
        "user-agent": "Mozilla/5.0 (compatible; altr-color-tagger/1.0)",
        accept: "image/*",
      },
    });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/* ---------------------------------------------------------------- ana ----- */

function pickImage(p) {
  // Kartta görünen görsel: ilk varyantın ilk fotoğrafı (import ile aynı kural).
  const idx = p.variants?.[0]?.imgs?.[0] ?? 0;
  return p.images?.[idx] ?? p.image ?? p.images?.[0] ?? null;
}

/** Ürünün renk ADLARINDAN aileler — hepsi tanınıyorsa görsele gerek yok. */
function tagsFromNames(p) {
  const names = (p.variants ?? []).map((v) => v.color).filter(Boolean);
  if (!names.length) return null;

  const all = [];
  let recognized = 0;
  for (const n of names) {
    const t = nameToTags(n);
    if (t.length) recognized++;
    for (const x of t) if (!all.includes(x)) all.push(x);
  }
  // Adların YARISINDAN AZI tanındıysa sözlüğe güvenme: marka kendi uydurma renk
  // adlarını kullanıyor demektir, karar görsele kalsın.
  if (recognized === 0 || recognized < names.length / 2) return null;
  return all.slice(0, MAX_TAGS + 1);
}

async function main() {
  const raw = await readFile(SRC, "utf8").catch(() => null);
  if (!raw) {
    console.error(`Kaynak katalog okunamadi: ${SRC}`);
    console.error("--kaynak ile baska bir dosya verebilirsin.");
    process.exit(1);
  }
  let products = JSON.parse(raw);
  if (!Array.isArray(products)) products = products.products ?? [];

  const prev = FORCE
    ? {}
    : JSON.parse(await readFile(OUT, "utf8").catch(() => "{}"));

  let queue = products;
  if (ONLY) queue = queue.filter((p) => p.brandSlug === ONLY);
  if (!FORCE) queue = queue.filter((p) => !prev[p.id]);
  if (LIMIT) queue = queue.slice(0, LIMIT);

  const sharp = await getSharp();
  if (!sharp) {
    console.warn("UYARI: sharp yuklu degil — yalniz renk ADI yolu calisacak,");
    console.warn("       gorselden olcum ve cok-renkli tespiti YAPILAMAYACAK.");
  }

  console.log(`Kaynak : ${SRC}`);
  console.log(`Katalog: ${products.length} urun · islenecek: ${queue.length}`);

  const out = { ...prev };
  const stat = { ad: 0, gorsel: 0, bos: 0, hata: 0 };
  let done = 0;
  let cursor = 0;
  let saving = false;

  await mkdir(dirname(OUT), { recursive: true });

  // ARA KAYIT. 69 bin ürünlük bir koşu yarım saat sürüyor; tek yazma noktası olsaydı
  // süreç sonda ölünce bütün iş çöpe giderdi. Kayıt eksikleri tamamlamalı çalıştığı
  // için (`--force` yoksa) yarım dosya bir sonraki koşuda kaldığı yerden devam ettirir.
  async function checkpoint() {
    if (saving) return;
    saving = true;
    try {
      await writeFile(OUT, JSON.stringify(out), "utf8");
    } catch {
      /* diske yazılamadıysa koşuyu kesme; sondaki yazma bir daha dener */
    }
    saving = false;
  }

  async function worker() {
    for (;;) {
      const i = cursor++;
      if (i >= queue.length) return;
      const p = queue[i];

      try {
        const byName = tagsFromNames(p);
        if (byName?.length) {
          out[p.id] = { tags: byName, src: "ad" };
          stat.ad++;
        } else {
          const url = pickImage(p);
          const buf = url && sharp ? await fetchImage(url) : null;
          const res = buf ? await analyze(buf) : null;
          if (res) {
            out[p.id] = { tags: tagsFromShares(res.shares), src: "gorsel" };
            stat.gorsel++;
          } else {
            // Hiçbir yol sonuç vermedi: kayıt AÇILMAZ. Boş bir etiket yazmak, bir
            // sonraki koşuda bu ürünün atlanmasına yol açardı.
            stat.bos++;
          }
        }
      } catch {
        stat.hata++;
      }

      done++;
      if (done % 250 === 0) {
        // Satır sonu ŞART: çıktı bir dosyaya/pipe'a yönlendirildiğinde `\r` ile yazılan
        // ilerleme hiç görünmüyor, koşu takıldı mı ilerliyor mu anlaşılmıyordu.
        console.log(
          `  ${done}/${queue.length} · ad ${stat.ad} · gorsel ${stat.gorsel} · bos ${stat.bos}`,
        );
      }
      if (done % 2000 === 0) await checkpoint();
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await writeFile(OUT, JSON.stringify(out), "utf8");

  const dagilim = {};
  for (const v of Object.values(out)) for (const t of v.tags) dagilim[t] = (dagilim[t] ?? 0) + 1;

  console.log(`\nYazildi: ${OUT}`);
  console.log(`  toplam kayit : ${Object.keys(out).length}`);
  console.log(`  addan        : ${stat.ad}`);
  console.log(`  gorselden    : ${stat.gorsel}`);
  console.log(`  etiketsiz    : ${stat.bos}  (hata: ${stat.hata})`);
  console.log("  dagilim      :");
  for (const [k, n] of Object.entries(dagilim).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${k.padEnd(12)} ${n}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
