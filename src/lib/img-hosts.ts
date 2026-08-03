import { LIVE_BRANDS } from "./brands";

// Görsel proxy'si için SSRF koruması: yalnızca bilinen genel CDN/marka host'larına izin.
// Özel/iç IP'ler, localhost vb. otomatik reddedilir (ne allowlist'te ne suffix'te olurlar).

const ALLOWED_SUFFIXES = [
  "cdn.shopify.com",
  "myshopify.com",
  "shopifycdn.com",
  "shopify.com",
  "cloudfront.net",
  "akamaized.net",
  "cloudinary.com",
  "cdninstagram.com",
  "fbcdn.net",
  "myikas.com", // İkas
  "ticimax.cloud", // Ticimax
  "tsoftcdn.com",
  "platformcdn.com",
  "googleusercontent.com",
  "wp.com",
  "cdn.dsmcdn.com", // Trendyol/DSM
  // Bu üç host katalogun %7,9'unun (4272 ürün) ana görselini taşıyordu ama allowlist'te
  // olmadığı için proxy reddediyor, kartlar sessizce "[ ÜRÜN GÖRSELİ ]"e düşüyordu.
  // Üçü de HTTPS üstünden herkese açık gerçek ürün görseli servis ediyor (doğrulandı).
  "wixstatic.com", // Wix (Kozmosize, Modax Wear)
  "qukasoft.com", // Quka Soft platformu (Sokak Butik, The Mets Co, Guerra Butik)
  "lofux.com", // Nuugg'ün görsel host'u
  // Shopier (cdn.shopier.app): katalogdaki EN BÜYÜK dördüncü görsel kaynağı —
  // 4.063 ürünün ana görseli, 14 marka (Aspera Clo, Eilul Archives, Fadeback Studio,
  // Giowear, La Mort Studios, Leontiére, Manic Sellout, Saram, Svamp Studios…).
  // Scraper bu markaları bilerek topluyor (bkz. .data/scrape-shopier*.log) ama host
  // allowlist'te olmadığı için proxy 403 veriyor ve kartlar sessizce
  // "[ ÜRÜN GÖRSELİ ]"e düşüyordu. Kaynak HTTPS üstünden herkese açık ürün görseli
  // servis ediyor (doğrulandı: 200, image/jpeg).
  "shopier.app",
];

function brandHostSet(): Set<string> {
  const s = new Set<string>();
  for (const b of LIVE_BRANDS) {
    if (!b.url) continue;
    try {
      const h = new URL(b.url).hostname.toLowerCase();
      s.add(h);
      s.add(h.startsWith("www.") ? h.slice(4) : `www.${h}`);
    } catch {
      /* geçersiz url'i atla */
    }
  }
  return s;
}

let cachedHosts: Set<string> | null = null;

export function isAllowedImageHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  // IP literal veya iç host'ları reddet
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (!host.includes(".")) return false;

  // `.${suf}` ile NOKTA SINIRI şart: eskiden üçüncü bir dal olarak noktasız
  // `host.endsWith(suf)` de vardı — "totallynotshopify.com" ya da "xcloudfront.net"
  // gibi shopify.com/cloudfront.net'le HİÇBİR ilgisi olmayan, herkesin satın
  // alabileceği bağımsız alan adları da "shopify.com" ile bitiyor diye izin
  // listesinden geçiyordu. Bu proxy'yi (SSRF koruması bilerek var) anonim bir görsel
  // vekiline çeviren gerçek bir açıktı — kaldırıldı.
  if (ALLOWED_SUFFIXES.some((suf) => host === suf || host.endsWith(`.${suf}`))) return true;

  cachedHosts ??= brandHostSet();
  if (cachedHosts.has(host)) return true;
  // marka host'unun alt alan adı (ör. images.marka.com) da olur
  for (const bh of cachedHosts) {
    if (host.endsWith(`.${bh}`)) return true;
  }
  return false;
}
