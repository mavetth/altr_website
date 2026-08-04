# Değişiklik Günlüğü

## 0.11.0 — 2026-08-04

Vitrindeki iki sessiz yanlış: tükenmiş ürünlerin "stokta" görünmesi ve aynı rengin
birden çok nokta olarak çizilmesi. İkisi de tek bir üründe birlikte görüldü
(kostebek "Tokalı Kargo Cepli Kot Pantolon": altı bedenin altısı da tükenmiş,
buna rağmen satın alınabilir; renk noktaları "Siyah, Siyah, Mavi, Mavi").

- **Ticimax mağazalarında stok artık mağazanın kendi verisinden okunuyor**
  (`scripts/scrape/adapters/jsonld.mjs`). Stok tek kaynaktan, JSON-LD'nin ilk
  teklifindeki `availability` alanından okunuyor; o alan yoksa ürün KÖRLEMESİNE
  "stokta" sayılıyordu. Ticimax temalarının bir kısmı hiç JSON-LD basmıyor
  (ölçüldü: kostebek.com.tr'de blok sayısı 0) — yani o mağazaların tamamı, tükenmiş
  ürünler dahil, katalogda stokta görünüyordu: kostebek 7.190, nuugg 2.014,
  fo4rbs 1.126, the-mets-co 797, kozmosize 557, matt-wear 305 ürünün %100'ü.
  Doğru veri hep oradaydı — `productDetailModel` beden başına gerçek stok adedi
  taşıyor ve beden listesi için zaten okunuyordu, yalnız ürün düzeyindeki karara
  bağlanmamıştı.
- **Aynı renk artık tek nokta** (`scripts/import-catalog.mjs`). Markaların çoğu aynı
  ürünü birden fazla sayfa olarak yayınlıyor (`…-mavi-kot-pantolon` ve `…-mavi-kot-pantolon2`,
  `…-t-shirt-1/-2/-3`, `…-siyah-605/-607/-599`); bu sayfalar tek ürüne katlanırken
  her biri kendi varyantını getirdiği için renk seçicide aynı renk tekrar ediyordu.
  73.178 üründen 3.091'i (çok renklilerin %12'si) bundan etkileniyordu, toplam 4.770
  fazla varyant — hepsi katlandı, mükerrer nokta sayısı **0**.
- **Kopya kayıt, doğru duran rengi de bozuyordu.** Mükerrer renk adı `colorSuspect`
  işaretini tetikliyor, arayüz de "ad güvenilmez" deyip nokta rengini fotoğraftan
  ölçmeye geçiyordu; kot pantolonun zemin ağırlıklı fotoğrafı gri ölçülünce **mavi
  ürün "GRİ" olarak** etiketleniyordu. İşaret artık katlamadan SONRA hesaplanıyor ve
  yalnız gerçek vakada (aynı ad, farklı renk ailesi) kalıyor: 1.616 → 56 ürün.
- Katlanan varyantın hex'i adın söylediği renk ailesinden seçiliyor: cartel-wind
  "Tech Fleece Jogger"da üç "siyah" kaydın hex'i `#111111`, `#7d7d75` (yer tutucu)
  ve `#3a463a` idi; nokta artık griye/yeşile kaymıyor.
- Elle alınan katalog yedekleri (`*yedek*`, `*.oncesi-*`, `*.onceki-*`) depo dışında
  bırakıldı — her biri yüz megabaytı buluyor ve tek bir makinenin geri alma ağı.

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
