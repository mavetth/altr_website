# Canlı tazeleme — kurulum

Hedef: bir ürünün fiyat / para birimi / stok / beden / renk bilgisi **en fazla 1 saat**
bayat olsun.

## Nasıl çalışıyor

`npm run refresh` markaları iki kovaya ayırır:

| kova | markalar | maliyet | sıklık |
|---|---|---|---|
| **Hızlı API** | Shopify (`/products.json`), İkas (storefront GraphQL), WooCommerce (Store API) | marka başına saniyeler | her turda hepsi |
| **Sayfa taraması** | Ticimax, T-Soft, platformu tanınmayan siteler | marka başına dakikalar | en bayat olandan başlayarak, zaman bütçesi dolana kadar |

Markaların ~%75'i hızlı kovada. Yavaş kova sırayla döner (round-robin, en bayat önce),
böylece hiçbir marka aç kalmaz. Her tur sonunda katalog (`.data/catalog.json`) yeniden
üretilir ve site bir sonraki isteğinde yeni veriyi servis eder.

Boş sonuç **asla** dolu veriyi ezmez: bir marka geçici olarak erişilemez hâle gelirse
önceki verisi korunur (geçmişte tam bunun yüzünden bir markanın 467 ürünü katalogdan
tamamen düşmüştü).

## Elle çalıştırma

```bash
npm run refresh                          # varsayılan: 60 dk hedef, 45 dk bütçe
npm run refresh -- --budget-min 20       # daha kısa tur
npm run refresh -- --only void,machinist # tek marka
npm run refresh -- --force               # yaşına bakma, hepsini tazele
```

Durum `.data/refresh-state.json` içinde tutulur (marka başına platform + son tazeleme anı).
Tur sonunda hangi markaların hâlâ bayat kaldığı ekrana yazılır.

## Saatlik zamanlama

### Windows (geliştirme makinesi)

Görev Zamanlayıcı'ya saatlik bir görev ekle:

```bash
schtasks /Create /TN "altr-refresh" /SC HOURLY /TR "cmd /c cd /d \"C:\Users\Tuna Demir\Documents\altr-0.0.3\" && npm run refresh >> .data\refresh.log 2>&1" /F
```

Kaldırmak için: `schtasks /Delete /TN "altr-refresh" /F`

### Linux / Docker (sunucu)

```cron
5 * * * * cd /srv/altr && /usr/bin/npm run refresh >> /var/log/altr-refresh.log 2>&1
```

### Vercel

Serverless dosya sistemi salt-okunur olduğu için tazeleme orada **çalışmaz**; katalog
build zamanında gömülür. Canlı tazeleme isteniyorsa iki seçenek var:

1. Tazelemeyi ayrı bir sunucuda/işçide çalıştırıp `.data/catalog.json`'ı ortak bir
   depoya (S3/R2 vb.) yazmak ve `readCatalog()`'u oradan okutmak.
2. Uygulamayı kendi sunucunda (`output: "standalone"`) çalıştırmak — cron doğrudan işler.

## Tazelemenin gerçekten çalıştığını görmek

```bash
node -e "const a=require('./.data/catalog.json');const p=a.find(x=>x.brandSlug==='void');console.log(p.name,p.price,p.currency,p.variants[0].sizes)"
cat .data/refresh-state.json | head -20
```
