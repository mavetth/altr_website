"use client";
import { indexLetter, type BrandIndexRow } from "@/lib/brand-page-shared";
import { STYLES } from "@/lib/brand-styles";
import { BrandLogo } from "./BrandLogo";
import { useLang } from "@/lib/lang";

/**
 * MARKALAR — "kimler var" ekranı.
 *
 * Ana vitrin "bugün ne var" sorusuna cevap verir; burası "kimler var" sorusuna. Bu yüzden
 * ürün yok, sıralama yok: sadece alfabetik, iri ve taranabilir bir marka rehberi.
 * Harf başlıkları listeyi göz için bölüyor — 150 kalemlik düz bir liste okunmuyor.
 *
 * Bileşen İKİ yerde kullanılıyor: `/markalar` sayfasında (sunucuda çizilir, bağlar
 * gerçek `<a>`) ve vitrinin MARKALAR sekmesinde (`onOpen` verilir, tıklama sayfa
 * yüklemeden sekme değiştirir). Tek kaynak: iki giriş noktası aynı ekranı gösterir.
 */

const STYLE_LABEL: Record<string, string> = Object.fromEntries(STYLES.map((s) => [s.k, s.label]));

export function BrandIndex({
  rows,
  /** Verilirse tıklama sayfa yüklemez, uygulama içinde marka sekmesini açar. */
  onOpen,
}: {
  rows: BrandIndexRow[];
  onOpen?: (slug: string) => void;
}) {
  const { t, n } = useLang();
  const groups: Array<{ letter: string; rows: BrandIndexRow[] }> = [];
  for (const b of rows) {
    const l = indexLetter(b.name);
    const last = groups[groups.length - 1];
    if (last && last.letter === l) last.rows.push(b);
    else groups.push({ letter: l, rows: [b] });
  }

  const totalProducts = rows.reduce((s, b) => s + b.count, 0);

  return (
    <>
      <h1
        className="glitch-head"
        style={{
          fontFamily: "'Anton', sans-serif",
          fontSize: 62,
          lineHeight: 1,
          letterSpacing: ".02em",
          color: "var(--fg-bright)",
          textTransform: "uppercase",
          margin: "10px 0 12px",
        }}
      >
        {t("Markalar")}
      </h1>
      <p style={{ maxWidth: 620, fontSize: 14, lineHeight: 1.8, color: "var(--muted)", borderLeft: "2px solid var(--grn)", paddingLeft: 16, margin: "0 0 26px" }}>
        {t("vitrindeki")} <span style={{ color: "var(--grn)" }}>{rows.length}</span>{" "}
        {t("markanın tamamı, alfabetik. toplam")}{" "}
        <span style={{ color: "var(--grn)" }}>{n(totalProducts)}</span>{" "}
        {t("parça. bir markaya bas, kendi sayfasına git.")}
      </p>

      {/* harf şeridi: uzun listede sayfa içi zıplama */}
      <nav style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 34 }}>
        {groups.map((g) => (
          <a
            key={g.letter}
            href={`#harf-${encodeURIComponent(g.letter)}`}
            className="fbox"
            style={{
              minWidth: 32,
              textAlign: "center",
              fontFamily: "'Space Mono', monospace",
              fontSize: 13,
              padding: "6px 0",
              border: "1px solid var(--line)",
              color: "var(--muted)",
              textDecoration: "none",
            }}
          >
            {g.letter}
          </a>
        ))}
      </nav>

      {groups.map((g) => (
        // scrollMarginTop: harf şeridinden zıplayınca başlık YAPIŞIK ÜST BARIN ALTINDA
        // kalmasın. Sabit 24px yalnız /markalar sayfası için doğruydu (orada başlık
        // sticky değil); vitrinin MARKALAR sekmesinde 61px'lik topbar harfin üstünü
        // yiyordu. Ölçü artık bağlamdan geliyor — bkz. globals.css `--anchor-offset`.
        <section
          key={g.letter}
          id={`harf-${encodeURIComponent(g.letter)}`}
          style={{ marginBottom: 40, scrollMarginTop: "var(--anchor-offset, 24px)" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
            <span style={{ fontFamily: "'Anton', sans-serif", fontSize: 44, lineHeight: 1, color: "var(--grn)" }}>
              {g.letter}
            </span>
            <span style={{ flex: 1, height: 1, background: "var(--line3)" }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "var(--faint)" }}>
              {g.rows.length}
            </span>
          </div>

          <div className="brand-index-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14 }}>
            {g.rows.map((b) => (
              // href her hâlükârda gerçek: orta tık / yeni sekmede aç / arama motoru
              // çalışmaya devam etsin. onOpen varsa SOL tık sekme değiştirir.
              <a
                key={b.slug}
                href={`/${b.slug}`}
                onClick={
                  onOpen
                    ? (e) => {
                        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                        e.preventDefault();
                        onOpen(b.slug);
                      }
                    : undefined
                }
                className="brand-index-card"
                style={{ display: "block", padding: "16px 18px", border: "1px solid var(--line)", color: "inherit", textDecoration: "none" }}
              >
                {/* Logo kartın YÜZÜ: rehberde marka önce logosundan tanınır, o yüzden
                    kendi çerçeveli alanı var ve marka sayfasındaki iri logonun küçük
                    ama okunur bir kardeşi kadar büyük.

                    Yükseklik SABİT (minHeight değil): sembol logolar referans ölçünün
                    1.6 katına kadar büyüyebiliyor, kutu da onunla uzayınca aynı satırdaki
                    kartlar farklı boylarda duruyordu. Artık kutu değişmez, logo `maxH`
                    ile kutunun içinde kalır. */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 88,
                    padding: "12px 14px",
                    marginBottom: 12,
                    border: "1px solid var(--line3)",
                    borderRadius: 14,
                    background: "var(--tex)",
                    overflow: "hidden",
                  }}
                >
                  <BrandLogo
                    slug={b.slug}
                    name={b.name}
                    h={46}
                    /* En dar kart 260px: 36 (kart) + 28 (kutu) + 2 (çerçeve) düşünce
                       186px kalıyor — logo kutunun dışına taşmasın. */
                    maxW={186}
                    maxH={62}
                    /* Marka adı kutunun hemen ALTINDA zaten yazıyor; sembol logoların
                       yanına bir kez daha yazmak hem tekrar hem de kutuyu taşırıyordu. */
                    showName={false}
                    fallback={
                      <span style={{ fontFamily: "'Anton', sans-serif", fontSize: 21, lineHeight: 1.1, textAlign: "center", color: "var(--fg-bright)", textTransform: "uppercase" }}>
                        {b.name}
                      </span>
                    }
                  />
                </div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, letterSpacing: ".08em", color: "var(--fg)", textTransform: "uppercase" }}>
                  {b.name}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 8, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: "var(--muted3)" }}>
                  <span style={{ color: "var(--grn)" }}>{n(b.count)}</span>
                  <span>{t("parça")}</span>
                  {b.styles.map((s) => (
                    <span key={s} style={{ letterSpacing: ".1em", border: "1px solid var(--line2)", padding: "2px 7px" }}>
                      {t(STYLE_LABEL[s] ?? s)}
                    </span>
                  ))}
                </div>
                {/* Tek satırlık avantaj: rehberde markalar arasında gezerken en çok
                    sorulan şey (kargo bedava mı) burada görünsün. */}
                {b.perk && (
                  <div style={{ marginTop: 8, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: "var(--muted)" }}>
                    <span style={{ color: "var(--grn)", marginRight: 6 }}>▸</span>
                    {b.perk.metin}
                  </div>
                )}
              </a>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
