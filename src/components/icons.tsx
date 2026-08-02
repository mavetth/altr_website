import { useLayoutEffect, useState } from "react";

const BADGE_FONT = (px: number) => `700 ${px}px 'Space Mono', monospace`;
/** Ölçüm puntosu. Mürekkep kutusu KÜÇÜK puntoda tam piksele yuvarlanıyor (11px'te
 *  gerçek 6.016×7.906 yerine 7×8 raporlanıyor), yuvarlama da tarayıcıdan tarayıcıya
 *  değişiyor — rozetin asimetrisi buradan geliyordu. Büyük puntoda ölçüp em oranına
 *  bölünce yuvarlama hatası 1/1000 em'e iner ve tarayıcılar aynı sonuca varır. */
const PROBE_PX = 1000;
const INK = new Map<string, { cx: number; cy: number; w: number; h: number }>();
/** Rakamın sığacağı yarıçap, dairenin yarıçapına oran. 1'e yaklaştıkça rakam kenara
 *  dayanır; 0.84 dolgun ama nefes alan bir kutu bırakıyor. */
const FIT_RATIO = 0.84;
/** Küçülmenin tabanı — bunun altına inince rakam okunmaz hale geliyor. */
const MIN_FONT_PX = 7;
/** Hane başına daire büyümesi: tek hane taban çapta kalır, her EK hane çapı %15
 *  büyütür (19 → 22 → 25). Rakamın genişliği hane başına ~iki katına çıktığı için
 *  daire tek başına yetişemez; büyüme yükün bir kısmını alır, kalanını punto
 *  küçültmesi kapatır. İkisi birlikte çalışınca 3 hanede punto 8.45px yerine
 *  ~10.7px'te kalıyor, yani okunur. */
const SIZE_GROWTH = 1.15;

/** Glifin gerçekten mürekkeplenen kutusunun merkezi, em ORANI olarak.
 *  canvas measureText kullanılır: SVG getBBox'ın aksine gerçekten mürekkep tabanlıdır
 *  (getBBox metin için em/metrik kutusunu döndürür, ki tarayıcılar ascent/descent'i
 *  farklı font tablolarından okur) ve elemanın ekranda olmasını gerektirmez — rozet
 *  `display:none` iken bile doğru ölçer. */
function inkMetrics(text: string) {
  const key = `${typeof document !== "undefined" ? document.fonts?.status : ""}|${text}`;
  const hit = INK.get(key);
  if (hit) return hit;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return null;
  ctx.font = BADGE_FONT(PROBE_PX);
  const m = ctx.measureText(text);
  const left = -m.actualBoundingBoxLeft, right = m.actualBoundingBoxRight;
  const top = -m.actualBoundingBoxAscent, bottom = m.actualBoundingBoxDescent;
  if (![left, right, top, bottom].every(Number.isFinite) || right <= left || bottom <= top) return null;
  const r = {
    cx: (left + right) / 2 / PROBE_PX, cy: (top + bottom) / 2 / PROBE_PX,
    w: (right - left) / PROBE_PX, h: (bottom - top) / PROBE_PX,
  };
  INK.set(key, r);
  return r;
}

// Vitrin ikonu: askı. Ürün kartındaki "vitrine ekle" düğmesi ile sol menüdeki
// VİTRİNİM girişi aynı ikonu paylaşır (tek kaynak, tutarlı görünüm).
export function HangerIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flex: "none" }}>
      <path
        d="M12 4.2a2.3 2.3 0 0 1 2.3 2.3c0 1-.7 1.6-1.5 2.1-.5.3-.8.7-.8 1.2v.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="m12 10.6 8.3 5.2c1 .6.5 2.2-.7 2.2H4.4c-1.2 0-1.7-1.6-.7-2.2L12 10.6Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Marka rehberi ikonu: etiket. Sol menüdeki MARKALAR girişi, hemen altındaki
// VİTRİNİM ile aynı ölçüde ve aynı çizgi kalınlığında dursun diye askı ikonuyla
// birebir aynı kutuda (24) ve aynı stroke ile çizilir.
export function TagIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flex: "none" }}>
      <path
        d="M11.4 3.5H4.9a1.4 1.4 0 0 0-1.4 1.4v6.5c0 .4.2.7.4 1l8.3 8.3c.5.5 1.4.5 2 0l6.4-6.4c.6-.6.6-1.4 0-2l-8.3-8.3a1.4 1.4 0 0 0-1-.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="7.9" cy="7.9" r="1.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

// Misyon ikonu: pusula. Sol menüde MARKALAR/VİTRİNİM ile aynı kutuda (24) ve aynı
// çizgi kalınlığında — üç giriş de aynı ölçüde dursun diye.
export function CompassIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flex: "none" }}>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="m15.4 8.6-1.9 4.9-4.9 1.9 1.9-4.9 4.9-1.9Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Yuvarlak sayı rozeti. Sırayla denenip hepsi cihaz/tarayıcıya göre kayan üç
 * yöntem: (1) SVG <text> + sabit dy, (2) HTML + flex + elle ayarlı translateY
 * nudge, (3) SVG <text dominant-baseline="central">. Üçü de aslında aynı
 * hatayı farklı şekilde tekrarlıyor: hepsi fontun soyut METRİK tablosuna
 * (ascent/descent/x-height gibi font dosyasının kendi beyan ettiği, gerçek
 * çizilen şekille birebir örtüşmeyen sayılara) güveniyor — "santral baseline"
 * bile bir tahmin, gerçek mürekkebin ölçümü değil.
 * (4) `getBBox()` ile ölçüp ortalamak da aynı tuzağın devamıymış: getBBox METİN
 * için mürekkebi değil em/metrik kutusunu döndürüyor. Ölçüldü — Chromium'da
 * getBBox y=-12/h=16 verirken gerçek mürekkep y=-8/h=8'di; ikisinin merkezi
 * Space Mono'da tesadüfen çakıştığı için Chrome'da doğru görünüyordu. Ayrıca
 * `display:none` altında getBBox sıfır döndüğü için, rozet masaüstünde gizliyken
 * ölçülüp mobile geçildiğinde rakam 4px kayıyordu.
 * Çözüm: ölçüm canvas `measureText().actualBoundingBox*` ile — bu gerçekten
 * mürekkep tabanlı, elemanın ekranda olmasını gerektirmiyor ve BÜYÜK puntoda
 * yapılıp em oranına bölündüğü için küçük punto yuvarlamasından da bağışık.
 * "display" burada set edilmiyor — masaüstünde/mobilde gizle/göster tamamen
 * .vit-badge CSS kuralının (globals.css) elinde kalsın diye. Inline style'da
 * display verilirse, stylesheet'teki "display:none" kuralını ezip masaüstünde
 * de görünür hale getiriyor (yaşanan regresyon buydu).
 */
export function NumberBadge({
  n,
  size = 19,
  fontSize = 11,
  className,
}: {
  n: number | string;
  size?: number;
  fontSize?: number;
  className?: string;
}) {
  // `size` TEK HANELİK taban çap; her ek hane çapı SIZE_GROWTH kadar büyütür.
  // Tam piksele yuvarlanır: kesirli SVG kutusu daireyi bulanıklaştırıyor.
  const dia = Math.round(size * Math.pow(SIZE_GROWTH, Math.max(0, String(n).length - 1)));
  const [box, setBox] = useState<{ x: number; y: number; fs: number } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const m = inkMetrics(String(n));
      if (!m) return;
      // Rakam daireye SIĞMALI. Kutunun köşeleri en dışa taştığı nokta olduğu için
      // ölçüt yarı-köşegen: kullanılabilir yarıçapı aşıyorsa punto o oranda küçülür.
      // Daire büyümesi yükün bir kısmını aldığı için bu genelde 3+ hanede devreye girer.
      const usableR = (dia / 2) * FIT_RATIO;
      const halfDiag = Math.hypot((m.w * fontSize) / 2, (m.h * fontSize) / 2);
      const fs = Math.max(MIN_FONT_PX, fontSize * Math.min(1, usableR / halfDiag));
      // Ortalama küçültülmüş punto ile yeniden hesaplanır, yoksa rakam kayar.
      setBox({ x: dia / 2 - m.cx * fs, y: dia / 2 - m.cy * fs, fs });
    };
    measure();
    // Webfont sonradan gelirse oranlar değişir (yedek monospace ile Space Mono'nun
    // mürekkep merkezi aynı değil) — hazır olunca bir kez daha ölç.
    let alive = true;
    document.fonts?.ready.then(() => { if (alive) measure(); });
    return () => { alive = false; };
  }, [n, dia, fontSize]);

  return (
    <svg
      className={className}
      width={dia}
      height={dia}
      viewBox={`0 0 ${dia} ${dia}`}
      style={{ flex: "none" }}
    >
      <circle cx={dia / 2} cy={dia / 2} r={dia / 2} fill="var(--grn)" />
      {/* Ölçüm useLayoutEffect'te, yani ilk boyamadan ÖNCE gelir; offset pratikte hep
          dolu. canvas hiç kullanılamazsa (ölçüm null) tarayıcının kendi ortalamasına
          düşeriz — kusursuz değil ama rakamsız rozetten iyi. */}
      <text
        x={box ? 0 : dia / 2}
        y={box ? 0 : dia / 2}
        fill="var(--on-accent)"
        fontFamily="'Space Mono', monospace"
        fontWeight={700}
        fontSize={box ? box.fs : fontSize}
        textAnchor={box ? undefined : "middle"}
        dominantBaseline={box ? undefined : "central"}
        transform={box ? `translate(${box.x} ${box.y})` : undefined}
      >
        {n}
      </text>
    </svg>
  );
}

/** Gece/gündüz anahtarındaki ikonlar. Önceden "☀"/"☾" unicode karakterleriydi;
 * bu glifin optik merkezi fontun/cihazın glif metriklerine göre değiştiğinden
 * yuvarlağın içinde simetrik durmuyordu (aynı NumberBadge sorunu). Elle çizilmiş
 * SVG path'e geçince ortalama artık flex kutusunun kendisiyle birebir örtüşüyor
 * — hiçbir font'a bağlı değil. */
export function SunIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flex: "none", display: "block" }}>
      <circle cx="12" cy="12" r="4.3" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
        <line x1="12" y1="2.4" x2="12" y2="4.6" />
        <line x1="12" y1="19.4" x2="12" y2="21.6" />
        <line x1="2.4" y1="12" x2="4.6" y2="12" />
        <line x1="19.4" y1="12" x2="21.6" y2="12" />
      </g>
    </svg>
  );
}

export function MoonIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flex: "none", display: "block" }}>
      <path
        d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Katlanabilir bölüm başlığındaki artı/eksi — mobilde MARKA ve TARZ şeritlerinin
 * ortak işareti (bkz. BrandChips / StyleRow, globals.css `.chip-sec-toggle`).
 *
 * Font glifi değil SVG: "+"/"−" karakterleri taban çizgisine oturuyor ve dairenin
 * ortasında durmuyorlardı. İki şerit AYNI işareti kullanmak zorunda — aynı davranışın
 * iki ayrı çizimi, kullanıcıya iki ayrı kalıp gibi görünüyor.
 */
export function PlusMinus({ open }: { open: boolean }) {
  return (
    // ÇİZGİ KALINLIĞI 2.4 DEĞİL 3: kutu 16px, viewBox 24 → ölçek 2/3, yani 2.4 ekranda
    // 1.6px'e düşüyordu. Tek piksele oturmayan çizgi yumuşatılırken ağırlığın bir yanı
    // diğerinden koyu çıkıyor ve artı, dairenin içinde kaymış görünüyordu. 3 → tam 2px:
    // merkez 12 olduğu için çizgi 11–13 arasını kaplıyor, iki yanı da keskin.
    // (Dairenin çift sayı olması da şart — bkz. globals.css .chip-sec-toggle.)
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ display: "block" }}>
      <path d="M4 12h16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      {!open && <path d="M12 4v16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />}
    </svg>
  );
}
