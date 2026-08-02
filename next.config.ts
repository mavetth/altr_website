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
  /**
   * Katalog `fs.readFile(path.join(process.cwd(), ...))` ile çalışma zamanında
   * okunuyor — Next'in otomatik dosya izleme (file tracing) aracı bunu statik
   * bir `import`/`require` gibi göremediği için Vercel'e giden serverless
   * fonksiyon paketine dahil ETMEYEBİLİR. Sonuç: kod hatasız çalışır ama
   * ENOENT ile karşılaşır, katalog boş döner, vitrin sessizce boşalır. Bu
   * yüzden kataloğu okuyan rotalar için dosyaları elle dahil ediyoruz.
   */
  outputFileTracingIncludes: {
    "/": [".data/catalog*.json"],
    "/[marka]": [".data/catalog*.json"],
    "/markalar": [".data/catalog*.json"],
    "/api/products": [".data/catalog*.json"],
    "/api/teshis": [".data/catalog*.json"],
    "/api/lists": [".data/catalog*.json"],
    "/api/me/data": [".data/catalog*.json"],
  },
};

export default nextConfig;
