import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Görseller markanın kendi CDN'inden /api/img proxy'si üzerinden yansıtılır;
  // next/image host allowlist derdi olmasın diye plain <img> + proxy kullanıyoruz.
  reactStrictMode: true,
  poweredByHeader: false,
  // Self-host / Docker taşınabilirliği için standalone çıktı.
  output: "standalone",
  // sharp / ioredis gibi opsiyonel native paketleri serverless bundle'a gömme.
  serverExternalPackages: ["sharp", "ioredis"],
  /**
   * Derleme klasörü. Varsayılan `.next`; `NEXT_DIST_DIR` ile değiştirilebilir.
   *
   * Neden: aynı klasörde İKİ dev server aynı anda çalıştığında (iki ayrı port) ikisi de
   * `.next`e yazıyor ve birbirinin derlenmiş route dosyasını siliyor — uçlar rastgele
   * 404/500 dönmeye başlıyor, sebebi kodda aranıyor. İkinci sunucuyu
   * `NEXT_DIST_DIR=.next-b` ile başlatmak sorunu bitiriyor.
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
