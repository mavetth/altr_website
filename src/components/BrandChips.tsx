"use client";
import { useMemo } from "react";
import { useStore } from "@/store";
import { brandScore } from "@/lib/brand-scores";
import { useT } from "@/lib/lang";
import { BrandLogo } from "./BrandLogo";
import { PlusMinus } from "./icons";

export interface BrandChip {
  name: string;
  slug: string;
  live: boolean;
  url?: string | null;
}

const LIMIT = 16;

export function BrandChips({ brands }: { brands: BrandChip[] }) {
  const selected = useStore((s) => s.query.brands);
  const toggleBrand = useStore((s) => s.toggleBrand);
  const setQuery = useStore((s) => s.setQuery);
  const showAll = useStore((s) => s.showAllBrands);
  const toggleBrands = useStore((s) => s.toggleBrands);
  const sectionOpen = useStore((s) => s.brandsSectionOpen);
  const toggleSection = useStore((s) => s.toggleBrandsSection);
  const t = useT();

  /**
   * Şeritteki marka SIRASI = EDİTORYAL MARKA PUANI (bkz. lib/brand-scores.ts), yüksekten
   * düşüğe. Eşit puanlılar kendi aralarında alfabetik — yoksa sıra `brand-names.json`
   * dosyasının rastgele sırasına düşüyor ve aynı puanlı markalar arasında hiçbir mantık
   * görünmüyor.
   *
   * ÖNCEKİ HÂL tohuma bağlı bir karışımdı (`brandRank` × 0.55 + rastgele × 0.45): amaç
   * her tazelemede farklı markalara göz değdirmekti. Değiştirildi çünkü kullanıcı
   * şeridin OKUNABİLİR olmasını istiyor — kapalı hâlde ilk 16 çip artık vitrinin en iyi
   * puanlı 16 markası, yani şerit bir rotasyon değil bir SIRALAMA. Ürün akışının kendi
   * karıştırması (discovery.ts) buna dokunmuyor; orası hâlâ tohumlu.
   */
  const ranked = useMemo(
    () =>
      [...brands].sort(
        (a, b) => brandScore(b.slug) - brandScore(a.slug) || a.name.localeCompare(b.name, "tr"),
      ),
    [brands],
  );

  // Seçili markalar listenin başına alınır: "+90 DAHA" kapalıyken seçtiğin marka
  // gözden kaybolmasın, kaç tane seçili olduğu tek bakışta görünsün.
  const chosen = new Set(selected);
  const ordered = [...ranked].sort(
    (a, b) => Number(chosen.has(b.name)) - Number(chosen.has(a.name)),
  );
  const shown = showAll ? ordered : ordered.slice(0, Math.max(LIMIT, chosen.size));

  return (
    // `chip-sec`: katlanabilir çip bölümünün ORTAK kalıbı — TARZ şeridi de aynısını
    // kullanıyor (bkz. StyleRow). Başlık/ızgara/artı-eksi ölçüleri globals.css'te tek
    // yerde duruyor ki iki şerit birbirinden ayrışmasın.
    <div
      className={`chip-sec brand-chips${sectionOpen ? " is-open" : ""}`}
      style={{ marginBottom: 28, paddingBottom: 22, borderBottom: "1px solid var(--line4)" }}
    >
      {/* mobilde dokununca açılır/kapanır (bkz. globals.css); masaüstünde her zaman açık */}
      <div className="chip-sec-head nav-item" onClick={toggleSection}>
        <span>
          {t("ARŞİVDEKİ MARKALAR")} — <span style={{ color: "var(--grn)" }}>{brands.length}</span>
        </span>
        {selected.length > 0 && (
          <span
            className="nav-item"
            onClick={(e) => {
              e.stopPropagation();
              setQuery({ brands: [] });
            }}
            title={t("Marka seçimini temizle")}
            // `white-space: nowrap`: dar sarmalayıcıda metinle ✕ arasındaki boşluktan
            // kırılıp ✕ yalnız başına alt satıra düşüyordu — bkz. kullanıcı ekran görüntüsü.
            style={{ color: "var(--grn)", letterSpacing: ".14em", whiteSpace: "nowrap" }}
          >
            {t(`${selected.length} SEÇİLİ`)} ✕
          </span>
        )}
        <span className="chip-sec-toggle">
          <PlusMinus open={sectionOpen} />
        </span>
      </div>
      <div
        className={`chip-sec-grid${sectionOpen ? " is-open" : ""}`}
        style={{ display: "flex", flexWrap: "wrap", gap: 9 }}
      >
        {shown.map((b) => {
          const active = chosen.has(b.name);
          return (
            <span
              key={b.slug}
              className={`logo-chip${active ? " is-on" : ""}`}
              onClick={() => toggleBrand(b.name)}
              title={b.name}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 13px",
                border: `1px solid ${active ? "var(--grn)" : "var(--line)"}`,
                background: active ? "var(--grn)" : "transparent",
                color: active ? "var(--on-accent)" : "var(--muted)",
              }}
            >
              {b.live && (
                <span
                  className="live"
                  title={t("canlı")}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: active ? "var(--on-accent)" : "var(--grn)",
                    flex: "none",
                  }}
                />
              )}
              <BrandLogo
                slug={b.slug}
                name={b.name}
                h={17}
                /* Wordmark'lar için geniş tavan. Ad artık "logo inceldi" diye YENİDEN
                   YAZILMIYOR (bkz. BrandLogo), yani okunaklılığın tek güvencesi bu
                   tavan: en geniş logo (point-2124, oran 13.6) 17px yükseklikte 232px
                   ister. Çip birkaç piksel uzasın, harfler okunsun. */
                maxW={240}
                /* Çipler tek sıra yüksekliğinde durmalı: marka çarpanı (bkz.
                   brand-logo-kind.json `olcek`) iri bir amblemi 38px'e çıkarıp şeridi
                   tırtıklı hâle getiriyordu. */
                maxH={27}
                fallback={
                  <span
                    style={{
                      fontFamily: "'Space Mono', monospace",
                      fontSize: 13,
                      letterSpacing: ".12em",
                      textTransform: "uppercase",
                    }}
                  >
                    {b.name}
                  </span>
                }
              />
            </span>
          );
        })}
        {brands.length > LIMIT && (
          <span
            className="logo-chip"
            onClick={toggleBrands}
            style={{
              display: "inline-flex",
              alignItems: "center",
              fontFamily: "'Space Mono', monospace",
              fontSize: 13,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              padding: "7px 13px",
              border: "1px solid var(--grn)",
              color: "var(--grn)",
            }}
          >
            {showAll ? t("− DAHA AZ") : `+${brands.length - shown.length} ${t("DAHA")}`}
          </span>
        )}
      </div>
    </div>
  );
}
