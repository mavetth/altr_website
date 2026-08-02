"use client";
import type { CSSProperties } from "react";
import { BRAND_LOGOS } from "@/lib/brand-logos.generated";
import { slugify, primaryName } from "@/lib/slug";
import KINDS from "../../data/brand-logo-kind.json";

/** Marka adından logo anahtarı — brandSlug elde yoksa (ör. BrandModal) kullanılır. */
export function brandLogoSlug(name: string): string {
  return slugify(primaryName(name));
}

export function hasBrandLogo(slugOrName: string): boolean {
  return Boolean(BRAND_LOGOS[slugOrName] ?? BRAND_LOGOS[brandLogoSlug(slugOrName)]);
}

type NameFont = "anton" | "space" | "plex";
type LogoKind = "sembol" | "yazi";

const KIND_TABLE = (KINDS as {
  markalar: Record<string, { tip: LogoKind; yazi?: NameFont; olcek?: number }>;
}).markalar;

/**
 * Markaya özel ölçek çarpanı (bkz. data/brand-logo-kind.json → `olcek`).
 *
 * Geometri (oran + alan normalizasyonu) iki logoyu aynı kutuya oturtur ama aynı
 * AĞIRLIKTA göstermez: ince çizgili bir el yazısı ile dolu bir blok harf aynı ölçüde
 * çizildiğinde biri kaybolur, öbürü bağırır. Çarpan bu farkı kapatır — logo dosyasının
 * kendi özelliği olduğu için nerede çizilirse çizilsin (rehber, çip, marka sayfası)
 * aynı şekilde uygulanır.
 */
function logoScale(key: string): number {
  return KIND_TABLE[key]?.olcek ?? 1;
}

/**
 * Logo "sembol" mü (marka adı okunmuyor) yoksa "yazı" mı (ad logonun içinde)?
 *
 * Elle sınıflandırılmış tablo (data/brand-logo-kind.json) esastır; oran bu işi tek başına
 * çözmüyor — kare bir logo pekâlâ okunur bir wordmark olabiliyor. Tabloda olmayan
 * (yeni eklenmiş) marka için oran yedek kural olarak çalışır.
 */
function logoKind(key: string, ar: number): LogoKind {
  const row = KIND_TABLE[key];
  if (row) return row.tip;
  return ar < 1.35 ? "sembol" : "yazi";
}

/**
 * Logonun DIŞINA marka adı yazmak gerekiyor mu?
 *
 * `BrandLogo` adı sembol logoların YANINA yazıyor; adın logonun ALTINDA, ayrı bir
 * satırda durduğu yerler (çıkış ekranı) aynı kararı kendi düzeniyle vermek zorunda.
 * Kural tek: ad logonun içinde okunuyorsa (wordmark) ikinci kez yazılmaz — yoksa aynı
 * kelime alt alta iki kez görünür.
 */
export function brandNameNeeded(slug: string | null | undefined, name: string): boolean {
  const key = slug && BRAND_LOGOS[slug] ? slug : brandLogoSlug(name);
  const meta = BRAND_LOGOS[key];
  if (!meta) return false; // logo yok → zaten adın kendisi çiziliyor
  return logoKind(key, meta.w / meta.h) === "sembol";
}

const FONT_STACK: Record<NameFont, string> = {
  anton: "'Anton', sans-serif",
  space: "'Space Mono', monospace",
  plex: "'IBM Plex Mono', monospace",
};

/**
 * Logonun kutu içindeki ÇİZİM ÖLÇÜSÜ.
 *
 * Eski kod sabit yükseklik + `min(maxW, ...)` genişlik veriyordu: genişlik tavana
 * çarpınca yükseklik aynı kaldığı için geniş wordmark'lar YATAY EZİLİYORDU (abluka
 * 640×52 gibi). Ayrıca kare amblemler (kaft 120×120) 17×17 piksele düşüp okunmaz
 * oluyordu; oysa dar bir wordmark ile kare bir amblem aynı YÜKSEKLİKTE değil, aynı
 * OPTİK AĞIRLIKTA durmalı.
 *
 * Bu yüzden ölçü ALANDAN türetiliyor: hedef alan sabit, yükseklik = √(alan/oran).
 * Böylece kare amblem yükselir, uzun wordmark alçalır ama genişler — ikisi de aynı
 * görsel ağırlıkta durur. Oran her durumda korunur (ezilme yok).
 */
function fitLogo(ar: number, h: number, maxW: number, kind: LogoKind) {
  // sembol daha büyük bir hedef alan ister: 17px yüksekliğinde bir amblem okunmuyor
  const target = kind === "sembol" ? h * 1.5 : h * 1.9;
  const minH = h * 0.78;
  const maxH = kind === "sembol" ? h * 1.6 : h * 1.15;

  let hh = Math.min(maxH, Math.max(minH, Math.sqrt((target * target) / ar)));
  let w = ar * hh;
  if (w > maxW) {
    const hAtMax = maxW / ar;
    if (hAtMax >= h * 0.72) {
      hh = hAtMax;
      w = maxW;
    } else {
      // Aşırı uzun wordmark (ör. point-2124, oran 13.6): tavana sığdırmak logoyu
      // okunmaz inceltiyor. Okunaklılık öncelikli — %25'e kadar taşmasına izin ver.
      hh = h * 0.72;
      w = Math.min(maxW * 1.25, ar * hh);
      hh = w / ar;
    }
  }
  return { w: Math.round(w), h: Math.round(hh) };
}

/**
 * `fixedH` yolunda KARE PAYI.
 *
 * Sabit yükseklik uzun bir wordmark için doğru ölçü: 13px'lik bir "RESPIRE" okunuyor,
 * çünkü genişlik boyunca 100px yer kaplıyor. Aynı 13px kareye yakın bir logoda 13×13'lük
 * bir leke demek — sabit YÜKSEKLİK, kareye yakın logoyu sabit ALANIN çok altına düşürüyor
 * (alan = oran × yükseklik²). Pay bu farkı kapatır: yükseklik oranın kareköküyle ters
 * orantılı büyür, yani logolar aynı yükseklikte değil aynı ALANDA durur.
 *
 * İlk hâli (2026-08-01) yalnız `tip: "sembol"` logolara veriliyordu; sonra görüldü ki
 * kural TÜRLE değil ORANLA ilgili — `saram` tipi "yazi" (adı logonun içinde) ama oranı
 * 0.86, yani kartta 15px'lik bir kare olarak çiziliyordu ve içindeki ad okunmuyordu.
 *
 * Referans oran türe göre kayar: amblem bütün çizimi yükseklik boyunca taşıdığı için
 * aynı oranda bir wordmark'tan daha çok yer hak eder. Tavan 1.75, eşit ALAN hesabının
 * kendisi: 3:1 bir wordmark 13px'te 507px² kaplıyor, kare bir logonun aynı alana çıkması
 * için 22.5px ≈ 13 × 1.73 gerekiyor. Taban 1: kartta hiçbir logo bugünkünden KÜÇÜLMEZ.
 */
function karePayi(ar: number, kind: LogoKind) {
  return Math.min(1.75, Math.max(1, Math.sqrt((kind === "sembol" ? 4.6 : 3) / ar)));
}

/**
 * Düz ölçekleme: yükseklik sabit `h`, genişlik orandan. Tavanı aşan (çok uzun)
 * wordmark oranı korunarak küçültülür — o tek durumda yükseklik `h`in altına düşer.
 */
function scaleToHeight(ar: number, h: number, maxW: number) {
  let hh = h;
  let w = ar * hh;
  if (w > maxW) {
    w = maxW;
    hh = w / ar;
  }
  return { w: Math.round(w), h: Math.round(hh) };
}

/**
 * `maxH` verilmişse logo KATI bir kutunun içindedir: oranı bozmadan hem yüksekliğe hem
 * genişliğe sığdırılır. Genişlik burada ikinci kez ele alınıyor çünkü `fitLogo` aşırı
 * uzun wordmark'larda okunaklılık için tavanı %25 aşmaya izin veriyor — sabit kutuda o
 * taşma kutunun dışına çıkmak demek.
 */
function fitBox(box: { w: number; h: number }, maxW: number, maxH?: number) {
  if (!maxH) return box;
  const k = Math.min(1, maxH / box.h, maxW / box.w);
  return k >= 1 ? box : { w: Math.round(box.w * k), h: Math.round(box.h * k) };
}

/**
 * KURAL (kullanıcı kararı, 2026-07-30): marka adı YALNIZCA logo sembolken yazılır.
 * Adı zaten harflerle taşıyan bir logonun (reflect-studio, abluka, point-2124…) yanına
 * adı bir kez daha yazmak tekrar; kutucukta aynı kelime iki kez görünüyordu.
 *
 * Burada eskiden bir "okunaklılık tabanı" (LEGIBLE_RATIO) vardı: çok geniş bir wordmark
 * genişlik tavanına çarpıp inceldiğinde adı yine de yazılıyordu. O taban KALDIRILDI —
 * doğru çözüm adı tekrar yazmak değil, logoya YETERİNCE YER VERMEK. Genişlik tavanları
 * (ProductCard `logoMaxW` vb.) ölçülen gerçek kart genişliğine göre yükseltildi, böylece
 * en geniş wordmark bile (point-2124, oran 13.6) tam yüksekliğinde çiziliyor.
 *
 * Tek istisna logo DOSYASININ HİÇ OLMAMASI: o zaman zaten `fallback` ile marka adı
 * yazılır (aşağıda), çünkü ortada gösterilecek başka bir şey yok.
 */

/**
 * Markanın kendi logosu — `npm run fetch-logos` ile bir kez indirilip
 * `public/brand-logos/<slug>.webp` altında duruyor, kendi origin'imizden statik servis
 * edilir (marka sitesine çalışma anında hiç gidilmez).
 *
 * Logosu bulunamayan markalar (109'da 7) yazıya düşer — `fallback` verilmezse marka adı
 * Anton ile yazılır, yani logo yokluğu tasarımda boşluk bırakmaz.
 *
 * SEMBOL logolarda (amblem/monogram) logonun yanına marka ADI da yazılır: aksi hâlde
 * kutucukta bir panda ya da bir makas duruyor ve hangi marka olduğu okunmuyordu.
 * Adın fontu markanın logo karakterine göre seçilir (bkz. data/brand-logo-kind.json).
 *
 * Renk/kontrast işi CSS'te: her logo için "karanlık zeminde ters çevrilmeli mi" bilgisi
 * manifestte duruyor (`inv`), `data-inv` olarak DOM'a geçiyor ve globals.css hem temaya
 * hem seçili çip zeminine göre invert'i ayarlıyor. Böylece beyaz kutulu logo siyah
 * sayfada beyaz blok, siyah wordmark da görünmez leke olmuyor.
 */
export function BrandLogo({
  slug,
  name,
  h = 18,
  maxW = 160,
  maxH,
  className,
  style,
  fallback,
  showName = true,
  fixedH = false,
}: {
  /** brandSlug (elde varsa). Yoksa `name`den türetilir. */
  slug?: string;
  name: string;
  /** Referans yükseklik (px). Gerçek çizim yüksekliği logo türüne göre bunun etrafında oynar. */
  h?: number;
  /** Çok geniş wordmark'ların satırı dağıtmaması için genişlik tavanı (px). */
  maxW?: number;
  /**
   * Yükseklik tavanı (px). Logonun sabit yükseklikli bir kutu içinde durduğu yerlerde
   * (marka rehberi kutucuğu) gerekir: sembol logolar referans yüksekliğin 1.6 katına
   * kadar büyüyebildiği için kutuyu uzatıp satırdaki kartları farklı boylara sokuyordu.
   */
  maxH?: number;
  className?: string;
  style?: CSSProperties;
  /** Logo yoksa gösterilecek içerik; verilmezse marka adı yazılır. */
  fallback?: React.ReactNode;
  /** Sembol logoların yanına marka adını yaz. Dar yerlerde (ör. modal başlığı) kapatılabilir. */
  showName?: boolean;
  /**
   * Alan normalizasyonunu kapat, logoyu DÜZ olarak `h` yüksekliğine ölçekle.
   *
   * Varsayılan davranış (fitLogo) logoları aynı optik AĞIRLIKTA gösterir: kare amblem
   * yükselir, uzun wordmark alçalır. Ürün kartında istenen bu değil — orada logo şeridi
   * kart kart aynı BANTTA durmalı, yoksa göz satırı tarayamıyor.
   *
   * Ama "aynı bant" ile "aynı piksel yüksekliği" aynı şey değil (2026-08-01): sabit
   * yükseklik amblemleri okunmaz bir lekeye indiriyor, dolgun bir slab'i ise bağırtıyordu.
   * Bant sabit kalır, logo bandın içinde marka çarpanı (`olcek`) ve amblem payı kadar
   * oynar; taşmasın diye çağıran taraf `maxH` verir.
   */
  fixedH?: boolean;
}) {
  const key = slug && BRAND_LOGOS[slug] ? slug : brandLogoSlug(name);
  const meta = BRAND_LOGOS[key];

  if (!meta) {
    return (
      <>
        {fallback ?? (
          <span
            style={{
              fontFamily: "'Anton', sans-serif",
              fontSize: h,
              lineHeight: 1,
              letterSpacing: ".02em",
              textTransform: "uppercase",
              ...style,
            }}
          >
            {name}
          </span>
        )}
      </>
    );
  }

  const ar = meta.w / meta.h;
  const kind = logoKind(key, ar);
  // Kartta çarpan yalnız BÜYÜTÜR: şerit 13px'lik bir banda sığıyor ve orada 11px ile
  // 13px arasındaki fark okunurluğun kendisi. Dolgun bir wordmark'ı optik denge adına
  // küçültmek rehberde doğru, kartta zarar — ağırlık dengesini oradaki tavan kurar.
  const ref = h * (fixedH ? Math.max(1, logoScale(key)) : logoScale(key));
  const { w, h: hh } = fitBox(
    fixedH ? scaleToHeight(ar, ref * karePayi(ar, kind), maxW) : fitLogo(ar, ref, maxW, kind),
    maxW,
    maxH,
  );
  const font = FONT_STACK[KIND_TABLE[key]?.yazi ?? "space"];

  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/brand-logos/${key}.webp`}
      alt={name}
      title={name}
      width={w}
      height={hh}
      data-inv={meta.inv ? "1" : "0"}
      /* mobil CSS'i logo türüne göre farklı ölçekleyebilsin diye DOM'a taşınıyor */
      data-kind={kind}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={`brand-logo${className ? ` ${className}` : ""}`}
      style={{ width: w, height: hh, ...style }}
    />
  );

  // Adı logonun İÇİNDE taşıyan logolarda ad tekrarlanmaz — tek koşul bu.
  if (kind === "yazi" || !showName) return img;

  return (
    <>
      {img}
      <span
        className="brand-logo-name"
        style={{
          fontFamily: font,
          fontSize: Math.round(h * 0.82),
          lineHeight: 1,
          letterSpacing: font.includes("Anton") ? ".04em" : ".08em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        {name}
      </span>
    </>
  );
}
