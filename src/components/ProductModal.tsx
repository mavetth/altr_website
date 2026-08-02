"use client";
import { useEffect, useRef, useState } from "react";
import { hexToRgb, nameToTags } from "@/lib/color-tags";
import { colorToHex } from "@/lib/colors";
import { dominantColor, loadPersisted, olcumUrl } from "@/lib/dominant-color";
import { genderLabel } from "@/lib/gender";
import type { Variant } from "@/lib/types";
import { formatPrice } from "@/lib/query";
import { sortSizes } from "@/lib/sizes";
import { useStore } from "@/store";
import { useLang } from "@/lib/lang";
import { ProductImage } from "./ProductImage";
import { BrandLogo } from "./BrandLogo";
import { ColorSwatches } from "./ColorSwatches";
import { RestockVote } from "./RestockVote";
import { Reviews } from "./Reviews";

/**
 * Varyantın TEMSİLİ rengi — karelerle karşılaştırmak için bir çıpa.
 *
 * Renk adı bilinen bir aileye çözülüyorsa sözlükteki karşılığı kullanılır: marka
 * panelinden gelen hex yer tutucu olabiliyor ("#ccc"), ad ise kullanıcının okuduğu
 * şeydir. Ad çözülmüyorsa ("Nefti", "01") elde kalan tek şey hex'tir; o da yoksa
 * karşılaştıracak çıpa yok demektir ve kare seçimi yapılmaz.
 */
function varyantReferansRengi(v: Variant | undefined): string | null {
  if (!v) return null;
  if (nameToTags(v.color ?? "").length) return colorToHex(v.color ?? "");
  return v.hex || null;
}

/** İki rengin RGB uzayındaki karesel uzaklığı — sıralama için yeterli. */
function renkUzakligi(a: string, b: string): number {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  if (!x || !y) return Infinity;
  return (x[0] - y[0]) ** 2 + (x[1] - y[1]) ** 2 + (x[2] - y[2]) ** 2;
}

const DOTLINE = {
  width: "100%",
  height: 1,
  margin: "18px 0",
  background: "repeating-linear-gradient(90deg,var(--line2) 0 6px,transparent 6px 12px)",
} as const;

export function ProductModal() {
  const detail = useStore((s) => s.detail);
  const close = useStore((s) => s.closeDetail);
  const nav = useStore((s) => s.detailNav);
  const setVariant = useStore((s) => s.setDetailVariant);
  const openBrandModal = useStore((s) => s.openBrandModal);
  const lists = useStore((s) => s.lists);
  const toggleInList = useStore((s) => s.toggleInList);
  const createList = useStore((s) => s.createList);
  const { t, lang } = useLang();
  const loc = lang === "en" ? "en-US" : "tr-TR";

  const p = detail ? detail.items[detail.pos] : null;
  const vi = detail?.variant ?? 0;
  const [imgIdx, setImgIdx] = useState(0);

  /**
   * PAYLAŞILAN FOTOĞRAF HAVUZU: markaların bir kısmı her renk için AYNI görsel listesini
   * veriyor (katalogda 1.931 ürün — çok renkli ürünlerin %7,5'i). Orada renge basmak
   * hiçbir şeyi değiştirmiyordu: iki varyantın da görselleri aynı sırada, aynı liste.
   * Oysa havuzun İÇİNDE o renklerin fotoğrafı çoğu zaman var (ör. Deer Wear'ın F1
   * tişörtünde 2 siyah + 2 beyaz kare).
   *
   * Çözüm veri değil GÖRÜNTÜLEME katmanında: havuzdaki her kare bir kez ölçülüyor
   * (lib/dominant-color.ts, nokta renkleriyle aynı önbellek) ve renk seçilince o renge
   * EN YAKIN kareye geçiliyor. Şerit olduğu gibi duruyor — kullanıcı diğer kareleri de
   * gezebilir. Ölçüm yoksa davranış eskisi gibi: başa dön.
   *
   * EŞİTLİK DEĞİL YAKINLIK: ilk sürüm kareyi renk ADIYLA eşleştiriyordu ve tam da bu
   * üründe kalıyordu — beyaz tişört beyaz zeminde çekilince arka planı eleyen adım
   * gömleğin en beyaz yerlerini de eliyor, geriye gölgeli katlar kalıyor ve kare
   * "#cacaca" yani GRİ sınıflanıyor. "Beyaz" adına uyan kare bulunamayınca siyah kare
   * gösteriliyordu. Yakınlık ölçüsü mutlak sınıfın doğru olmasını gerektirmez, yalnız
   * SIRALAMANIN doğru olmasını ister: #cacaca beyaza (#ededea) siyahtan (#1b1b1b) çok
   * daha yakın, dolayısıyla beyaz varyant doğru kareye gider.
   */
  const paylasimliHavuz =
    !!p && p.variants.length > 1 &&
    new Set(p.variants.map((v) => (v.imgs ?? []).join(","))).size === 1;
  const [kareRengi, setKareRengi] = useState<Record<number, string>>({});
  useEffect(() => {
    if (!p || !paylasimliHavuz) return;
    let alive = true;
    loadPersisted();
    (async () => {
      const next: Record<number, string> = {};
      await Promise.all(
        p.images.map(async (src, i) => {
          const hex = src ? await dominantColor(olcumUrl(src)) : "";
          if (hex) next[i] = hex;
        }),
      );
      if (alive) setKareRengi(next);
    })();
    return () => {
      alive = false;
    };
  }, [p, paylasimliHavuz]);

  // Ürün veya renk değişince küçük görsel şeridi başa döner — yoksa yeni rengin
  // 1 görseli varken eski rengin 3. görselinde kalıp boş kare gösterebiliyordu.
  // Paylaşımlı havuzda "baş", o renge en yakın karedir.
  useEffect(() => {
    if (!p) return setImgIdx(0);
    const v = p.variants[vi];
    const referans = paylasimliHavuz ? varyantReferansRengi(v) : null;
    if (!referans) return setImgIdx(0);
    const sira = v?.imgs?.length ? v.imgs : p.images.map((_, i) => i);
    let enIyi = -1;
    let enYakin = Infinity;
    sira.forEach((gi, i) => {
      const hex = kareRengi[gi];
      if (!hex) return;
      const d = renkUzakligi(hex, referans);
      // Eşdeğer sayılan kareler arasında SIRADA ÖNCE GELEN kazanır: bir rengin
      // birden fazla karesi var (ön/arka) ve markanın ilk koyduğu kare o rengin
      // vitrin fotoğrafıdır. Pay: kanal başına ~20 (20² × 3).
      if (d < enYakin - 1200) {
        enYakin = d;
        enIyi = i;
      }
    });
    setImgIdx(enIyi >= 0 ? enIyi : 0);
  }, [p, vi, paylasimliHavuz, kareRengi]);

  // backdrop'ta tıklama (kapat) ile modal içeriğini kaydırma sürüklemesini ayırt eder:
  // parmak/işaretçi başladığı noktadan az hareket ettiyse gerçek bir "tap" sayılır.
  const downPos = useRef<{ x: number; y: number } | null>(null);
  const onBackdropDown = (e: React.PointerEvent) => {
    downPos.current = { x: e.clientX, y: e.clientY };
  };
  const onBackdropUp = (e: React.PointerEvent) => {
    const start = downPos.current;
    downPos.current = null;
    if (!start) return;
    const dx = Math.abs(e.clientX - start.x);
    const dy = Math.abs(e.clientY - start.y);
    if (dx < 6 && dy < 6) close();
  };

  if (!detail || !p) return null;
  const hasPrev = detail.pos > 0;
  const hasNext = detail.pos < detail.items.length - 1;

  // Seçili renk: görseller, bedenler, fiyat, stok ve "satın al" hedefi ondan gelir.
  const v = p.variants[vi];
  const imgs = v?.imgs.length
    ? v.imgs.map((i) => p.images[i]).filter(Boolean)
    : p.images.length
      ? p.images
      : p.image
        ? [p.image]
        : [];
  const shown = imgs[imgIdx] ?? imgs[0] ?? p.image;
  const sizes = v?.sizes.length ? v.sizes : p.sizes;
  /**
   * Modaldaki beden kutuları — YALNIZ ÜRETİLEN bedenler.
   *
   * Eskiden harfli beden satan üründe çekirdek merdiven (S·M·L·XL·2XL) sönük kutularla
   * tamamlanır, bu "hangi beden tükenmiş" diye sunulurdu. Veri o ayrımı taşımıyor:
   * eksik beden çoğu zaman TÜKENMİŞ değil HİÇ ÜRETİLMEMİŞ bedendir, dolayısıyla sönük
   * kutu uydurma bilgiydi. Artık ürünün gerçek bedenleri neyse o listelenir.
   */
  const modalSizes = sortSizes(sizes);
  const price = v?.price ?? p.price;
  const inStock = v ? v.inStock : p.inStock;
  const buyUrl = v?.url ?? p.productUrl;
  const goBrand = () => openBrandModal(p.brand, buyUrl, p);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onPointerDown={onBackdropDown} onPointerUp={onBackdropUp} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.82)" }} />
      {/* dış sarmalayıcı: overflow yok, kapatma rozeti modal-anim'in kaydırma kırpmasından etkilenmesin */}
      <div style={{ position: "relative", maxWidth: MODAL_MAX_W, maxHeight: "92vh" }}>
        <div
          className="modal-anim"
          style={{ position: "relative", width: 900, maxWidth: MODAL_MAX_W, maxHeight: "92vh", overflowY: "auto", background: "var(--bg2)", border: "2px solid var(--fg-bright)", borderRadius: 26 }}
        >
          {hasPrev && (
            <span className="det-nav" onClick={() => nav(-1)} style={navStyle("left")}>
              <Chev dir="left" />
            </span>
          )}
          {hasNext && (
            <span className="det-nav" onClick={() => nav(1)} style={navStyle("right")}>
              <Chev dir="right" />
            </span>
          )}

          <div className="pm-grid" style={{ position: "relative", padding: "34px 46px", display: "grid", gridTemplateColumns: "minmax(0,1.18fr) minmax(0,.82fr)", gap: 36, alignItems: "stretch" }}>
          {/* görsel sütunu: büyük panel + küçük görsel şeridi */}
          <div className="pm-imgcol" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              className="pm-img"
              style={{
                position: "relative",
                aspectRatio: "4/5",
                minHeight: 440,
                background: "var(--tex)",
                border: "2px solid var(--fg-bright)",
                borderRadius: 32,
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* modal kullanıcı tıklamasıyla açılır: beklemeden, yüksek öncelikle yükle */}
              <ProductImage
                key={shown ?? "none"}
                src={shown}
                // seçili görsel ölürse şeritteki diğerleri denenir (bkz. ProductImage)
                fallbacks={[...imgs, ...p.images, p.image]}
                w={900}
                sizes="(max-width: 820px) 92vw, 520px"
                priority
              />
            </div>
            {imgs.length > 1 && (
              <div className="pm-thumbs" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {imgs.map((src, i) => (
                  <span
                    key={src}
                    className="thumb"
                    onClick={() => setImgIdx(i)}
                    style={{
                      position: "relative",
                      width: 56,
                      height: 56,
                      border: `2px solid ${i === imgIdx ? "var(--grn)" : "var(--line)"}`,
                      borderRadius: 14,
                      overflow: "hidden",
                      background: "var(--tex)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flex: "none",
                    }}
                  >
                    <ProductImage src={src} w={120} label="·" priority />
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div className="pm-meta" style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, letterSpacing: ".22em", color: "var(--muted3)" }}>
              {t(p.category)}
              <span style={{ color: "var(--faint)" }}> · {t(genderLabel(p.genders))}</span>
            </div>
            {/* ÜRÜN ADI: glitch gölgesi ve Anton KALDIRILDI (2026-07-30).
                `.glitch-head` iki renkli ±2px text-shadow basıyor; marka kimliğinin bir
                parçası ama bir ÜRÜN ADI için yanlış yer — adlar uzun, karışık ve çoğu
                zaman İngilizce ("SB Dunk Low ‘Panda’"), gölgeli ağır bir display fontta
                okunmuyordu. Vitrinin sert dili başlıklarda ve boş-durum ekranlarında
                duruyor; burada okunurluk kazanır. Space Mono kartlardaki ad fontuyla
                aynı — modal karttan devraldığını aynı sesle sürdürüyor. */}
            <div
              className="pm-title"
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 27,
                lineHeight: 1.25,
                letterSpacing: ".04em",
                color: "var(--fg-bright)",
                textTransform: "uppercase",
                marginTop: 8,
              }}
            >
              {p.name}
            </div>
            <div className="prod-src" onClick={goBrand} style={{ display: "inline-flex", alignSelf: "flex-start", alignItems: "center", gap: 6, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, letterSpacing: ".1em", color: "var(--muted3)", marginTop: 10, cursor: "pointer" }}>
              <span style={{ fontFamily: "'Anton', sans-serif", fontSize: 24, color: "var(--muted3)" }}>↗</span>
              <span className="brand-mark" style={{ display: "inline-flex", alignItems: "center", borderBottom: "1px solid var(--line2)", paddingBottom: 3 }}>
                <BrandLogo
                  slug={p.brandSlug}
                  name={p.brand}
                  h={18}
                  /* 170 → 250: en geniş wordmark (oran 13.6) 18px'te 245px ister.
                     Adı ayrıca yazma kuralı kalktığı için okunaklılık tavana bağlı. */
                  maxW={250}
                  /* Tek satırlık marka şeridi: amblem satırı uzatmasın. */
                  maxH={29}
                  fallback={<span style={{ textDecoration: "underline", textUnderlineOffset: 4 }}>{p.brand}</span>}
                />
              </span>
            </div>

            <div className="pm-dot" style={DOTLINE} />
            <div className="pm-price" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 26, color: "var(--grn)" }}>
              {formatPrice(price, p.currency, loc)}
              {!inStock && (
                // Modalda görsel grileşmiyor; tek stok sinyali bu yazı, o yüzden BELİRGİN:
                // kalın, büyük, çerçeveli bir etiket.
                <span
                  style={{
                    display: "inline-block",
                    fontFamily: "'Space Mono', monospace",
                    fontWeight: 700,
                    fontSize: 15,
                    letterSpacing: ".2em",
                    color: "var(--fg-bright)",
                    border: "1.5px solid var(--fg-bright)",
                    borderRadius: 5,
                    padding: "5px 12px",
                    marginLeft: 16,
                    verticalAlign: "middle",
                    textTransform: "uppercase",
                  }}
                >
                  {t("STOKTA YOK")}
                </span>
              )}
            </div>

            {p.variants.length > 0 && (
              <div className="pm-colorblock">
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 22, marginBottom: 9 }}>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, letterSpacing: ".22em", color: "var(--faint)" }}>{t("RENK")}</span>
                  {v?.color && (
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, letterSpacing: ".06em", color: "var(--muted2)", textTransform: "uppercase" }}>
                      {v.color}
                    </span>
                  )}
                </div>
                {/* tek renkli üründe ColorSwatches hiç çizilmez; yukarıdaki renk adı yeter */}
                <ColorSwatches variants={p.variants} active={vi} onPick={setVariant} size={26} max={12} images={p.images} />
              </div>
            )}

            {modalSizes.length > 0 && (
              <div className="pm-sizeblock">
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, letterSpacing: ".22em", color: "var(--faint)", marginTop: 20, marginBottom: 9 }}>{t("BEDEN")}</div>
                {/* Modal, karttaki önizlemenin AKSİNE tam listedir: uç bedenler (2XS,
                    3XL…), numaralar ve "TEK BEDEN" burada kısaltılmadan görünür. Kartta
                    "+n" gördüğün bedenlerin karşılığı burasıdır. */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {modalSizes.map((label) => (
                    <span
                      key={label}
                      className="size-chip on"
                      style={{
                        minWidth: 38,
                        height: 38,
                        padding: "0 11px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 999,
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontWeight: 700,
                        fontSize: 13,
                        whiteSpace: "nowrap",
                        border: "1.5px solid var(--fg-bright)",
                        color: "var(--fg)",
                        background: "var(--chip-bg)",
                      }}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ flex: 1 }} />

            {/* Listeye ekle: karttaki askı düğmesi ürünü AKTİF listeye atar; burada
                hangi listeye gideceği tek tek seçilebilir (çoklu liste destekleniyor). */}
            <div className="pm-lists">
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, letterSpacing: ".22em", color: "var(--faint)", marginTop: 20, marginBottom: 9 }}>
                {t("LİSTEYE EKLE")}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {lists.map((l) => {
                  const on = l.ids.includes(p.id);
                  return (
                    <span
                      key={l.id}
                      className="fbox"
                      onClick={() => toggleInList(l.id, p)}
                      style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: 12,
                        letterSpacing: ".06em",
                        padding: "7px 11px",
                        border: `1px solid ${on ? "var(--grn)" : "var(--line)"}`,
                        background: on ? "var(--grn)" : "transparent",
                        color: on ? "var(--on-accent)" : "var(--muted)",
                      }}
                    >
                      {on ? "✓ " : "+ "}
                      {/* Liste adları kullanıcı verisi; yalnız VARSAYILAN ad sözlükte
                          karşılık bulur, kullanıcının kendi yazdığı ad olduğu gibi kalır. */}
                      {t(l.name)}
                    </span>
                  );
                })}
                <span
                  className="fbox"
                  onClick={() => {
                    const id = createList();
                    toggleInList(id, p);
                  }}
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 12,
                    letterSpacing: ".06em",
                    padding: "7px 11px",
                    border: "1px solid var(--line)",
                    color: "var(--muted3)",
                  }}
                >
                  {t("+ YENİ LİSTE")}
                </span>
              </div>
            </div>

            {/* Tükenmiş renkte "SATIN AL" yalan olur: mağazaya gönderdiğimiz kişi ölü bir
                sayfayla karşılaşır. Onun yerine talebi topluyoruz; mağaza linki yine
                duruyor ama ikincil, sönük bir satır olarak. */}
            {inStock ? (
              <span
                className="cta-btn"
                onClick={goBrand}
                style={{ marginTop: 22, textAlign: "center", fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 15, letterSpacing: ".14em", color: "var(--on-accent)", background: "var(--grn)", padding: "15px 0", borderRadius: 10 }}
              >
                {t("ÜRÜNÜ SATIN AL →")}
              </span>
            ) : (
              <div style={{ marginTop: 22 }}>
                <RestockVote p={p} size="lg" />
                <div
                  className="nav-item"
                  onClick={goBrand}
                  style={{ textAlign: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, letterSpacing: ".1em", color: "var(--muted3)", marginTop: 11 }}
                >
                  {t("yine de mağazaya git ↗")}
                </div>
              </div>
            )}
          </div>
          </div>

          {/* Yorumlar iki sütunun ALTINDA, tam genişlikte: sağ sütun zaten ürünün
              künyesi + satın alma yolu; yorum oraya sıkıştırılsa hem dar kalır hem
              satın alma düğmesini aşağı iterdi. */}
          <div className="pm-revwrap" style={{ padding: "0 46px 34px" }}>
            <Reviews p={p} />
          </div>
        </div>
        {/* kapatma: dış sarmalayıcıya bağlı — modal-anim'in kaydırma kırpmasının dışında, köşede yüzer.
            Not: det-nav sınıfı BİLEREK verilmiyor — o sınıfın mobilde ok'lara özel top override'ı
            bu butonu da etkiler ve yanlış yere taşırdı. */}
        <span className="modal-close" onClick={close} style={closeStyle()}>
          <CloseIcon />
        </span>
      </div>
    </div>
  );
}

/* Modal genişliği ile kapatma rozetinin sarkması AYNI kısıta bağlı, o yüzden tek yerde
   durur. Rozet modalın köşesinden dışarı sarkar; sarkma miktarı, modalın ekran kenarına
   bıraktığı boşluktan büyük olursa rozet viewport'u taşar. Masaüstünde boşluk bol
   (3vw = 38px @1280) ve sorun yok, ama telefonda 3vw yalnız ~12px: sabit 14px sarkma
   tuşun bir kısmını ekranın dışında bırakıyordu.
   Çözüm sarkmayı boşluğa bağlamak: her genişlikte en fazla "boşluk eksi güvenlik payı"
   kadar sarkar, yani ekran kenarına daima CLOSE_SAFE_INSET kadar mesafe kalır.
   MODAL_SIDE_GAP'i elle güncellemek gerekmesin diye MODAL_MAX_W'den türetiliyor. */
const MODAL_MAX_W = "94vw";
const MODAL_SIDE_GAP = `calc((100vw - ${MODAL_MAX_W}) / 2)`;
const CLOSE_SAFE_INSET = "8px";
const CLOSE_OVERHANG = `calc(-1 * min(14px, max(0px, ${MODAL_SIDE_GAP} - ${CLOSE_SAFE_INSET})))`;

/* SVG ok: font taban çizgisine bağlı kalmadan kutunun tam ortasında durur.
   Koordinatlar 1:1 PİKSEL (viewBox 14 = width 14). Eskiden 24 birimlik viewBox 14px'e
   0.5833 katsayısıyla iniyordu, yani hiçbir kenar piksel sınırına oturmuyordu; üstüne
   sol ok `scaleX(-1)` ile aynalandığı için iki ok farklı alt piksel fazına düşüyordu.
   Ölçüldü: sağ ok x[3,11] y[2,12], sol ok x[4,10] y[2,13] — yani iki ok GERÇEKTEN
   farklı boyutta çiziliyordu (gözle görülen asimetri buydu, ortalama hatası değil).
   Şimdi uçlar .75/.25'e hizalı: 1.5px çizginin kenarları (uç ± 0.75) tam integer
   piksele oturuyor. Aynalama da transform yerine elle yazılmış ikinci bir path ile,
   böylece iki ok aynı faza düşüyor. Ölçüm: ikisi de x[4,10] y[2,12], sapma 0. */
function Chev({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ display: "block" }}>
      <path
        d={dir === "right" ? "m4.75 2.75 4.5 4.25-4.5 4.25" : "m9.25 2.75-4.5 4.25 4.5 4.25"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ display: "block" }}>
      <path d="M5 5l14 14M19 5 5 19" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function navStyle(side: "left" | "right"): React.CSSProperties {
  return {
    position: "absolute",
    top: "50%",
    // modal kenarı ile içerik (46px padding) arasındaki boşluğun tam ortası
    [side]: 8,
    transform: "translateY(-50%)",
    zIndex: 5,
    width: 32,
    height: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    // görsel panellerin imza dili: 2px parlak kenarlık + opak zemin
    border: "2px solid var(--fg-bright)",
    background: "var(--bg2)",
    color: "var(--fg-bright)",
    borderRadius: "50%",
    cursor: "pointer",
  };
}

function closeStyle(): React.CSSProperties {
  return {
    // modalin dış köşesinde yarı-dışarı taşan rozet: içerikle asla çakışmaz
    position: "absolute",
    top: CLOSE_OVERHANG,
    right: CLOSE_OVERHANG,
    zIndex: 6,
    width: 32,
    height: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "2px solid var(--fg-bright)",
    background: "var(--bg2)",
    color: "var(--fg-bright)",
    borderRadius: "50%",
    cursor: "pointer",
  };
}
