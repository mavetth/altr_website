"use client";
import { useEffect, useState } from "react";
import { BRAND_LOGOS } from "@/lib/brand-logos.generated";
import { INTRO_KEY, type Lang } from "@/lib/i18n";
import { useLang } from "@/lib/lang";
import { useStore } from "@/store";
import { Logo3D } from "./Logo3D";
import { FlagTR, FlagUS } from "./flags";
import "./intro.css";

/**
 * KARŞILAMA (MİSYON) MODALI.
 *
 * Kaynağı `altr-landing` projesinin kapı ekranı. Oradaki DAVET KODU + BEKLEME LİSTESİ
 * katmanı (referans sistemi) tamamen çıkarıldı; yerine DİL SEÇİMİ geldi. Fark önemli:
 *
 *   - Kapı bir ENGELDİ (çerezi olmayan siteye giremiyordu, middleware yönlendiriyordu).
 *   - Bu modal bir KARŞILAMA. Siteyi kilitlemiyor, cihaz başına BİR KEZ açılıyor, okla
 *     geçiliyor ve sonra yalnız sol menüdeki MİSYON girişinden çağrılıyor.
 *
 * Dil bayrağına basmak modalı KAPATMAZ — kullanıcı İngilizceye geçip metni okuyabilsin,
 * karar verince okla girsin. İstediği bu: "bayrağa basarak dil değiştiren birisi altta
 * ok'a basarak siteye devam edebilecek, basmadan da modaldaki yazıları İngilizce
 * okuyabilecek."
 *
 * Modal KATALOĞA DOKUNMAZ: marka sayısı ve ürün sayısı zaten vitrinin elindeki
 * değerlerden geliyor, arka plan duvarı da `public/brand-logos/*.webp` altındaki hazır
 * dosyalardan. Ek bir veri yükü yok.
 */

/** Duvarda kaç logo. 54 hem ızgarayı doldurur hem yükü ~400 KB'ta tutar. */
const WALL_COUNT = 54;

/**
 * Alfabetik listeden EŞİT ARALIKLI örnek. Baştan 54 tanesini almak duvarı "a-c"
 * harfleriyle doldururdu. Rastgelelik YOK: sunucu ile istemci aynı diziyi üretmeli.
 */
function wallSample(): Array<[string, (typeof BRAND_LOGOS)[string]]> {
  const all = Object.keys(BRAND_LOGOS).sort();
  if (all.length <= WALL_COUNT) return all.map((k) => [k, BRAND_LOGOS[k]]);
  const step = all.length / WALL_COUNT;
  const out: Array<[string, (typeof BRAND_LOGOS)[string]]> = [];
  for (let i = 0; i < WALL_COUNT; i++) {
    const key = all[Math.floor(i * step)];
    out.push([key, BRAND_LOGOS[key]]);
  }
  return out;
}

function ArrowDown() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden style={{ display: "block" }}>
      <path d="M12 4v15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="m5.5 12.5 6.5 6.5 6.5-6.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
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

/** Misyon blokları — metin burada, çevirisi lib/i18n.ts sözlüğünde. */
const MISSION = [
  {
    title: "TEK VİTRİN",
    body: "Bağımsız markalar akışın içinde kayboluyor. altr hepsini tek ekrana getirir; ürünler markanın kendi sitesinden gelir, arada kimse yok.",
  },
  {
    title: "SIRA SATILMAZ",
    body: "Vitrindeki yer satın alınamaz. Sıralamayı marka puanı ve ürün kalitesi kurar; en büyük katalog bile ekranı ele geçiremez.",
  },
  {
    title: "SENİN LİSTEN",
    body: "Beğendiklerini listeye at, linkiyle paylaş. Hesap açmadan, hiçbir yere kaydolmadan.",
  },
] as const;

export function IntroModal({ brandCount }: { brandCount: number }) {
  const { lang, setLang, t, n } = useLang();
  const open = useStore((s) => s.introOpen);
  const openIntro = useStore((s) => s.openIntro);
  const closeIntro = useStore((s) => s.closeIntro);
  /** Sol menüden çağrıldıysa "ilk karşılama" değil — kapatma rozeti çıkar. */
  const manual = useStore((s) => s.introManual);
  const total = useStore((s) => s.result?.total ?? 0);

  /**
   * İlk karşılama kararı MONTAJDAN SONRA veriliyor: localStorage sunucuda yok, SSR'de
   * okunamaz. Bir kare gecikmeyle açılması sorun değil — modal zaten tam ekran.
   */
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    if (checked) return;
    setChecked(true);
    try {
      if (localStorage.getItem(INTRO_KEY) !== "1") openIntro(false);
    } catch {
      /* depolama kapalıysa modalı hiç açma — her ziyarette göstermek daha kötü */
    }
  }, [checked, openIntro]);

  // Sol menüden açıldığında Escape ile kapanabilsin (ilk karşılamada tek çıkış ok).
  useEffect(() => {
    if (!open || !manual) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeIntro();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, manual, closeIntro]);

  // Modal açıkken arkadaki vitrin kaymasın.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const pick = (l: Lang) => setLang(l);

  const enter = () => {
    try {
      localStorage.setItem(INTRO_KEY, "1");
    } catch {
      /* yoksay */
    }
    closeIntro();
  };

  const logos = wallSample();

  return (
    <div className="intro-veil" role="dialog" aria-modal="true" aria-label="altr">
      <div className="intro">
        {/* aria-hidden: dekoratif. Ekran okuyucuya 54 marka adı okutmanın anlamı yok. */}
        <div className="intro-wall" aria-hidden="true">
          {logos.map(([slug, meta], i) => (
            <span key={slug} className="intro-wall-cell" data-wide={meta.w / meta.h > 6 ? "1" : undefined}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="brand-logo intro-wall-logo"
                src={`/brand-logos/${slug}.webp`}
                alt=""
                width={meta.w}
                height={meta.h}
                data-inv={meta.inv ? "1" : "0"}
                fetchPriority="low"
                decoding="async"
                draggable={false}
                /* Titreşimi zamanda dağıt; asal olmayan adım deseni ızgarayla
                   hizalanıp dalgaya dönüşmesin diye. */
                style={{ animationDelay: `${(i * 0.37).toFixed(2)}s` }}
              />
            </span>
          ))}
        </div>

        {manual && (
          <span className="intro-close" onClick={closeIntro} role="button" aria-label={t("KAPAT")}>
            <CloseIcon />
          </span>
        )}

        <div className="intro-inner">
          <div className="intro-logo">
            <Logo3D fontSize={110} />
          </div>

          <h1 className="intro-tagline">{t("TÜRKİYE'NİN ALTERNATİF GİYİM VİTRİNİ")}</h1>

          <p className="intro-stats">
            {/* .live: globals.css'teki steps(2) nabız — sitenin "canlı" göstergesiyle aynı */}
            <span className="live intro-dot" aria-hidden="true">
              ●
            </span>
            {n(brandCount)} {t("MARKA")} · {n(total)} {t("ÜRÜN")} · {t("CANLI")}
          </p>

          <div className="intro-dotline" />

          <section className="intro-mission">
            {MISSION.map((m) => (
              <article key={m.title}>
                <h2 className="intro-mission-title">{t(m.title)}</h2>
                <p className="intro-mission-body">{t(m.body)}</p>
              </article>
            ))}
          </section>

          <div className="intro-dotline" />

          {/* DİL — etiket bilerek iki dilde: seçim yapılmadan önce hangi dili okuduğu
              belli olmayabilir, bu satır her iki okuyucuya da anlamlı gelmeli. */}
          <div className="intro-langlabel">DİL / LANGUAGE</div>
          <div className="intro-langs">
            <button
              type="button"
              className="intro-flag"
              aria-pressed={lang === "tr"}
              onClick={() => pick("tr")}
            >
              <FlagTR />
              TÜRKÇE
            </button>
            <button
              type="button"
              className="intro-flag"
              aria-pressed={lang === "en"}
              onClick={() => pick("en")}
            >
              <FlagUS />
              ENGLISH
            </button>
          </div>

          {/* Devam oku — modaldan çıkışın ana yolu. Gerçek <button>: sitenin genelinde
              tıklanabilirler <span onClick> ama bu, ilk karşılamadan çıkan TEK yol;
              <span> olsaydı klavye kullanıcısı siteye hiç geçemezdi. */}
          <button type="button" className="intro-go" onClick={enter}>
            <span className="intro-go-ring">
              <ArrowDown />
            </span>
            <span className="intro-go-text">{t("SİTEYE DEVAM ET")}</span>
          </button>

          <div className="intro-footer">{t("altr — alternatif giyim vitrini")}</div>
        </div>
      </div>
    </div>
  );
}
