"use client";
import { useState } from "react";
import type { Product } from "@/lib/types";
import { formatPrice, defaultVariantIndex } from "@/lib/query";
import { previewSizes, shortSizeLabel, hasSizeInfo } from "@/lib/sizes";
import { useStore, type Layout } from "@/store";
import { useLang } from "@/lib/lang";
import { useReviewSummary } from "@/lib/reviews-client";
import { ProductImage } from "./ProductImage";
import { BrandLogo } from "./BrandLogo";
import { ColorSwatches } from "./ColorSwatches";
import { RatingLine } from "./Stars";
import { HangerIcon } from "./icons";
import { RestockVote } from "./RestockVote";
import { flyToVitrin } from "@/lib/vitrin-flight";

/**
 * ÜRÜN KARTI.
 *
 * Kartın ağırlık merkezi FOTOĞRAF. Ad, fiyat ve marka "bakmak isteyince görülecek"
 * ikincil bilgi — bu yüzden görsel büyütülüp altındaki yazılar küçültüldü. Marka logosu
 * da artık tıklanabilir bir çıkış değil: kart içinde iki farklı hedef (modal / marka
 * modali) kullanıcıyı tereddütte bırakıyordu. Markaya gitmenin yolu MARKALAR sekmesi ve
 * ürün modali; karttaki logo yalnız "bu kimin" sorusunu cevaplıyor ve HER KARTTA AYNI
 * DİKEY ÖLÇÜDE duruyor (bkz. BrandLogo `fixedH`).
 *
 * Dört gösterim biçimi var (bkz. store.ts Layout); hepsi bu tek bileşenden çıkıyor,
 * ölçüler aşağıdaki tablodan geliyor.
 */

interface CardSpec {
  /** Görsel panelinin en/boy oranı. */
  aspect: string;
  radius: number;
  /** İstenen görsel genişliği (srcSet basamağı). */
  imgW: number;
  sizes: string;
  name: number;
  price: number;
  logo: number;
  logoMaxW: number;
  /** Görsel üstündeki düğmelerin köşeden uzaklığı. */
  inset: number;
  /** Beden baloncuklarını göster (sık ızgarada yer yok). */
  showSizes: boolean;
  /**
   * Renk noktasının çapı (px). Ölçüler bir tur BÜYÜTÜLDÜ: 11–17px noktalar bir
   * tıklama hedefi olarak da, rengi okumaya yarayan bir işaret olarak da küçüktü —
   * özellikle yakın iki ton (lacivert/siyah) 11px'te ayırt edilemiyordu.
   */
  swatch: number;
}

/**
 * `imgW` = srcSet merdiveninin TAVANI, kartın CSS genişliği değil.
 *
 * Bu değerler 2026-07-30'da yükseltildi ve sebebi görsellerin bulanık görünmesiydi.
 * Eski hâlde ızgara kartı `imgW: 520` istiyordu; merdiven (`ProductImage.STEPS`)
 * 520'nin ALTINDAKİ basamaklarla kuruluyor, yani en büyük seçenek **480px** oluyordu.
 * Kart masaüstünde 330px genişliğinde ve retina (2x) ekranda 660px'lik veri istiyor —
 * tarayıcı elindeki en büyüğü, 480'i alıp büyütüyordu. Yani vitrin, 2x ekranların
 * tamamında sistematik olarak yumuşak görünüyordu.
 *
 * Yeni tavanlar her biçim için "CSS genişliği × 2"nin üstündeki basamağı içerecek
 * şekilde seçildi. Maliyeti bant genişliği, karşılığı net bir vitrin.
 *
 * `sizes` DE YANLIŞTI (2026-07-30, ikinci düzeltme) — asıl bulanıklık sebebi buydu.
 * Sabit piksel yazıyordu ("330px"), oysa ızgara AKIŞKAN: `repeat(4,minmax(0,1fr))`
 * sütunları pencereyle birlikte büyüyor. 1920px'lik bir ekranda ızgara kartı ÖLÇÜLDÜ:
 * gerçek genişlik **387px**, `sizes` ise tarayıcıya 330px diyor → tarayıcı 360
 * basamağını indirip 387px'lik yuvaya BÜYÜTEREK yerleştiriyordu. DPR 1 olan ekranlarda
 * bile, yani "retina değilim" diyen herkeste, vitrin sistematik olarak yumuşaktı.
 *
 * Artık `sizes` de ızgaranın kendisi gibi vw cinsinden yazılıyor; sayılar 1920px'te
 * ölçülen gerçek kart genişliğinden türetildi ve bilerek biraz YUKARI yuvarlandı —
 * `sizes`i olduğundan büyük söylemek en fazla bir basamak fazla veri indirtir, küçük
 * söylemek ise görseli garanti bulanıklaştırır.
 */
const SPEC: Record<Layout, CardSpec> = {
  sik: {
    // 6 sütun → 1920'de ~250px (≈13vw); 15vw payla 2x'te 900 basamağına çıkabilsin
    aspect: "1", radius: 34, imgW: 900, sizes: "(max-width:820px) 46vw, 15vw",
    name: 11, price: 11.5, logo: 11, logoMaxW: 130, inset: 10, showSizes: false, swatch: 14,
  },
  izgara: {
    // 4/5 dikey: giyim fotoğrafı zaten dikey çekiliyor, kare çerçeve görselin üstünü
    // ve altını boşa harcıyordu. Aynı sütun genişliğinde görsel alanı %25 büyüdü.
    // 4 sütun → 1920'de ölçülen 387px (≈20vw); 22vw payla
    aspect: "4/5", radius: 56, imgW: 900, sizes: "(max-width:820px) 46vw, 22vw",
    name: 13, price: 13.5, logo: 13, logoMaxW: 190, inset: 16, showSizes: true, swatch: 16,
  },
  buyuk: {
    // 2 sütun → 1920'de ~800px (≈42vw); merdivenin tavanı 1200 (CFG.imgMaxWidth)
    aspect: "4/5", radius: 88, imgW: 1200, sizes: "(max-width:820px) 92vw, 45vw",
    name: 16, price: 17, logo: 17, logoMaxW: 250, inset: 24, showSizes: true, swatch: 20,
  },
  liste: {
    // Tek satır, görsel gerçekten sabit 220px (bkz. `panel` width) → vw'ye çevirmek
    // yanlış olurdu. 2x için 480 yeter, 3x'te 720'ye çıkabilsin.
    aspect: "4/5", radius: 34, imgW: 720, sizes: "(max-width:820px) 38vw, 220px",
    name: 16, price: 17, logo: 15, logoMaxW: 220, inset: 12, showSizes: true, swatch: 18,
  },
};

/**
 * Liste satırındaki bilgi bloğunun SABİT genişliği ve görsele uzaklığı.
 * Sabit olması şart: blok içeriğine göre genişleyince her kartın ortası başka bir
 * noktaya düşüyor ve sütun boyunca hiçbir satır hizalanmıyordu.
 */
const LISTE_BILGI_W = 330;
const LISTE_ARALIK = 12;

export function ProductCard({
  p,
  context,
  index,
  layout = "izgara",
}: {
  p: Product;
  context: Product[];
  index: number;
  layout?: Layout;
}) {
  const openDetail = useStore((s) => s.openDetail);
  const toggleShowcase = useStore((s) => s.toggleShowcase);
  const inShow = useStore((s) => s.showcase.some((x) => x.id === p.id));
  const rating = useReviewSummary(p.id);
  const { t, lang } = useLang();
  const loc = lang === "en" ? "en-US" : "tr-TR";

  // Seçili renk varyantı. Görsel, bedenler, fiyat ve mağaza linki buna göre değişir —
  // renk noktaları artık salt süs değil, ürünün o rengini gösteren gerçek bir seçim.
  const [vi, setVi] = useState(() => defaultVariantIndex(p));
  const v = p.variants[vi];
  const image = (v && p.images[v.imgs[0]]) ?? p.image;
  // Ana görsel ölürse (kaynakta silinmiş/404) kart boş kalmasın: önce bu rengin diğer
  // fotoğrafları, sonra ürünün tüm havuzu denenir. Bkz. ProductImage `fallbacks`.
  const imageAlts = [...(v?.imgs.map((i) => p.images[i]) ?? []), ...p.images, p.image];
  const sizes = v?.sizes.length ? v.sizes : p.sizes;
  // Baloncuklar YALNIZ ÜRETİLEN bedenleri gösterir — sönük "yok" kutusu yok, çünkü veri
  // "tükendi" ile "hiç üretilmedi"yi ayırmıyor ve sönük kutu yanlış bilgi veriyordu.
  // Pencere XS'ten başlar, sığmayanlar "+n" olur; modalda ve filtrede tam liste durur.
  // Tek beden üretilen üründe satır hiç çizilmez (bilgi değeri yok).
  const preview = previewSizes(sizes);
  const price = v?.price ?? p.price;
  // Stok seçili renge göre: bir renk tükendiyse başka rengi seçince kart tekrar "canlı" olur.
  const inStock = v ? v.inStock : p.inStock;

  const s = SPEC[layout];
  const row = layout === "liste";
  const showSizes = s.showSizes && hasSizeInfo(sizes) && preview.slots.length > 0;

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const panel = (
    <div
      className="prod-img"
      onClick={() => openDetail(context, index, vi)}
      style={{
        position: "relative",
        aspectRatio: s.aspect,
        width: row ? 220 : undefined,
        flex: row ? "none" : undefined,
        background: "var(--tex)",
        border: "2px solid var(--fg-bright)",
        borderRadius: s.radius,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* key: renk değişince <img> yeniden kurulur, eski görsel bir kare bile kalmaz.
          Tükenmiş üründe SADECE görsel griye/soluğa düşer — rozet ve askı butonu keskin
          kalsın diye filtre panele değil, görseli saran bu span'e uygulanır. */}
      <span
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          filter: inStock ? undefined : "grayscale(1)",
          opacity: inStock ? 1 : 0.5,
        }}
      >
        <ProductImage
          key={image ?? "none"}
          src={image}
          fallbacks={imageAlts}
          w={s.imgW}
          sizes={s.sizes}
          priority={index < 4}
        />
      </span>

      {/* Tükenmiş üründe kartta AYRI bir "STOKTA YOK" rozeti yok: görselin grileşip
          solması durumu zaten belli ediyor (bkz. yukarıdaki filtre span'i).
          Yerine TALEP düğmesi var — ölü kartı bir sinyale çevirir. Sol üstte duruyor,
          sağ üstteki askı (vitrine ekle) düğmesiyle çakışmasın diye. */}
      {!inStock && (
        <span style={{ position: "absolute", top: s.inset, left: s.inset, zIndex: 3 }}>
          <RestockVote p={p} />
        </span>
      )}

      {/* vitrine ekle — görsel kutusunun içinde, köşe kavisine göre içeride */}
      <span
        className="add-btn"
        onClick={(e) => {
          stop(e);
          // eklerken (çıkarırken değil) ürünü yumuşakça VİTRİNİM'e uçur
          const adding = !inShow;
          const box = (e.currentTarget as HTMLElement).closest(".prod-img");
          toggleShowcase(p);
          if (adding) flyToVitrin(box, image);
        }}
        title={inShow ? t("Vitrinden çıkar") : t("Vitrinime ekle")}
        style={{
          position: "absolute",
          top: s.inset,
          right: s.inset,
          zIndex: 3,
          width: 34,
          height: 34,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: `1px solid ${inShow ? "var(--grn)" : "var(--muted3)"}`,
          background: inShow ? "var(--grn)" : "var(--btn-glass)",
          color: inShow ? "var(--on-accent)" : "var(--fg-bright)",
          borderRadius: "50%",
          backdropFilter: "blur(4px)",
        }}
      >
        <HangerIcon size={17} />
      </span>

      {showSizes && (
        <div
          className="size-row"
          style={{
            position: "absolute",
            bottom: 12,
            left: 12,
            right: 12,
            display: "flex",
            justifyContent: "center",
            gap: 5,
            zIndex: 2,
          }}
        >
          {preview.slots.map((sz) => (
            // Görünürlük: baloncuklar ürün fotoğrafının ÜSTÜNDE duruyor ve fotoğraf
            // her renkte olabiliyor. Şeffaf çerçeve açık zeminli görsellerde
            // kayboluyordu — zemin opak (--chip-bg-on), kenarlık 1.5px.
            <span
              key={sz}
              className="size-chip on"
              title={sz}
              style={{
                minWidth: 27,
                height: 27,
                padding: "0 7px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 999,
                fontFamily: "'IBM Plex Mono', monospace",
                fontWeight: 700,
                fontSize: 11,
                lineHeight: 1,
                border: "1.5px solid var(--fg-bright)",
                color: "var(--fg-bright)",
                background: "var(--chip-bg-on)",
                backdropFilter: "blur(3px)",
              }}
            >
              {shortSizeLabel(sz)}
            </span>
          ))}
          {/* Önizlemeye sığmayan bedenler (XS altı uçlar, 3XL, ekstra numaralar) burada
              sayılır; hepsi ürün modalında tek tek listelenir ve filtreden seçilebilir. */}
          {preview.extra > 0 && (
            <span
              className="size-chip more"
              title={`${preview.hidden.join(" · ")} — ${t("ürüne tıkla")}`}
              style={{
                minWidth: 27,
                height: 27,
                padding: "0 6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 999,
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 10,
                lineHeight: 1,
                border: "1.5px dashed var(--muted3)",
                color: "var(--muted2)",
                background: "var(--chip-bg-off)",
                backdropFilter: "blur(3px)",
              }}
            >
              +{preview.extra}
            </span>
          )}
        </div>
      )}
    </div>
  );

  /* renkler kendi satırında: eskiden ürün adının yanına sıkışıyor, hem satırı
     dağıtıyor hem tıklanabilir görünmüyordu */
  const renkSatiri = (
      <ColorSwatches
        variants={p.variants}
        active={vi}
        onPick={setVi}
        size={s.swatch}
        max={6}
        images={p.images}
        // Listede renkler fiyatla marka arasında: ad ve fiyat okunduktan sonra
        // "hangi renklerde var" sorusu gelir, marka logosu da bloğu kapatır.
        // Izgarada üstte kalıyor, orada blok kartın dibine yaslı ve renkler görselin
        // hemen altında duruyor.
        style={{ justifyContent: "center", marginBottom: row ? 0 : 7, marginTop: row ? 9 : 0 }}
      />
  );
  /* Tek renkli üründe ColorSwatches hiç çizilmiyor; listede o boşluk yine de
     ayrılır, yoksa o kartın logosu komşusundan yukarıda kalıyor. */
  const renkler = row ? (
    <div style={{ height: s.swatch + 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {renkSatiri}
    </div>
  ) : (
    renkSatiri
  );

  /**
   * LİSTEDE SABİT SATIR SAYISI: ad iki satırlık yeri her kartta kaplar (kısa adda
   * boş kalır, uzun ad "…" ile kesilir). Böylece fiyat, renkler ve logo bütün
   * kartlarda AYNI YÜKSEKLİKTE durur — göz sütun boyunca aynı yeri tarar. Adın
   * tamamı ürün modalinde duruyor. Izgara biçimlerinde kesme yok: orada kart
   * yüksekliği zaten hücreyi dolduruyor ve logo dibe yaslanıyor.
   */
  const adSatirlari = 2;

  /**
   * ÜRÜN ADI 0.0.6'DAKİ HÂLİNE DÖNDÜRÜLDÜ: ana metin renginde (`--fg`) ve .1em harf
   * aralığıyla. 0.0.7'de ad `--muted`e ve 13px'e indirilmişti ("kartın ikincil
   * bilgisi"); istenen, adın yeniden kartın okunur ana satırı olması.
   *
   * Ölçü neden `s.name`den ayrı: `s.name` kartın GENEL yazı ölçeği ve puan satırı
   * da (RatingLine) ondan besleniyor. SPEC'teki sayıyı büyütmek yıldızları da
   * şişirirdi — istenen yalnızca ad. Bu yüzden ad, ölçeği bozmadan tek başına
   * çarpılıyor; biçimler arası hiyerarşi (sık < ızgara < iri) korunuyor.
   *
   * `AD_KUCULT`: 0.0.6'nın ölçüsü birebir konunca ad biraz iri kaldı, %10 geri
   * alındı. Yani 4 sütunlu ızgarada 18px değil 16px.
   */
  const AD_KUCULT = 0.9;
  const adPx = Math.round(s.name * (18 / 13) * AD_KUCULT * 2) / 2;

  const ad = (
      <div
        className="prod-name"
        style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: adPx,
          letterSpacing: ".1em",
          lineHeight: 1.45,
          color: "var(--fg)",
          textTransform: "uppercase",
          ...(row
            ? {
                height: Math.round(adPx * 1.45 * adSatirlari),
                overflow: "hidden",
                display: "-webkit-box",
                WebkitBoxOrient: "vertical" as const,
                WebkitLineClamp: adSatirlari,
              }
            : null),
        }}
      >
        {p.name}
      </div>
  );

  const fiyat = (
      <div
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: s.price,
          color: "var(--grn)",
          marginTop: 4,
        }}
      >
        {formatPrice(price, p.currency, loc)}
      </div>
  );

  /* Puan yalnız yorumu olan üründe çizilir — "0 yorum" kartta gürültü.
     Listede satır ÇİZİLMESE DE yeri durur: yorumu olan bir kart, olmayanın
     altındaki her şeyi aşağı kaydırmasın. */
  const puanSatiri = (
      <RatingLine
        avg={rating.avg}
        count={rating.count}
        size={Math.max(10, s.name - 1)}
        style={{ marginTop: 5, alignSelf: "center" }}
      />
  );
  const puan = row ? (
    <div style={{ height: Math.max(10, s.name - 1) + 5, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {puanSatiri}
    </div>
  ) : (
    puanSatiri
  );

  /* Marka: tıklanmaz. Bütün kartlarda AYNI dikey ölçüde durur, göz satır satır
     aynı hizada tarar.

     Bandın yüksekliği en İRİ logoya göre kurulur: kareye yakın bir logo eşit alana
     çıkmak için taban ölçünün 1.75 katına kadar uzayabiliyor (bkz. BrandLogo
     `karePayi`). Bant sabit, içindekinin boyu markaya göre değişir. */
  const logoMaxH = Math.round(s.logo * 1.75);
  const marka = (
      <div
        className="prod-brand"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          /* Bandın İÇ yüksekliği tam olarak `logoMaxH`: `box-sizing: border-box` olduğu
             için `paddingTop` bu yükseklikten düşülüyor ve eski ölçü (logo × 1.5 = 20px,
             padding düşünce 12px) 13px'lik bir logoyu bile taşırıyordu — 19-20px'lik
             kare logoların altından ~4px `overflow:hidden` ile KESİLİYORDU. */
          height: 8 + logoMaxH,
          // Izgarada `auto`: logo bloğu kartın DİBİNE yaslanır. Üstündeki içerik
          // (1 ya da 2 satırlık ad, olan/olmayan puan satırı) ne olursa olsun, aynı
          // ızgara satırındaki bütün logolar aynı yatayda durur.
          // Listede yaslama YOK: blok zaten görselin yanında dikeyde ortalanmış tek
          // bir yığın, `auto` onu aşağı iterek o ortalamayı bozardı.
          marginTop: row ? 6 : "auto",
          paddingTop: 8,
          // Logo kartın ENİNE ölçeklensin: dar kartta taşmasın, geniş kartta ortalansın.
          width: "100%",
          maxWidth: "100%",
          overflow: "hidden",
          color: "var(--muted3)",
        }}
      >
        <BrandLogo
          slug={p.brandSlug}
          name={p.brand}
          h={s.logo}
          maxW={s.logoMaxW}
          maxH={logoMaxH}
          fixedH
          fallback={
            <span
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: s.logo,
                letterSpacing: ".1em",
                textTransform: "uppercase",
              }}
            >
              {p.brand}
            </span>
          }
        />
      </div>
  );

  const info = (
    <div
      className="prod-info"
      // Alt bilgi de kartın bir parçası: ada/fiyata/logoya basmak da ürünü açar.
      // (Renk noktaları kendi tıklamasını durduruyor — bkz. ColorSwatches.)
      onClick={() => openDetail(context, index, vi)}
      style={{
        padding: row ? 0 : "10px 4px 0",
        textAlign: "center",
        // Izgara biçimlerinde de sütun: logo bloğunun `margin-top:auto` ile dibe
        // yaslanabilmesi için bilgi alanının esneyen bir sütun olması gerekiyor.
        display: "flex",
        flexDirection: "column",
        // Listede blok GÖRSELE YASLI durur: dikeyde satırın ortası, yatayda görselin
        // hemen sağı. Genişlik SABİT (içeriğe göre değil): değişken genişlikte her
        // kartın ortası başka bir noktaya düşüyor, sütun boyunca hiçbir şey hizalı
        // durmuyordu. Sabit genişlikle bütün adlar, fiyatlar, renkler ve logolar
        // aynı dikey eksende ortalanır.
        justifyContent: row ? "center" : undefined,
        alignItems: row ? "center" : undefined,
        flex: row ? "0 0 auto" : 1,
        width: row ? LISTE_BILGI_W : undefined,
        maxWidth: "100%",
        minWidth: 0,
      }}
    >
      {/* Listede okuma sırası: AD → FİYAT → RENKLER → MARKA.
          Izgarada renkler görselin hemen altında kalır (eski sıra). */}
      {row ? (
        <>
          {ad}
          {fiyat}
          {puan}
          {renkler}
          {marka}
        </>
      ) : (
        <>
          {renkler}
          {ad}
          {fiyat}
          {puan}
          {marka}
        </>
      )}
    </div>
  );

  if (row) {
    return (
      <article className="prod prod-row" style={{ position: "relative", display: "flex", gap: LISTE_ARALIK, alignItems: "stretch" }}>
        {panel}
        {info}
      </article>
    );
  }

  return (
    // Kart, ızgara hücresinin TAMAMINI kaplayan bir sütun.
    //
    // Neden gerekli: ürün adı bir ya da iki satır olabiliyor, puan satırı yalnız yorumu
    // olan üründe çiziliyor. Kart yüksekliği içeriğe göre değişince marka logoları
    // ızgarada zikzak çiziyordu. Sütun hücreyi doldurunca ve logo bloğu `margin-top:auto`
    // ile dibe yaslanınca, aynı satırdaki bütün logolar TEK BİR YATAY HİZAYA oturuyor
    // (bkz. globals.css .prod-brand).
    <article
      className="prod"
      style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%" }}
    >
      {panel}
      {info}
    </article>
  );
}
