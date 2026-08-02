"use client";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/lang";

/**
 * Ürün görselini markanın CDN'inden /api/img proxy'siyle yansıtır.
 * Boş/hatalı ise tasarımdaki placeholder metni kalır. object-fit:cover ile
 * tüm görseller panel çerçevesinde tek tip boyutta durur.
 * Bu bileşen, position:relative + overflow:hidden bir panelin İÇİNE konur.
 *
 * Yükleme davranışı (sayfa açılışındaki takılmanın kaynağı buydu):
 *  - <img> ancak görsel görüş alanına yaklaşınca DOM'a giriyor. Native loading="lazy"
 *    tek başına yetmiyordu: 40 kartın <img>'i baştan kuruluyor, tarayıcı hepsini
 *    sıraya alıyordu. IntersectionObserver ile ekranın 600px ötesine kadar olanlar
 *    yükleniyor, gerisi kaydırdıkça geliyor.
 *  - srcSet/sizes ile telefon 240–360px'lik görsel indiriyor; eskiden herkese
 *    tek tip 640px gidiyordu.
 *  - İlk sıradaki kartlar `priority` ile beklemeden, yüksek öncelikle yükleniyor.
 */

/** /api/img'in kabul ettiği basamaklar (route.ts: WIDTHS) — keyfi genişlik önbelleği böler. */
const STEPS = [120, 240, 360, 480, 720, 900, 1200];

function proxy(src: string, w: number): string {
  return `/api/img?url=${encodeURIComponent(src)}&w=${w}`;
}

export function ProductImage({
  src,
  fallbacks,
  label = "[ ÜRÜN GÖRSELİ ]",
  w = 480,
  sizes = "(max-width: 600px) 46vw, (max-width: 1100px) 31vw, 23vw",
  priority = false,
}: {
  src: string | null;
  /**
   * Sıradaki aday görseller. `src` yüklenemezse (kaynak 404 verdi, proxy reddetti,
   * marka görseli kaldırdı) sırayla bunlar denenir; hepsi düşerse placeholder kalır.
   *
   * Neden gerekli: katalogdaki her ürünün görseli VAR, ama tek tek URL'ler zamanla
   * ölüyor ve kart bu yüzden boş bir kutuya düşüyordu — oysa aynı ürünün elimizde
   * 2–5 görseli daha duruyor. "İlk fotoyu boş gösterme, atla" kuralı burada uygulanır.
   */
  fallbacks?: (string | null | undefined)[];
  label?: string;
  /** İhtiyaç duyulan en büyük genişlik. srcSet bu değere kadar basamaklanır. */
  w?: number;
  /** <img sizes> — tarayıcının doğru basamağı seçebilmesi için. */
  sizes?: string;
  /** İlk ekranda görünen kartlar: gözlemciyi bekleme, yüksek öncelikle yükle. */
  priority?: boolean;
}) {
  // Aday listesi: asıl görsel + yedekler, tekilleştirilmiş. useMemo değil çünkü liste
  // her boyamada aynı içerikle yeniden kurulsa da yalnız uzunluğu/indeksi okunuyor.
  const candidates = [src, ...(fallbacks ?? [])].filter(
    (u, i, a): u is string => Boolean(u) && a.indexOf(u) === i,
  );
  const [at, setAt] = useState(0);
  const current = candidates[at] ?? null;

  const [state, setState] = useState<"loading" | "ok" | "error" | "empty">(
    candidates.length ? "loading" : "empty",
  );
  const [near, setNear] = useState(priority);
  const anchor = useRef<HTMLSpanElement>(null);
  const t = useT();

  /** Bu aday yüklenemedi: varsa sıradakine geç, yoksa placeholder'a düş. */
  const onImgError = () => {
    if (at + 1 < candidates.length) {
      setAt(at + 1);
      setState("loading");
    } else {
      setState("error");
    }
  };

  useEffect(() => {
    if (near || !current) return;
    const el = anchor.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setNear(true); // gözlemci yoksa (çok eski tarayıcı) eski davranışa dön
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near, current]);

  const ladder = STEPS.filter((s) => s <= w);
  if (!ladder.length) ladder.push(STEPS[0]);
  const srcSet = ladder.map((s) => `${proxy(current ?? "", s)} ${s}w`).join(", ");

  return (
    <>
      {/* gözlem hedefi: paneli tam kaplayan görünmez kutu. Metin placeholder'ı hedef
          alınamıyor — ortalanmış küçük bir yazı, hatta boşken sıfır boyutlu olurdu. */}
      {current && !near && <span ref={anchor} aria-hidden style={{ position: "absolute", inset: 0 }} />}
      {current && near && state !== "error" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          // key: aday değişince tarayıcı ESKİ <img>'i yeniden kullanmasın. Aynı düğüm
          // üzerinde src değiştirmek bazı tarayıcılarda yeni bir error/load olayı
          // üretmiyor ve atlama tek adımda takılıyordu.
          key={current}
          src={proxy(current, ladder[ladder.length - 1])}
          srcSet={ladder.length > 1 ? srcSet : undefined}
          sizes={ladder.length > 1 ? sizes : undefined}
          alt=""
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "low"}
          onLoad={() => setState("ok")}
          onError={onImgError}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: state === "ok" ? 1 : 0,
            // Ani "pat" yerine kısa bir açılma: kategori değiştirince kartlar tek tek
            // dolduğu için sert geçişler ekranı kıpır kıpır gösteriyordu.
            transition: "opacity .18s ease-out",
          }}
        />
      )}
      {/* Bekleme/hata katmanı paneli TAMAMEN kaplar (eskiden yalnız ortadaki yazı
          kadardı, bu yüzden iskelet zemini kartın arkasını değil bir metin kutusunu
          boyuyordu). Yüklenirken YAZI YOK: "[ YÜKLENİYOR ]" 40 kartta aynı anda
          belirip kaybolunca vitrin titriyordu; sessiz bir zemin yeterli. */}
      {state !== "ok" && (
        <span
          className={state === "loading" && near ? "img-skel" : ""}
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'Space Mono', monospace",
            fontSize: 12,
            letterSpacing: ".18em",
            color: "var(--faint2)",
            textAlign: "center",
            padding: "0 8px",
            zIndex: 1,
          }}
        >
          {state === "error" || state === "empty" ? t(label) : ""}
        </span>
      )}
    </>
  );
}
