# altr — alternatif giyim aggregator'ı

Alt markaların ürünlerini **tek çatı altında, yan yana** gösteren bir vitrin
(Akakçe mantığı — ama fiyat kıyaslama değil, ürünleri görmek için).

## Mimari

- **Next.js 15 (App Router, TS)** — hem route handler'lar hem React arayüz.
- **Statik katalog + arka planda tazeleme.** İstek anında scrape yapılmaz; ürünler bir
  JSON anlık görüntüsünden (`src/lib/aggregate.ts` → `readCatalog()`, memo'lu) servis
  edilir. Hangi dosya okunacağı **`ALTR_CATALOG`** ile belirlenir (bkz. `.env.example`);
  verilmezse `.data/catalog.json`. Canlı olan **`.data/catalog.new-full.json`**
  (73.178 ürün · stokta 56.413 · 163 marka); `.data/catalog.sample.json` az bellekli
  geliştirme için hafif örnek (2.160 ürün). Katalog `npm run refresh` ile saatlik
  tazelenir (aşağıda).
- **Sıralama önbelleği.** Aynı tohum + aynı filtre için dokunmuş dizi bir kez kurulup
  saklanır (`src/lib/query.ts` → `orderCache`, 8 girdilik LRU; anahtar sayfayı içermez,
  yani sayfalama bedava). Ölçülen: ana sayfa isteği 118 ms → 3 ms, arama 2.678 ms → 30 ms.
- **Ana sayfa bir GİYİM vitrini.** Aksesuar ailesi (takı, çanta, şapka, çorap, gözlük…)
  keşfet akışının dışında (`src/lib/types.ts` → `FEED_EXCLUDED_CATS`): 56.413 → 40.413
  ürün. Silme değil KAPSAM — sol menüden, aramadan ve marka sayfalarından erişilebilir,
  arama yapıldığında kapsam kendiliğinden açılır.
- **Yönetim konsolu ayrı bir yolda**: `/yonetim` (bkz. `src/app/yonetim/page.tsx`).
  Vitrinin kabuğunu kullanmaz, kendi arayüzü vardır (dev-tools estetiği). Admin olmayan
  404 görür.
- **Keşfet akışı tohumlu ve elle tazelenebilir.** Sıralamanın omurgası editoryal marka
  puanı (`data/brand-scores.json`); tohum marka düzeyinde ±0.16 rotasyon uyguluyor ve
  ızgara başlığındaki **↻ restart imleci** yeni bir tohumla vitrini baştan kuruyor
  (`src/lib/discovery.ts`). Skorun üstüne eklenen ayrı terimler: `spotlightBonus`
  (orta bandın VERİ olarak eksiksiz ürünü), `underdogBonus` (az bilinen markanın
  GÖRSEL olarak iddialı ürünü), `scarcityPenalty` (1–2 bedeni kalmış ürün aşağı iner).
  Dokuma marka yorgunluğunun yanında **kategori yorgunluğu** da uygular (`catFatigue`),
  böylece ilk ekranda 19–20 farklı kategori bulunur. Denetim: `npm run check-discovery`.
- **Estetik puan** (`src/lib/discovery.ts` → `aestheticScore`): desen/grafik dili,
  renk kararlılığı ve fotoğraf yatırımı. Öznel olduğu kabul edilir; fiyat ve marka puanı
  bilerek dışarıdadır. İleride kişiselleştirilecek, bu fonksiyon taban olarak kalır.
- **Düz kategori taksonomisi.** Ürünün kategorisi doğrudan ürün tipidir (TİŞÖRT, HOODIE,
  GÖMLEK, ŞORT…) — `src/lib/types.ts` → `PRODUCT_CATS`, sınıflandırma
  `src/lib/categorize.ts`. Script'ler bu dosyaları doğrudan import eder (Node 24 `.ts`
  çalıştırır), böylece katalogdaki kategori ile arayüzün beklediği kategori ayrışamaz.
  Sol menüdeki **çatı başlıkları** (`CAT_GROUPS`: ÜST GİYİM / ALT GİYİM / DIŞ GİYİM /
  ELBİSE & TAKIM / AKSESUAR) yalnızca bir görünüm katmanıdır: açılır kapanır, filtreye
  girmez, üründe saklanmaz.
- **Beden.** Kanonik sözlük `src/lib/sizes.ts`; scraper, import ve arayüz aynı
  fonksiyonları çağırır. Ham veri "Medium", "SM", "S/M", "35-38", "TEK BOYUT",
  "XL (M-L BEDENE TEKABUL EDER)", "28 (XXS)" gibi onlarca yazımla geliyor; hepsi tek
  merdivene (`2XS…6XL`), numaraya veya "TEK BEDEN"e indirgenir. Kartta ürünün YALNIZ
  ÜRETİLEN bedenleri baloncuk olur (pencere XS'ten başlar, taşanlar "+n"); olmayan beden
  sönük ÇİZİLMEZ, çünkü veri "tükendi" ile "hiç üretilmedi"yi ayırmıyor. Tek bedenli
  üründe satır hiç çizilmez. Çocuk giyimi ve yaş bedenleri vitrinde yok (arşivde).
- **Cinsiyet etiketleri.** Ürün `genders: ("kadin"|"erkek")[]` taşır; unisex ürün ikisini
  birden taşır ve her iki filtrede de görünür (`src/lib/gender.ts`). Ad ve kategori
  susuyorsa BEDEN ARALIĞI karar verir — kural, adında cinsiyet yazan ürünler etiketli
  veri sayılarak ölçüldü (%86 isabet, `npm run check-gender`).
- **Tarz.** Ürün `styles` taşır (`src/lib/product-styles.ts`): marka tarzı önseldir,
  ürün adı düzeltir — **desenli bir ürün "basic" olamaz**. Yedi tarz: streetwear, basic,
  techwear, ravewear, spor, old-money, minimalist, **y2k**.
- **Fiyat.** Kartta yazan fiyat, kaynakta O AN geçerli olan satış fiyatıdır; indirim
  mekanizması bilerek YOK. Renge göre değişen fiyatlarda aralık `priceMin`/`priceMax`te
  durur ve filtre o aralıkla kesişime bakar.
- **Herkese açık listeler.** Kullanıcı listesini bir nick vererek yayınlayabilir; yayınlar
  VİTRİNİM > HERKESE AÇIK sekmesinde sergilenir (`src/lib/public-lists.ts`). Hesap
  gerekmez — sahiplik cihazda saklanan gizli anahtarla kanıtlanır.
- **Yorum ve puan.** Ürün modalinin altında 1–5 yıldız + serbest metin
  (`src/lib/reviews.ts`). Kişi başı TEK yorum: ikinci gönderim öncekini günceller, yoksa
  ortalama tekrar oy vererek şişerdi. Üyelik şart değil — oturum varsa yorum hesaba
  bağlanır ve nick oradan gelir, yoksa listelerdeki gibi cihaz anahtarı + nick.
- **Gösterim biçimleri.** Izgara dört biçimde çizilir: SIK / IZGARA / İRİ / LİSTE.
  Tercih cihazda saklanır. Kartın ağırlık merkezi fotoğraf; ad, fiyat ve marka logosu
  ikincil ve logo tıklanmaz (markaya gitmenin yolu MARKALAR sekmesi ve ürün modali).
- **Renk varyantları.** Her ürün `variants[]` taşır: renk adı, hex, o rengin görselleri
  (ürünün `images` havuzuna indeks), bedenleri, fiyatı ve markadaki kendi ürün linki.
  Arayüzde bir renge basınca kart/modal o rengin fotoğrafına geçer.
- **Görsel proxy** (`src/app/api/img`): SSRF-korumalı (host allowlist), hotlink'i Referer
  ile aşan, sharp ile webp'ye çevirip küçülten, **üç katmanlı önbellekli** akış
  (bkz. aşağıdaki bölüm).
- **Marka logoları** (`public/brand-logos/`): markaların kendi sitelerinden **bir kez**
  indirilir, normalize edilir, kendi origin'imizden statik servis edilir. Çalışma anında
  marka sitesine hiç gidilmez.
- **Tema**: karanlık (siyah+sarı) / aydınlık (beyaz+mor); CSS değişkenleriyle anında
  çevrilir (flash yok).

## Kurulum

```bash
npm install
npm run dev -- -p 3005    # http://localhost:3005 — TAM katalog (73.178 ürün)
npm run dev:hafif         # hafif örnek katalog (2.160 ürün), az bellekli geliştirme
npm run check             # typecheck + kategori + tarz + beden + çatı + arşiv + cinsiyet
                          # + fiyat + renk + keşfet
```

Aynı klasörde ikinci bir dev server açacaksan `NEXT_DIST_DIR` ver
(`NEXT_DIST_DIR=.next-b npm run dev -- -p 3002`) — yoksa iki sunucu aynı `.next`e yazıp
birbirinin derlenmiş route dosyasını siler, uçlar rastgele 404/500 döner.

### Yönetim paneline giriş

İki yol var, ikisi de `.env.local`den:

- **`ADMIN_EMAILS`** — bu adreslerle giriş yapan hesabın rolü otomatik `admin` olur.
  Giriş 6 haneli e-posta kodu ile; henüz bir SMTP bağlı olmadığı için kod yalnız
  `AUTH_DEV_CODES=1` iken ekranda görünür.
- **`ADMIN_ACCOUNTS`** — parolalı yönetim hesapları, e-postaya bağımlı değil.
  Giriş kutusuna e-posta yerine handle (`guap`, `maveth`) yazınca kod adımı yerine
  parola sorulur. Arayüzde ayrı bir düğme yok; `@` içeren her girdi normal akışa gider,
  yani sıradan kullanıcı için ekran hiç değişmez.

  ```bash
  npm run admin-hash -- guap guap@altr.local "parolan"
  # çıkan satırı ADMIN_ACCOUNTS'a virgülle ekle
  ```

  Handle başına 10 dakikada 5 deneme, sonra 15 dakika kilit.

Admin oturumunda üst şeritte **YÖNETİM** linki çıkar → **`/yonetim`** (konsol vitrinden
bağımsız bir arayüz: KUTU / ÖLÇÜM / TEŞHİS). Hem sayfa hem uçlar admin olmayana 404 döner.

## Sayfalar

| Yol | Ne |
|---|---|
| `/` | Vitrin (tek sayfalık uygulama): keşfet akışı, kategori/tarz/marka filtreleri, listeler. |
| `/yonetim` | Yönetim konsolu (admine özel; gelen kutusu + ekler, ölçüm, teşhis). |
| `/markalar` | Alfabetik marka rehberi — harf şeridi, iri logo + tarz + ürün adedi + markanın kargo avantajı. |
| `/<marka-slug>` | Marka sayfası: iri logo, künye (adet/stok/fiyat aralığı), **mağazanın sundukları** (kargo/taksit/iade), kategori kırılımı, ürün ızgarası. SEO için uzantı markanın kendi adıdır (`/void`). |
| `/?liste=…&mod=kombin` | Paylaşılan kombin — kategori başına tek parça, üstten alta bir kıyafet. |

`/markalar` ve `/<marka-slug>` **sunucuda** çizilir ve vitrinin istemci mağazasına bağlı
değildir: arama motoru ve link önizlemesi gerçek HTML görsün diye. Oradaki tıklanabilirler
gerçek `<a>`; vitrindekiler hâlâ `<span onClick>`.

Vitrinin İÇİNDEN bu iki ekrana sayfa yüklemeden geçilir: MARKALAR ve marka sayfası birer
**sekme** (kategori değiştirmek gibi). Ekranlar ortak — `BrandIndex.tsx` /
`BrandPage.tsx`; sayfa sürümü handler vermez (her bağ gerçek `<a>`), sekme sürümü verir
ve veriyi `/api/marka`dan alır. `href`ler her hâlükârda gerçek: orta tık ve "yeni
sekmede aç" `/markalar` ve `/<slug>` adreslerini açmaya devam eder.

## Dil (TR / EN)

Vitrin iki dilli. **Varsayılan Türkçe**; İngilizce tam çeviri.

| Parça | Yeri |
|---|---|
| Sözlük + `translate()` | `src/lib/i18n.ts` |
| İstemci bağlamı (`useLang`, `useT`) | `src/lib/lang.tsx` |
| Karşılama modalı (misyon + dil seçimi) | `src/components/IntroModal.tsx` + `intro.css` |
| Sitedeki dil anahtarı | `src/components/LangToggle.tsx` (sol menüde tema anahtarının altında; mobilde üst şeritte) |

**Sözlük TÜRKÇE METNİN KENDİSİYLE anahtarlanır**, ayrı bir anahtar uzayı yok:

```tsx
const t = useT();
<span>{t("VİTRİNİM")}</span>   // tr: VİTRİNİM   en: MY RAIL
```

Sebebi: 30'dan fazla bileşeni `t("nav.vitrin")` gibi soyut anahtarlara çevirmek Türkçe
kaynağı okunmaz yapardı ve atlanan bir anahtar ekranda BOŞLUK/`nav.vitrin` gösterirdi.
Bu düzende **atlanan metin en kötü ihtimalle Türkçe kalır** — hiçbir zaman bozulmaz.
Bedeli: anahtar koddaki dizeyle karakteri karakterine aynı olmalı (noktalama, `…`, büyük
harf dahil).

Yeni metin eklerken: dizeyi `t("…")` ile sar, karşılığını `src/lib/i18n.ts`'teki `EN`
tablosuna yaz. İçinde sayı geçen kalıplar için ya `PATTERNS` (`"3 MARKA"` → `"3 BRANDS"`)
ya da `{n}` yer tutucusu kullanılır — **kelime sırası iki dilde farklıysa yer tutucu
şart**: `"{n} ÜRÜNÜ GÖSTER"` → `"SHOW {n} PRODUCTS"` (parça parça çevirmek "40.413 SHOW
PRODUCTS" üretiyordu).

**Dil ÇEREZDE**: `altr_dil` (+ yedek olarak `localStorage.altr-lang`). Çerez şart, çünkü
`/markalar` ve `/<marka>` SUNUCUDA çizilir; dil yalnız localStorage'da olsaydı sunucu
Türkçe basıp istemci İngilizceye çevirir ve hidrasyon uyuşmazlığı verirdi. Kök layout
çerezi okuyup `<LangProvider>`a veriyor (tüm sayfalar zaten `force-dynamic`).

**Çevrilmeyen üç şey, bilerek:** marka adları (özel isim), ürün adları (kaynağın kendi
metni) ve `<head>` metadata'sı (arama motoru çerezsiz gelir; Türkçe doğru varsayılan).
Yönetim konsolu (`/yonetim`) da Türkçe — dışarıya kapalı, iki hesabın gördüğü iç alet.

**Sorgu değerleri çevrilmez, yalnız etiketleri:** `?kategori=TİŞÖRT` her iki dilde de
aynı adres. Aksi hâlde İngilizce paylaşılan bir link Türkçe tarayıcıda açılmazdı.

### Karşılama modalı

`altr-landing` projesindeki kapı ekranından geldi; oradaki **davet kodu + bekleme
listesi katmanı tamamen çıkarıldı**, yerine dil seçimi kondu. Fark: kapı bir ENGELDİ
(middleware çerezi olmayanı yönlendiriyordu), bu bir KARŞILAMA — siteyi kilitlemiyor.

- Cihaz başına **bir kez** açılır (`localStorage.altr-giris`), okla geçilir.
- Bayrağa basmak modalı KAPATMAZ: kullanıcı İngilizceye geçip metni okuyabilsin.
- Sonrasında sol menüdeki **MİSYON** girişinden her zaman açılabilir (o hâlde kapatma
  rozeti de çıkar).
- Kataloğa dokunmaz: marka/ürün sayısı vitrinin elindeki değerlerden, arka plan duvarı
  `public/brand-logos/*.webp`ten gelir.

## Veriyi yenilemek

Scraper artık **bu projenin içinde** (`scripts/scrape/`). Arşivdeki eski scraper'a gerek yok.

```bash
npm run scrape                    # tüm markalar -> .data/full/<slug>.json
npm run tag-colors                # ürünleri renge göre etiketle -> data/color-tags.json
npm run import-catalog            # .data/full/* -> .data/catalog.json
npm run refresh                   # scrape + import, saatlik tazeleme için (aşağıya bak)
```

`tag-colors` **import'tan önce** çalışır ve çıktısını ayrı bir dosyada tutar; import onu
yalnız okuyup `Product.colorTags`a yazar. Ayrı durmasının sebebi maliyeti: etiketi
olmayan ürünlerin fotoğrafı indirilip piksel histogramı çıkarılıyor, bu her import'ta
tekrarlanamaz. Yeni ürünler için bayraksız çalıştırmak yeter (eksikleri tamamlar).

Faydalı bayraklar:

```bash
npm run scrape -- --only void,machinist      # tek marka
npm run scrape -- --platform ikas            # yalnız İkas mağazaları
npm run scrape -- --dry                      # yaz, ama dosyalara dokunma
npm run audit-brands                         # her markayı yoklayıp neyin çekilemediğini raporla
```

### Adaptörler

| Adaptör | Kaynak | Kapsanan |
|---|---|---|
| `shopify` | `/products.json` (tam sayfalama) + `/meta.json` (para birimi) | ~60 marka |
| `ikas` | storefront GraphQL (`api.myikas.com`) | ~54 marka |
| `woocommerce` | Store API | 5 marka |
| `shopier` | `POST /s/api/v1/search_product/<mağaza>` + ürün sayfasındaki satır içi JSON | 12 marka |
| `jsonld` | sitemap + JSON-LD/OpenGraph, Ticimax `productDetailModel` kısayoluyla | kalanlar |

**Shopier** (pazaryeri altındaki vitrinler) 2026-07-29'da eklendi. Mağaza sayfasında
ürünlerin yalnız ilk 24'ü var; gerisi vitrinin kendi liste uç noktasından geliyor ve o
uç nokta **oturum çerezi + `csrf-token`** ister (ikisi olmadan 500 döner, 403 değil —
"adaptör bozuk" gibi görünür). Beden/stok ürün sayfasındaki `{"page":"product", …}`
nesnesinden okunur. Hepsi TEK origin olduğu için Shopier markaları `--concurrency 1`
ile çekilmeli; paralel çekimde mağaza sayfaları 429 döndürüyor.

Platform, `brands.generated.ts`'teki alana **güvenilmeden** her çalıştırmada ana sayfadan
tespit edilir: o alanda 38 marka "jsonld" yazıyordu ama aslında İkas'tı ve bu yüzden
sitemap taramasıyla eksik/bedensiz çekiliyorlardı.

### Veri kaybına karşı korumalar

- **Son-iyi koruması**: bir marka daha önce dolu veri verdiyse ve bu sefer boş dönerse
  dosyası ezilmez. (Geçmişte bir markanın sitesinde 467 ürün varken katalogda 0 ürünü
  vardı — scrape anındaki geçici bir hata sessizce boş dizi yazmıştı.)
- **Yeniden deneme**: 5xx/429/ağ hatası üstel geri çekilmeyle 3 kez denenir.
- **Çerez kavanozu**: çerez verip yönlendiren siteler sonsuz yönlendirmeye düşmez.
- **Yedek yol**: API'li bir adaptör beklenmedik şekilde boş dönerse sitemap yoluna düşülür.

### Canlı tazeleme (≤ 1 saat)

`npm run refresh` fiyat/stok/beden/renk bilgisini kaynaktan tazeler ve katalogu yeniden
üretir. Hızlı API'li markalar her turda, sayfa taranan markalar en bayat olandan
başlayarak zaman bütçesi kadar tazelenir. Zamanlama ve dağıtım notları:
[docs/canli-tazeleme.md](docs/canli-tazeleme.md).

### Davranış ölçümü ve admin paneli

İki olay günlüğe yazılır (`src/lib/events.ts`, günlük JSONL):

| Olay | Dosya | Ne zaman |
|---|---|---|
| **Görüntülenme** | `.data/events/views-<gün>.jsonl` | ürün modalı açıldı (`POST /api/view`) |
| **Çıkış** | `.data/events/outbound-<gün>.jsonl` | kullanıcı markanın sitesine gitmeyi onayladı (`POST /api/outbound`) |

İkisi ayrı dosyada, çünkü ayrı sorulara cevap veriyorlar; asıl bilgi ORANLARINDA
(modalı açan kaç kişi mağazaya gitti). Özetler **admine özel**:
`GET /api/stats?days=30` ve `GET /api/outbound?days=30` — yetki oturum çerezinden
okunur, admin olmayana 404 döner. Arayüzde üst şeritteki **İSTATİSTİKLER** sekmesi
(`src/components/StatsPanel.tsx`): gün/saat kırılımı, marka ve kategori sıralaması,
ürün tablosu; grafikler kütüphanesiz düz SVG.

`import-catalog` iki şey yapar: kaynak `ProductGroup[]`'un renk varyantlarını korur ve
**aynı ürünün renge göre bölünmüş ayrı kartlarını tek ürüne katlar** (bazı markalar her
rengi ayrı ürün sayfası olarak yayınlıyor; vitrinde yan yana neredeyse aynı 3-4 kart
çıkıyordu). Katlama iki geçişte olur:

1. **Renk sözlüğü** — adından renk sözcükleri atıldığında aynı ada inen ürünler.
2. **Ad eki** — markanın uydurduğu renk adları ("Mürdüm", "Nefti Yeşili") sözlükte olmaz.
   Çıplak ad ürün olarak gerçekten varsa, ek en fazla 2 sözcükse ve aynı tabana bağlanan
   en az 2 farklı ek varsa katlanır. `NOT_A_COLOR` listesi "Uzun Kol", "Kapüşonlu" gibi
   ekleri korur — onlar renk değil, başka üründür.

## Marka logoları

```bash
npm run fetch-logos                          # eksikleri indir
npm run fetch-logos -- --force               # hepsini yeniden indir
npm run fetch-logos -- --only <slug> --dry   # aday listesini ve puanlarını yaz
```

Script marka ana sayfasından logo adaylarını çıkarır ve üç sinyalle puanlar: **nereden**
geldiği (header `<img>` > apple-touch-icon > JSON-LD > favicon > og:image), **boyutu**
(32px'lik bir işaret neredeyse hep sponsor/ödeme rozetidir) ve **dosya türü** (png/svg =
şeffaf zeminli işaret, jpg = kampanya görseli). Sonra 120px yüksekliğe normalize edip
webp yazar; ayrıca **kırpmadan önce** piksellerden "karanlık temada ters çevrilmeli mi"
bilgisini (`inv`) hesaplar — beyaz kutulu logo siyah sayfada beyaz blok, siyah wordmark
da görünmez leke olmasın diye.

Yanlış görsel yakalanırsa `data/brand-logo-overrides.json`'a satır ekle: doğrudan URL,
ya da `null` (= bu markada kullanılabilir logo yok, yazıya düş). Logosu olmayan marka
`BrandLogo`'nun `fallback`'ine düşer, tasarımda boşluk kalmaz.

Üretilenler: `public/brand-logos/<slug>.webp`, `src/lib/brand-logos.generated.ts`
(manifest), `data/brand-logos.meta.json` (kalıcı ton bilgisi — kırpılmış dosyadan
yeniden hesaplanamaz, o yüzden saklanır).

> Logolar markaların tescilli işaretleridir; burada yalnızca ürünün hangi markaya ait
> olduğunu göstermek için kullanılıyor. Yayına almadan önce telif/ToS tarafını netleştir.

## Marka avantajları

```bash
npm run fetch-perks                    # tüm markalar
npm run fetch-perks -- --only void     # tek marka
npm run fetch-perks -- --dry           # yazma, sadece raporla
```

Markanın ana sayfasındaki duyuru şeridinden kargo eşiği, hızlı gönderim, taksit, kapıda
ödeme, iade süresi ve ilk sipariş indirimi çıkarılır → `data/brand-perks.json`. Marka
sayfasında "MAĞAZANIN SUNDUKLARI", marka rehberinde tek satırlık kargo notu olarak çıkar.

**Cümle markanın kendi ifadesidir, özetlenmez.** Eşiği ayrıştırıp kendi cümlemizi kurmak
("2000 TL üzeri kargo bedava") kampanya koşulunu ("sadece kartla", "İstanbul içi")
düşürür ve tutmayan bir taahhüt üretir. Bulunamayan markada bölüm hiç çizilmez.

İki ayrıştırma tuzağı çözüldü, dokunurken bozma: (1) HTML etiketleri boşluğa çevrilince
duyuru komşusuna yapışıyordu ("… iade **Sipariş Takibi**") — blok etiketler artık `|`
ayracına dönüyor ve kalıplar `|` geçmeyen parça arıyor; (2) kuyruklar karakterle değil
SÖZCÜKLE sınırlı, yoksa cümle "iade edebilir ya da **deği**" diye kesiliyordu.

## Görsel önbelleği

`/api/img` üç katman kullanır (`src/lib/img-cache.ts`):

1. **Süreç-içi LRU** — en sıcak görseller, diske bile gitmeden.
2. **Disk önbelleği** (`.data/img-cache`) — süreç yeniden başlasa da kalır; tavan aşılınca
   en eski kullanılanlar silinir.
3. **Uçuşta tekilleştirme** — aynı görseli aynı anda isteyen 20 sekme, markanın
   sunucusuna 20 değil 1 istek atar.

Ayrıca istemciye `ETag` + 30 günlük `Cache-Control` gider (`If-None-Match` → 304), istenen
genişlik sabit basamaklara yuvarlanır (keyfi değerler önbelleği paramparça ederdi) ve
marka CDN'lerine açılan eşzamanlı bağlantı sayısı sınırlıdır.

İstemcide `ProductImage` görselleri `IntersectionObserver` ile ekranın 600px ötesine
kadar yükler (40 kartın `<img>`'i baştan kurulmuyor) ve `srcSet`/`sizes` ile telefona
240–360px'lik görsel iner.

## Ortam değişkenleri (`.env`)

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `SOURCE_TIMEOUT_MS` | 5000 | Marka CDN'ine timeout. |
| `IMG_MAX_WIDTH` | 1200 | Görsel proxy resize üst sınırı. |
| `IMG_CACHE_DIR` | `.data/img-cache` | Disk önbellek klasörü. Yazılamazsa sessizce bellek-içi katmana düşülür. |
| `IMG_CACHE_MAX_MB` | 1024 | Disk önbellek tavanı. |
| `IMG_MEM_CACHE_MB` | 32 | Süreç-içi LRU tavanı. |
| `IMG_FETCH_CONCURRENCY` | 8 | Marka CDN'ine eşzamanlı istek. |
| `ADMIN_EMAILS` | — | Bu adresler giriş yapınca rol `admin` olur. Arayüzden admin SEÇİLEMEZ. |
| `AUTH_DEV_CODES` | dev'de `1` | `1`: giriş kodu API cevabında/günlükte görünür. `0`: yalnız e-posta — ama sağlayıcı bağlı değilse giriş çalışmaz. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | — | Google ile giriş. Yoksa düğme hiç çizilmez. |
| `APP_ORIGIN` | istek origin'i | Google dönüş adresi buradan kurulur: `<APP_ORIGIN>/api/auth/google/callback`. |
| `AUTH_DIR` | `.data/auth` | Kullanıcı/oturum dosyaları. |
| `RESTOCK_FILE` | `.data/restock.json` | Stok talebi oyları. |

## Üyelik

Parolasız: e-posta + 6 haneli tek kullanımlık kod. İlk girişte nick sorulur, başka bilgi
istenmez. "Beni hatırla" oturum ömrünü belirler (60 gün / 12 saat). Google ile giriş
opsiyonel (OAuth 2.0 authorization code, kütüphanesiz — `src/lib/google-auth.ts`).

Roller: `user` (varsayılan), `business` (kayıtta seçilir; **şu an yalnız bir etiket**,
hiçbir yetki açmıyor çünkü marka sahipliğini doğrulayan bir akış yok), `admin`
(yalnızca `ADMIN_EMAILS`).

> **Hesap sistemi bilerek hiçbir özelliğe bağlanmadı.** Listeler hâlâ cihazda
> (localStorage), stok talebi oyları hâlâ anonim çerezle. Önce katman tek başına oturuyor;
> bağlar sonra teker teker atılacak — yarım bir hesap sistemi çalışan özellikleri de bozar.

**Canlıya çıkmadan:** `src/lib/auth.ts` içindeki `deliverCode()` gerçek bir SMTP/servise
bağlanmalı ve `AUTH_DEV_CODES=0` yapılmalı. Şu an kod yalnız günlüğe yazılıyor.

## Dağıtım

- **Vercel**: çalışır, ama serverless FS salt-okunur olduğu için disk önbelleği devre dışı
  kalır (yalnız bellek-içi + tarayıcı önbelleği). Kalıcı önbellek isteniyorsa
  `IMG_CACHE_DIR`'i yazılabilir bir hacme göster.
- **Kendi sunucun / Docker**: `output: "standalone"` ayarlı; disk önbelleği tam çalışır.

## Not

Bu bir aggregator kalıbıdır. Her markanın kendi kullanım şartlarına saygı gerekir; ürün
görselleri ve marka logoları kaynakta kalır, burada yalnızca gösterim amacıyla yeniden
boyutlandırılıp önbelleklenir.
