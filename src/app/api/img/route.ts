import type { NextRequest } from "next/server";
import { isAllowedImageHost } from "@/lib/img-hosts";
import { CFG } from "@/lib/cache";
import { fetchWithTimeout } from "@/lib/http";
import {
  cacheKey,
  clearDeadImage,
  isDeadImage,
  markDeadImage,
  withImageCache,
  withUpstreamSlot,
  type CachedImage,
} from "@/lib/img-cache";

// sharp (opsiyonel native) için Node runtime gerekiyor.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 20 * 1024 * 1024;
// Proxy URL'i kaynağın tam adresini (çoğunda ?v=… sürüm damgasıyla) içerdiğinden içerik
// pratikte değişmez: tarayıcıya uzun ömürlü cache + ETag veriyoruz.
const CACHE_CONTROL = "public, max-age=2592000, stale-while-revalidate=86400";
/** İstemcinin isteyebileceği genişlikler — keyfi değerler önbelleği paramparça eder. */
const WIDTHS = [120, 240, 360, 480, 720, 900, 1200];

/**
 * Gövdenin İLK BAYTLARINDAN gerçek görsel türünü okur; görsel değilse null.
 *
 * Neden gerekiyor: bazı marka sunucuları webp/jpeg'i yanlış başlıkla veriyor
 * (mahalleboy.com: `content-type: text/plain`, 173 ürün). Yalnız başlığa bakınca
 * bu görseller "görsel değil" sayılıp 502'ye düşüyordu — oysa dosyanın kendisi
 * geçerli bir webp. Başlık kaynağın İDDİASI, imza ise KANIT.
 *
 * SVG bilerek YOK: metin tabanlı, script taşıyabiliyor ve imzayla güvenilir biçimde
 * ayırt edilemiyor. Buradaki gevşetme yalnız raster biçimler için.
 */
function sniffImageType(b: Buffer): string | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return "image/png";
  if (b.subarray(0, 6).toString("latin1") === "GIF89a" || b.subarray(0, 6).toString("latin1") === "GIF87a")
    return "image/gif";
  if (b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP")
    return "image/webp";
  if (b.subarray(4, 8).toString("latin1") === "ftyp") {
    const marka = b.subarray(8, 12).toString("latin1");
    if (marka.startsWith("avif") || marka.startsWith("avis")) return "image/avif";
    if (marka.startsWith("heic") || marka.startsWith("heix") || marka.startsWith("mif1"))
      return "image/heic";
  }
  return null;
}

function snapWidth(raw: string | null): number {
  const n = raw ? parseInt(raw, 10) : 0;
  if (!Number.isFinite(n) || n <= 0) return 0;
  const capped = Math.min(n, CFG.imgMaxWidth);
  return WIDTHS.find((w) => w >= capped) ?? WIDTHS[WIDTHS.length - 1];
}

/** Markanın CDN'inden indirir ve (mümkünse) webp'ye çevirip küçültür. */
async function produce(u: URL, width: number): Promise<CachedImage | null> {
  // Markanın kendi origin'ini Referer olarak göndererek hotlink korumasını aş.
  const referer = `${u.protocol}//${u.hostname}/`;
  // Kuyruk kaynak başına: yavaş bir markanın CDN'i başka markaların görsellerini
  // bekletmesin (bkz. img-cache.ts withUpstreamSlot).
  const upstream = await withUpstreamSlot(
    () =>
      fetchWithTimeout(u.toString(), {
        timeoutMs: CFG.sourceTimeoutMs,
        referer,
        accept: "image/avif,image/webp,image/*,*/*",
      }),
    u.hostname,
  );
  if (!upstream.ok) return null;

  const ct = upstream.headers.get("content-type") ?? "";
  const basliktaGorsel = ct.startsWith("image/");

  const len = Number(upstream.headers.get("content-length") ?? "0");
  if (len && len > MAX_BYTES) return null;

  const inputBuf = Buffer.from(await upstream.arrayBuffer());
  if (inputBuf.byteLength > MAX_BYTES) return null;

  // Başlık görsel demiyorsa gövdenin imzasına bak: yanlış content-type gönderen
  // sunucuların görselleri de çizilsin (bkz. sniffImageType). İkisi de görsel
  // demiyorsa gerçekten görsel değil — HTML hata sayfası, JSON vb.
  const imza = sniffImageType(inputBuf);
  if (!basliktaGorsel && !imza) return null;

  // Genişlik istendiyse ve sharp varsa yeniden boyutlandır (bant genişliği + tek tip boyut).
  if (width) {
    try {
      const sharp = (await import("sharp")).default;
      const out = await sharp(inputBuf)
        .rotate()
        // `withoutEnlargement` KALIYOR: kaynaktan büyük üretmek, olmayan ayrıntıyı
        // uydurmak demek — yumuşak/bulanık bir kart çıkıyor. Kaynak küçükse olduğu
        // gibi verilir, tarayıcı CSS'te ölçekler.
        .resize({ width, withoutEnlargement: true })
        // 78 → 86. Ölçüm değil gözle karar: 78'de düz renkli kumaş yüzeylerinde ve
        // baskı kenarlarında webp bantlaşması görünüyordu. 86 dosyayı ~%25 büyütüyor,
        // ama bu bir GİYİM vitrini — fotoğrafın kendisi ürünün ta kendisi.
        // `effort` varsayılan 4; sıkıştırma bir kez yapılıp diske önbelleklendiği için
        // (bkz. img-cache.ts) daha yüksek efor CPU'ya değer.
        .webp({ quality: 86, effort: 5 })
        .toBuffer();
      return { body: out, contentType: "image/webp", etag: "" };
    } catch {
      // sharp yok/başarısız -> orijinali aynen ver (CSS object-fit zaten çerçeveler)
    }
  }
  // Tür imzadan gelir, varsa: kaynağın yanlış başlığını tarayıcıya aynen aktarmak
  // görselin "indirilecek metin dosyası" gibi davranmasına yol açardı.
  return { body: inputBuf, contentType: imza ?? ct.split(";")[0].trim(), etag: "" };
}

export async function GET(req: NextRequest) {
  const src = req.nextUrl.searchParams.get("url");
  if (!src) return new Response("missing url", { status: 400 });

  let u: URL;
  try {
    u = new URL(src);
  } catch {
    return new Response("bad url", { status: 400 });
  }
  if (u.protocol !== "https:" && u.protocol !== "http:")
    return new Response("bad protocol", { status: 400 });
  if (!isAllowedImageHost(u.hostname))
    return new Response("host not allowed", { status: 403 });

  const width = snapWidth(req.nextUrl.searchParams.get("w"));
  const key = cacheKey(u.toString(), width);
  const etag = `"${key}"`;
  const href = u.toString();

  // Ölü bilinen URL: kaynağa HİÇ gitme. Her denemesi 5 sn'lik timeout'a kadar bir
  // upstream slotunu tutuyor ve aynı sayfadaki sağlam görselleri kuyrukta bekletiyordu
  // (bkz. img-cache.ts negatif önbellek).
  if (isDeadImage(href)) {
    return new Response("upstream image unavailable (cached)", {
      status: 502,
      headers: { "Cache-Control": "public, max-age=600" },
    });
  }

  // Tarayıcıda zaten varsa gövdeyi hiç üretme/gönderme.
  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag, "Cache-Control": CACHE_CONTROL } });
  }

  let hit: CachedImage | null;
  try {
    hit = await withImageCache(key, () => produce(u, width));
  } catch {
    markDeadImage(href);
    return new Response("upstream fetch error", { status: 502 });
  }
  if (!hit) {
    markDeadImage(href);
    return new Response("upstream image unavailable", { status: 502 });
  }
  // Daha önce ölü işaretlenmiş olabilir (geçici kesinti); artık geliyor.
  clearDeadImage(href);

  return new Response(new Uint8Array(hit.body), {
    headers: {
      "Content-Type": hit.contentType,
      "Cache-Control": CACHE_CONTROL,
      ETag: etag,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
