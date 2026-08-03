# Değişiklik Günlüğü

## 0.10.0 — 2026-08-03

- Sayfa/filtre/kategori geçişlerinde ızgara artık boşalmıyor: eski içerik yerinde
  kalıp üstüne ince bir yükleniyor katmanı biniyor (`LoadingOverlay`,
  `LoadingSpinner`, `TopProgressBar`).
- Sayfalama arayüzü ortak bir pencereleme fonksiyonuna taşındı (`lib/pagination.ts`,
  `GridView` ve `BrandPage` paylaşıyor).
- Gecikmeli bayrak hook'u eklendi (`lib/use-delayed-flag.ts`) — kısa süren
  yüklenmelerde göstergenin gözle görülür şekilde titremesini önlüyor.
- `App.tsx`, `BrandPage.tsx`, `BrandViews.tsx`, `CategoryNav.tsx`, `GridView.tsx`,
  `Logo3D.tsx`, `ProductCard.tsx`, `RestockVote.tsx`, `Showcase.tsx`,
  `store.ts`, `lib/img-hosts.ts`, `lib/vitrin-flight.ts`, `globals.css` üzerinde
  ilgili güncellemeler.

## 0.1.0 — 2026-08-02

- 73.178 ürünlük katalog, 166 markanın ham kaynağı ve marka logoları depoya alındı.
- Vercel için `outputFileTracingIncludes` düzeltmesi: katalog dosyası çalışma
  zamanında `fs.readFile` ile okunduğu için Next'in otomatik dosya izlemesi onu
  serverless fonksiyon paketine dahil etmiyordu, ürünler sessizce boş dönüyordu.
- 120 MB'lık ham katalog GitHub'ın 100 MB dosya sınırını aştığı ve bu ortamdan
  Git LFS'in depolama ucuna (S3) ağ erişimi olmadığı için gzip'lenerek (~13 MB)
  depoya alındı; kurulumda `postinstall` ile otomatik açılıyor
  (`scripts/decompress-catalog.mjs`).
