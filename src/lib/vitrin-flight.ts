// Vitrine ekleme animasyonu — YUMUŞAK "uçuş" efekti.
// Askı (vitrine ekle) tuşuna basınca ürün görselinin bir kopyası, yumuşak bir yay
// çizerek sol menüdeki VİTRİNİM'e (mobilde yüzen reminder'a) süzülür, küçülerek varır;
// varışta hedef hafif bir "pop" yapar. Kasıtlı olarak yumuşak easing kullanılır
// (bu efekt için kullanıcı sert/glitch dili YERİNE yumuşak istedi).

const IMG_W = 640;
const DURATION = 640;

/** Ekranda görünür olan VİTRİNİM hedefini seç; mobil yüzen reminder varsa onu tercih et. */
function pickTarget(): HTMLElement | null {
  const els = Array.from(document.querySelectorAll<HTMLElement>("[data-vitrin-target]"));
  if (els.length === 0) return null;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const visible = els.filter((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    return cx >= 0 && cx <= vw && cy >= 0 && cy <= vh;
  });
  return (
    visible.find((el) => el.dataset.vitrinTarget === "reminder") ||
    visible[0] ||
    els[0] ||
    null
  );
}

/** Hedefe yumuşak bir "pop" oynat (varışta tetiklenir). */
function firePulse(el: HTMLElement) {
  el.classList.remove("vf-hit");
  // sınıfı tekrar eklemeden önce reflow'u zorla — animasyon yeniden oynasın
  void el.offsetWidth;
  el.classList.add("vf-hit");
  window.setTimeout(() => el.classList.remove("vf-hit"), 520);
}

/**
 * @param fromEl  Uçuşun başlayacağı kaynak eleman (ürün görsel paneli).
 * @param src     Ürün görselinin (proxy'lenecek) kaynak URL'i.
 */
export function flyToVitrin(fromEl: Element | null, src: string | null): void {
  if (typeof window === "undefined" || !fromEl || !src) return;

  const target = pickTarget();
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // hareketi kısan kullanıcı ya da hedef yoksa: sadece hedefi hafifçe canlandır.
  if (reduce || !target) {
    if (target) firePulse(target);
    return;
  }

  const from = fromEl.getBoundingClientRect();
  const to = target.getBoundingClientRect();

  const sx = from.left + from.width / 2;
  const sy = from.top + from.height / 2;
  const ex = to.left + to.width / 2;
  const ey = to.top + to.height / 2;
  const dist = Math.hypot(ex - sx, ey - sy);

  // uçan kopya: karta benzeyen yuvarlak panel + yumuşak gölge
  const clone = document.createElement("div");
  clone.style.cssText = [
    "position:fixed",
    `left:${from.left}px`,
    `top:${from.top}px`,
    `width:${from.width}px`,
    `height:${from.height}px`,
    "border-radius:72px",
    "overflow:hidden",
    "z-index:200",
    "pointer-events:none",
    "transform-origin:center center",
    "border:2px solid var(--fg-bright)",
    "box-shadow:0 14px 38px rgba(0,0,0,.45)",
    "will-change:transform,opacity",
  ].join(";");

  const img = document.createElement("img");
  img.src = `/api/img?url=${encodeURIComponent(src)}&w=${IMG_W}`;
  img.alt = "";
  img.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;";
  clone.appendChild(img);
  document.body.appendChild(clone);

  // yumuşak yay: orta noktası yukarı doğru kaldırılmış bir quadratic bezier
  const lift = Math.min(220, dist * 0.32);
  const cx = (sx + ex) / 2;
  const cy = (sy + ey) / 2 - lift;

  const N = 26;
  const frames: Keyframe[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const mt = 1 - t;
    const bx = mt * mt * sx + 2 * mt * t * cx + t * t * ex;
    const by = mt * mt * sy + 2 * mt * t * cy + t * t * ey;
    const scale = 1 - 0.86 * t;
    // yalnızca en sonda hafif solma
    const opacity = t < 0.86 ? 1 : 1 - ((t - 0.86) / 0.14) * 0.85;
    frames.push({
      offset: t,
      transform: `translate(${bx - sx}px, ${by - sy}px) scale(${scale})`,
      opacity: String(opacity),
    });
  }

  const anim = clone.animate(frames, {
    duration: DURATION,
    easing: "cubic-bezier(.42,0,.25,1)",
    fill: "forwards",
  });

  // varışta: klonu kaldır + hedefi "pop"la. Yalnızca bir kez çalışsın.
  let done = false;
  const settle = () => {
    if (done) return;
    done = true;
    clone.remove();
    firePulse(target);
  };
  anim.onfinish = settle;
  anim.oncancel = () => {
    if (done) return;
    done = true;
    clone.remove();
  };
  // güvenlik ağı: sekme arka planda/görünmezken WAAPI throttle olup onfinish
  // gecikebilir/kaçabilir — klon asla ekranda takılı kalmasın.
  window.setTimeout(settle, DURATION + 160);
}
