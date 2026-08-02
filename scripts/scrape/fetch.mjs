// Scraper'ın ortak HTTP katmanı.
//
// Üç şey burada çözülür, çünkü üçü de sahada ürün KAYBETTİRDİ:
//  - Çerez kavanozu: bazı TR siteleri çerez verip yönlendiriyor; çerez saklanmazsa
//    "redirect count exceeded" ile site hiç çekilemiyor.
//  - Elle yönlendirme takibi: origin/referer'ı doğru taşıyabilmek için.
//  - Yeniden deneme: tek seferlik bir ağ hatası markanın TAMAMINI düşürüyordu
//    (sigma-wears: sitede 467 ürün var, katalogda 0 — scrape anındaki geçici hata
//    sessizce boş sonuç yazmış).

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const JAR = new Map();
function jarFor(url) {
  const h = new URL(url).hostname.replace(/^www\./, "");
  let m = JAR.get(h);
  if (!m) { m = new Map(); JAR.set(h, m); }
  return m;
}

/** Tek denemelik ham istek (yönlendirmeleri elle takip eder). */
async function once(url, { accept = "text/html", referer, timeout = 20000, method = "GET", body, headers = {} } = {}) {
  let current = url;
  for (let i = 0; i <= 8; i++) {
    const jar = jarFor(current);
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeout);
    let res;
    try {
      res = await fetch(current, {
        method,
        body,
        redirect: "manual",
        signal: ac.signal,
        headers: {
          "User-Agent": UA,
          Accept: accept,
          "Accept-Language": "tr,en;q=0.8",
          ...(jar.size ? { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") } : {}),
          ...(referer ? { Referer: referer, Origin: new URL(referer).origin } : {}),
          ...headers,
        },
      });
    } finally {
      clearTimeout(t);
    }
    for (const line of res.headers.getSetCookie?.() ?? []) {
      const pair = line.split(";")[0];
      const idx = pair.indexOf("=");
      if (idx > 0) jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return res;
      current = new URL(loc, current).toString();
      continue;
    }
    return res;
  }
  return null;
}

/**
 * Yeniden denemeli istek. 5xx / 429 / ağ hatası tekrar denenir; 4xx (429 hariç) kalıcı
 * kabul edilip hemen döner — yok olan bir sayfayı 3 kez istemenin anlamı yok.
 */
export async function get(url, opts = {}) {
  const tries = opts.tries ?? 3;
  let last = null;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await once(url, opts);
      if (res && (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429))) return res;
      last = res;
    } catch (e) {
      last = null;
      if (i === tries - 1) throw e;
    }
    await sleep(600 * 2 ** i + Math.random() * 300); // üstel geri çekilme
  }
  return last;
}

// getJson/getText ASLA fırlatmaz — çağıranlar null'ı "bu kaynağı atla" diye ele alır.
// Fırlattıkları sürümde tek bir bozuk ürün sayfası mapLimit → Promise.all zincirinden
// yukarı kaçıp markanın TAMAMINI düşürüyordu (the-mets-co ve kozmosize: sitemap'te
// 1090 ve 748 ürün URL'i varken katalogda 0 ürün, sebep "terminated" olan tek sayfa).
export async function getJson(url, opts = {}) {
  try {
    const res = await get(url, { accept: "application/json,*/*", ...opts });
    if (!res || !res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function getText(url, opts = {}) {
  try {
    const res = await get(url, opts);
    if (!res || !res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Sınırlı eşzamanlılık + istekler arası kibarlık gecikmesi. */
export async function mapLimit(items, limit, delayMs, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
      for (;;) {
        const idx = i++;
        if (idx >= items.length) return;
        if (delayMs) await sleep(delayMs);
        out[idx] = await fn(items[idx], idx);
      }
    }),
  );
  return out;
}

export const uniq = (a) => [...new Set(a.filter(Boolean))];

/**
 * Metinden sayı çıkarır — para birimi sembolü, boşluk ve binlik ayracı ne olursa olsun.
 *
 * Eski hâli TR biçimini ("1.799,90") doğru okuyordu ama ABD biçiminde ("1,799.90")
 * noktayı ondalık, virgülü binlik sanmıyor; virgülü nokta yapıp "1.799.90" üretiyor ve
 * `parseFloat` ilk noktada durup **1.799** döndürüyordu. Katalogda 4.551 USD ürün var,
 * hepsi 1000 kat küçük fiyatla girme riski taşıyordu.
 *
 * Kural: SON ayraç ondalıktır — ama yalnız ardından 1-2 basamak geliyorsa. "1.799" tek
 * ayraçlı ve 3 basamaklıysa binliktir (Türkçe fiyatların çoğu böyle). Diğer bütün
 * ayraçlar binliktir ve atılır.
 */
export function num(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;

  // Rakam ve ayraç dışında ne varsa at (₺, $, tsk, boşluk, &nbsp;…). Baştaki eksi korunur.
  const neg = /^\s*-/.test(v);
  const s = v.replace(/[^\d.,]/g, "");
  if (!s) return null;

  const last = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
  let out;
  if (last < 0) {
    out = s;
  } else {
    const decimals = s.length - last - 1;
    // 1-2 basamak → ondalık ayracı. 3 basamak → binlik (1.799 = bin yedi yüz).
    // 0 ya da 4+ basamak da ondalık sayılmaz (ör. "1.234.567").
    const isDecimal = decimals >= 1 && decimals <= 2;
    const head = s.slice(0, isDecimal ? last : s.length).replace(/[.,]/g, "");
    out = isDecimal ? `${head}.${s.slice(last + 1)}` : head;
  }

  const n = parseFloat(out);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}
