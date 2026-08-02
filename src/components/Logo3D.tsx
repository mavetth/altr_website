"use client";
import { useEffect, useRef, type CSSProperties } from "react";

/**
 * 3B "altr" wordmark — SABİT durur; yalnız fareyle (parmakla) SÜRÜKLENİNCE her eksende döner.
 * Bırakılınca yavaş ve yumuşak şekilde doğal (ilk) açısına geri süzülür. Kendi kendine dönmez.
 *
 * Kütüphane yok: Z ekseninde katmanlanmış "faux extrusion". Katmanlar Z=0 ETRAFINDA ortalanır —
 * böylece blok kendi merkezinden döner, yana yatınca bile sağ/sol simetrik ve tam ortalı görünür
 * (ön yüzden pivotlarsa lopsided oluyordu). Adım küçük tutulur ki komşu katmanlar üst üste binip
 * yandan dolu bir blok gibi görünsün.
 *
 * RENK temaya bağlı: katmanlar `--grn` vurgu değişkeninden `color-mix` ile türer → GECE sarı /
 * GÜNDÜZ mor (tema değişince anında döner). Erişilebilirlik: animasyon yalnız etkileşimde çalışır;
 * `prefers-reduced-motion` açıksa geri dönüş anında yapılır.
 *
 * ORTAK 3B BAĞLAM YOK (sticky ata hatası). Bu bileşen sticky konumlu bir atanın
 * (Sidebar.tsx > .sidebar) içinde duruyor. Atada `perspective`, sahnede `transform-style:
 * preserve-3d` olduğunda Firefox sayfa kaydırılırken logoyu bozuk çiziyordu: sticky sidebar
 * derleyicide (compositor) eşzamansız kaydırılıyor, altındaki 3B bağlam ise o kaymayla birlikte
 * yeniden geçerlenmiyor → dikey lekelenme/iz. Çözüm bir tarayıcı yaması değil, hatanın kaynağını
 * kaldırmak: ortak 3B bağlam yerine HER KATMAN kendi `perspective(...)` fonksiyonunu taşıyor.
 * Ekrandaki sonuç birebir aynı, çünkü dönüş sırası (perspective ∘ rotateX ∘ rotateY ∘ translateZ)
 * ve tüm dönüş merkezleri (sahne merkezi = her katmanın merkezi) eskisiyle çakışıyor — ama artık
 * ortada tarayıcının kaydırmayla senkronlaması gereken bir 3B katman yığını kalmıyor.
 *
 * Bedeli: derinlik sıralaması tarayıcıya bırakılamıyor (düz bağlamda boyama DOM sırasına düşer).
 * Onu `--logo-dir` ile kendimiz çeviriyoruz — bkz. aşağıdaki `apply` ve globals.css `.logo3d-layer`.
 * Yan faydası: `preserve-3d` derinlik sıralaması tarayıcıdan tarayıcıya değişirdi, bu haliyle
 * hepsinde birebir aynı.
 */
// Aşağıdaki sabitler (STEP, thickness, PERSPECTIVE) BU yazı boyu için yazıldı. Gerçek boy
// `--logo-fs` değişkeninden gelir ve tüm kurulumu (yazı + derinlik + bakış mesafesi) birlikte
// ölçekler — perspektif yansıtması ölçek değişmezdir, yani üçü birden çarpılınca görüntü
// yalnızca büyür/küçülür, oranları bozulmaz. Mobil bu yüzden CSS'ten eski boyuna sabitlenebiliyor
// (globals.css ≤820px bloğu) — masaüstü büyürken mobil piksel piksel aynı kalır.
const BASE_FS = 50;
const STEP = 0.45; // katmanlar arası Z adımı (px, BASE_FS boyunda) — küçük = dolu blok
// Doğal duruş: yalnız X ekseninde hafif eğik (3B derinlik görünsün); Y ekseninde düz (çapraz durmaz).
const REST_RX = -7;
const REST_RY = 0;
// Bırakınca geri dönüş süresi (ms) — en az 10 saniye sürsün.
const RETURN_MS = 10000;
// Bakış mesafesi (px). Eskiden atadaki `perspective` ÖZELLİĞİYDİ; artık her katmanın kendi
// transform'undaki `perspective()` FONKSİYONU. İkisi de aynı matrisi (m34 = -1/d) üretir.
const PERSPECTIVE = 750;

export function Logo3D({
  text = "altr",
  fontSize = 50,
  thickness = 40,
  className,
  onClick,
}: {
  text?: string;
  fontSize?: number;
  /** Ekstrüzyon KALINLIĞI (px). Katman sayısı = kalınlık / adım. */
  thickness?: number;
  className?: string;
  /** Sürükleme değil, düz tıklama/dokunma: parmak/işaretçi ilk indiği yerden
   * neredeyse hiç oynamadan kalkarsa çağrılır (bkz. down/up içindeki eşik). */
  onClick?: () => void;
}) {
  const depth = Math.max(2, Math.round(thickness / STEP));
  const sceneRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const onClickRef = useRef(onClick);
  useEffect(() => {
    onClickRef.current = onClick;
  }, [onClick]);

  useEffect(() => {
    const scene = sceneRef.current;
    const stage = stageRef.current;
    if (!scene || !stage) return;

    const reduce =
      typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;

    let rx = REST_RX, ry = REST_RY;
    let drag = false, px = 0, py = 0, raf = 0;
    // İndiği ilk nokta — sürükleme mesafesini (dolayısıyla tıklama mı sürükleme mi
    // olduğunu) ölçmek için px/py'den ayrı tutulur (onlar her move'da güncellenir).
    let downX = 0, downY = 0;
    // Geri dönüş tween durumu (zaman tabanlı → süre sabit kalır, açıdan bağımsız).
    let t0 = 0, sx = REST_RX, sy = REST_RY;

    // Dönüş tek bir özel değişkenle yayılır: sahne dönmez, katmanların her biri kendi
    // transform'unda `var(--logo-rot)` okur. Tek `setProperty` → tek stil geçersizlemesi.
    const apply = () => {
      scene.style.setProperty(
        "--logo-rot",
        `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`,
      );
      // Bloğun ön yüzü ekrana mı bakıyor? (0,0,z) noktasının ekran derinliği z·cos(rx)·cos(ry)
      // ile orantılı; işaret değişince ön/arka yer değiştirir ve boyama sırası ters çevrilmeli.
      const rad = Math.PI / 180;
      const facing = Math.cos(rx * rad) * Math.cos(ry * rad);
      scene.style.setProperty("--logo-dir", facing < 0 ? "-1" : "1");
    };
    apply();

    const down = (e: PointerEvent) => {
      drag = true;
      px = e.clientX;
      py = e.clientY;
      downX = e.clientX;
      downY = e.clientY;
      cancelAnimationFrame(raf);
      raf = 0;
      stage.setPointerCapture(e.pointerId);
      stage.style.cursor = "grabbing";
    };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      ry += (e.clientX - px) * 0.55;
      rx -= (e.clientY - py) * 0.55;
      px = e.clientX;
      py = e.clientY;
      apply(); // sürükleme sırasında rAF gerekmez, doğrudan uygula
    };

    // Bırakınca doğal açıya yumuşak geri dönüş — sabit RETURN_MS boyunca süzülür, sonra durur.
    const settle = (now: number) => {
      if (drag) return;
      const p = Math.min(1, (now - t0) / RETURN_MS);
      const e = 1 - Math.pow(1 - p, 3); // easeOutCubic — sona doğru yumuşak yavaşlar
      rx = sx + (REST_RX - sx) * e;
      ry = sy + (REST_RY - sy) * e;
      apply();
      if (p >= 1) {
        rx = REST_RX;
        ry = REST_RY;
        apply();
        raf = 0;
        return; // yerine oturdu, döngüyü durdur
      }
      raf = requestAnimationFrame(settle);
    };

    const up = (e: PointerEvent) => {
      if (!drag) return;
      drag = false;
      stage.style.cursor = "grab";
      if (reduce) {
        rx = REST_RX;
        ry = REST_RY;
        apply();
      } else if (!raf) {
        sx = rx;
        sy = ry;
        t0 = performance.now();
        raf = requestAnimationFrame(settle);
      }
      // Sürükleme yoksa (neredeyse yerinde bırakıldıysa) tıklama say.
      const moved = Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY);
      if (moved < 6) onClickRef.current?.();
    };

    stage.addEventListener("pointerdown", down);
    stage.addEventListener("pointermove", move);
    stage.addEventListener("pointerup", up);
    stage.addEventListener("pointercancel", up);

    return () => {
      cancelAnimationFrame(raf);
      stage.removeEventListener("pointerdown", down);
      stage.removeEventListener("pointermove", move);
      stage.removeEventListener("pointerup", up);
      stage.removeEventListener("pointercancel", up);
    };
  }, []);

  const layers = [];
  for (let i = depth; i >= 0; i--) {
    const t = i / depth; // 1 = arka, 0 = ön
    const bright = Math.round(20 + 80 * (1 - t));
    const front = i === 0;
    // Z=0 etrafında ortala: i=0 → +yarı derinlik (ön), i=depth → -yarı derinlik (arka)
    const z = (depth / 2 - i) * STEP;
    layers.push(
      <span
        key={i}
        aria-hidden
        className="logo3d-layer"
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Anton', sans-serif",
          fontSize: "var(--logo-fs)",
          lineHeight: 1,
          letterSpacing: ".02em",
          whiteSpace: "nowrap",
          // Katmanın KENDİ 3B yansıtması — ata `perspective`/`preserve-3d` yerine (bkz. başlık).
          // Mesafeler --logo-fs ORANI olarak yazılır ki boy değişince derinlik de birlikte ölçeklensin.
          transform:
            `perspective(calc(var(--logo-fs) * ${PERSPECTIVE / BASE_FS})) var(--logo-rot) ` +
            `translateZ(calc(var(--logo-fs) * ${(z / BASE_FS).toFixed(5)}))`,
          // Önden arkaya sıra: ön (i=0) en büyük. z-index'i globals.css `--logo-dir` ile çarpar.
          "--lz": depth - i,
          color: front ? "var(--grn)" : `color-mix(in srgb, var(--grn) ${bright}%, #000)`,
          textShadow: front ? "1.5px 0 rgba(255,0,120,.5), -1.5px 0 rgba(0,220,255,.5)" : undefined,
        } as CSSProperties}
      >
        {text}
      </span>,
    );
  }

  return (
    <div
      ref={stageRef}
      className={`logo3d${className ? ` ${className}` : ""}`}
      style={{
        // Tek ölçek kolu: CSS bunu ezerek (bkz. globals.css ≤820px) logoyu boyutlandırabilir.
        "--logo-fs": `${fontSize}px`,
        cursor: "grab",
        touchAction: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
      } as CSSProperties}
      role="img"
      aria-label={text}
    >
      <div
        ref={sceneRef}
        style={{
          position: "relative",
          width: "calc(var(--logo-fs) * 2.4)",
          height: "calc(var(--logo-fs) * 1.15)",
          // Kendi yığın bağlamı: --logo-dir=-1 iken katmanların z-index'i negatife düşüyor;
          // bağlam olmasa o katmanlar sidebar zemininin ARKASINA boyanıp kaybolurdu.
          isolation: "isolate",
          // İlk boyamada da doğal duruşta olsun — useEffect çalışana kadar düz durmasın.
          "--logo-rot": `rotateX(${REST_RX}deg) rotateY(${REST_RY}deg)`,
          "--logo-dir": "1",
        } as CSSProperties}
      >
        {layers}
      </div>
    </div>
  );
}
