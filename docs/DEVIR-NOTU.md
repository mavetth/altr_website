# altr-0.0.6 — devir notu (2026-07-31)

Yeni bir sohbete bağlam vermek için. Doğrulanmış sayılar, açık işler ve tuzaklar.

---

## 2026-08-01 — MOBİL (3): üç kapı bloğu (VİTRİNİM · MARKALAR · MİSYON)

Telefonda üç kapı sağa yaslıydı ve satırlar tek tek hizalandığı için ikonlar zikzak
yapıyordu — ölçüldü: sağ kenarlar hizalı (hepsi 359) ama sol kenarlar **282 / 291 / 283**.

Üç değişiklik:
- **Aralarına kesikli ayraç.** `.dotline` mobilde topluca kapalı (dikey boşluk pahalı);
  yalnız bu üçünün arasında açıldı, boşluğu masaüstünün dörtte biri (`margin: 5px`).
  Bloğu tek bir menü gibi okutan şey bu.
- **Kendi hücresinde ORTALI.** `justify-self: end` → `center`. Sidebar mobilde
  `1fr auto 1fr` bir ızgara: logo 1. sütunun ortasında duruyordu, kapılar 3. sütunun
  sağ kenarına yapışıyordu. Artık ikisi de ortada — **logo merkezi 94, kapı bloğu
  merkezi 281, ekran ortası 187.5**, yani aradaki dikey kesikli ayraca göre tam simetrik.
- **Her kapı KENDİ İÇİNDE ortalı** (`align-items: center`; satırın kendi hizası
  bileşenden gelen `center`). Önce ikon hizası denendi (`stretch` + `flex-start`):
  ikonlar tek sütuna oturuyordu ama kısa yazı (MİSYON, 68px) sağda 18px boşluk
  bırakıyordu ve blok dar olduğu için bu bir liste gibi değil, eksik bir satır gibi
  okunuyordu. **Kullanıcı kararı: ikon hizası YOK, üçü de ortalı.** Ortak sınırı zaten
  kesikli çizgiler çiziyor (bloğun enini alıyorlar: 86px).
- **Vitrin rozeti de AKIŞTA** — satırın parçası, yani VİTRİNİM ikon + yazı + rozet olarak
  bir bütün hâlinde ortalanıyor. Rozeti akıştan çıkarıp (`position: absolute`) yalnız
  yazıyı ortalamak denendi ve **kullanıcı kararıyla geri alındı**: vitrin boşken rozet
  zaten çizilmiyor, yani fark ancak vitrinde ürün varken ortaya çıkıyor ve orada rozetin
  bloğun dışına asılması istenmedi. Sonuç — boşken blok 86px, ürün varken 110px; her iki
  durumda da üç kapının merkezi **281** ve kesikli çizgiler blokla aynı ende
  (boşken 239→324, doluyken 227→336).

Bedeli sidebar satırında **+10px** (111 → 121px). Masaüstü ETKİLENMEDİ (kurallar
≤820px bloğunda): orada satırlar hâlâ tek tek ortalı, çünkü her kapının altında bir alt
yazı var ve blok 230px — liste değil, üç ayrı kart gibi okunuyor.

---

## 2026-08-01 — MOBİL (2): kategori şeridi iki satıra ayrıldı

Şerit iki SEVİYEYİ tek satıra sıkıştırıyordu: bir çatıya basınca kalemleri aynı satırın
içine giriyor, sonraki çatı ekranın kilometrelerce sağına kaçıyordu. Ölçüldü (375px):

| durum | kalem | şeridin eni | sonraki çatının yeri |
|---|---|---|---|
| hepsi kapalı | 9 | 1090px (≈3 ekran) | — |
| ÜST GİYİM açık (ESKİ) | 22 | **2337px** (≈6 ekran) | ALT GİYİM **x=1487** |
| ÜST GİYİM açık (YENİ) | 9 + 13 | satır1 1100 / satır2 1315 | ALT GİYİM **x=251** |

Yani bir çatıyı açan kişi diğer çatıları tamamen kaybediyordu. Seçenekler tartışıldı
(drill-down / iki satır / tam ekran çekmece); **kullanıcı iki satırı seçti.**

`CategoryNav` artık iki kipli: `ikiSatir` propu verilen ŞERİT kopyası üstte çatıları,
altta açık çatının kalemlerini çiziyor (`.cats-row` + `.cats-row-alt`), sidebar kopyası
eskisi gibi dikey. Başlık ve MARKALAR bağı iki kipin ortak parçası olarak dışarı alındı.

Kararlar:
- **Şeritte aynı anda TEK çatı açık.** Store'daki `openGroups` çoklu açılışa göre kurulu
  (sidebar öyle çalışıyor); iki satırlık şeritte "hangi çatının kalemleri" sorusunun tek
  cevabı olmalı, o yüzden şeridin kendi YEREL durumu var. Durum ÜÇ değerli:
  `undefined` = dokunulmadı (seçili kategorinin çatısı açık gelir), `string` = kullanıcı
  açtı, `null` = kullanıcı kapattı. İki değerli olsaydı elle kapatılan çatı
  `activeGroup` yüzünden anında geri açılırdı.
- **Kaydırma satırların İÇİNDE**, şeridin kendisinde değil — yoksa iki satır tek bir
  yatay kaydırma alanında birbirini sürüklerdi.
- **Açık başlık satır 1'de sola YAPIŞIR** (`position: sticky; left: 0` + zemin ve negatif
  margin): şerit sağa kayınca hangi çatının içinde olunduğu kaybolmuyor.
- Satır 2'nin zemini ayrı DEĞİL: karanlık temada `--bg2` (#050505) ile `--bg` (#000)
  farkı ekranda okunmuyor. Seviye farkını ince ayraç çizgisi + bir tık küçük punto +
  satır 1'de açık başlığın beyaz kalması taşıyor.
- `.cats-row > *` (eskiden yalnız `span`): MARKALAR bir `<a>` ve nowrap satırda
  büzülüyordu.
- Şerit açıkken 41 → 79px olduğu için harf bağı payı da (`--anchor-offset`) buna bağlandı:
  `:has(.topbar-cats-fixed.is-acik)` ile `--cats-h` 41 → 81.

**Doğrulandı:** kapalı 1 satır/41px; ÜST GİYİM açık 2 satır/79px ve ALT GİYİM x=251'de
(ekranda); ikinci çatıya basınca birincisi kapanıp satır 2 yenisiyle değişiyor (aynı anda
tek açık); satır 2'den kalem seçince filtre uygulanıyor (`?kategori=tisort`), satır açık
kalıyor, seçili kalem vurgulu; başlığa tekrar basınca kapanıp 41px'e dönüyor; şerit her
durumda arama çubuğunun altında (y=53); MARKALAR sekmesinde harf bağı çatı açıkken de
şeridin 16px altına oturuyor. Masaüstü sidebar etkilenmedi (dikey, 13 kalem, kolon).

---

## 2026-08-01 — MOBİL (1): yapışkan arama çubuğu gerçekten yapışıyor

Telefonda kaydırırken ekranın en üst 41px'inde ürünler akıyor, kategori şeridi de havada
duruyordu. İki ayrı hata üst üste binmişti:

**1. Arama çubuğu hiç yapışmıyordu.** `globals.css` `.mobile-search-sticky`a
`position: sticky` veriyor ama `SearchBox` kök `<div>`üne SATIR İÇİ `position: relative`
yazıyordu — satır içi stil stylesheet'i yener, yani kural hiçbir zaman işlememişti.
O `relative` öneri listesi (position:absolute) için gerekliydi; artık `.search-anchor`
sınıfıyla CSS'ten geliyor. Mobil kural dosyada daha SONRA geldiği için — aynı özgüllükte
— onu geçersiz kılıyor. `position: sticky` de absolute çocuklar için aynı kuşatan bloğu
kurduğundan öneri listesi aynı yerde duruyor.

**2. Kategori şeridi yanlış yükseklikte kilitleniyordu.** `top: 41px` yazıyordu, çubuk
ise 53px. Çubuk yapışmadığı için bu fark hiç görülmemişti; yapışınca şerit çubuğun
altını örtecekti. İki sayı artık tek kaynaktan: `.app-shell { --msearch-h: 53px }`,
çubuk `height`ini, şerit `top`unu, harf bağı payı da (`--anchor-offset`) bunu okuyor.
Boy içeriğe bırakılmadı (bilerek sabit): fontla oynarsa şerit ya çubuğu örter ya boşluk
bırakır.

**Doğrulandı** (375×812, kaydırma 0/400/1500/4000): çubuk her derinlikte `top:0`'da,
şerit tam 53'te kilitleniyor (boşluk 0, örtüşme 0), viewport'un en üstündeki eleman artık
ızgara değil arama çubuğu. Harf bağları şeridin 14px altına oturuyor (`--anchor-offset`
53+41+14=108). Masaüstü değişmedi: arama `.topbar` içinde, `position: relative`, 360px.

---

## 2026-08-01 — Büyük harf ve nokta: "OVERSİZE" mi "OVERSIZE" mı

Soru: ürün adlarında büyük İ çıkıyor, İngilizcede bu harf yok. Sebep şu — ürün adı
veritabanında normal yazılı (`Mother - Oversize Premium Sweatshirt`), büyük harfe **CSS
`text-transform: uppercase`** çeviriyor ve CSS bunu `<html lang>`e göre yapıyor: `tr`
iken `i → İ`. Yani bu bir veri hatası değil, **doğru çalışan** bir yerelleştirme.

`<html lang>` zaten dile bağlı (layout.tsx çerezden okuyor, `setLang` çalışırken
`document.documentElement.lang`i güncelliyor), yani **EN modunda hiçbir yerde İ
çıkmıyor** — doğrulandı: vitrinde `MOTHER - OVERSIZE PREMIUM SWEATSHIRT`, sunucuda
çizilen `/markalar`da `212 ATELIER`, `BALINA BUTIK`.

**KARAR (kullanıcı, 2026-08-01): kural dile bağlı kalsın, kelime bazlı ayrım YAPILMAYACAK.**
Yani TR modunda `OVERSİZE`, EN modunda `OVERSIZE`; bunun bedeli EN modunda Türkçe
kelimelerin noktasını kaybetmesi (`TİŞÖRT` → `TIŞÖRT`, `SİYAH` → `SIYAH`) ve bu
**bilerek kabul edildi**. Alternatif, kelimeyi kendi diline göre çevirmekti; katalog
tarandı ve iki taraf da büyük çıktı — içinde `i` geçen saf-ASCII kelimelerde İngilizce
~63.000 örnek (oversize 15.271, shirt 9.187, unisex 6.836…), Türkçe ~28.000 (siyah
8.507, gotik 2.619, bisiklet 1.378…). Yani "İ'yi tamamen kaldır" 28 bin Türkçe kelimeyi,
"hep Türkçe kural" 63 bin İngilizce kelimeyi bozuyordu; elle bir Türkçe-ASCII sözlüğü
tutmadan temiz bir orta yol yok. **Bu sayıları yeniden ölçmeden bu karara dönme.**

Tek gerçek kaçak düzeltildi: `AccountButton` nick'i `toLocaleUpperCase("tr")` ile
büyütüyordu, yani İngilizce arayüzde "emir" → "EMİR". Artık aktif dili alıyor. Sayfadaki
diğer büyük harfler CSS'ten geldiği için `<html lang>`i kendiliğinden izliyor.
`auth.ts` / `sync.ts` / `brand-page-shared.ts` içindeki sabit `"tr"` DOKUNULMADI —
onlar ekrana değil ANAHTARA yazıyor (nick eşleştirme, ad anahtarı, harf gruplaması);
dile göre değişmeleri kayıtları ve sayfa içi bağ adreslerini bozardı.

---

## 2026-08-01 — Harf şeridinden zıplayınca başlık üst barın altında kalıyordu

MARKALAR'da bir harfe basınca (`#harf-H`) bölüm başlığının üstü yapışık üst şeridin
altında kalıyordu. Sebep: `BrandIndex`teki `scrollMarginTop: 24` SABİTTİ ve yalnız
`/markalar` sayfası için doğruydu — orada başlık akışta duruyor. Vitrinin MARKALAR
SEKMESİNDE ise `.topbar` yapışık (61px), yani hedef 24px'e oturunca başlığın üst 37px'i
barın altında kalıyordu (ölçüldü).

Ölçü artık bağlamdan geliyor: `scroll-margin-top: var(--anchor-offset, 24px)`.
Değişkeni yalnız uygulama kabuğu tanımlıyor (App.tsx'in kök `<div>`üne `.app-shell`
eklendi) — masaüstünde `calc(var(--topbar-h) + 22px)`, telefonda `96px` (orada yapışan
şey `.topbar` değil, arama çubuğu + altına kilitlenen kategori şeridi). `PageChrome`
sayfalarında değişken hiç tanımlanmadığı için varsayılan 24px geçerli kalıyor, yani o
sayfaların davranışı değişmedi.

**Doğrulandı:** vitrin sekmesinde H/D/K başlıkları barın **22px altına** oturuyor
(eskiden 37px altında KALIYORDU); telefonda kategori şeridinin 14px altına; `/markalar`
sayfasında hedef yine 24px'te ve üstte yapışan hiçbir eleman yok.

**Yan bulgu (ayrı iş olarak işaretlendi):** telefonda `.mobile-search-sticky` aslında
YAPIŞMIYOR — `SearchBox` kök `<div>`üne satır içi `position: relative` yazıyor ve
stylesheet'teki `position: sticky` (`!important` yok) eziliyor. Bu yüzden `.topbar-cats-fixed`
`top: 41px`te, altında kimsenin olmadığı bir boşluğa kilitleniyor.

---

## 2026-08-01 — ÇIKIŞ EKRANI + "canlı" noktası kesintisiz nefes alıyor

**1. Çıkış ekranı (`ExitScreen.tsx`).** Kaydırma onaylandıktan sonra hedef sekme açılana
kadar geçen pay (RITUAL_MS) boş geçiyordu: modal ekranda duruyor, hiçbir şey olmuyor,
sonra birden yeni sekme açılıyordu. Artık o payı tam ekran bir ara sayfa dolduruyor —
altr wordmark'ı, "seni şuraya götürüyoruz", markanın kendi logosu (daire içinde) ve adı,
dolan süre çubuğu, dönen halka. Pay **850 → 1600ms**; üst sınırı tarayıcı koyuyor:
`window.open` kullanıcı hareketinden kopunca engelleniyor, Chrome'un geçici etkinlik
penceresi 5sn, 1.6sn onun epey içinde.

- Modal `going` olunca kendini çizmeyi bırakıp ekranı devrediyor; onay anındaki glitch
  flaşı da modalden ekrana taşındı (geçiş sert kalsın).
- **Kaçış kapısı:** "uzun mu sürüyor? hemen aç" — sayacı kesip hedefi anında açar.
  Tarayıcı yeni sekmeyi engellerse tek çıkış yolu bu.
- **Marka adı yalnız logo SEMBOLKEN yazılır.** İlk hâlinde ad her zaman dairenin altına
  basılıyordu; "NOMARC" gibi bir wordmark'ta aynı kelime alt alta iki kez görünüyordu.
  Karar `BrandLogo.brandNameNeeded()`e taşındı — sayfanın geri kalanındaki kuralın
  (bkz. BrandLogo başlığı) adın logonun ALTINDA durduğu düzenler için karşılığı.
  **Doğrulandı: nomarc'ta ad yok (logo okunuyor), kaft'ta var (makas amblemi).**
- **Hedefi olmayan markada ritüel YOK:** "seni şuraya götürüyoruz" deyip 1.6sn sonra
  "mağaza yok" demek olurdu; kaydırma o durumda doğrudan uyarıyı basıp kapanıyor.
- İki çıkış yolu da (vitrindeki `BrandModal`, marka sayfasındaki `StoreGate`) aynı
  `GoModal`dan geçtiği için ekran ikisinde birden çalışıyor.
- **Doğrulandı** (/kaft, kaydırma simüle edildi): ekran çiziliyor, marka logosu ve adı
  yerinde, çubuk 1.6sn/linear + halka 0.9sn/linear "running", ~1.6sn sonra hedef açılıp
  ekran kapanıyor. Telefonda (375×812) içerik 414px, taşma yok.

**2. "Canlı" noktası.** `animation: dpulse 1.6s steps(2)` idi — iki kare arasında
zıplıyordu. Sayfanın geri kalanı bilinçli olarak sert/adımlı ama 6px'lik bir noktada bu
sertlik "efekt" diye değil "takılan GIF" diye okunuyor. Tek istisna olarak yumuşatıldı:
`1.9s cubic-bezier(.45,0,.55,1)`, yani nokta yanıp sönmüyor, kesintisiz soluyor.
`prefers-reduced-motion` açıksa hiç oynamıyor.

---

## 2026-08-01 — Logo ölçüleri: kutucuk, kart şeridi ve soluk logoların ton kuralı

Şikâyet: "logolar tam oturmamış, bazıları çok küçük duruyor." Üç ayrı sebep vardı.

**1. Sembol logoların yanına marka adı yazılıyordu.** Rehber kartında ad zaten kutunun
hemen ALTINDA yazıyor; `BrandLogo`ın "sembolse adı da yaz" kuralı burada aynı kelimeyi
ikinci kez basıyor ve 38px'lik ad kutucuğu YANDAN taşırıyordu (2downstreet, deer wear,
guerra butik, from cult, gotham…). `BrandIndex` artık `showName={false}` veriyor —
sembol logolar da kutunun tamamını kendine kullanıyor.

**2. Kutu `minHeight`ti, sembol logolar onu uzatıyordu.** Sembol logo referans ölçünün
1.6 katına kadar büyüyebiliyor; kutu da onunla uzayınca aynı satırdaki kartlar farklı
boylarda duruyordu. Kutu artık **sabit 88px**, logo yeni **`maxH`** propuyla içeride
kalıyor (`fitBox`: oranı bozmadan hem ene hem boya sığdırır — `fitLogo`ın çok geniş
wordmark'lara tanıdığı %25 taşma payı sabit kutuda geçersiz). Genişlik tavanı 210 →
**186**: en dar sütun 260px, kart (36) + kutu (28) + çerçeve (2) düşünce kalan bu.
**Doğrulandı: 163 kartın kutu yüksekliği tek değer (88), taşan logo yok.**

**3. Aynı ölçü aynı AĞIRLIK değil.** Geometri oranı çözüyor ama `abluka` baştan sona
dolu bir blok, `amuse-bouche` ince bir el yazısı — aynı kutuda biri bağırıyor, öbürü
kayboluyor. `data/brand-logo-kind.json`a logo başına **`olcek`** (0.8–1.4) eklendi;
`BrandLogo` bunu referans yüksekliğe çarpıyor. Değerler her logonun koyu zeminde
GÖRÜNEN mürekkep kütlesi ölçülerek üretildi (kütlenin karekökü ortancaya yaklaştırılır,
düzeltmenin YARISI uygulanır — tam eşitleme ince yazıları 3-4 katına çıkarıp marka
kimliğini bozuyor), sonra 157 kutucuk kontakt sayfası hâlinde gözle tarandı; kendi beyaz
kutusu içinde küçük kalan 10 logo (barikat, kaft, shout, guerra-butik…) elle yükseltildi.
Dosya kaynaktır, üreten betik YOK — yeni markanın çarpanı yoksa 1 kabul edilir.

Çarpanın büyüttüğü amblemler dar yerleri taşırmasın diye çip (`maxH=27`), ürün modalı
(29), paylaşılan liste (23), GoModal dairesi (70) ve marka künyesi (118) kendi tavanını
veriyor. **Doğrulandı: çip yüksekliği yine iki değer (36/43, değişmedi), kaft künyesi
118×118 kutunun içinde.**

**4. Ürün kartındaki logo şeridi de aynı işlemden geçti.** "Aynı bant" ile "aynı piksel
yüksekliği" aynı şey değil: `fixedH` bütün logoları 13px'e sabitliyordu, bu bir wordmark
için doğru ölçü (genişlik boyunca 100px yer kaplıyor) ama kareye yakın bir logo 13×13'lük
tanınmaz bir lekeye iniyordu. Sabit YÜKSEKLİK, kareye yakın logoyu sabit ALANIN çok
altına düşürüyor (alan = oran × yükseklik²). `BrandLogo.karePayi` bu farkı kapatıyor:
yükseklik oranın kareköküyle ters orantılı, tavan **1.75** — eşit alan hesabının kendisi
(3:1 wordmark 13px'te 507px², kare logonun aynı alana çıkması için 22.5 ≈ 13 × 1.73).
Referans oran türe göre kayıyor (amblem 4.6, yazı 3): amblem bütün çizimi yükseklik
boyunca taşıdığı için aynı oranda bir wordmark'tan çok yer hak ediyor.

Pay ilk hâlinde (aynı gün) yalnız `tip: "sembol"` logolara veriliyordu; kural TÜRLE değil
ORANLA ilgili çıktı — `saram` tipi "yazi" (ad logonun içinde) ama oranı 0.86, yani kartta
15px'lik bir kare olarak çiziliyor ve içindeki ad okunmuyordu.

**Kartta çarpan yalnız BÜYÜTÜR** (`Math.max(1, olcek)`): 13px'te 11px'e inmek okunurluğu
doğrudan yiyor, rehberdeki denge kaygısı burada zarar.

**TUZAK — bant `box-sizing: border-box`:** şerit `height: s.logo × 1.5` (20px) +
`paddingTop: 8` idi, yani İÇ yüksekliği 12px — 13px'lik düz bir wordmark bile taşıyordu,
20px'lik kare logoların altından ~4px `overflow:hidden` ile kesiliyordu ve bu hiç fark
edilmemişti (ölçüm kutu BOYLARINI karşılaştırıyordu, KONUMLARINI değil). Bant artık
`8 + logoMaxH`, `logoMaxH = s.logo × 1.75` — yani iç yükseklik tam olarak en iri logo
kadar. Kart ~11px uzadı. **Doğrulandı: bant tek değer (31px), kırpılan logo yok (taşma
≤ 0), kare logolar 22-23px (saram 22×19, gotham 23×17, shout 23×23), wordmark'lar 13px'te
kaldı, hiçbiri küçülmedi.**

**5. Soluk logolar — sebep `inv` değil ton kuralıydı.** `scripts/lib/logo-tone.mjs`
"renkli logo ters çevrilmez" diyordu (invert markanın rengini yalanlar) ama TONA hiç
bakmıyordu: koyu renkli işaretler (amuse-bouche kahvesi, balina-butik lacivertti,
2downstreet, diddy-studios, doomster, taxim, seize-society, stray-united, monday-kick)
karanlık sayfada siyah üstüne siyah kalıyordu — üstelik logolar duruşta `grayscale(1)`
ile çizildiği için KORUNAN RENK ZATEN GÖRÜNMÜYORDU. Dahası açık temada tam ters kural
işlediği için aynı logolar orada da beyaz üstüne beyaz oluyordu. Kurala ton koşulu
eklendi: renkli logo ancak **ortalama parlaklığı ≥ 0.40** ise korunur. Eşik adım 3'ün
0.45'inden düşük tutuldu, çünkü renkli bir logoyu çevirmenin bedeli marka kimliği —
sınırdaki slatra (0.45) camgöbeğinden pembeye düşecekti, bir tık kontrast için değmez.
`node scripts/fix-logo-inv.mjs` ile **9 logonun `inv` bayrağı düzeldi**. Bedeli: bu dokuz
logo hover'da ters tonda görünüyor; karşılığı duruşta (yani zamanın tamamına yakınında)
görünür olmaları. **Doğrulandı: karanlık temada en düşük kontrast 0.41'e (slatra) çıktı,
eskiden 0.12'ydi (amuse-bouche).**

Bu dokuz logonun `olcek` değeri de yeniden hesaplandı: ölçüm "görünen mürekkep" üstünden
çalıştığı için görünmeyen logolara 1.25-1.4 gibi şişkin çarpanlar vermişti (amuse-bouche
1.35 → 1, balina-butik 1.4 → 1, taxim 1.4 → 1.1). **Sıra önemli: `inv` düzeltilmeden
`olcek` ölçülmez.**

---

## 2026-07-31 — İKİ DİL (TR/EN), karşılama modalı, marka sıralaması puana bağlandı

**1. Marka sırası artık PUAN.** Hem ızgaranın üstündeki `ARŞİVDEKİ MARKALAR` şeridi
(`BrandChips.tsx`) hem filtre panelindeki marka listesi (`FilterPanel.tsx`) **editoryal
puana** göre (yüksekten düşüğe), eşit puanda alfabetik sıralanıyor. Kaynak
`data/brand-scores.json` → `lib/brand-scores.ts` `brandScore()`.

Şeritteki ESKİ davranış tohuma bağlı bir karışımdı (`brandRank` × 0.55 + rastgele ×
0.45); amacı her tazelemede farklı markalara göz değdirmekti. Bilerek değiştirildi:
kapalı hâlde görünen ilk 16 çip artık vitrinin **en iyi puanlı 16 markası**, yani şerit
bir rotasyon değil bir SIRALAMA. **Ürün akışının kendi karıştırması (`discovery.ts`)
buna dokunmadı** — orası hâlâ tohumlu. Doğrulandı: çiplerin ilk 16'sı
`brand-scores.json`un ilk 16'sıyla birebir aynı sırada (reflect-studio 4.4 → kaft/void
4.0 → …), filtre listesi de aynı.

**2. Tam İngilizce çeviri.** Ayrıntı README "Dil (TR / EN)" bölümünde. Özet:

- `src/lib/i18n.ts` — sözlük **Türkçe metnin kendisiyle** anahtarlı (~400 kayıt) +
  `PATTERNS` (sayı içeren kalıplar). `src/lib/lang.tsx` — `LangProvider` / `useLang` /
  `useT`.
- **Neden ayrı anahtar uzayı YOK:** atlanan bir metin bu düzende Türkçe kalır; soyut
  anahtarla ekranda boşluk ya da `nav.vitrin` çıkardı. Bedeli: anahtar koddaki dizeyle
  karakteri karakterine aynı olmalı.
- **Dil ÇEREZDE (`altr_dil`), localStorage yedek.** ZORUNLU: `/markalar` ve `/<marka>`
  sunucuda çiziliyor; dil yalnız localStorage'da olsaydı sunucu Türkçe basar, istemci
  İngilizceye çevirir, React hidrasyon uyuşmazlığı verirdi. Kök layout çerezi okuyup
  `<LangProvider>`a geçiriyor.
- **TUZAK — kelime sırası:** parça parça çeviri `"40.413 ÜRÜNÜ GÖSTER"`i ekranda
  `"40413 SHOW PRODUCTS"` yapıyordu. Sıra iki dilde farklıysa kalıbın tamamı tek anahtar
  olmalı ve sayı `{n}` ile yerine konmalı (`"{n} ÜRÜNÜ GÖSTER"` → `"SHOW {n} PRODUCTS"`).
- **TUZAK — sayı biçimi:** `toLocaleString("tr-TR")` her yerde sabitti; İngilizcede
  "2,681 pieces" ile "₺5.905" yan yana düşünce biri yanlış görünüyordu. `formatCount()`
  ve `formatPrice(..., locale)` dile bağlandı.
- `PageChrome` `"use client"` oldu (yalnız metin çeviriyor). `children` hâlâ sunucuda
  çiziliyor — bir istemci bileşenine prop olarak geçen sunucu düğümleri sunucuda kalır,
  yani marka sayfasının SEO'su etkilenmedi.
- **Çevrilmeyenler, bilerek:** marka/ürün adları, `<head>` metadata'sı (arama motoru
  çerezsiz gelir), yönetim konsolu (`/yonetim`, iki hesaba açık iç alet).

**3. Karşılama (misyon) modalı** — `IntroModal.tsx` + `components/intro.css`.
`altr-landing` projesinin kapı ekranından alındı, **davet kodu + bekleme listesi
katmanı çıkarıldı**, yerine TR/US bayraklı dil seçimi kondu. Kapı bir ENGELDİ, bu bir
KARŞILAMA: siteyi kilitlemiyor, cihaz başına bir kez açılıyor
(`localStorage.altr-giris`), alttaki okla geçiliyor. Bayrağa basmak **kapatmaz** —
kullanıcı İngilizceye geçip metni okuyabilsin. Bayraklar gömülü SVG
(`components/flags.tsx`): emoji bayrağı Windows'ta çizilmiyor, "TR"/"US" harflerine
düşüyordu. Modal kataloğa dokunmuyor.

**4. Sol menüde MİSYON girişi** (MARKALAR'ın üstünde, aynı biçimde) modalı her zaman
açıyor. **Yan bulgu — MOBİLDE MEVCUT BİR ÇAKIŞMA:** `.side-vitrin` kutularının HEPSİ
`grid-column:3; grid-row:1`e yerleşiyordu, yani MARKALAR ile VİTRİNİM zaten üst üste
biniyordu (üçüncüsü daha da kötüleştirecekti). Üç kapı tek bir `.side-nav`
sarmalayıcısına alındı; hücreye artık tek öğe giriyor, içindekiler yan yana diziliyor.
375px'te ölçüldü: şerit sidebar'ın sağ kenarını 17px taşıyordu, mobil punto 14→12px ve
harf aralığı .14→.06em'e indirilince iki dilde de taşma kalmadı.

**5. Dil anahtarı sitenin içinde de var** — `LangToggle.tsx`, sol menüde tema
anahtarının hemen altında (mobilde tema anahtarıyla birlikte üst şeritte).

**Doğrulandı** (3006'da, gerçek katalogla): `npm run typecheck` temiz · modal ilk
ziyarette açılıyor, ENGLISH metni anında çeviriyor (73.178 → 73,178), ok basınca
kapanıyor ve `altr-giris=1` yazılıyor, yenilemede bir daha çıkmıyor · MİSYON yeniden
açıyor · sol menü / çipler / filtre / ürün modalı / `/markalar` / `/void` İngilizce ·
TR'ye dönünce hepsi Türkçe · hidrasyon uyarısı yok · 375px'te yatay taşma yok.

**Açık:** `src/components/FeedbackPanel.tsx` ve `StatsPanel.tsx` artık hiçbir yerden
import edilmiyor (işlevleri yönetim konsoluna taşınmıştı) — ölü dosya, silinebilir.

---

## 2026-07-30 (dördüncü tur) — P0 bug, performans, estetik sıralama, veri temizliği, yönetim konsolu

**1. ⚠ BOŞ VİTRİN BUG'I ÇÖZÜLDÜ (P0).** `lib/aggregate.ts` şunu yazıyordu:
`memo = snap?.length ? snap : []` ve ardından `if (memo) return memo`. **Boş dizi
JavaScript'te truthy**, yani katalog okuması BİR KEZ başarısız olduğunda (`readCatalog`
her hatayı yutup `undefined` dönüyordu) `memo` kalıcı olarak `[]`e kilitleniyordu.
Sonuç: sunucu ayakta ama her istek 0 ürün — vitrin "filtreden dolayı ürün yok" gibi
görünüyor, yeniden başlatmadan düzelmiyor. Artık boş sonuç ÖNBELLEKLENMİYOR, sebep
günlüğe düşüyor ve aynı anda gelen istekler tek bir okumayı paylaşıyor (`inflight`).

**2. PERFORMANS — ölçülen kazanç (73.178 ürünlük katalog):**
| istek | önce | sonra |
|---|---|---|
| ana sayfa | 118 ms | **3 ms** |
| sayfa 50 | 123 ms | **4 ms** |
| arama "siyah" | **2.678 ms** | **30 ms** |
| kategori | 37 ms | 11 ms |
Üç ayrı sebep vardı:
- **Arama**: `relevance()` sort KARŞILAŞTIRICISININ İÇİNDE çağrılıyordu ve her çağrıda
  `searchFold(name/brand)` (NFKD normalize + harf haritası) yeniden çalışıyordu —
  20 bin sonuçta ~280 bin katlama. Artık skor ürün başına bir kez (süsle-sırala-soy).
- **Sıralama önbelleği** (`query.ts` `orderCache`, 8 girdilik LRU): aynı tohum+filtre
  için dokuma her istekte yeniden yapılıyordu. Anahtar sayfayı içermez → sayfalama bedava.
- **`WEAVE_LIMIT` kuralı kodda tutulmuyordu**: dokuma sınırı `page * 40 + 200` ile
  istenen sayfadan türüyordu, yani sayfa 13'e tıklayarak gitmek ile doğrudan sayfa
  50'ye gitmek aynı indekste FARKLI ürün veriyordu (kullanıcıda "ürünler tekrar
  ediyor/kayboluyor"). Sabit sınıra alındı.

**3. VERİ TEMİZLİĞİ — ölçülüp düzeltildi, katalog yeniden import edildi.**
- **66.026 sahte beden jetonu → 0.** Kaynak sitelerin bir kısmında ADET SEÇİCİ
  (1,2,3…10) beden diye çekiliyordu; takıların %58'i, cüzdanların %77'si "7 beden"
  taşıyordu. `sizes.ts` → `MIN_NUMERIC_SIZE = 16` (jean beli 24'ten, kadın konfeksiyonu
  34'ten, ayakkabı 35'ten başlar). Ayrıca "tanınmadıysa koru" yolu çıplak sayıyı
  geçiriyordu, o kapı da kapatıldı.
- **`SIZELESS_CATS`** (takı/gözlük/saat/cüzdan/aksesuar): beden alanı tamamen boşaltılır.
  ŞAPKA, KEMER, ÇORAP bilerek DIŞARIDA — onlarda beden gerçek (kemerlerin 212'si S).
- **Ayakkabı sızıntısı kapatıldı.** "Nike Air Force 1", "SB Dunk Low", "Adidas Samba OG"
  gibi adlar jenerik ayakkabı sözcüğü içermediği için DİĞER'e düşüyor, arşiv
  filtresinden kaçıyordu: **36 ürün, 8 marka**. `categorize.ts` → `looksLikeSneaker()`,
  YALNIZ hâlâ DİĞER olan üründe çalışır (yoksa "Air Force Nakışlı Şapka" ayakkabı olur).
  **"jordan" tek başına listede YOK** — katalogda 36 tişört, 29 şort, 10 hoodie adında
  geçiyor (NBA lisanslı giyim); yalnız model numarasıyla sayılır.
  Arşiv AYAKKABI 803 → **839**.
- Beden JETONLARI slug'lanmıyor, sebebi `query.ts`te yazılı ("135/54", "39,5", "4'LU SET").

**4. ANA SAYFA GİYİM VİTRİNİ OLDU.** `types.ts` → `FEED_EXCLUDED_CATS`: aksesuar ailesi
+ DİĞER ana akıştan çıktı (56.445 → **40.413 ürün**). Silme değil KAPSAM: sol menüden,
aramadan ve marka sayfalarından erişilebilir. **Aramada kapsam açılır** — "kolye" yazan
kolyeyi bulmalı (`catMatch(p, cat, feedScope)`, `feedScope = !q`).

**5. KATEGORİ DENGESİ.** `catRun` yalnız ARKA ARKAYA geleni engelliyordu; "tişört,
hoodie, tişört, hoodie…" kuralı bozmuyor ama vitrin iki kategoriden ibaret görünüyordu
(katalogda 14.166 tişörte karşılık 970 triko var). Marka yorgunluğunun kategori
karşılığı eklendi: `catFatigue = 0.82`.
**Ölçüm: ilk 40'ta 19–20 farklı kategori, hiçbiri 3'ten fazla değil.**

**6. ESTETİK PUANLAMA — `aestheticScore()` (0–1).** Üç sinyal: desen/grafik dili
(`styles` alanı zaten taşıyor), renk kararlılığı (kromatik aile sayısı; etiketi olmayan
ürün CEZA alır çünkü fotoğrafı okunamamış demektir), fotoğraf yatırımı. Bilerek dışarıda:
fiyat (pahalı ≠ çekici), marka puanı (ayrı terim; buraya karışırsa underdog çöker).
`baseScore`ta ağırlık **0.22** — marka payının (0.55) yarısından az, kürasyon omurga kalır.
- **`underdogBonus`**: marka bandı 0.15–0.65 (yani "az bilinen"), estetik ≥0.62,
  tohum kapısı %12. `spotlightBonus`tan farkı: o VERİ bütünlüğüne bakar, bu GÖRSEL iddiaya.
- **`scarcityPenalty`**: 1 beden kaldıysa −0.18, 2 bedense −0.06. Bedeni hiç olmayan
  ürün cezalandırılmaz (takıda beden yokluğu bir eksiklik değil).
**Ölçüm, ilk 200 / katalog:** estetik 0.69/0.60 · görsel 8.86/5.61 · beden 4.71/4.47 ·
marka puanı 3.00/2.86 · **tek bedenli ürün 0** (katalogda %4).

**7. GÖRSEL KALİTESİ.** İki ayrı hata:
- Kart `imgW: 520` istiyordu, merdiven (`STEPS`) 520'nin ALTINDAKİ basamakları kuruyor,
  yani en büyük seçenek **480px** oluyordu. Kart masaüstünde 330px ve retinada 660px'lik
  veri istiyor → tarayıcı 480'i büyütüyordu. **Vitrin 2x ekranların tamamında sistematik
  olarak yumuşaktı.** Tavanlar "CSS genişliği × 2"nin üstüne çekildi (ızgara 720).
- webp kalitesi 78 → **86** (düz kumaş yüzeylerinde bantlaşma görünüyordu).
- **Negatif önbellek** (`img-cache.ts`): ölü URL'ler artık hatırlanıyor. Öncesinde her
  sayfa açılışında yeniden deneniyor ve 5 sn'lik timeout boyunca 8 upstream slotundan
  birini tutuyordu — **ölü görselli bir marka, sayfadaki sağlam görselleri de
  bekletiyordu.** Ayrıca bu kayıt sıralamaya besleniyor: tüm görselleri ölü bilinen ürün
  akışın SONUNA gider. Katalogda görselsiz ürün YOK (0/73.178), yani boş kartların
  tamamı bu durum. Bilgi zamanla birikir (hiç istenmemiş görsel "sağlam" sayılır) — bu
  kabul edilebilir, çünkü düzeltilmesi gereken yer kullanıcının GÖRDÜĞÜ yer.

**8. Y2K TARZI EKLENDİ.** `brand-styles.ts` → 8. tarz. Ürün kuralı iki kademeli
(`product-styles.ts`): güçlü jetonlar (rhinestone, baggy, kelebek, holografik, velour…)
tek başına yeter; zayıf jetonlar ("crop", "mini", "cargo" — 2020'lerin de kesimi)
ancak İKİSİ BİRDEN geçerse sayılır. Katalogda **9.031 ürün**. Markalar TAHMİNLE değil
ÖLÇÜMLE etiketlendi: ürünlerinin ≥%30'u y2k çıkan 13 marka (cherry-kitten %92,
fleak %91, zeph-culture %49…).

**9. VARSAYILAN RENK = EN ÇOK BEDENİ OLAN STOKTAKİ VARYANT.** "İlk stoktaki" yetmiyordu:
renk sırası markanın kendi sırası ve anlamsız; yalnız "XS" kalmış bir renk açılışta
seçilince ürün tükenmiş gibi duruyordu. `displayPrice` de AYNI varyantı seçmek zorunda,
o da güncellendi (yoksa kartta yazan fiyatla seçili renk çelişir).

**10. KART LOGOLARI HİZALANDI + OKUNMAYAN WORDMARK'LARA AD YAZILIYOR.**
- Kart artık ızgara hücresini dolduran bir sütun (`height:100%`) ve logo bloğu
  `margin-top:auto` ile dibe yaslanıyor. Öncesinde ürün adı 1 ya da 2 satır, puan satırı
  var ya da yok olduğu için logolar zikzak çiziyordu.
  **Doğrulandı: aynı satırdaki 4 kartın logo bloğu aynı Y koordinatında (913/913/913/913).**
- `BrandLogo` → **`LEGIBLE_RATIO = 0.82`**. "Bu logo yazı mı sembol mü" kararı elle
  (`data/brand-logo-kind.json`, 157 logonun 97'si) ya da en/boy oranıyla veriliyordu;
  ikisi de logonun TÜRÜNÜ bulabiliyor ama ÇİZİLDİĞİ ÖLÇÜYÜ hesaba katmıyordu. Çok geniş
  bir wordmark genişlik tavanına çarpınca oranı korumak için alçalıyor ve okunmayan ince
  bir şerit kalıyor. Ölçüldü (kart: h=13, maxW=104): `soon-to-be-announced` 6.7px,
  `point-2124` 7.6px, `abluka` 8.4px, `saintora-atelier` 8.6px, `hype-of-steps` ve
  `junior-crime` 9.8px. Bu altı marka "yazı" sayıldığı için adları HİÇ yazılmıyordu.
  Kural türden bağımsız çalışır: çizim yüksekliği istenenin %82'sinin altına düşerse ad
  da yazılır. **Adı yazılan marka 41 → 47.**

**11. YÖNETİM KONSOLU AYRI BİR YOLDA: `/yonetim`.** Vitrinin `View` tipinden
"istatistik"/"geribildirim" KALDIRILDI; `StatsPanel`/`FeedbackPanel` artık vitrinde
çizilmiyor. Konsol kendi kabuğunu kuruyor (dev-tools referansı: monospace, dar satır,
sol sekme sütunu, liste/detay bölmesi, kendi paleti — vitrinin tema değişkenlerini
kullanmıyor). Üç sekme: **KUTU** (gelen kutusu + ekler), **ÖLÇÜM** (`/api/stats`),
**TEŞHİS** (`/api/teshis` — hangi katalog yüklü, kaç ürün, ölü görsel sayısı, heap;
"0 ürün + ayakta sunucu" satırı 1 numaralı bug'ın teşhisi için).
Admin olmayan **404** görür (`/yonetim`, `/api/teshis`, `/api/feedback/dosya` — doğrulandı).

**12. BİZE ULAŞIN.** MARKA ÖNER'deki "NEDEN? (opsiyonel)" alanı kaldırıldı (marka adı +
link zaten yeterli bir öneri). GERİ BİLDİRİM'e **dosya eki** geldi: fotoğraf/video/PDF,
4 dosya × 10 MB. "opsiyonel" artık ayrı RENKTE bir rozet (`--grn`) — hangi alanı boş
bırakabileceğin tek bakışta görünüyor.
Güvenlik (`lib/feedback-files.ts`): tür İZİN LİSTESİNDEN, **SVG bilerek yok** (script
çalıştırabilir); diskteki ad rastgele üretilir, kullanıcının adı yola HİÇ girmez; okuma
ucu admine özel ve istenen dosya önce O KAYDIN ek listesinde aranır; görsel olmayanlar
`Content-Disposition: attachment` + `nosniff` + `CSP: sandbox` ile döner.
**Uçtan uca doğrulandı**: PNG kaydedildi, `text/html` dosyası reddedildi.

**13. Küçük düzeltmeler.** Ürün modalindeki başlıktan `.glitch-head` (±2px iki renkli
text-shadow) ve Anton KALDIRILDI → Space Mono 27px; ürün adları uzun ve karışık, ağır
bir display fontta okunmuyordu. "↻ YENİLE" metni yerine küçük restart SVG'si (metin
hâli bir SIRALAMA SEÇENEĞİ gibi okunuyordu).

**14. `npm run check` zinciri artık uçtan uca geçiyor.** `check-cat-groups` denetimi
geçtiği hâlde süreç çıkışta çöküyordu: `console.log` hemen ardından `process.exit()`,
Windows'ta stdout bir pipe'a bağlıyken libuv assertion'ı veriyor
(`!(handle->flags & UV_HANDLE_CLOSING)`). Dört betikte son satır `process.exitCode`e
çevrildi.

**Yeni sayılar (2026-07-30 dördüncü import):** 73.178 ürün · stokta 56.413 · 163 marka ·
fiyatlı 73.124 · bedenli 55.228 · arşiv 1.508 (AYAKKABI 839 + ÇOCUK 669) ·
ana sayfa kapsamı 40.413.

---

## 2026-07-30 (üçüncü tur) — TAM KATALOG canlıya, keşfet tazeleme, temiz adresler

**1. VİTRİN ARTIK TAM KATALOĞU SERVİS EDİYOR: 2.160 → 73.214 ürün** (stokta 56.445,
163 marka). Sorun kodda değildi: `.data/catalog.json` hâlâ `make-sample` çıktısıydı,
yani vitrin aylardır HAFİF ÖRNEĞİ gösteriyordu.
- `src/lib/cache.ts` → `catalogPath()` artık **`ALTR_CATALOG`** okuyor (mutlak ya da
  proje köküne görece). `.env.local`de `.data/catalog.new-full.json` yazılı.
- Dosya ÜZERİNE KOPYALAMA yöntemi bırakıldı: hangi katalogun canlı olduğu adından
  anlaşılmıyordu ve `make-sample --uygula` gerçek katalogu sessizce eziyordu.
- Hafif örneğe dönmek: `npm run dev:hafif` (ya da `.env.local`de yolu değiştir).
- `check-discovery` de aynı env'i okuyor — denetim, servis edilen katalogu ölçmeli.
  Not: npm script'leri `.env.local` YÜKLEMEZ, tam katalogu ölçmek için
  `ALTR_CATALOG=… npm run check-discovery` gerekiyor.
- Ölçülen bellek: sunucu süreci **1.551 MB** working set, boş RAM 3 GB'ta stabil.

**2. `scripts/next-with-heap.mjs`** — `dev`/`build`/`start` artık bundan geçiyor.
İki gerçek sebep: (a) Node'un varsayılan heap tavanı MAKİNEYE göre değişiyor
(bu makinede 4288 MB, 8 GB'lık bir sunucuda ~2 GB), (b) `next dev` asıl sunucuyu ayrı
bir alt süreçte açıyor ve **argv'deki `--max-old-space-size` o çocuğa geçmiyor**
(ölçüldü: çocukta `NODE_OPTIONS` boş) — env değişkeni geçiyor.
**Bu, eski `next dev` OOM'larının çözümü DEĞİL**: onlar heap tavanına dayanmaktan
değil, boş sistem RAM'i 1,5 GB'a inmesinden oluyordu. Dosyanın işi taşınabilirlik.

**3. KEŞFETİ YENİLE + marka rotasyonu.** Tohum 3 saatlik pencereye bağlı olduğu için
sayfayı yenilemek vitrini DEĞİŞTİRMİYORDU. İki ekleme:
- `discovery.ts` → `manualSeed()` ve store'da `reshuffleFeed()`; düğme ızgara
  başlığında (`↻ YENİLE`, yalnız keşfet sıralamasındayken çizilir). Filtreleri korur,
  geçmişe adım eklemez.
- `BRAND_ROTATION = 0.16` — marka puanı tohuma göre ±0.16 kayıyor, yani bir markanın
  BÜTÜN ürünleri birlikte hareket ediyor. Asıl düzeltme bu: gürültü ürün id'sine bağlı
  olduğu için tazeleme eskiden aynı markaların farklı ürünlerini getiriyordu.
  Ölçüm (tam katalog): iki tohumun ilk 40'ı **0/40 ürün**, 19/40 marka paylaşıyor.
- Marka ÇİPLERİ de aynı rotasyonu izliyor (`BrandChips`): kapalı şeritteki 16 marka
  eskiden hep aynı 16'ydı ve "aynı feed" hissini tek başına ayakta tutuyordu.

**4. ÖNE ÇIKAN ÜRÜN PRİMİ** (`spotlightBonus`, `SPOTLIGHT_SHARE = 0.18`). Orta bantta
(0.25 ≤ puan < 0.80) yer alan markanın kalitesi ≥0.80 olan ürünü, her tohumda ~%18
kapısıyla +0.14/+0.20 prim alıyor. `productQuality` içine gömülmedi — bilerek ÜSTTEN
eklenen bir terim (bkz. TUZAKLAR, sinyalin gürültü altında kalması).
**Ölçülen takas, tam katalog ilk 200:**
| ölçü | prim kapalı | prim açık |
|---|---|---|
| marka puanı kaldıracı | 1.071 | 1.060 |
| beden çeşitliliği oranı | 1.201 | 1.145 |
Yani orta markalar öne çıktıkça `sizeBonus`la aynı yeri paylaşıyor ve iki ölçü de bir
tık düşüyor. Kullanıcı tarafında görünmüyor (ilk sayfa hâlâ ürün başına ~5 beden).
`check-discovery` eşikleri buna göre güncellendi: `MIN_SIZE_RATIO` 1.15 → **1.12**,
yeni `MIN_BRAND_LIFT` **1.02**, yeni tazeleme eşiği `MAX_OVERLAP` **12**.

**⚠ Bu turun en önemli bulgusu:** `data/brand-scores.json` ÇOK YAYVAN — 163 markanın
**111'i 3–3.5 bandında**, 4'ün üstünde yalnız **3 marka** var. "Ünlülerin kendi arasında
sıralanması" isteniyorsa asıl iş algoritmada değil BU DOSYADA: rotasyon ve prim
çalışıyor ama ayırt edecekleri bir puan farkı yok. Açık iş 3b artık P1.

**5. ADRESLER TEMİZLENDİ.** Eskiden her tıklama
`/?cat=T%C3%9CM+%C3%9CR%C3%9CNLER&brand=OATH+ISTANBUL&price=2&page=1` üretiyordu.
Artık `/?kategori=tisort&marka=oath-istanbul&fiyat=2k-4k&sayfa=3`; filtresiz ana sayfa
çıplak `/`. Üç kural `query.ts`te yazılı: varsayılan yazılmaz, değerler slug,
**eski linkler okunmaya devam eder** (`cat`/`brand`/`q`/`price`/`size`/`sort`/`dir`/
`tukenmis`/`page` + tam kategori/marka adı). Doğrulandı: 12 yeni/eski biçim çifti aynı
`matched` ve `activeLabel`ı veriyor.
- `sirala=fiyat` tek başına "artan"; azalan için `yon=azalan`. `tukenmis=1` → `stok=tumu`.
- Beden jetonları slug'LANMIYOR: katalogda `135/54`, `39,5`, `4'LU SET` gibi jetonlar var
  ve slug bunları geri çevrilemez hâle getiriyor.
- `query.ts` marka slug'ını `brand-names.json`dan kendi kuruyor; `lib/brands.ts` import
  EDİLMEDİ çünkü o dosya `data/`den import attribute'suz JSON çekiyor ve bu modülü Node
  ile doğrudan çalıştıran script'leri (import-catalog) kırardı.

**6. `.claude/launch.json` (Documents kökündeki) temizlendi**: 3001/3002/3003/3004/3005
için birikmiş 6 yapılandırma ve arşiv sürümleri kaldırıldı; `altr` (3005) + `kesisim`
(8765) kaldı.

---

## 2026-07-30 (ikinci tur) — iletişim, admin hesapları, hesap senkronu, filtre/renk/arama

**1. BİZE ULAŞIN.** Sağ altta sabit düğme (`ContactButton`, z-index 50 — Toast'ın ve
panellerin altında, mobilde vitrin hatırlatıcısının üstüne çıkar) → tek ekranlı modal
(`ContactModal`). Adım adım akış BİLEREK yapılmadı: her adım bir vazgeçme fırsatı, buraya
basan kişinin zaten söyleyecek bir şeyi var. Dört konu üstte çip satırı, varsayılan
**MARKA ÖNER**; altındaki açıklama ve alanlar konuya göre değişiyor. `marka-kaldir`de
e-posta ZORUNLU (talebi doğrulamadan marka kaldırılamaz), `marka-oner`de marka adı tek
başına yeterli.
Depo `lib/feedback.ts` (reviews.ts kalıbı), uç `/api/feedback`:
POST herkese açık + **IP başına 60 sn** hız sınırı + honeypot; GET/PATCH/DELETE admine
özel (404 ile gizli). Admin görünümü üst şeritteki **KUTU** sekmesi (`FeedbackPanel`) —
konu filtresi, okunmamış sayacı, `mailto:` linki, okundu/sil.

**2. `requireAdmin` tek yere alındı** (`lib/api-auth.ts`). Blok `stats` ve `outbound`'da
kopyaydı, `feedback` üçüncüsü olacaktı. `requireUser` de burada (401, çünkü o ucun
varlığı gizli değil).

**3. PAROLALI YÖNETİM HESAPLARI — `guap` ve `maveth`.** Giriş kutusuna `@` İÇERMEYEN bir
değer yazılırsa kod adımı yerine **parola** adımı açılıyor. Arayüze hiçbir düğme
eklenmedi: normal kullanıcı her zaman e-posta yazar, onun ekranı birebir aynı.
Yapılandırma `.env.local` → `ADMIN_ACCOUNTS=<handle>:<eposta>:scrypt.<tuz>.<özet>`,
üretimi `npm run admin-hash -- <handle> <eposta> <parola>`.
- **Ayraç `.`, `$` DEĞİL**: Next'in env yükleyicisi `$...` parçasını değişken sanıp
  siliyor; `scrypt$a$b` sessizce `scrypt`e dönüşüyor ve doğru parola bile 401 alıyordu.
- Handle başına **10 dakikada 5 deneme**, sonra 15 dk kilit (429). Var olmayan handle da
  geçersiz parolayla AYNI cevabı alır (varlık sızmaz), scrypt kukla tuzla yine çalışır.
- `ADMIN_ACCOUNTS`taki adresler ayrıca `ADMIN_EMAILS`e yazılmak zorunda değil.

**4. HESAP SENKRONU — listeler + tercihler.** `lib/user-data.ts` (`.data/auth/user-data.json`)
+ `/api/me/data` (GET/PUT) + `lib/sync.ts`. Giriş anında cihaz ↔ hesap **BİRLEŞTİRİLİR**
(id eşleşirse ürünler union, id farklı ama AD aynıysa yine birleşir), sonra sunucu kaynak
olur; `commitLists` ve tercih setter'ları 1500 ms geciktirmeli push yapar. Çakışmada PUT
409 döner, istemci birleştirip bir kez daha dener.
- **`altr-sync-owner` şart**: onsuz guap'ın listesi, aynı tarayıcıdan giren maveth'in
  hesabına birleşiyordu. Cihaz verisi başka bir hesaba aitse birleştirme YAPILMAZ,
  hesabın kendi verisi gelir. Sahipsiz veri (hiç giriş yapılmamış cihaz) birleşir —
  giriş yapmadan kurulan liste kaybolmasın.
- Çıkış yapmak cihazdaki kopyayı SİLMEZ.

**5. FİLTRE PANELİ yeniden düzenlendi.**
- **Aktif filtre özeti** en üstte: her seçim tek tıkla kaldırılabilir çip. Panel 400px ve
  sekiz bölüm; kullanıcı seçtiğini görmek için kaydırmak zorunda kalıyordu.
- **Bölümler katlanabilir** (`altr-fp-open`). Açık: kategori/tarz/kim/renk/beden.
- **Beden ÇOKLU** oldu (`QueryParams.size: string` → `sizes: string[]`, "veya").
- **Numaralar BANT** (`sizes.ts NUM_BANDS`: ≤24 / 26–30 / 32–36 / 38–42 / 44–48 / 50+).
  Bant tıklanınca sorguya bandın KAPSADIĞI GERÇEK jetonlar yazılır — `runQuery` bantları
  hiç bilmez, tam eşleşme korunur. Yarı seçili bant kesikli çerçeveyle çizilir ve
  tıklanınca TAMAMLAR (kaldırmaz). "tek tek seç" ile tam numara hâlâ seçilebiliyor.
- **W/L jean bedenleri artık çiziliyor** (bel ölçüsüne göre bantlanmış); eski gruplama
  yalnız alpha/num/one çektiği için sessizce düşüyorlardı.
- Adetler tooltip'te değil çipin içinde; alt eylem şeridi sticky.

**6. RENK ETİKETİ + RENK FİLTRESİ.** `lib/color-tags.ts` (15 aile) + `npm run tag-colors`
→ `data/color-tags.json` → `import-catalog` bunu okuyup `Product.colorTags`a yazar.
Filtre **VE** ile birleşir: iki renk seçilince ikisini birden içeren ürünler gelir
(`renk=siyah,beyaz`). Etiketi olmayan ürün renk filtresi açıkken hiç görünmez —
uydurma bir aileye atmaktansa listelememek doğru.
Yöntem HİBRİT ve sırası önemli:
1. **Renk ADI** sözlükte tanınıyorsa görsel hiç indirilmez (fotoğrafın arka planı, ışığı,
   modelin teni yanıltmaz). Adların yarısından azı tanınıyorsa sözlüğe güvenilmez.
2. **GÖRSEL**: sharp ile 64×64, kenar çerçevesinden arka plan tahmini + ten tonu elemesi
   + merkez %12–88 penceresi, pay ≥ %12 olan aileler (en fazla 3).
- **Nötrler TEK kovada toplanır** (siyah/beyaz/gri/bej): aynı beyaz kumaşın ışıklı yeri
  "beyaz", gölgesi "gri", sarımsı ışığı "bej" okunuyor ve üçe bölününce hiçbiri eşiği
  geçemiyordu.
- **Doygunluğu %20'nin altındaki piksel gri eksenine indirilir**: beyaz tişörtün mavimsi
  gölgesi "mavi" etiketi kazandırıyordu.
- **"çok renkli" yalnız KROMATİK aileler sayılarak** belirlenir; nötrler sayılınca düz
  beyaz bir tişört bile çok renkli çıkıyordu (ölçüm: 17/120 → 1/120).
Denetim: `npm run check-colors` (kapsama, tek renk baskınlığı, çok-renkli oranı,
taksonomi dışı etiket; `--ornek` ile gözle denetim listesi).

**7. ARAMA yeniden yazıldı** (`lib/search-index.ts` + `lib/search-synonyms.ts`).
Eski hâli tek satırlık `name.toLowerCase().includes(q)` idi.
- **TR katlama** (`searchFold`): "istanbul" → Oath Istanbul, "kostebek" → Köstebek.
  Yazılmıştı ama yalnız filtredeki marka kutusunda kullanılıyordu.
- **Jetonlama + VE**: "siyah tişört" artık çalışıyor (eskiden 0 sonuç).
- **Eşanlamlı sözlüğü**: tshirt/tişört, sweat/sweatshirt, kapşonlu/hoodie, esofman,
  kot/jean/denim… Genişletme YALNIZ EKLER, hiçbir zaman daraltmaz.
- **Aranabilir metin** ad + marka + kategori + tarz + renk aileleri + varyant renk adları;
  ürün başına bir kez katlanıp modül içi haritada tutulur (kataloga YAZILMAZ, dosya %12
  büyürdü). `clearAggregateMemo` bu indeksi de temizler.
- **ALAKA sıralaması**: sorgu doluyken keşfet dokuması yerine alaka skoru
  (marka tam eşleşme > ad kelime başı > marka kelime başı > gövde), eşitlikte `baseScore`.
  Eşanlamlı üzerinden gelen eşleşme 0.6 ile ağırlıklandırılır.
- **Öneri açılırı**: yazarken marka/kategori adayları; tıklanınca arama metni değil
  doğrudan FİLTRE uygulanır ve metin temizlenir.
- Boş sonuçta "ARAMAYI BIRAK" ve "HEPSİNİ SIFIRLA" ayrı ayrı sunulur.

**8. Bedeni bol ürün keşfette öne alındı.** `productQuality`deki düz `if (p.sizes.length)`
kademeli hâle geldi, ama asıl etki `baseScore`a eklenen ayrı **`sizeBonus`**tan geliyor.
**DERS:** `productQuality` yedi sinyali 0–1'e sıkıştırıp `baseScore` onu 0.37 ile
çarpıyor; oradaki bir kademe skora en fazla ~0.06 katıyor, keşfet gürültüsü ise 0.30.
İçeride ağırlık artırmak ölçüyü 1.13'ten ancak 1.14'e taşıdı; bonus üstten eklenince
**1.27** oldu (`npm run check-discovery`: ilk 200 ürünün beden ortalaması / katalog
ortalaması). Görsel ağırlığı 0.30→0.26'ya çekildi çünkü toplam `Math.min(1, q)` tavanına
dayanıp yeni sinyali köreltiyordu.

**9. Renk noktaları büyütüldü**: kartta 11–17 → **14–20** (sık/ızgara/liste/iri),
modalda 22 → 26, vitrinde 14 → 16. Çerçeve `.55` → `.75` + içeriden `inset` kontur —
beyaz nokta açık temada, siyah nokta koyu temada zemine karışıyordu.

**10. `NEXT_DIST_DIR`** (`next.config.ts`). Aynı klasörde iki dev server aynı anda
çalışınca ikisi de `.next`e yazıp birbirinin derlenmiş route dosyasını siliyor; uçlar
rastgele 404/500 dönmeye başlıyor ve sebep kodda aranıyor. İkinci sunucuyu
`NEXT_DIST_DIR=.next-3005` ile başlat.

---

## 2026-07-30 — marka sekmeleri, yorumlar, kart düzeni

**1. Selsil tamamen silindi.** Giyim markası değildi (silikon/yapıştırıcı üreticisi,
bkz. `data/brands-archived.json`); zaten vitrine çıkmıyordu ama kayıtlarda duruyordu.
Silinenler: `brand-names.json`, `brands.generated.ts`, `brand-logos.generated.ts`,
`brands.csv`, `new-brands.json`, `brand-logo-kind.json`, `brand-logos.meta.json`,
`public/brand-logos/selsil.webp`, `.data/full/selsil.json` ve
`.data/catalog.archived.json`'daki **131 ürün** (1.584 → 1.453). `brands-archived.json`
girdisi BİLEREK duruyor: "bir daha ekleme" notu orası.

**2. MARKALAR artık sayfa değil SEKME.** Sol menüdeki/üst bardaki MARKALAR ve rehberdeki
marka kartları sayfa yüklemiyor; `view: "markalar" | "marka"` ile kategori değiştirir
gibi geçiliyor (`store.ts`). `/markalar` ve `/<slug>` yolları **duruyor** (SEO, paylaşım,
dışarıdan gelen ziyaretçi) — ekranların kendisi ortak bileşenlerde:
`BrandIndex.tsx` / `BrandPage.tsx`. Sayfalar handler VERMEZ (her şey gerçek `<a>`),
sekmeler verir. `href` her iki durumda da gerçek: orta tık ve "yeni sekmede aç" çalışır.
Sekmenin verisi `/api/marka` (`?slug=&sayfa=`), modül seviyesinde önbellekli.

**3. Mağazaya çıkış tek kapıdan.** Kaydırma ritüeli `GoModal.tsx`'e çıkarıldı; hem
vitrindeki `BrandModal` hem marka sayfasındaki `StoreGate` (MAĞAZAYA GİT) onu kullanıyor.
Eskiden marka sayfasındaki düğme düz `<a target="_blank">` idi, ritüelsiz açıyordu.
Hedef her iki yolda da yeni sekmede açılır.

**4. Yorum + puan.** `lib/reviews.ts` (sunucu, `.data/reviews.json`) +
`/api/reviews` + `lib/reviews-client.ts` + `Reviews.tsx` (ürün modalinin altı) +
`Stars.tsx`. Kişi başı TEK yorum (ikinci gönderim öncekini günceller — yoksa ortalama
tekrar oy vererek şişerdi). Kimlik: oturum varsa `user:<id>` ve nick hesaptan
(istemcinin gönderdiği ad YOK SAYILIR), yoksa cihaz anahtarı + nick (listelerdeki
yöntem). Kart yıldızları **toplu** çekiliyor (`?ids=`, 40 kart = 1 istek).

**5. Kart düzeni: fotoğraf öne, yazı geriye.** Görsel oranı 1:1 → **4/5** (aynı sütunda
görsel alanı ~%25 büyüdü), ad 18 → 13px, fiyat 15 → 13,5px. Karttaki marka logosu artık
**tıklanmıyor** (kartta iki farklı hedef kafa karıştırıyordu) ve `BrandLogo fixedH` ile
**her kartta aynı dikey ölçüde**: varsayılan alan-normalizasyonu logoları farklı
yüksekliklerde çiziyordu.

**6. Dört gösterim biçimi** (`Layout`, tercih localStorage `altr-layout`):
SIK (6 sütun) · IZGARA (4, varsayılan) · İRİ (2) · LİSTE (tek sütun, yatay satır).
Ölçüler `ProductCard.tsx`'teki `SPEC`, sütun/boşluk `GridView.tsx`'teki `GRID`,
dar ekran karşılıkları `globals.css`'te `.grid-inner[data-layout=…]`.

**TUZAK (yaşandı):** istemci bileşeni `@/lib/brand-page`ten **değer** import edince
(`indexLetter`, `BRAND_PAGE_SIZE`) tüm katalog/`node:fs` zinciri tarayıcı paketine girip
derleme "node:fs/promises is not handled" ile patladı. `tsc` bunu YAKALAMAZ. Sınır artık
`lib/brand-page-shared.ts`: tipler + saf yardımcılar orada, `brand-page.ts` onları
yeniden dışa veriyor. Aynı sebeple `reviews-client.ts` `ReviewSummary`yi kendi tanımlıyor.

---

## 2026-07-29 (üçüncü tur) — FİYAT KAPSAMASI: %87,5 → %99,9

Son üç turun denetiminde raporlanmamış bir hata çıktı: **beş markanın fiyatı katalogda
tamamen boştu** (kostebek 9.274 · fo4rbs 2.099 · giesto 666 · matt-wear 350 ·
diddy-studios 203 = 12.626 ürün) ve punk-design'ın %78'i fiyatsızdı. Tarama günlüğünde
`fiyat 0` yazıyordu ama kimse dönüp bakmamıştı. Dört ayrı kök neden vardı.

**1. Ticimax fiyatı hiç okunmuyordu** (`jsonld.mjs` → yeni `ticimaxPrice`).
Bu mağazalar JSON-LD basmıyor — mattwear.com.tr'de `application/ld+json` bloğu **0**,
`product:price:amount` metası da yok. Adaptör yalnız JSON-LD teklifine bakıyordu.
Fiyat `productDetailModel`'de duruyor ve iki biçimde: `productPrice: 1317.27` KDV
**hariç**, `productPriceStr: 1449` vitrindeki hâli. Gösterim alanı önceleniyor
(`productPriceStr` → `productPriceKDVIncluded` → `product.indirimliFiyatiStr` → …).
Bu, önceki turun planındaki A4 maddesiydi: yazılmış, uygulanmamış.

**2. Shopify çeviri katmanı renk eşleşmesini kırıyordu** (`shopify.mjs`).
tr.punkdesign.shop `options[].values`'ı "SİYAH YEŞİL" diye çeviriyor ama varyantın
`option1`'i "BLACK-GREEN" kalıyor. Kod rengi `options.values`'tan alıp varyantları ona
göre süzdüğü için küme BOŞ kalıyor → fiyat da beden de yok oluyordu. Artık renk listesi
**varyantların kendi değerlerinden** türetiliyor, `options` yalnız hangi pozisyonun renk
olduğunu söylüyor. Ölçüm: punk-design 1.216 → **6.580 fiyatlı**, beden 941 → **5.472**.

**3. Küçülme koruması yalnız SAYIYA bakıyordu** (`run.mjs`).
Hız sınırı altında mağaza dolu sayıda ama fiyatsız gövde döndürüyor; sayı yerinde
olduğu için koruma devreye girmiyor ve iyi veriyi eziyordu. Kanıt: aynı adaptör giesto'da
bugün 255/255 fiyat çekiyor, 29 Temmuz taramasında 666 kayıt **0 fiyatla** gelip üzerine
yazmıştı. Artık fiyat ve beden **kapsaması** da korunuyor (`collapsed`), günlükte sebep
yazıyor: `[ÖNCEKİ VERİ KORUNDU (fiyat çöktü): …]`.

**4. Shopify geri çekilmesi tek denemeydi** — 12 sn bekleyip pes ediyordu. Basamaklı
oldu (12s → 45s → 120s). Ayrıca sayfa düzeyinde "kırpılmış gövde" yakalaması var:
1. sayfa fiyatlıyken sonraki sayfa 0 fiyatlıysa sayfa yeniden isteniyor, düzelmezse
tarama fiyatsız yazmak yerine YARIM KALDI diyerek çıkıyor.

### abluka çözüldü — not 6a artık geçersiz

Devir notu "sınırsız bellek birikimi, heap büyütme çözmüyor, **tekrar deneme**" diyordu.
Ölçüldü: 120 sayfa boyunca heap **13 MB'da düz**. Tam tarama sorunsuz bitti:
**2.789 kayıt · 2.789 fiyatlı · 2.743 bedenli** (öncesi 2.788, %82 bedenli, %0 fiyatlı).
Sızıntı `detach()` ile kapanmış olmalı. `--skip abluka` artık gereksiz.

### selsil kataloğa girmişti — marka arşivi ürün düzeyine indi

`selsil` giyim markası değil, **silikon/yapıştırıcı/epoksi üreticisi**; 131 ürünü
("Genel Amaçlı Silikon 280gr", "Ninja Süper Japon Yapıştırıcı", "Akvaryum Silikonu")
katalogda duruyordu, 130'u DİĞER'e düşüyordu. Delik şuydu: `brands-archived.json`
yalnız `src/lib/brands.ts`'te okunuyordu, yani markayı BRANDS listesinden eliyordu ama
ÜRÜNLERİNİ elemiyordu — arşivli markaların hiç ürünü olmadığı sürece fark edilmiyordu.
Artık `import-catalog.mjs` de okuyor, arşiv sebebi `MARKA`.

### Sayılar

| | önce | sonra |
|---|---|---|
| Ürün | 61.772 | **68.362** |
| Fiyatlı | ~%87,5 | **%99,9** (68.308) |
| Bedenli | %81,8 | **%88,2** (60.288) |
| Marka | 111 | 139 (167 dosya, arşivliler hariç) |
| Arşiv | 1.189 | 1.508 (ayakkabı 708 · çocuk 669 · marka 131) |

Canlı doğrulama, üç mağaza üç ayrı platform:
`kostebek/bordo-beli-lastikli-salas-uzun-etek` sitede ₺423,92 → katalogda 423,92 ·
`ablukaonline/erkek-slim-fit-...-hirka-bej-5126` 799,90 TL → 799,9 ·
`mattwear/black-boxy-fit-cut-off-sweatshirt` ₺624,00 → 624. `npm run check` (57 kategori
+ 53 beden + arşiv + tarz + cinsiyet + 24 fiyat biçimi) sıfır hatayla geçiyor.

### Hâlâ açık

- **6 Shopify mağazası bugün hiç veri vermedi** (after-6, emorpi, estatico-design,
  touz-moda, vamos-clo, zincir-wear): 217 sn boyunca basamaklı beklemeye rağmen 0 kayıt.
  Bugün üst üste denendikleri için IP bazlı bir soğutmada olabilirler. Dosyadaki eski
  verileri korundu, **kayıp yok** — bir gün sonra `npm run scrape -- --only <slug>`.
- **the-lucid-lab 17.831 → 732** geldi, önceki korundu. Aynı soğutma.
- forza-core %79,5 fiyatlı (78 ürün) — kalan tek kayda değer fiyat boşluğu.
- kostebek 9.000'lik `--cap` tavanına dayanmaya devam ediyor.

---

## 2026-07-29 (ikinci tur) — 56 yeni marka, Shopier adaptörü, marka sayfası, İÇ GİYİM

### 56 yeni marka (roster 111 → 167)

Kullanıcının verdiği 62 mağaza adresinin 6'sı zaten roster'daydı (Pretend It, Soonpiera,
Hotel 471, Point 2124, Modax Wear, From Cult). Kalan 56'sı eklendi. Platform dağılımı
ana sayfadan yoklanarak bulundu: **shopify 17 · ikas 16 · shopier 12 · jsonld 8 ·
woocommerce 3**. Marka eklemek beş dosyaya birden dokunuyor ve elle yapıldığında biri
hep unutuluyordu; artık `npm run add-brands` (`data/new-brands.json` okur) hepsini
tutarlı yazıyor: `brands.csv`, `brand-names.json`, `brands.generated.ts`,
`brand-styles.json`, `brand-scores.json`.

`Platform` union'ına `ikas` ve `shopier` eklendi (union'da yoktular; `brands.generated`
İkas markalarına "jsonld" yazmaya devam ediyordu — zararsız, çünkü platform her
çalıştırmada yeniden tespit ediliyor).

**Selsil kapsam dışı görünüyor**: selsil.com bir yapı kimyasalları mağazası (boya,
yapıştırıcı) — giyim değil. Listede olduğu için eklendi ama tarzı yok ve ürünlerinin
tamamı giyilemez filtresine takılıyor. `npm run check-brand-styles` bu yüzden "TARZI YOK
(1): selsil" diyor. Karar kullanıcıya bırakıldı: ya arşive (`data/brands-archived.json`)
ya da listeden çıkar.

### Shopier adaptörü (`scripts/scrape/adapters/shopier.mjs`)

Shopier mağazaları bir dönem "kendi katalogu yok" denip arşive alınmıştı
(fadeback-studio, manic-sellout). Yanlışmış — vitrinin kendi uç noktaları yeterli:

- **Liste**: `POST /s/api/v1/search_product/<mağaza>`, gövde
  `start=24&offset=<n>&filter=0&sort=0&…`. **Oturum çerezi + `csrf-token` şart**; ikisi
  olmadan **500** döner (403 değil, o yüzden "adaptör bozuk" gibi görünür). Token mağaza
  sayfasının `<meta name="csrf-token">` etiketinde.
- **Ürün**: sayfadaki satır içi `{"page":"product", …}` nesnesi — stok, fiyat ve
  `variations.variation_1[{name,stock}]` (beden başına gerçek stok).
- Görseller `cdn.shopier.app/pictures_large/…`, açıklama `og:description` (Shopier'de
  etiket yok, kategori/cinsiyet tespitinin tek ham sinyali bu).

**Hepsi TEK origin.** İki mağazayı paralel çekerken ürün başına 3 eşzamanlı istek binince
mağaza sayfaları 429 döndü ve o turda bütün Shopier markaları boş geldi. Adaptör içi
eşzamanlılık 2'ye indirildi; Shopier markaları `--concurrency 1` ile ayrı çekilmeli.

Doğrulama (zeph-culture): **233/233 üründe fiyat**, 5 görsel, TRY.

### Beden: denim bel/boy ("W30 L32")

Shopier'deki jean mağazaları bedeni böyle yazıyor. `looksLikeSizeValues` bunları beden
saymadığı için ürünün beden seçeneği hiç bulunamıyor, beden listesi TAMAMEN kayboluyordu.
`sizes.ts`'e kanonik `W30/L32` jetonu ve `wl` beden türü eklendi (baloncukta "30/32").

### Kategori doğruluğu — ölçülen kazanç

Katalog (61.772 ürün) üzerinde ölçüldü:

| düzeltme | etki |
|---|---|
| **"T - Shirt" (tire etrafında boşluk)** | **663 tişört** GÖMLEK kovasından çıktı |
| kaynağın etiket metni yalnız ad SUSTUĞUNDA okunuyor | 599 kayıt DİĞER'den kurtuldu |
| "külotlu çorap" ÇORAP | 22 |
| iç giyim sözcüğü baskı/detay olabilir (OUTER_OVERRIDE) | 15 |
| capri / postal / bilezik / hızma / earrings / patchler | ~70 |

**En büyük tuzak buydu:** bazı mağazalar adı "T - Shirt" diye yazıyor. `t-shirt` kuralı
tutmuyor, ad GÖMLEK kuralındaki `shirt`e düşüyordu. `haystacks()` artık tirenin
etrafındaki boşluğu silen bir kopya daha üretiyor.

**İki geri tepme ölçülüp geri alındı** (ikisi de "serbest arama" yüzünden):
`kemer` serbest arandığında "kemerli pantolon/etek" 33 ürünü KEMER yaptı; `patch`
serbest arandığında "Patchwork Jean", "Patchli T-Shirt" 38 ürünü AKSESUAR yaptı. İkisi
de sözcük sınırlı hâle getirildi. Ayrıca etiket metnine bakmadan önce giyilemez
koruması çalışıyor: "Fragonard Kanvas Tablo"nun etiketinde "Jean-Honoré" geçtiği için
tablo JEAN oluyordu, kupa/parfüm de AKSESUAR'a terfi edip filtreden kaçıyordu.

`npm run check-categorize` 39 → **57 vaka**.

### İÇ GİYİM kendi sekmesi

`CAT_GROUPS`'ta ALT GİYİM'in altındaydı, orada aranınca bulunmuyordu. Artık kendi
çatısı. Tek kalemli çatılar (İÇ GİYİM, DİĞER) sol menüde açılır kapanır başlık değil
DOĞRUDAN kategori kalemi olarak çiziliyor — "İÇ GİYİM"i açıp altında yine "İÇ GİYİM"
görmek anlamsızdı.

### Marka sayfası: "MAĞAZANIN SUNDUKLARI" + MARKALAR artık marka listeliyor

- Sol menüdeki **MARKALAR** bir ÜRÜN görünümüydü: katalogun tamamını markadan markaya
  dolaşarak sıralıyordu, yani marka arayana yine ürün çıkıyordu. Artık `/markalar`
  rehberine giden gerçek bir bağlantı. (`discovery.ts`'teki `markalar` besleme kipi
  duruyor ama arayüzden ulaşılmıyor.)
- `/markalar` kartlarında logo 22px'ten **46px**'e çıktı ve kendi çerçevesini aldı;
  altında markanın kargo avantajı tek satır olarak yazıyor.
- `/<marka>` sayfasına **MAĞAZANIN SUNDUKLARI** bölümü eklendi (kargo/hızlı gönderim/
  taksit/kapıda ödeme/iade/indirim). Veri `npm run fetch-perks` →
  `data/brand-perks.json`; ayrıntı ve ayrıştırma tuzakları README'de.

### Logolar

55 yeni logo indirildi (167 markada 158 logo). Hepsi kontakt sayfası hâlinde GÖZLE
denetlendi ve `data/brand-logo-kind.json`a sembol/yazı olarak işlendi (tablo 44 → 98
satır). Dört yanlış seçim bulunup düzeltildi:

- **`logo_band_colored…png`** — Shopify temalarının ödeme rozetleri şeridi. JUNK
  kalıbında `logo-band` yalnız TİRELİ hâli kapsıyordu, dosya adı ALT ÇİZGİLİ.
  le-tual ve prev bu yüzden "iyzico/visa" bandını logo diye taşıyordu. `logo[-_]?band`
  yapıldı, `hero` da eklendi (mahalle-boy'un og:image'ı hero fotoğrafıydı).
- mahalle-boy / oniki-studio / kevclo / tarmac-studios → `brand-logo-overrides.json`.
  oniki-studio'da kullanılabilir logo yok (`null`, yazıya düşer).

**Tuzak:** üç logo montajda bomboş göründü ama bozuk DEĞİLLERDİ — beyaz wordmark'lar.
`inv` alanı zaten bunu yönetiyor (açık temada invert edilir). Bir logoyu "boş" diye
elemeden önce negatifini al.

### Sonuç (doğrulandı)

**69.621 ürün · 152 marka** (öncesi 61.772 / 111). Fiyatlı 69.567 · bedenli 61.142 ·
stokta 54.924 · çok renkli 25.034 · TRY 64.100 / USD 5.521. Arşive ayrılan 1.584,
giyilemez elenen 2.994. `npm run check` 9 adım geçti.

Yeni markaların **45/56'sı** katalogda. Eksik 11'in sebebi kod değil, HIZ SINIRI:

- **9 Shopier markası** — Cloudflare IP'yi kapattı: *"İstek sınırı aşıldı … birkaç saat
  içerisinde tekrar deneyin. Hata Kodu: 9009"*. Adaptör doğru çalışıyor (aynı turda
  zeph-culture 233, saram 169, aspera-clo 138 ürün verdi). Birkaç saat sonra:
  `npm run scrape -- --only eilul-archives,giowear,la-mort-studios,leontiere,pale-archive,peace-hunter,solane,svamp-studios,zero-wear --concurrency 1`
- **revion-savera** — Shopify `local_rate_limited`. Aynı şekilde sonra denenmeli.
- **selsil** — selsil.com yapı kimyasalları satıyor (boya/yapıştırıcı). 133 kayıt geldi,
  hepsi giyilemez filtresine takıldı. Vitrine çıkmıyor; listeden çıkarmak ya da
  `data/brands-archived.json`a almak KULLANICI KARARI.

Ayrıca `fetch-perks` turunda **38 marka "sayfa alınamadı"** — hepsi Shopify ve o sırada
IP 429 yiyordu. Avantajlar 56 markada dolu; sonra `npm run fetch-perks` tekrar
çalıştırılınca eksikler tamamlanır (script birikimli yazar, var olanı silmez).

### 2026-07-30 gece turu — kalan eksiklerin kapatılması

**ABLUKA ÇÖZÜLDÜ** (üç turdan beri açık duran `exit 134` / V8 heap işi). Heap büyütmek
çözmüyordu; sebep TAVAN'dı. Sitemap'te ~2.800 ürün var, varsayılan tavan 9.000 —
tarama listesi şişiyor ve Ticimax'in 0,7 MB'lık ürün sayfaları biriktiğinde heap taşıyor.
Tavan gerçek ürün sayısına çekilince **2.697 kayıt, %98 bedenli, 1.577 sn** ile sorunsuz
geldi. Kalıcı çözüm: `data/brand-caps.json` (slug → tavan) ve `run.mjs` içinde `capFor()`
— komut satırındaki `--cap`ten zayıf, varsayılandan güçlü. **Yeni bir marka heap ile
ölürse ilk yapılacak şey tavanı gerçek ürün sayısına çekmek.**

**Shopier bloğu kalktı, adaptör yavaşlatıldı.** Cloudflare'ı tetikleyen şey marka sayısı
değil İSTEK HIZI: eilul-archives'ın 480 ürünü 159 saniyede çekildi (~3 istek/sn) ve
ardından IP "birkaç saat" kapandı. Adaptör içi eşzamanlılık **1**, istekler arası
**1,2 sn** oldu; ayrıca `.data/shopier-tek-tek.sh` markaları tek tek çekip aralarında
bekliyor. Bu ayarla giowear 616 kayıt (871 sn) sorunsuz geldi.

**W/L beden düzeltmesinin etkisi ölçüldü**: zeph-culture'ın bedenli kayıtları 14 → 78.

**fadeback-studio + manic-sellout arşivden ÇIKARILDI** — "Shopier pazaryeri vitrini,
kendi kataloğu yok" diye arşivlenmişlerdi; adaptör yazıldığına göre bu gerekçe düştü.

**revion-savera çekilemez, çünkü MAĞAZA HENÜZ AÇILMAMIŞ**: revionsavera.com parola
korumalı, sayfada "PASSWORD RELEASE IN … 16.08.2026" sayacı var. `products.json`
429 `local_rate_limited`, `/collections/all/products.json` 401 — hepsi bu yüzden.
Roster'da kalıyor; mağaza açıldığında ilk scrape'te kendiliğinden gelir.

**Logosu olmayan markalar belgelendi** (`brand-logo-overrides.json`, `null`):
fam1997 / aksesuarix / x-puppet-wear header'da logo değil DÜZ METİN kullanıyor;
crupt-studio'nun logosu sayfaya gömülü bir SVG sprite (`#crupt-Logo`), indirilebilir
dosya yok; oniki-studio'nun bulunan tek adayı boş beyaz bir kutuydu. Hepsi `BrandLogo`
fallback'iyle marka adı olarak yazılıyor.

**Tuzak:** üç logo (kevclo, tarmac-studios, oniki-studio) kontakt sayfasında bomboş
göründü ama ikisi sağlamdı — beyaz wordmark'lar. Bir logoyu "boş" diye elemeden önce
NEGATİFİNE bak.

#### Gece turunun sonucu (doğrulandı)

**70.360 ürün · 157 marka** (gündüz: 69.621 / 152). Fiyatlı 70.306 · bedenli 61.600 ·
stokta 55.664. `npm run check` 9 adımın tamamı geçti (164 aktif markanın 164'ünde tarz).

Çekilen Shopier markaları: zeph-culture 233 · saram 169 · aspera-clo 138 ·
eilul-archives 480 · **giowear 616** · pale-archive 157 · la-mort-studios 9 ·
leontiere 4.

Kalan 6 Shopier markası için `.data/shopier-tamamla.sh` yazıldı: her turda YALNIZ boş
kalanları dener, başarılıyı listeden düşer, 30 dk bekler. **Üç turda hepsi tamamlandı** —
peace-hunter 3.182 · zero-wear 348 · manic-sellout 145 · fadeback-studio 45 ·
svamp-studios 40 · solane 28. Aynı desen tekrar yaşanırsa:

```sh
BEKLE=1800 sh .data/shopier-tamamla.sh <slug…>
```

#### Kapanış (2026-07-30 07:00, doğrulandı)

**73.214 ürün · 163 marka.** Fiyatlı 73.160 · bedenli 64.267 · stokta 56.445 ·
çok renkli 25.637 · TRY 67.693 / USD 5.521. `npm run check` 9/9 geçti.

**Roster'da tek boş marka kaldı: revion-savera** — mağaza parola korumalı, sayacı
16.08.2026'yı gösteriyor. Kod tarafında yapılacak bir şey yok.

**Avantajlar 77 markada dolu.** Kalan ~87 markanın çoğunda ya duyuru yok ya da Shopify
IP'yi 429'luyor; `.data/perks-tamamla.sh` (30 dk aralarla, 16 tur) eksikleri kendi
kendine tamamlıyor.

**Shopier avantajları ÖZNİTELİKTE**: duyuru `<… msg="1.800 TL'lik ürüne ücretsiz kargo">`
biçiminde; etiketler silinince metin de gidiyordu. `visibleText` artık `msg="…"`
değerlerini metnin başına ekliyor. İkinci incelik: "TL'lik" gibi BİTİŞİK ek yüzünden
eşik kalıbı tutmuyor ve cümle eşiksiz "ücretsiz kargo"ya düşüyordu.

---

## 2026-07-29 turu — fiyat, arşiv, beden, tarz, public liste

### FİYAT — katalog ESKİ fiyatı taşıyordu (P0, kanıtlandı)

İkas storefront API'si varyant başına iki fiyat döndürüyor: `sellPrice` (liste, üstü
çizili) ve `discountPrice` (kasada geçerli olan). Sorgumuz `discountPrice`'ı HİÇ
istemiyordu, dolayısıyla indirimi sürekli açık markalarda katalog baştan sona eski
fiyatı gösteriyordu. Canlı ölçüm (voidtr.com, ilk 30 üründe 30'u indirimli):

| ürün | sellPrice | discountPrice | eski katalog |
|---|---|---|---|
| 1984 Baskı Detaylı Premium Oversize Sweatshirt | 799 | **359** | 799 ❌ |
| 00 Baskılı Star Detaylı Premium Oversize T | 909 | **425** | 909 ❌ |

Etki ~40 ikas markası. Düzeltmeler:
- `ikas.mjs`: sorguya `discountPrice` + `priceListId`; `variantPrice()` =
  `discountPrice ?? sellPrice`; `priceRow()` varsayılan fiyat listesini seçiyor
  (eskiden körlemesine `prices[0]` alınıyordu).
- **`num()` 1000 kat hatası** (`fetch.mjs`): ABD biçimli `"1,799.90"` → **1.799**
  okunuyordu (nokta binlik sanılıp virgül ondalığa çevriliyor, `parseFloat` ilk noktada
  duruyordu). Katalogda 4.551 USD ürün var. Artık SON ayraç ondalık kabul ediliyor,
  ama yalnız ardından 1-2 basamak varsa ("1.799" binliktir). 24 biçimlik birim testi:
  `npm run check-prices`.
- `shopify.mjs`: fiyat artık bedenle AYNI kümeden (stoktakiler) alınıyor. Eskiden fiyat
  tüm varyantlardan, beden yalnız stoktakilerden geliyordu.
- `jsonld.mjs`: `offerPrice()` — stokta olan tekliflerin minimumu (eskiden keyfî
  `offers[0]`). Ticimax'in `productPriceKDVIncluded` alanı JSON-LD ile birebir aynı
  çıktı, o yol zaten doğruydu.
- **Vitrin fiyatı tanımı değişti** (`src/lib/variant.ts`): `Product.price` artık kartta
  AÇILIŞTA GÖRÜNEN varyantın fiyatı. Eskiden tüm renklerin MİNİMUMU idi; kart seçili
  varyantı yazdığı için kartta 1799 ₺ görünürken filtre 1099 ₺ ile eşleşiyordu. Aralık
  ayrı alanlarda: `priceMin`/`priceMax`, fiyat filtresi bu aralıkla KESİŞİME bakıyor.

**İndirim mekanizması YOK ve yazılmadı** — kullanıcının isteği buydu: ürün kaynakta
kaça satılıyorsa vitrinde de o yazar. `compare_at_price` gibi eski fiyat alanlarına
bilerek bakılmıyor.

### ARŞİV — ayakkabı ve çocuk giyimi vitrinden çıktı

Eleme TEK NOKTADA, `import-catalog.mjs`'in sonunda: arşivlikler
`.data/catalog.archived.json`'a (`archiveReason: "AYAKKABI" | "COCUK"`) yazılıyor ve
`catalog.json`'a hiç girmiyor. Böylece `runQuery`, `discovery`, kategori sayaçları,
sidebar, marka sayfaları HİÇ değişmedi — hiçbir yerde filtre tekrarı yok. Geri almak
için kuralı gevşetip yeniden import etmek yeterli, ham veri `.data/full/`te duruyor.

- `AYAKKABI` `PRODUCT_CATS`'te KALIYOR (categorize hâlâ onu üretiyor, arşiv kararı ona
  bakıyor) ama `NAV_CATS`/`CAT_GROUPS`'tan çıktı. Yeni sabit: `ARCHIVE_CATS`.
  `check-cat-groups` artık NAV_CATS üzerinden ölçüyor ve arşiv kaleminin yanlışlıkla
  bir çatıya eklenmesini de hata sayıyor.
- Çocuk tespiti `src/lib/kids.ts`. İki sinyal: YAŞ bedeni (kesin, 494 ürün) ve addaki
  GÜÇLÜ sözcük. **Yanlış pozitifler ölçülerek elendi** — ham tarama 1.064 eşleşme
  veriyordu ama:
  - **"Stray Kids" bir K-pop grubu: 79 ürün**, hepsi yetişkin bedenli hayran ürünü.
    ("Kids Karma" kalıbı da aynı gruba ait.)
  - **Tekil "kid" hep slogandı** ("90's KID", "Muay Thai Kid", "Boxer Kid", "Kid Tom") —
    9 vakanın 9'u. Tekil "kid" ZAYIF sayıldı, çoğul "kids" güçlü kaldı.
  - **Marka adı tuzağı**: "Junior Crime" markasının HER ürünü çocuk sanılıyordu.
    `stripBrand()` marka adını addan düşürüyor. "Boca Juniors" da elendi.
  - `bebek`/`baby` TEK BAŞINA yetmiyor: "Bebek Mavi" bir RENK, "Cry Baby" bir grup.
- Sonuç (2026-07-29 import'u): **1.189 ürün arşive** = AYAKKABI 521 + ÇOCUK 668.
  Denetim: `npm run check-archive` (canlı katalogda 0 çıkmalı — eleme import'ta yapıldığı
  için arşivlik ürün katalogda hiç kalmaz).
- **Yaş bedeni vitrine çıkmıyor**: `normalizeSize` yaş jetonunu hâlâ üretiyor (arşiv
  kararı ona dayanıyor) ama import, arşive girmeyen üründe kalanları `dropAgeSizes` ile
  siliyor. FilterPanel'deki yaş grubu kaldırıldı.

### BEDEN — sönük baloncuk kalktı

Eskiden çekirdek beş beden (S·M·L·XL·2XL) her kartta çizilir, üründe olmayan sönük
bırakılırdı. Bu YANLIŞ bilgiydi: veri "tükendi" ile "hiç üretilmedi"yi ayırmıyor, oysa
sönük kutu "tükenmiş" diye okunuyordu. Artık:
- `previewSizes` yalnız ÜRETİLEN bedenleri çiziyor, pencere **XS'ten** başlıyor
  (2XS/3XS/4XS ve beşinci slottan sonrası "+n"e düşüyor). `SizeSlot.on` alanı silindi.
- **Tek beden üretilen üründe beden satırı hiç çizilmiyor** (`hasSizeInfo`).
- Ürün modalında da çekirdek merdiveni sönük kutuyla tamamlama kaldırıldı.
- `filterSizes` ölü kodu silindi. `check-sizes` 8 yeni önizleme vakası içeriyor.
- **Ticimax beden başına GERÇEK stok taşıyormuş** (`productVariantData[].stokAdedi`) ve
  hiç okunmuyordu; artık shopify/ikas ile aynı kural: alınabilir beden varsa yalnız
  onlar listeleniyor.

### CİNSİYET — beden kuralı denendi, ÇOĞU ELENDİ (bu turun en öğretici bulgusu)

Ad ve kategori susuyorsa beden aralığının uçlarının konuşacağı varsayıldı. İlk ölçüm
(adında cinsiyet YAZAN ürünler etiketli veri) dört kalıbı da güçlü gösterdi — `S,M,L`
%87 kadın, `XS,S,M,L` %93 kadın, `M,L,XL` %96 erkek; toplam **%86,1**.

**Sonra varsayım kendi düzeltmemiz yüzünden bozuldu.** Aynı turda Ticimax'in beden
başına `stokAdedi` alanını okumaya başladık, yani beden listesi artık "üretilen" değil
"KALAN" aralığı gösteriyor. XL'i tükenmiş bir erkek ürünü `S,M,L`ye düşüp kadın
kalıbına benziyor. Yeni katalogda denetim isabeti **%70'e** çöktü ve `npm run check`
KIRMIZI verdi. Alt kural bazında ölçüm:

| kural | tahmin | n | isabet |
|---|---|---|---|
| M'den başlar, XL+'e çıkar | erkek | 50 | **%96** ✔ kaldı |
| L'de biter | kadın | 793 | %76 ✘ |
| 2XL+'e uzanır, XS yok | erkek | 296 | %72 ✘ |
| XL'de biter, XS'ten başlar | kadın | 274 | **%41** ✘ (yazı-turadan kötü) |

Elenenler kaldırıldı. Ayakta kalan kural stoktan etkilenmiyor çünkü küçük bedenlerin
YOKLUĞUNA değil büyük bedenlerin VARLIĞINA bakıyor. Son durum: **%92,7 isabet, katalogun
%0,7'si** (412 ürün) unisex olmaktan çıkıyor — dar ama güvenilir.

**SAYISAL bedenler de işe yaramıyor** (ayrıca ölçüldü): 32-46 çift numara hem kadın mini
şortunda hem erkek kargo pantolonunda geçiyor. **Bol kesim dışlanıyor**: erkek "oversize"
tişörtler S-M-L satılıyor.

**DERS:** bir sezgiyi ölçmek yetmiyor, ölçümün dayandığı VARSAYIMIN hâlâ geçerli olduğunu
da denetlemek gerekiyor. `check-gender`in eşiği (%80) bunu yakaladı — o denetim olmasaydı
katalog %70 isabetli cinsiyet etiketiyle yayına gidecekti.

### TARZ — artık ÜRÜNÜN alanı, `minimalist` eklendi

Tarz yalnız markaya yazılıyken ürünlerin %86,6'sı "streetwear", %55,6'sı "basic"
çıkıyordu; filtre hiçbir şeyi ayırmıyordu ve kullanıcının işaret ettiği hata buradaydı:
**desenli bir ürün "basic" görünüyordu**. Artık `Product.styles` var
(`src/lib/product-styles.ts`): marka tarzı ÖNSEL, ürün adına bakan kural motoru düzeltir.

- Desen/baskı/grafik taşıyan üründen `basic` ve `minimalist` DÜŞER, `streetwear` eklenir.
  `npm run check-product-styles` bu ihlali ZORUNLU olarak 0'da tutuyor (exit 1).
- **Önsel yalnız SAHNE tarzlarını taşır** (`PRIOR_STYLES`): `techwear` ve `spor` ürünün
  KENDİSİNDEN kanıt ister. Önsel bunları da taşırken katalogda "Havlu Çorap = techwear",
  "Örgü Kazak = spor" çıkıyordu. Düzeltmeden sonra techwear 3.472 → **640** (hepsi
  gerçek kargo/teknik parça), spor 7.388 → 3.729.
- **`minimalist` yeni tarz.** Ham kaynakta (`data/brands.csv`) zaten 6 markada
  "old money/minimal" yazılıydı ama `old-money`'e katlanmıştı; artık kendi ekseni:
  reflect-studio, aperith, keit, interim-collective, quite-often, cucire + kaft.
- Filtredeki sayı artık MARKA değil ÜRÜN adedi (`styleCounts(products)`); marka sayısı
  yalnız denetim script'inde (`brandStyleCounts()`).
- **Türkçe tuzağı yine ısırdı**: `simli` serbest aranınca "Mevsimlik Ceket" ravewear
  çıkıyordu (sözcüğün İÇİNDE geçiyor). Sözcük sınırına alındı.

### CANLI DROP tamamen kaldırıldı

`drop` alanı yalnız shopify/woocommerce'te hesaplanıyor, ikas/jsonld sabit `false`
yazıyordu — yani katalogun yarısı o filtreden yapısal olarak geçemiyordu ("YENİ"
kategorisini öldüren aynı yanlılık). Tip, sorgu parametresi (`?drop=1`), filtre kutusu,
modal rozeti, `freshBonus` dalı ve dört adaptördeki üretim: hepsi silindi.

### RENK — nokta artık fotoğraftan ölçülüyor

Eskiden görselden renk türetme yalnız "hex'ler varyantları ayırt edemiyorsa" devreye
giriyordu; o koşul asıl sorunu hiç yakalamıyordu (marka panelinden gelen hex FARKLI ama
YANLIŞ olabiliyor). Artık `images` verildiği sürece HER ZAMAN ölçülüyor ve hesap
merkez ORTALAMASI değil **baskın renk**: ortalama, iki renkli üründe üründe hiç
bulunmayan bir çamur tonu veriyordu. Arka plan (kenar çerçevesi) eleniyor, ten tonu
kovası ancak başka aday yoksa seçiliyor. Sonuç localStorage'da (`altr-swatch-v1`).
VİTRİNİM de artık ham hex basmıyor, aynı bileşeni kullanıyor.
`colors.ts`: eşleştirme `trLower` ile (**"GRİ" sözlükte bulunamıyordu**, büyük harf
yazan markaların tüm renkleri uydurma griye düşüyordu), ~30 Türkçe ton eklendi,
ayraçsız bileşik ad ("Siyah Kırmızı") çözülüyor.

### PUBLIC LİSTELER — vitrinde yeni sekme

VİTRİNİM artık iki sekmeli: **LİSTELERİM | HERKESE AÇIK**. Yayınlanan listeler
Letterboxd/Pinterest dilinde kart ızgarasında (2×2 kapak kolajı, ad, @nick, parça
adedi, bakış) sergileniyor.

- **Hesap YOK** (kullanıcı kararı): yayınlarken yalnız nick sorulur, sahiplik cihazdaki
  gizli anahtarla kanıtlanır. Anahtarın kendisi sunucuya gitmez, SHA-256'sı saklanır.
- Depo `src/lib/public-lists.ts` → `.data/public-lists.json` (restock.ts örüntüsü).
  API `src/app/api/lists/route.ts` (GET akış / GET tek liste+ürünler / POST / DELETE).
  Ürün gövdelerini SUNUCU çözüyor: listede yalnız id var, istemcide katalog yok.
- Link paylaşımı (`?liste=`) KALDI ve ayrı duruyor: link donmuştur, yayın ise liste
  düzenlendikçe güncellenir.
- **Vercel'de çalışmaz** (dosya sistemine yazıyor) — `restock` ve `events` ile aynı kısıt.
- Doğrulandı: yanlış anahtarla silme 403, geçersiz nick 400, sahibi silince 200,
  görüntülenme sayacı ve `mine` bayrağı çalışıyor, ürün çözümlemesi doğru.

### SON DURUM (2026-07-29 import'u)

| ölçü | değer | önceki |
|---|---|---|
| ürün | **61.772** | 62.730 |
| arşivde (vitrin dışı) | **1.189** (ayakkabı 521 + çocuk 668) | — |
| marka | **107** (111 listede, 4 arşivli) | 109 |
| fiyatlı | 49.231 | 50.221 |
| bedenli | 50.546 (%81,8) | 43.759 (%70) |
| stokta | 45.962 | 46.534 |
| çok renkli | 22.027 | 22.337 |
| cinsiyet | kadın 5.095 / erkek 6.889 / unisex 49.788 | — |
| para birimi | TRY 57.303 / USD 4.469 | 58.179 / 4.551 |
| kategori | **36** (AYAKKABI düştü) | 37 |

**Scrape turu:** 106 marka denendi. ikas **39/39 başarılı** — yani fiyat düzeltmesinin
uygulanması gereken markaların TAMAMI tazelendi. woo 2/2, jsonld 20/21. Shopify'da 21
marka hız sınırına takıldı; **14'ü ikinci turda kurtarıldı**, 8'i (after-6,
estatico-design, the-lucid-lab, touz-moda, punk-design, vamos-clo, emorpi, zincir-wear)
kısmi veri döndürdü ve küçülme koruması eski (1 günlük) verilerini korudu. Sekizi de
Shopify/jsonld, yani fiyat hatası taşımıyorlar. Tazelemek için:
`npm run scrape -- --only <slug> --force`.

**Fiyat düzeltmesinin ölçülen etkisi:** eski katalogla karşılaştırıldığında **9.229
üründe fiyat düştü**. Doğrulama vakası: void "1984 Baskı Detaylı Premium Oversize
Sweatshirt" 799 ₺ → **359 ₺** (mağazadaki gerçek fiyat).

**Katalog dosyaları:** `catalog.new-full.json` (96 MB, canlıya gidecek olan) ·
`catalog.json` = `catalog.sample.json` (3,4 MB, 2.160 ürün / 36 kategori / 106 marka —
artık `npm run make-sample` ile TABAKALI üretiliyor, eskiden elle yapılmıştı ve 45
marka içeriyordu) · `catalog.archived.json` (1,9 MB, vitrin dışı ürünler).

---

### MARKA — Les Benjamins ve Sigma Wears çıkarıldı

Kullanıcı isteğiyle TAMAMEN silindi (arşivlenmedi): 12 dosyadan kayıtları,
`.data/full/*.json` ham verileri ve logoları. **113 → 111 marka**, tarzlı marka 107.
Ayrıca `scripts/scrape/brands.mjs` arşiv listesini hiç okumuyordu — `npm run scrape`
her turda 4 arşivli markayı da deniyordu; filtre eklendi (106 marka çekiliyor).
`run.mjs`'e `--skip` bayrağı eklendi (abluka için).

### Denetim zinciri büyüdü

`npm run check` = typecheck + categorize + brand-styles + sizes + cat-groups
**+ archive + product-styles + gender + prices**. `check-prices --canli` bayrağıyla
katalog fiyatını markanın kendi sayfasıyla karşılaştırıyor (ağ gerektirdiği için
zincirde değil).

---


## 2026-07-28 turunda eklenenler

- **BEDEN, baştan sona.** Katalogun bedeni her yerde ayrı bir `isSize` regex'iyle
  süzülüyordu ve üç adaptör üçü de farklı şey kabul ediyordu. Artık tek kaynak:
  `src/lib/sizes.ts` (scraper, import ve arayüz aynı fonksiyonları çağırıyor).
  Kanonik biçim "2XL/3XL" (XXL DEĞİL — katalogda iki yazım birden vardı ve aynı beden
  filtrede iki kutu oluyordu). Kurtarılanlar: yazıyla yazılmış bedenler (Medium/Large/
  X Large/Xxlarge), aralıklar (SM · S-M · S/M · L-XL · 35-38 · 28-30 → bileşenlerine
  açılır), bel/boy (`30/32` → 30, çünkü "/" aralık değil), tek beden (TEK BOYUT ·
  OneSize · Standart · TekEbat · STD · OS → "TEK BEDEN"), parantezli notlar
  (`XL (M-L BEDENE TEKABUL EDER)` → XL; `28 (XXS)` → hem 28 hem 2XS), çocuk (9-10 YAŞ),
  santim (105CM → 105). `npm run check-sizes` 50 gerçek değeri koruyor;
  `--tara` bayrağı ham veriyi tarayıp tanınmayan jetonu listeliyor (şu an %0,02).
- **Seçenek tespiti ADA DEĞİL DEĞERE bakıyor.** Ölçüldü: katalogda beden seçeneğinin
  adı 463 kez "Boyut", ayrıca "Ölçü"; x-puppet-wear ise seçeneği ürünün RENK ADIYLA
  açıyor ("Beyaz" = [S,M,L,XL]). `looksLikeSizeValues()` bunların hepsini tek kuralla
  çözüyor. Dört adaptörde de aynı kural.
- **Wix'ten beden.** the-mets-co'da (1076 kayıt, bedenli 0) beden ne JSON-LD'de ne bir
  `<select>`te; sayfanın içindeki JS string'inde kaçışlı JSON olarak duruyor
  (`\"title\":\"Beden\",\"selections\":[…]`). `embeddedOptionSizes()` bu KALIBI arıyor,
  platformu değil. Sonuç: 0 → 1024 bedenli.
- **Ölçülen kazanç** (yeniden çekim sonrası, ham kayıt): after-6 304→8473 ·
  the-lucid-lab 368→13656 · touz-moda 1137→4994 · emorpi 0→604 · the-mets-co 0→1024 ·
  catch 186→856 · keit 5→293 · lethe-studios 189→696 · gotham 483→695 ·
  hype-of-steps 0→114 · wes-wear 480→1002 · kozmosize 377→479.
- **Baloncuklar** (`previewSizes`): kartta çekirdek beş beden — S·M·L·XL·2XL, katalogdaki
  gerçek frekanstan çıkarıldı — hep aynı yerde çizilir, üründe olmayan sönük kalır.
  Harfli bedeni olmayan üründe (jean 30/32, ayakkabı 41, TEK BEDEN) ürünün KENDİ
  bedenleri baloncuğun içine yazılır. Sığmayan uçlar "+n" olur; ürün modalı tam listeyi,
  filtre ise katalogda geçen HER bedeni sunar (harf / numara / diğer diye gruplu).
  Baloncuklar ürün fotoğrafının üstünde durduğu için artık opak zeminli ve 1.5px kenarlı
  (`--chip-bg-on/off`) — şeffaf çerçeve açık renkli görsellerde kayboluyordu.
- **Çatı kategoriler** (`CAT_GROUPS`, types.ts): sol menü 36 düz kalem yerine 6 açılır
  kapanır başlık (ÜST GİYİM / ALT GİYİM / DIŞ GİYİM / ELBİSE & TAKIM / AKSESUAR /
  SINIFLANDIRILMAMIŞ). Yalnız bir GÖRÜNÜM katmanı — ürünün kategorisi hâlâ düz taksonomi,
  sorguya alan eklenmedi. Varsayılan kapalı; seçili kategoriyi içeren çatı kendiliğinden
  açılır. `npm run check-cat-groups` kapsamayı denetler (bir kategori çatısız kalırsa
  menüden sessizce kaybolurdu).
- **Sol bar katlanabilir**: sağ üst köşedeki küçük ok (`.side-toggle`), tercih
  localStorage'da (`altr-sidebar`). Katlıyken 46px'lik şeritte MENÜ + vitrin rozeti kalır,
  ızgara ~190px genişler. Mobilde geçersiz (orada sidebar zaten üst şerit).
- **ADMİN İSTATİSTİKLERİ** (`StatsPanel`, `/api/stats`): üst şeritte İSTATİSTİKLER
  sekmesi yalnız admin oturumunda çizilir; yetki sunucuda oturum çerezinden okunur ve
  admin olmayana **404** döner (403 ucun varlığını doğrulardı). Aynı koruma artık
  `GET /api/outbound`ta da var — orası herkese açıktı. İki ölçü yan yana:
  GÖRÜNTÜLENME (ürün modalı açıldı, YENİ — `views-*.jsonl` + `/api/view`, store'un
  `openDetail`/`detailNav`ından) ve ÇIKIŞ (mağazaya gidildi, mevcut). Grafikler
  kütüphanesiz düz SVG. İki serinin renkleri ölçülerek seçildi (`--stat-1/--stat-2`,
  L bandı + renk körlüğü ΔE + kontrast doğrulandı); kimlik renge bırakılmadı, açıklama
  şeridi ve sayı etiketleri hep var.
- **`.env.local` oluşturuldu**: `ADMIN_EMAILS` + `AUTH_DEV_CODES=1`. Admin sekmesi bu
  değişken olmadan HİÇ görünmez.

---

## Proje

`C:\Users\Tuna Demir\Documents\altr-0.0.6` — proje kökü DOĞRUDAN burası. Türk
alternatif/streetwear markalarını tek vitrinde gösteren Next.js 15 aggregator.
Karanlık/glitch estetik; IBM Plex Mono / Space Mono / Anton.
Dev: `npm run dev -- -p 3005` — `.claude/launch.json`'da iki yapılandırma var:
`altr` (3005) ve `altr-3006` (3006 + `NEXT_DIST_DIR=.next-3006`; başka bir sohbet 3005'i
tutuyorsa bunu kullan — iki dev server AYNI `.next`i paylaşırsa birbirinin route
dosyalarını siler ve uçlar rastgele 404/500 döner).

> **2026-07-31'de düzeltildi: klasör artık İÇ İÇE DEĞİL.** Eskiden yol
> `…\altr-0.0.6\altr-0.0.6` idi (arşiv, aynı adlı bir klasörün içine açılmıştı); dış
> sarmalayıcıda yalnız bir `.claude` vardı. İçerik bir üst dizine taşındı, iki
> `.claude/settings.local.json` BİRLEŞTİRİLDİ (23 + 20 izin → 39 tekil, hiçbiri
> kaybolmadı) ve `Documents\.claude\launch.json` yolları güncellendi. Eski yola işaret
> eden bir şey kaldıysa tek düzeltme: sondaki fazla `\altr-0.0.6`yı sil.

Sürüm zinciri: `_archive\altr` (orijinal) → `_archive\altr-0.0.2` → `altr-0.0.3` →
**`altr-0.0.6` (GÜNCEL, burada çalış)**. 0.0.3 hâlâ diskte duruyor ama artık geride:
aşağıdaki "0.0.6'da eklenenler" bölümündeki her şey yalnız bu kopyada var.
**Scraper arşivde değil, bu projenin içinde** — arşive bağımlılık kalmadı.

## 2026-07-26 turunda eklenenler

- **Tükenmiş ürünler her zaman SONDA** (`query.ts`): stok filtresi kapalıyken (TÜMÜ)
  liste iki bloğa ayrılır — alınabilirler önce, tükenmişler en sonda. Bloklar AYRI
  sıralanır, yani kural sıralamadan bağımsız (fiyata azalan sıralasan da tükenmiş
  öne geçmez). Ölçüm: sayfa 1'de 40/40 stokta, son sayfada 32/32 tükenmiş.
- **TARZ ekseni** — streetwear / basic / techwear / ravewear / spor / old-money.
  Tarz MARKAYA yazılı (`data/brand-styles.json`, 109/109 marka etiketli); filtre
  panelinde bölüm + ızgaranın üstünde şerit, URL'de `tarz=`. `npm run check-brand-styles`
  eksik/yetim slug'ı ve geçersiz tarzı yakalar.
- **Kategori düzeltmesi.** Kök neden: `trLower` her büyük "I"yı noktasız "ı" yapıyordu
  ("CARDIGAN" → "cardıgan"), katalogda büyük harfli + "I" içeren 1553 ad vardı ve hepsi
  sessizce DİĞER'e düşüyordu. Artık her kural İKİ metne birden bakıyor (Türkçe + düz
  küçültme). Üstüne sözlük boşlukları kapandı (çorabı, yüzüğü, valiz, glasses, tracksuit,
  beanie, botları, gerdanlık, buff, tozluk, kombin, set…) ve giyilemez listesi genişledi.
  Sonuç: DİĞER 2.472 → ~1.000, ~1.500 ürün doğru kovaya geçti, ~500 giyilemez elendi.
  `npm run check-categorize` 39 gerçek ürün adıyla bunu koruyor.
- **Bozuk görseli atlama** (`ProductImage` `fallbacks`): ana görsel 404 verirse sıradaki
  aday denenir, hepsi düşerse placeholder kalır. Kart/modal/vitrin/marka sayfası besliyor.
- **Stok talebi oylaması** (`lib/restock.ts` + `/api/restock` + `RestockVote`): tükenmiş
  üründe "STOĞA GELSİN". Anonim çerezle ürün başına tek oy, geri alınabilir.
  `GET /api/restock?top=1` talep raporunu verir. Modalda tükenmiş üründe "SATIN AL"
  yerine bu düğme var — ölü bağa göndermek yalan olurdu.
- **Üyelik** (`lib/auth.ts` + `/api/auth/*` + `AuthModal`): parolasız, e-posta + 6 haneli
  kod; "beni hatırla" (60 gün / 12 saat); ilk girişte nick; roller `user`/`business`/`admin`
  (admin YALNIZ `ADMIN_EMAILS`'ten, arayüzden seçilemez); Google ile giriş (env yoksa
  düğme hiç çizilmez). **Hiçbir özelliğe bağlanmadı** — bilerek. Bkz. açık işler 13–16.
- **Kombin paylaşımı**: vitrin listesinden kategori başına tek parça seçilerek kurulur
  (`CombineBuilder`), link `mod=kombin` taşır, karşı taraf ızgara değil üstten alta
  tek sütun bir kıyafet görür. Liste paylaşımıyla aynı sunucusuz altyapı.
- **Markalar rehberi + marka sayfaları**: `/markalar` (alfabetik, harf şeridi, 109 kart)
  ve `/<marka-slug>` (iri logo, künye, kategori kırılımı, ürün ızgarası, sayfalama).
  SUNUCUDA çizilir, `<a>` gerçek bağ, `generateMetadata` ile title/description/canonical/OG.
  Kök seviyede dinamik segment; statik yollar (`/markalar`, `/api/*`) önce eşleşir.
- **Scraper: İKİ ayrı sessiz kayıp bulundu ve kapatıldı.**
  1. *Sitemap sınırı*: `sitemapProductUrls` bütçesi 90 sn → 7 dk, `--cap` 3000 → 9000.
     Ölçüm: kostebek sitemap'te 6000+ ürün URL'i varken hamda 2.495 vardı.
     Tavana dayanan tarama artık nota "CAP'e dayandı" yazıyor.
  2. *Sayfa düşmeleri*: `fetchJsonLd` alınamayan sayfayı sessizce atlıyordu. Eşzamanlı
     istek altında site bağlantı kestiğinde marka "çekildi" görünüp yarısı eksik
     kalıyordu — **ölçüm: gotham sitemap'te 734 ürün URL'i, hamda 200.** Artık düşen
     sayfalar biriktirilip TEK AKIŞTA yavaşça bir kez daha deneniyor ve nota
     "KAYIP n sayfa (x alınamadı, y boş)" yazılıyor. Aynı ölçüm düzeltmeden sonra:
     **707 ürün, 0 alınamadı, 26 boş.**

  **Sonuç (21 marka yeniden tarandı, katalog yeniden üretildi): 54.872 → 62.729 ürün.**
  Marka bazında en büyük kazançlar: kostebek 2.495→9.274, flaw-wears 2.444→6.145,
  gotham 200→708, balina-butik 1.940→4.525, kozmosize 291→745, abluka 1.153→2.788.

  **HÂLÂ AÇIK:** kostebek 9000'lik `--cap` tavanına dayandı ("CAP'e dayandı" notu var),
  yani orada daha fazla ürün var. Tavanı yükseltmeden önce belleğe bak — 9274 kayıtlık
  tarama zaten 6 GB heap istedi.

## 0.0.6'da 0.0.3'ten SONRA eklenenler

Bu notun geri kalanı iki sürümde de geçerli; buradakiler yalnız 0.0.6'da:

- **Stok filtresi**: `query.inStockOnly` — **varsayılan AÇIK** (vitrin bir "alınabilir
  ürün" listesi; tükenmiş ürün alıcı için ölü bağ). Izgara başlığında STOKTAKİLER/TÜMÜ.
  URL'de yalnız KAPALIYKEN görünür (`tukenmis=1`), varsayılan link temiz kalır.
- **`defaultVariantIndex`** (query.ts): kart/modal İLK STOKTAKİ renkle açılır. Varyant
  dizisinin ilk elemanı tükenmiş renk olabildiği için alınabilir ürünler "STOKTA YOK"
  gibi görünüyordu.
- **İkas stok bilgisi** (`ikas.mjs`): storefront `stocks { stockCount }` çekiliyor;
  `sellIfOutOfStock` açıksa yine alınabilir sayılır. Bedenler stoktaki varyantlardan
  alınır (shopify ile aynı kural).
- **Renk swatch'ı temizliği**: Ticimax `/varyasyonresim/` düz renk çipidir, ürün
  fotoğrafı değil — primary'ye düşüp kartta kapkara kare gösteriyordu. `jsonld.mjs`
  (kaynakta) ve `import-catalog.mjs` (`stripPlaceholders`, ayrıca `resim-hazirlaniyor`
  gibi "resim yok" görselleri) eliyor.
- **Görsel host allowlist'i** (`img-hosts.ts`): wixstatic / qukasoft / lofux eklendi —
  katalogun %7,9'u (4272 ürün) proxy reddettiği için sessizce görselsiz kalıyordu.
- **ColorSwatches — görselden renk**: hex'ler varyantları ayırt edemiyorsa (benzersiz
  hex < varyant sayısı) her varyantın görselinin MERKEZ rengi tarayıcıda hesaplanıp
  nokta olarak gösteriliyor; sonuç modül düzeyinde önbellekli.
- **3B logo** (`Logo3D.tsx`): sidebar'daki altr logosu fareyle her eksende döndürülebilir,
  rengi temadan gelir (gece sarı / gündüz mor).
- **Tema**: varsayılan artık her zaman GECE (sistem tercihine bakılmıyor) + tema ile
  eşleşen favicon (`#theme-favicon`, hem layout'taki blocking script hem `setTheme`).
- **Sticky ölçüsü**: sidebar `top`/`height` sabit 50px yerine `--topbar-h` değişkeninden.

## Doğrulanmış mevcut durum (2026-07-28 import'u)

| | değer |
|---|---|
| Ürün | **62.730** (öncesi 54.404) |
| Marka (vitrinde) | **109** (listede 113, 4'ü arşivli) |
| **Bedenli** | **43.759 / %70** (öncesi %57) |
| Fiyatlı / stokta | 50.221 / 46.534 |
| Beden dağılımı | S 36.996 · M 36.898 · L 36.453 · XL 33.327 · 2XL 15.390 · XS 9.156 · 3XL 3.352 · TEK BEDEN 2.102 · 2XS 1.962 |
| Farklı beden jetonu | 121 (112'si sayısal; "XXL" artık 0, hepsi "2XL") |
| Çok renkli ürün | 22.337 · katlanan mükerrer kart 15.968 |
| Para birimi | TRY 58.179 / USD 4.551 |

**`.data/` içindeki katalog dosyaları** (2026-07-28 sonu):
`catalog.json` = **hafif örnek** (2.220 ürün, 3,5 MB — `next dev` bu makinede 98 MB'ı
kaldıramıyor) · `catalog.new-full.json` = **gerçek katalog** (62.729 ürün, 98 MB, canlıya
gidecek olan) · `catalog.sample.json` = örneğin kopyası · `catalog.full.json` = düzeltme
ÖNCESİ katalog (88 MB, artık gereksiz, silinebilir). Dev server'ı 4 GB heap ile
başlatırsan (`.claude/launch.json`'daki `altr-006-dev` artık öyle) gerçek katalog da açılır.

### Eski sayılar (düzeltme öncesi, karşılaştırma için)

| | değer |
|---|---|
| Ürün | 54.404 |
| Ham scrape kaydı | 117.454 |
| Fiyatlı / bedenli | %86 / %57 |
| Çok renkli ürün | 19.968 |
| Kategori | 37 (düz taksonomi) |
| Para birimi | TRY 49.844 / USD 4.560 |
| Cinsiyet | kadın 5.305 / erkek 5.044 / unisex 44.055 |
| Logo | 109 aktif markanın 102'sinde |
| Katalog dosyası | 83,5 MB → parse sonrası ~313 MB heap |

## Mimari

- **Statik katalog**: `.data/catalog.json` → `src/lib/aggregate.ts` `readCatalog()` (memo'lu).
  İstek anında scrape yok.
- **Scraper**: `scripts/scrape/` — adaptörler `shopify` / `ikas` / `woocommerce` / `jsonld`
  (Ticimax `productDetailModel` kısayoluyla). Platform her çalıştırmada ana sayfadan
  tespit edilir, `brands.generated.ts`'teki alana güvenilmez.
- **Ürün modeli** (`src/lib/types.ts`): `variants[]` (renk adı, hex, `imgs` = images'a
  indeks, sizes, inStock, price, url), `genders: ("kadin"|"erkek")[]`, `currency` (ISO,
  büyük harf), `category` (düz tip).
- **Görsel**: `/api/img` proxy + üç katmanlı önbellek (`src/lib/img-cache.ts`): süreç-içi
  LRU 32MB + disk `.data/img-cache` 1GB + uçuşta tekilleştirme + upstream semafor.
  ETag/304, 30 gün Cache-Control. Ölçüm: soğuk 941ms → sıcak 12ms.
- **İstemci görsel**: `ProductImage` IntersectionObserver (rootMargin 600px) + srcSet/sizes.
  40 karttan yalnız 4 `<img>` baştan kurulur.
- **Logolar**: `public/brand-logos/<slug>.webp` + `src/lib/brand-logos.generated.ts`.
  `BrandLogo` bileşeni marka adının geçtiği her yerde. Tema/seçili-çip zeminine göre
  CSS `invert`, duruşta grayscale, hover'da renk. Ölçü ALANDAN türetilir (√(hedef²/oran)):
  kare amblem yükselir, uzun wordmark alçalıp genişler, oran hiç bozulmaz.
  `data/brand-logo-kind.json` her logoyu elle "sembol" (ad okunmuyor → logonun yanına
  marka adı YAZILIR, fontu markanın karakterine göre seçilir) veya "yazi" (ad logoda)
  diye işaretler — 106 logo tek tek gözle sınıflandırıldı, en/boy oranı bu işi çözmüyor
  (0.89 oranlı bir wordmark de var, 1.35 oranlı bir monogram da).
- **Çıkış ölçümü**: `src/lib/events.ts` (günlük JSONL) + `POST/GET /api/outbound` +
  `src/lib/track.ts` (sendBeacon). BrandModal'da kaydırma onaylanınca yazılır.
- **Keşfet motoru** (`src/lib/discovery.ts`): sıralamanın nötr hâli. Üç katman —
  (1) SKOR: editoryal marka puanı (`data/brand-scores.json`, 1–5) %55 + ürün kalitesi
  (görsel/renk/fiyat/beden/stok/ad/kategori) %37 + tazelik bonusu; üstüne tohumlu
  gürültü (keşfet %30, kategori içi %12). (2) DOKUMA: her sıraya, komşuluk kurallarını
  bozmayan en iyi ürün seçilir; her seçimde markanın etkin skoru 0.86 ile azalır
  ("marka yorgunluğu") — böylece 4560 ürünlü pazaryeri markası da, puanı 5 olan marka
  da vitrini ele geçiremez. (3) KURALLAR: aynı marka en az 4 ürün arayla, aynı
  kategoriden en fazla 2 ardışık, aynı tondan (renk parlaklığı) en fazla 3 ardışık.
  İlk 4000 ürün dokunur (100 sayfa), sonrası ucuz adım-serpmesiyle dağıtılır.
- **Tohum**: 3 saatlik pencere (`currentSeed`). Sunucu üretir, sonuçla döner, istemci
  oturum boyunca aynı tohumu geri gönderir → sayfa 2'ye geçince vitrin titremez, ertesi
  gün gelen farklı bir vitrin görür. URL'e YAZILMAZ.
- **Sıralama üç durumlu**: FİYAT/TARİH/MARKA düğmeleri 1. basış artan → 2. azalan →
  3. nötr (= KEŞFET). `cycleSort` tek kaynak (query.ts); ızgara başlığı ve filtre paneli
  aynı fonksiyonu çağırır. Eksik veri (fiyatı olmayan ürün) YÖNDEN BAĞIMSIZ sona gider.
- **Listeler** (`src/lib/lists.ts` + `ListBar`/`SharedListView`): çoklu liste,
  localStorage'da (`altr-lists-v1` = id'ler, `altr-list-cache-v1` = ürün gövdeleri).
  Eski tek listeli `altr-showcase` ilk açılışta otomatik taşınır. Paylaşım SUNUCUSUZ:
  ürün id'lerinin 8 karakterlik karma kodu linke gömülür (`/?liste=kod.kod&ad=…`),
  sunucu SSR'de katalogdan çözer. Hesap sistemi gelince değişecek tek yer depo katmanı.
- **Node 24 tip-soyma**: `.mjs` script'ler `src/lib/*.ts`'i doğrudan import eder
  (`from "../src/lib/categorize.ts"`). tsconfig'de `allowImportingTsExtensions: true`.
  Böylece kategori/cinsiyet/para birimi mantığı site ile script arasında TEK kopya.

## Komutlar

```bash
npm run dev -- -p 3001      # port 3001
npm run scrape              # tüm markalar -> .data/full/<slug>.json  (~3 saat)
npm run import-catalog      # .data/full/* -> .data/catalog.json
npm run refresh             # tazele + import (saatlik için) — HENÜZ HİÇ ÇALIŞTIRILMADI
npm run audit-brands        # her markayı yokla, neyin çekilemediğini raporla
npm run fetch-logos         # eksik logoları indir
npm run typecheck
npm run check-categorize    # kategori kurallarının doğruluk listesi (39 gerçek ürün adı)
npm run check-brand-styles  # her markanın tarzı var mı, yetim/geçersiz slug var mı
npm run check-sizes         # beden normalizasyonu (50 gerçek ham değer); --tara ile ham veriyi de tarar
npm run check-cat-groups    # her ürün kategorisi bir çatının altında mı
npm run check-colors        # renk etiketi kapsaması + sapmalar; --ornek ile gözle denetim
npm run check-discovery     # akışın başı katalog ortalamasını geçiyor mu (beden/görsel/renk)
npm run check               # yukarıdakilerin hepsi

npm run tag-colors          # ürünleri renge göre etiketle -> data/color-tags.json
                            # (--force / --only <slug> / --kaynak <dosya> / --limit N)
                            # import-catalog'dan ÖNCE çalışır; import onu yalnız okur
npm run admin-hash -- <handle> <eposta> <parola>   # ADMIN_ACCOUNTS satırı üretir
```

İki dev server aynı anda çalışacaksa ikincisini `NEXT_DIST_DIR=.next-b` ile başlat —
yoksa ikisi de `.next`e yazıp birbirinin route dosyasını siler.

Faydalı bayraklar: `--only slug1,slug2`, `--platform ikas`, `--dry`, `--force`,
`--concurrency N`, `fetch-logos -- --only <slug> --dry` (aday puanlarını yazar).

## AÇIK İŞLER

**Öncelikli**
1. `npm run refresh` **hiç çalıştırılmadı** — yazıldı, tek marka bile denenmedi. İlk
   çalıştırmada `--only void --force` ile küçük başla.
2. **Saatlik zamanlama kurulmadı** — komutlar `docs/canli-tazeleme.md`'de hazır
   (Windows `schtasks`, Linux cron). Kurulumu senin kararın.
3. **Katalog belleği** — 2026-07-30 üçüncü turunda ÖLÇÜLDÜ ve tam katalog canlıya
   alındı: 121 MB dosya, ~480 MB heap (yalnız katalog), sunucu süreci **1.551 MB**
   working set, boş RAM 3 GB'ta stabil. Yani tam katalog bu makinede ÇALIŞIYOR.
   Kalan risk aynı: boş RAM 1,5 GB'a inerse `next dev` yine ölür (heap tavanı değil,
   sistem belleği — bkz. TUZAKLAR "Bellek"). Sıkışırsan `npm run dev:hafif`.
   İyileştirme yolları hâlâ açık: varyant başına görsel sayısını düşürmek
   (`MAX_IMGS_PER_VARIANT`, şu an 5) veya sorgu için indeks kurmak.

**Orta**
3b. **[2026-07-30 üçüncü turda P1'e YÜKSELTİLDİ — tablo çok yayvan, ölçüldü: 163 markanın
   111'i 3–3.5 bandında, 4 üstü yalnız 3 marka. Keşfet rotasyonu ve öne çıkan primi
   çalışıyor ama ayırt edecekleri puan farkı yok.]**
   **Marka puanları tahmini** — `data/brand-scores.json` doğrulanmış takipçi/yorum
   verisiyle DEĞİL, tanınırlık + medyan fiyat + katalog kürasyonu izlenimiyle verildi.
   Gerçek veri toplandığında dosyadaki sayıları güncellemek yeterli, kodda değişiklik
   gerekmez. Keşfet akışının en ağır girdisi burasıdır — yanlış puan doğrudan vitrine yansır.
3c. **Davranış logu henüz akışa girmiyor** — `src/lib/events.ts` yalnız çıkış tıklamasını
   yazıyor. Görüntülenme/tıklama biriktikçe `discovery.ts`'te marka puanının yanına
   davranış sinyali eklenmeli (skoru orada karıştırmak tek satırlık iş; asıl eksik veri).
4. 7 aktif markanın logosu yok: aksesuarix, black-sample-jewellery, crupt-studio,
   dantelions, giesto, so-high, x-puppet-wear. (4'ü `brand-logo-overrides.json`'da
   bilerek `null` — otomatik seçim ürün fotoğrafı/kategori döşemesi getiriyordu.)
5. **Shopier adaptörü yok** — fadeback-studio ve manic-sellout bu yüzden arşivde.
6. DİĞER **~1.000 ürüne indi** (eskiden 2.459). Kalanların çoğu marka-kodu adlı ürünler
   ("MC-SS25 3", "JET CANDY 063") — addan sınıflandırılamıyor, kural eklemek çözmez.
7. Cinsiyet %81 unisex — markaların ad/etiketlerinde sinyal yok. Unisex zaten iki
   filtrede de çıkıyor (istenen davranış), ama filtre ayırt edici değil.

**Eskiden beri açık (bu turda dokunulmadı)**
8. Telif/ToS netleştirme — artık marka LOGOLARI da var (tescilli işaret) + çıkış
   tıklaması topluyoruz. Canlıya almadan netleşmeli.
9. Kalıcı **ürün** sayfası yok (sadece modal). Marka sayfaları AÇILDI (`/<marka-slug>`).
10. Vitrindeki tıklanabilirler hâlâ `<span onClick>` (a11y + SEO). Marka sayfalarında
   ve markalar rehberinde gerçek `<a>` kullanılıyor.
11. Gelir modeli/affiliate yok. (Tükendi-sona sıralama YAPILDI.)
11b. Listeler cihaza bağlı (localStorage) — üyelik geldi ama listelere BAĞLANMADI.
   `lib/lists.ts`'teki `loadLists`/`saveLists` sunucuya bağlanacak; model hazır.
   Paylaşım linki listenin O ANKİ hâlini taşır; sonradan eklenen ürün linke yansımaz.
12. Elle vitrin denetimi (ölü ürün linkleri).

**Bedenden kalan işler**
6a. **abluka ARTIK ÇEKİLİYOR — bu madde 2026-07-29 üçüncü turunda kapandı.**
   Eski hâli "üç deneme de OOM ile düştü, heap büyütmek çözmüyor, tekrar deneme" diyordu.
   Yeniden ölçüldü: 120 sayfa boyunca heap **13 MB'da düz** kaldı, tam tarama sorunsuz
   bitti (2.789 kayıt · 2.789 fiyatlı · 2.743 bedenli). Sızıntı `detach()` ile kapanmış
   olmalı. `--skip abluka` gerekmiyor.
6b. **crupt-studio erişilemiyor** (Cloudflare arkasında, bu makineden `fetch failed`).
   Dosyadaki 307 kaydı korundu; ürünleri zaten zincir/kolye, bedeni olmayan takı.
6c. Hâlâ bedensiz kalan az sayıda jeton var (%0,02): şapka santimi ("57.7"), ABD
   ayakkabı numarası ("6US"), bir telefon kılıfı ("17 Pro Max"). Kanonik jetona
   çevrilmiyorlar ama ATILMIYORLAR — modalda ve filtrede olduğu gibi görünüyorlar.
6d. Bazı markaların bedeni GERÇEKTEN yok: aksesuarix, black-sample-jewellery,
   hoghheim'in şapka/ayakkabı rafı. Bunlarda düşük "bedenli %" bir hata değil.

**Üyelikten kalan işler** (bkz. `src/lib/auth.ts`)
13. **E-posta gönderimi bağlı değil.** `deliverCode()` şu an kodu yalnız günlüğe yazıyor;
   `AUTH_DEV_CODES` açıkken kod API cevabında ve giriş ekranında görünüyor. Canlıya
   çıkmadan bir SMTP/servis bağlanmalı ve bayrak kapatılmalı.
14. **Google girişi yapılandırılmadı** — `GOOGLE_CLIENT_ID`/`SECRET` yoksa düğme hiç
   çizilmiyor (kod tarafı hazır, `/api/auth/google`).
15. **`business` rolü yalnız bir etiket** — hiçbir yetki açmıyor, çünkü markanın gerçekten
   o kişiye ait olduğunu doğrulayacak bir akış yok.
16. Hesaplar `.data/auth/*.json` dosyalarında. Tek düğüm için yeterli; çok düğüme
   çıkarken depo katmanı değişmeli.

## TUZAKLAR — tekrar düşmemek için

- **Next env yükleyicisi `$`'ı yer**: `.env.local`de `scrypt$tuz$ozet` yazarsan
  `$tuz` bir değişken sanılıp silinir ve elinde `scrypt` kalır. Doğru parola bile 401
  alır, sebep kodda aranır. Sırlarda `$` ayraç olarak KULLANMA (`.` güvenli).
- **Aynı klasörde iki dev server `.next`i paylaşır** ve birbirinin derlenmiş route
  dosyasını siler: uçlar rastgele 404/500 döner, sunucu logunda
  `ENOENT ... app/api/<uc>/route.js` görürsün. İkincisini `NEXT_DIST_DIR=.next-b` ile
  başlat (bkz. `next.config.ts`).
- **`productQuality` içindeki bir ağırlık, keşfet gürültüsünün altında kalabilir.**
  Fonksiyon yedi sinyali 0–1'e sıkıştırıyor ve `baseScore` onu 0.37 ile çarpıyor →
  bir kademe skora ~0.06 katıyor; keşfet gürültüsü 0.30. Bir sinyalin akışta GÖRÜNÜR
  etkisi olmasını istiyorsan `freshBonus`/`sizeBonus` gibi ÜSTTEN eklenen ayrı bir terim
  yaz. Ölçüldü: içeride artırmak 1.13→1.14, bonus 1.27 (`npm run check-discovery`).
  Ayrıca toplam `Math.min(1, q)` tavanına dayanıyorsa yeni sinyal diğerlerini köreltir —
  bütçeden yer aç.
- **Renk ölçümünde nötrleri bölme.** Aynı beyaz kumaşın ışıklı yeri "beyaz", gölgesi
  "gri", sarımsı ışığı "bej" okunuyor; üçe bölününce hiçbiri eşiği geçemiyor ve ürün
  yanlış etiketleniyor. Nötrler tek kovada toplanmalı. Aynı sebeple "çok renkli"
  kararı YALNIZ kromatik ailelere bakmalı — nötrler sayılınca düz beyaz tişört bile
  çok renkli çıkıyordu (17/120 → 1/120).
- **Doygunluğu düşük piksel renk değil ışıktır**: beyaz tişörtün mavimsi gölgesi
  "mavi" etiketi kazandırıyordu. %20 altı gri eksenine indiriliyor.
- **Giriş yapmak başkasının listesini taşımamalı.** Cihazdaki liste ile hesaptakini
  birleştirmek doğru (giriş yapmadan biriktirilmiş liste kaybolmasın) ama cihaz verisi
  BAŞKA bir hesaba aitse birleştirme bir sızıntıdır. `altr-sync-owner` bunun için var.
- **`pop` alanı sahte**: katalogun %58'inde sabit 50, kalanında `100−day`. Popülerlik
  ÖLÇMÜYOR. "POPÜLER" sıralaması bu yüzden kaldırıldı; hiçbir yerde kullanma.
- **`day` alanı yarı sahte**: yalnız shopify/woocommerce adaptörlerinde gerçek,
  ikas/jsonld sabit 20 yazıyor (34.702 ürün). Eski "YENİ" kategorisi bu yüzden
  katalogun %64'ünü hiç göremeyen 630 ürünlük yanlı bir listeydi — kaldırıldı.
- **Serpme ≠ dokuma**: markaları listeye eşit aralıkla yayan "stride" yöntemi denendi ve
  ilk ekranı büyük katalog markalarıyla doldurdu (4560 ürünlü markanın adımı 12 olduğu
  için ilk ürünü hep en başa düşüyor). Sıralamayı ürün seçerek kurmak gerekiyor.
- **Sayfalama tutarlılığı**: dokuma sınırı istenen SAYFAYA göre değişirse 2. sayfa ile
  38. sayfa isteği farklı diziler üretir, ürünler tekrar eder/kaybolur. `WEAVE_LIMIT`
  sabit olmalı.

- **Türkçe küçültme İngilizceyi bozar**: `trLower` her büyük "I"yı noktasız "ı" yapar.
  "HIRKA" → "hırka" doğru, ama "CARDIGAN" → "cardıgan", "BEANIE" → "beanıe" yanlış.
  Düz `toLowerCase()` tam tersini yapar. TEK BİR KURAL YOK. Çözüm iki yerde:
  `categorize()` her kuralı İKİ metne birden uygular; kategori adının cümle içinde
  küçük harfli hâli gerekince `types.ts`'teki elle yazılmış `CAT_LOWER` kullanılır.
  Bir yerde `toLocaleLowerCase("tr")` görürsen İngilizce sözcük geçip geçmediğini kontrol et.
- **Türkçe regex sınırı**: JS'in `\b`'si ş/ç/ı/ğ/ö/ü'yü sözcük karakteri saymaz;
  `\bşort\b` bir boşluktan sonra ASLA eşleşmez. `categorize.ts`'te özel sınır var:
  `(?<![a-zçğıöşü0-9])`.
- **Kategori kural SIRASI kritik**: "t-shirt" içindeki "shirt" GÖMLEK'e düşüyordu.
  Sıra: HOODIE > SWEATSHIRT > TİŞÖRT > GÖMLEK.
- **Kaynağın eski kategorisini ipucu verme**: "ÜST / FORMA" metni FORMA kuralını
  tetikliyor, 1298 ürün yanlış kovaya gidiyordu. Yalnız ürün adından sınıflandır.
- **Giyilemez filtresi YALNIZCA DİĞER'e uygulanır**: yoksa "Kanvas Çanta",
  "Halı Desenli T-Shirt", "Havlu Triko Polo" gibi geçerli ürünler elenir.
- **İkas API varyant düzeyinde satır döner**: aynı ürün her rengi için ayrı satır ama
  her satır TÜM varyantları taşır → önce ürün id'sine göre tekilleştir, sonra renklere böl.
- **`getText`/`getJson` asla fırlatmamalı**: fırlattıkları sürümde tek bozuk ürün sayfası
  `Promise.all`'dan kaçıp markanın tamamını düşürüyordu (the-mets-co 0→1087).
- **Sessizce atlanan sayfa = sessizce kaybolan ürün**: `fetchJsonLd` alınamayan ürün
  sayfasını atlıyor (doğru — tek sayfa markayı düşürmemeli) ama eskiden bunu HİÇBİR YERE
  yazmıyordu. Sonuç: marka "çekildi" görünüyor, katalogda yarısı yok. gotham'da 734
  sayfanın 534'ü böyle kaybolmuştu. Kural: bir şeyi atlıyorsan SAY ve rapora yaz.
  Şimdi düşen sayfalar tek akışta bir kez daha deneniyor; kalan kayıp nota yazılıyor.
- **"Boş sonuç" koruması YETMİYOR, KÜÇÜLME de korunmalı.** punk-design'ın mağazası
  2. sayfadan itibaren 429 (hız sınırı) döndürünce ilk sayfanın 279 kaydı, dosyadaki
  5422 kaydın üstüne sessizce yazıldı — koruma yalnız "0 kayıt"a bakıyordu. Artık
  `run.mjs` yeni sonuç eskinin %60'ından küçükse dosyaya DOKUNMUYOR ve rapora
  "ÖNCEKİ VERİ KORUNDU: n vardı, m geldi" yazıyor (`--force` ile aşılır). Shopify
  adaptörü de sayfalar arasında bekliyor, 429'da uzun soluklanmayla bir kez daha
  deniyor ve başaramazsa nota "TARAMA YARIM KALDI" yazıyor.
  *(Kaybedilen punk-design verisi `altr-0.0.3/.data/full/`ten geri alındı — sürüm
  klasörleri bir yedek görevi görüyor, silmeden önce iki kez düşün.)*
- **Bir markanın küçülmesi her zaman hata değil**: only-trend-wear 6913→4668 düştü,
  sebep bizim kod değil — mağaza çocuk serisini kaldırmış (canlı `totalCount` 2635 ile
  doğrulandı). Küçülme uyarısını gördüğünde önce KAYNAĞA bak.
- **Eşzamanlılık kayıp üretir**: aynı sayfalar sıra sıra istendiğinde sorunsuz geliyor,
  5 paralel istekte site bağlantı kesiyor. Bir markadan beklenenden az ürün geliyorsa
  önce eşzamanlılığı düşürüp tek marka dene — kodda hata aramadan önce.
- **Scraper de OOM oluyor** (dev server gibi): `--concurrency 3` ile büyük Ticimax
  markaları (kostebek/sokak-butik/nomarc, her biri 6000 sayfa) aynı anda çekilirken
  V8 heap doldu ve süreç 12. markada öldü — o ana kadarki 12 marka diske yazılmıştı,
  kalan 9'u kaybedildi. **Büyük markaları TEK TEK çek**:
  `NODE_OPTIONS=--max-old-space-size=6144 ... --only <slug> --concurrency 1`.
  Marka başına ayrı süreç, biri düşerse diğerleri etkilenmez.
- **Asıl sebep: V8 "dilim string"leri.** `slice`/regex yakalaması yeni string üretmez,
  KAYNAK metni işaret eder. Yani 40 karakterlik bir ürün adı, geldiği 475 KB'lık sayfayı
  bellekte canlı tutuyordu; 6000 sayfada birkaç GB. `jsonld.mjs`'teki `detach()` her
  sayfanın kayıtlarını JSON turundan geçirip bağı koparıyor. Ham HTML'den alan çıkaran
  yeni bir adaptör yazarsan aynı tuzağa dikkat et.
- **Boş sonuç dolu veriyi ezmemeli**: sigma-wears sitede 467 ürünken katalogda 0'dı,
  sebebi geçici bir hatanın sessizce `[]` yazmasıydı. Son-iyi koruması var.
- **`import-catalog` küçülme emniyeti**: yeni katalog mevcudun %60'ından küçükse İPTAL
  eder (`--force` ile geçilir) — yarım scrape katalogu ezmesin diye.
- **Bellek**: dev server ölüyorsa önce `wmic OS get FreePhysicalMemory /format:list`.
  Kod hatası sanma. Tarayıcı testi gerekiyorsa katalogun küçük bir alt kümesini geçici
  olarak `.data/catalog.json`'a yaz (yedeğini alıp sonra geri yükle) — bu işe yaradı.
- **Browser paneli görünmüyorsa** screenshot alınamaz; doğrulamayı `javascript_tool` ile
  DOM üzerinden yap, yeterli oluyor.

## Marka listesi yolları

- `src/lib/brand-names.json` — görünen adlar (166; selsil 2026-07-30'da silindi)
- `src/lib/brands.generated.ts` — slug → { url, platform }
- `data/brands.csv` — keşif kaynağı, `npm run discover`
- `data/brands-archived.json` — vitrinde gösterilmeyenler + sebebi (5 kayıt; selsil
  markalardan tamamen silindi, satır "bir daha ekleme" notu olarak duruyor)
- `data/brand-audit.json` — `npm run audit-brands` çıktısı (marka başına teşhis)
- `data/brand-logo-overrides.json` — logo seçimi elle düzeltme
- `data/brand-scores.json` — **editoryal marka puanı (1–5)**, keşfet akışının omurgası
- `data/brand-styles.json` — **editoryal marka TARZI** (streetwear/basic/techwear/
  ravewear/spor/old-money), tarz filtresinin tek kaynağı
- `data/brand-logo-kind.json` — logo sembol mü wordmark mı + ad yazılacaksa fontu

---

## 2026-07-30 (dördüncü tur) — hız / logo kuralı / bulanıklık

### 1. "Kategoriye geçince ürünleri beklemek" — darboğaz görsel proxy'sinin KUYRUĞUYDU

`/api/products` zaten hızlıydı (ölçüldü: 70–210 ms). Bekleten şey `/api/img`:
`img-cache.ts` içindeki upstream semaforu **tek küresel 8'lik kuyruktu**. Oysa bir
ızgaradaki 40 kart 15–20 FARKLI markanın CDN'inden geliyor; hepsi aynı sıraya diziliyor
ve yavaş cevap veren (ya da 5 sn'lik timeout'a giden) tek bir kaynak hızlıları da
bekletiyordu.

Kuyruk **kaynak (host) başına** ayrıldı: `PER_HOST=6` + toplam `MAX_UPSTREAM=32`
(`IMG_FETCH_PER_HOST` / `IMG_FETCH_CONCURRENCY` ile ayarlanır). `withUpstreamSlot` artık
ikinci parametre olarak host alıyor, `/api/img` `u.hostname`i geçiyor.

**Ölçüm** (aynı makine, soğuk kategori, 40 görsel, w=900, eski kod vs yeni kod):

| kategori | eski (tek kuyruk) | yeni (host başına) |
|---|---|---|
| kemer / çanta | 8.552 ms | 2.950 ms |
| şapka / mont  | 5.336 ms | 2.126 ms |

Son görselin geldiği an ~3 kat öne çekildi.

### 2. "Yanıp sönen ışıklar" — iskelet animasyonu

`.img-skel { animation: skel 1.2s steps(2) infinite }`. `steps(2)` yumuşak bir nabız
değil SERT bir yanıp sönme üretiyor ve kategori değişince ekrandaki 40 kart birbirinden
bağımsız fazlarda aynı anda yanıp sönüyordu. Animasyon kaldırıldı; yerine hareketsiz,
düşük kontrastlı bir zemin. Ayrıca:

- Bekleme katmanı artık paneli TAMAMEN kaplıyor (eskiden ortadaki yazı kutusu kadardı,
  yani iskelet zemini zaten görünmüyordu).
- **"[ YÜKLENİYOR ]" yazısı kaldırıldı** — 40 kartta aynı anda belirip kaybolunca vitrin
  titriyordu. Hata/boş durumda placeholder metni duruyor.
- Görsel `opacity .18s` ile açılıyor, "pat" diye belirmiyor.

### 3. Bulanıklık — `sizes` ÖLÇÜLDÜ ve yanlıştı

`ProductCard.SPEC.sizes` sabit piksel yazıyordu (`"330px"`), oysa ızgara akışkan
(`repeat(4,minmax(0,1fr))`). 1920px'lik ekranda gerçek kart **387px** ölçüldü; tarayıcı
"330px" duyduğu için **360** basamağını indirip 387px'lik yuvaya büyütüyordu — yani
DPR 1 olan ekranların TAMAMINDA vitrin sistematik olarak yumuşaktı. (Bir önceki tur
`imgW` tavanlarını düzeltmişti; `sizes` gözden kaçmıştı, ikisi birlikte gerekiyormuş.)

`sizes` artık ızgaranın kendisi gibi vw cinsinden ve gerçek ölçüden biraz YUKARI
yuvarlanmış: sık 15vw · ızgara 22vw · iri 45vw · liste 220px. Doğrulandı: 1345px'te
243px yuvaya 360, 1920px'te 387px yuvaya 480 iniyor (önce 360'tı).

### 4. Marka adı KURALI: yalnız sembol logoların yanına

Kullanıcı kararı: adı zaten harflerle taşıyan bir logonun yanına adı bir kez daha yazmak
tekrar (örn. reflect-studio). `BrandLogo`daki `LEGIBLE_RATIO` mekanizması —
"wordmark genişlik tavanına çarpıp inceldiyse adı yine de yaz" — **kaldırıldı**.

Doğru çözüm adı tekrar yazmak değil, logoya YER VERMEK: genişlik tavanları gerçek kart
ölçülerine göre yükseltildi (kart 104→190, çip 150→240, ürün modalı 170→250, paylaşılan
liste 110→200, mobil CSS 108/104→190/180).

Bunun bedeli: kararın tek dayanağı artık `data/brand-logo-kind.json`. Tablo bu turda
**157 logonun tamamı için** dolduruldu (60 marka oran tahminine bırakılmıştı).

### 5. Logolar yeniden çekildi + ZEMİN TEMİZLEME

`scripts/fetch-brand-logos.mjs`:

- **`stripFlatBackground`** eklendi: logonun arkasındaki düz beyaz/siyah kutuyu
  kenardan taşma (flood fill) ile şeffaflaştırıyor. Renkli zeminler (cordelia'nın
  kırmızısı, cucire'nin lacivertı) doygunluk eşiğiyle korunur; `_zemin_koru` listesi
  elle muafiyet verir. Kenar yumuşatma bandında yalnız ALFA oranlanıyor —
  "un-premultiply" ile rengi geri kazanmak denendi, JPG kaynaklarda harflerin çevresinde
  PARLAK çerçeve üretti, vazgeçildi. Gradyanlı/gürültülü zemin için ikinci, cömert
  toleranslı deneme var (drip-house/deer-wear/norv bu yüzden temizlenmiyordu).
- **`--force` artık eldekini SİLMİYOR, üzerine yazıyor.** Eskiden başta topluca
  siliyordu ve ağdaki geçici bir aksaklık ÇALIŞAN bir logoyu kalıcı olarak yok ediyordu
  (bir turda 4 marka böyle kayboldu, tek tek çalıştırılınca sorunsuz geldiler).

**point-2124**: otomatik seçim ödeme rozeti şeridini (iyzico/Mastercard/VISA/Amex/troy)
logo sanmıştı. Gerçek logo — "POINT" + braille noktaları — override'a yazıldı.
hotel-471 ve drip-house için de override eklendi.

**Not**: `nuugg.com` tüm görsellerini `lofux.com`dan servis ediyor, header logosu da
"lofux" yazıyor. Yanlış çekim değil, markanın sitesi öyle.

Denetim yöntemi: bütün logolar tek tek kontak baskısı olarak ORTA GRİ zemine dizilip
gözle geçirildi (beyaz ya da siyah zeminde logoların yarısı görünmüyor). Yedek:
`.data/brand-logos-yedek-*`.

**Yeniden çekilemeyenler (57 marka)**: sitelerinden aday logo dönmedi (ana sayfa
JS ile çiziliyor ya da art arda istekten sonra kapı kapandı). Eldeki dosyaları
korundu — hepsi çalışıyor, sadece yeni zemin temizliğinden geçmediler. İleride
`--only <slug> --force` ile tek tek denenebilir.

### 6. Üst şeritten MARKALAR kaldırıldı

Rehberin girişi sol menüde (CategoryNav) zaten var; `/markalar` yolu ve sekme mantığı
yerinde. `TopBar` artık `view`/`setView`/`openMarkalar` okumuyor.
