"use client";
import type { Product } from "@/lib/types";
import { BRAND_PAGE_SIZE, type BrandPageData } from "@/lib/brand-page-shared";
import { catSlug, formatPrice } from "@/lib/query";
import { pageList } from "@/lib/pagination";
import { STYLES, type StyleKey } from "@/lib/brand-styles";
import { PERK_LABEL } from "@/lib/brand-perks";
import { BrandLogo } from "./BrandLogo";
import { BrandProductGrid } from "./BrandProductGrid";
import { StoreGate } from "./StoreGate";
import { useLang } from "@/lib/lang";

/**
 * MARKA SAYFASI — "bu marka kim".
 *
 * BrandIndex gibi İKİ yerde kullanılıyor: `/<slug>` sayfasında (sunucuda çizilir, tüm
 * bağlar gerçek `<a>` — SEO ve paylaşım) ve vitrinin marka sekmesinde (handler'lar
 * verilir, tıklamalar sayfa yüklemeden sekme/filtre değiştirir).
 *
 * Mağazaya çıkış her iki durumda da StoreGate'ten, yani kaydırma ritüelinden geçer.
 */

const STYLE_LABEL: Record<string, string> = Object.fromEntries(STYLES.map((s) => [s.k, s.label]));

export interface BrandPageHandlers {
  /** Yol izindeki MARKALAR — rehber sekmesine döner. */
  onIndex?: () => void;
  /** Sayfalama (verilmezse gerçek `<a href="?sayfa=n">`). */
  onPage?: (n: number) => void;
  /** Tarz çipi — vitrini o tarza filtreler. */
  onStyle?: (s: StyleKey) => void;
  /** Markaya (ve istenirse kategoriye) göre vitrini filtreler. */
  onFilter?: (cat?: string) => void;
  /** Ürün kartı — verilirse markanın sitesine gitmek yerine ürün modalini açar. */
  onOpenProduct?: (items: Product[], index: number) => void;
}

export function BrandPage({
  data,
  page,
  handlers = {},
}: {
  data: BrandPageData;
  page: number;
  handlers?: BrandPageHandlers;
}) {
  const { brand, stats, styles, perks, items, matched } = data;
  const pageCount = Math.max(1, Math.ceil(matched / BRAND_PAGE_SIZE));
  const { onPage, onStyle, onFilter, onOpenProduct } = handlers;
  const { t, n: num, lang } = useLang();
  const loc = lang === "en" ? "en-US" : "tr-TR";

  /** Sol tık handler'a, diğer her şey (orta tık, ctrl+tık) gerçek bağa gider. */
  const intercept = (fn?: () => void) =>
    fn
      ? (e: React.MouseEvent) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          fn();
        }
      : undefined;

  return (
    <>
      {/* ---- marka başlığı: iri logo + künye ---- */}
      <section
        className="brand-hero"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(200px,300px) minmax(0,1fr)",
          gap: 40,
          alignItems: "center",
          padding: "20px 0 30px",
          borderBottom: "1px solid var(--line3)",
          marginBottom: 30,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 170,
            padding: 24,
            border: "2px solid var(--fg-bright)",
            borderRadius: 26,
            background: "var(--tex)",
          }}
        >
          <BrandLogo
            slug={brand.slug}
            name={brand.name}
            h={70}
            maxW={230}
            /* Künye kutusu 170px: amblem çarpanla birlikte kutuyu uzatmasın. */
            maxH={118}
            /* Sembol logolarda (amblem, ad okunmuyor) BrandLogo adı normalde logonun
               YANINA da yazar — ama burada adı zaten hemen sağda kocaman bir <h1>
               taşıyor. İkisi bu dar kutuda (230px) yan yana sığmayınca (ör. ZERO WEAR)
               ikili grup kutunun dışına taşıyordu. Ad zaten h1'de var, tekrar gerekmiyor. */
            showName={false}
            fallback={
              <span style={{ fontFamily: "'Anton', sans-serif", fontSize: 38, lineHeight: 1.05, textAlign: "center", color: "var(--fg-bright)", textTransform: "uppercase" }}>
                {brand.name}
              </span>
            }
          />
        </div>

        <div>
          <h1
            className="glitch-head"
            style={{
              fontFamily: "'Anton', sans-serif",
              fontSize: 58,
              lineHeight: 1,
              letterSpacing: ".02em",
              color: "var(--fg-bright)",
              textTransform: "uppercase",
              margin: "0 0 14px",
            }}
          >
            {brand.name}
          </h1>

          {styles.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 16 }}>
              {styles.map((s) => (
                <a
                  key={s}
                  href={`/?tarz=${encodeURIComponent(s)}`}
                  onClick={intercept(onStyle && (() => onStyle(s as StyleKey)))}
                  className="fbox"
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 12,
                    letterSpacing: ".1em",
                    padding: "6px 11px",
                    border: "1px solid var(--grn)",
                    color: "var(--grn)",
                    textDecoration: "none",
                  }}
                >
                  {t(STYLE_LABEL[s] ?? s)}
                </a>
              ))}
            </div>
          )}

          <dl className="brand-facts" style={{ display: "flex", flexWrap: "wrap", gap: "16px 34px", margin: "0 0 20px" }}>
            <Fact label={t("PARÇA")} value={num(stats.total)} />
            <Fact label={t("STOKTA")} value={num(stats.inStock)} />
            {stats.priceMid != null && (
              <Fact label={t("MEDYAN FİYAT")} value={formatPrice(stats.priceMid, stats.currency, loc)} />
            )}
            {stats.priceLow != null && stats.priceHigh != null && (
              <Fact
                label={t("ARALIK")}
                value={`${formatPrice(stats.priceLow, stats.currency, loc)} – ${formatPrice(stats.priceHigh, stats.currency, loc)}`}
              />
            )}
          </dl>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            {/* Mağazaya çıkış: kaydırma onayı + glitch + gecikme, sonra YENİ SEKME. */}
            {brand.url && <StoreGate brand={brand.name} brandSlug={brand.slug} url={brand.url} />}
            <a
              href={`/?marka=${brand.slug}`}
              onClick={intercept(onFilter && (() => onFilter()))}
              className="fbox"
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 13,
                letterSpacing: ".14em",
                padding: "13px 20px",
                border: "1px solid var(--line)",
                color: "var(--muted)",
                textDecoration: "none",
              }}
            >
              {t("VİTRİNDE FİLTRELE →")}
            </a>
          </div>
        </div>
      </section>

      {/* ---- markanın sunduğu avantajlar ----
           Cümleler markanın KENDİ duyurusundan alınır (bkz. src/lib/brand-perks.ts);
           özetlenmez. Bulunamayan markada bölüm hiç çizilmez. */}
      {perks.length > 0 && (
        <section style={{ marginBottom: 30 }}>
          <h2 style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: ".26em", color: "var(--faint)", margin: "0 0 12px" }}>
            {t("MAĞAZANIN SUNDUKLARI")}
          </h2>
          <ul
            className="brand-perks"
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 10, listStyle: "none", margin: 0, padding: 0 }}
          >
            {perks.map((p) => (
              <li key={p.tip} style={{ border: "1px solid var(--line)", borderLeft: "2px solid var(--grn)", padding: "11px 14px" }}>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: ".2em", color: "var(--grn)", marginBottom: 5 }}>
                  {t(PERK_LABEL[p.tip] ?? p.tip)}
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, lineHeight: 1.5, color: "var(--fg)" }}>
                  {p.metin}
                </div>
              </li>
            ))}
          </ul>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "var(--faint)", margin: "10px 0 0" }}>
            {t("markanın kendi sitesindeki duyurudan alındı; koşulları mağazada geçerli olan belirler.")}
          </p>
        </section>
      )}

      {/* ---- kategori kırılımı ---- */}
      {stats.categories.length > 1 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 26 }}>
          {stats.categories.slice(0, 14).map((c) => (
            <a
              key={c.cat}
              href={`/?kategori=${catSlug(c.cat)}&marka=${brand.slug}`}
              onClick={intercept(onFilter && (() => onFilter(c.cat)))}
              className="fbox"
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 12,
                letterSpacing: ".06em",
                padding: "6px 11px",
                border: "1px solid var(--line)",
                color: "var(--muted)",
                textDecoration: "none",
              }}
            >
              {t(c.cat)}
              <span style={{ marginLeft: 7, color: "var(--faint)" }}>{num(c.n)}</span>
            </a>
          ))}
        </div>
      )}

      <BrandProductGrid items={items} onOpen={onOpenProduct} />

      {/* ---- sayfalama: TÜM ÜRÜNLER ızgarasıyla (bkz. GridView) BİREBİR aynı görünüm —
           ok düğmeleri + alt çizgili aktif sayfa. Linkler yine gerçek <a>: arama
           motoru markanın sayfalarına buradan inebilsin (bkz. `intercept`). */}
      {pageCount > 1 && (
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            marginTop: 46,
            fontFamily: "'Space Mono', monospace",
            fontSize: 17,
            letterSpacing: ".1em",
          }}
        >
          {page > 1 ? (
            <a
              href={page - 1 === 1 ? `/${brand.slug}` : `/${brand.slug}?sayfa=${page - 1}`}
              onClick={intercept(onPage && (() => onPage(page - 1)))}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 36,
                minHeight: 36,
                color: "var(--muted)",
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              ‹
            </a>
          ) : (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 36,
                minHeight: 36,
                color: "var(--faint2)",
                fontSize: 14,
              }}
            >
              ‹
            </span>
          )}
          {pageList(page, pageCount).map((n, i) =>
            n === "…" ? (
              <span key={`gap${i}`} style={{ color: "var(--faint)", minWidth: 36, textAlign: "center" }}>
                …
              </span>
            ) : (
              <a
                key={n}
                href={n === 1 ? `/${brand.slug}` : `/${brand.slug}?sayfa=${n}`}
                onClick={intercept(onPage && (() => onPage(n)))}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 36,
                  minHeight: 36,
                  textAlign: "center",
                  // bkz. GridView aynı satır: tek karakterli span'lerde miras kalan
                  // letter-spacing altı çizgiyi rakamdan kaydırıyordu.
                  letterSpacing: 0,
                  color: n === page ? "var(--grn)" : "var(--muted)",
                  borderBottom: `2px solid ${n === page ? "var(--grn)" : "transparent"}`,
                  textDecoration: "none",
                }}
              >
                {n}
              </a>
            ),
          )}
          {page < pageCount ? (
            <a
              href={`/${brand.slug}?sayfa=${page + 1}`}
              onClick={intercept(onPage && (() => onPage(page + 1)))}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 36,
                minHeight: 36,
                color: "var(--muted)",
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              ›
            </a>
          ) : (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 36,
                minHeight: 36,
                color: "var(--faint2)",
                fontSize: 14,
              }}
            >
              ›
            </span>
          )}
        </nav>
      )}
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt style={{ fontFamily: "'Space Mono', monospace", fontSize: 10.5, letterSpacing: ".24em", color: "var(--faint)" }}>
        {label}
      </dt>
      <dd style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 17, color: "var(--fg)", margin: "5px 0 0" }}>
        {value}
      </dd>
    </div>
  );
}
