"use client";
import { useEffect, useMemo, useState } from "react";
import { CATS } from "@/lib/types";
import { PRICES, SORTS, GENDERS, DEFAULT_QUERY, cycleSort, styleLabel, toggleIn } from "@/lib/query";
import { NUM_BANDS, bandOf, sortSizes, sizeKind, isKnownSize } from "@/lib/sizes";
import { COLOR_TAGS, colorTagLabel } from "@/lib/color-tags";
import { STYLES } from "@/lib/brand-styles";
import { brandScore } from "@/lib/brand-scores";
import { searchFold } from "@/lib/slug";
import { useLang, useT } from "@/lib/lang";
import { useStore } from "@/store";
import type { BrandChip } from "./BrandChips";

/**
 * FİLTRE PANELİ.
 *
 * Üç yapısal karar:
 *
 * 1. ÜSTTE AKTİF FİLTRE ÖZETİ. Panel 400px ve sekiz bölüm uzunluğunda; kullanıcı
 *    seçtiğini görmek için aşağı kaydırmak zorunda kalıyordu. Özet satırı her seçimi
 *    tek tıkla kaldırılabilir bir çip olarak en üstte tutuyor.
 *
 * 2. BÖLÜMLER KATLANABİLİR. Hepsi açıkken panel dört ekran boyunda. Varsayılan açık
 *    olanlar vitrine girişin ana yolları (kategori, tarz, beden); marka/fiyat/sıralama/
 *    stok katlı başlıyor. Tercih cihazda saklanıyor.
 *
 * 3. NUMARALAR BANT. Katalogda 1–130 arası her sayı ayrı jeton olabiliyor ve tek tek
 *    çizilince NUMARA bölümü 30+ kutuya çıkıyordu. Bantlar (bkz. sizes.ts NUM_BANDS)
 *    bunu altıya indiriyor; tek numara isteyen "tek tek seç"i açıyor. Bant tıklanınca
 *    sorguya bandın KAPSADIĞI GERÇEK jetonlar yazılır — sorgu motoru bantları bilmez.
 */

function chipStyle(on: boolean) {
  return {
    border: `1px solid ${on ? "var(--grn)" : "var(--line)"}`,
    background: on ? "var(--grn)" : "transparent",
    color: on ? "var(--on-accent)" : "var(--muted)",
  } as const;
}

/** Bandın bir kısmı seçili: ne "açık" ne "kapalı" — kesikli çerçeveyle ayrı gösterilir. */
function partialStyle() {
  return {
    border: "1px dashed var(--grn)",
    background: "transparent",
    color: "var(--grn)",
  } as const;
}

const MONO = "'IBM Plex Mono', monospace";
const SPACE = "'Space Mono', monospace";

const HEAD = {
  fontFamily: SPACE,
  fontSize: 12,
  letterSpacing: ".26em",
  color: "var(--faint)",
} as const;

const NOTE = {
  fontFamily: MONO,
  fontSize: 11,
  letterSpacing: ".08em",
  color: "var(--faint)",
  marginTop: 8,
} as const;

const CHIP = {
  fontFamily: MONO,
  fontSize: 13,
  letterSpacing: ".06em",
  padding: "8px 12px",
} as const;

const OPEN_KEY = "altr-fp-open";

/** Varsayılan açıklık — vitrine girişin ana yolları açık, gerisi katlı. */
const DEFAULT_OPEN: Record<string, boolean> = {
  kategori: true,
  tarz: true,
  kim: true,
  renk: true,
  beden: true,
  marka: false,
  fiyat: false,
  sira: false,
  stok: false,
};

interface SizeBand {
  k: string;
  label: string;
  tokens: string[];
  n: number;
}

/** Sayısal/bel-boy jetonlarını bantlara toplar. Boş bant hiç çizilmez. */
function toBands(tokens: string[], counts: Record<string, number>): SizeBand[] {
  const out: SizeBand[] = [];
  for (const b of NUM_BANDS) {
    const inBand = tokens.filter((t) => bandOf(t) === b.k);
    if (!inBand.length) continue;
    out.push({
      k: b.k,
      label: b.label,
      tokens: inBand,
      // Aynı ürün bandın iki numarasını birden üretebiliyor; bu yüzden bu sayı
      // "ürün adedi" değil "kaç kayıt bu banda düşüyor" — yaklaşık bir yoğunluk işareti.
      n: inBand.reduce((s, t) => s + (counts[t] ?? 0), 0),
    });
  }
  return out;
}

function groupSizes(counts: Record<string, number>) {
  const all = sortSizes(Object.keys(counts).filter(isKnownSize));
  const pick = (kind: string) => all.filter((s) => sizeKind(s) === kind);
  return {
    alpha: pick("alpha"),
    // "age" bilerek YOK: yaş bedenleri kataloga hiç girmiyor (çocuk ürünleri arşive
    // ayrılıyor, artakalan yaş jetonları import'ta siliniyor — bkz. src/lib/kids.ts).
    num: toBands(pick("num"), counts),
    numTokens: pick("num"),
    // Bel/boy (W30/L32) jetonları eskiden filtrede HİÇ çizilmiyordu: gruplama yalnız
    // alpha/num/one çekiyordu, jean bedenleri sessizce düşüyordu.
    wl: toBands(pick("wl"), counts),
    wlTokens: pick("wl"),
    one: pick("one"),
  };
}

export function FilterPanel({
  brands,
  sizeCounts,
  styleCounts,
  colorCounts,
}: {
  brands: BrandChip[];
  sizeCounts: Record<string, number>;
  styleCounts: Record<string, number>;
  /** Renk ailesi -> ürün adedi (sunucuda katalogdan sayılır). */
  colorCounts?: Record<string, number>;
}) {
  const open = useStore((s) => s.filterOpen);
  const closeFilter = useStore((s) => s.closeFilter);
  const resetAll = useStore((s) => s.resetAll);
  const setQuery = useStore((s) => s.setQuery);
  const toggleBrand = useStore((s) => s.toggleBrand);
  const toggleGender = useStore((s) => s.toggleGender);
  const toggleStyle = useStore((s) => s.toggleStyle);
  const setView = useStore((s) => s.setView);
  const q = useStore((s) => s.query);
  const matched = useStore((s) => s.result?.matched ?? 0);
  const { t, n: num } = useLang();

  const [brandQ, setBrandQ] = useState("");
  const [showNums, setShowNums] = useState(false);
  const [sections, setSections] = useState<Record<string, boolean>>(DEFAULT_OPEN);

  // Açık/kapalı tercihi cihazda. İlk boyamada okunmuyor (SSR'de localStorage yok);
  // panel zaten yalnız kullanıcı açınca çiziliyor, göz kırpma olmuyor.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(OPEN_KEY);
      if (raw) setSections({ ...DEFAULT_OPEN, ...(JSON.parse(raw) as Record<string, boolean>) });
    } catch {
      /* yoksay */
    }
  }, []);

  const toggleSection = (k: string) => {
    setSections((prev) => {
      const next = { ...prev, [k]: !prev[k] };
      try {
        localStorage.setItem(OPEN_KEY, JSON.stringify(next));
      } catch {
        /* kota */
      }
      return next;
    });
  };

  const sizeGroups = useMemo(() => groupSizes(sizeCounts), [sizeCounts]);

  /**
   * Marka listesi PUANA göre sıralı (bkz. lib/brand-scores.ts), eşit puanda alfabetik.
   * Vitrindeki ARŞİVDEKİ MARKALAR şeridiyle AYNI sıra — iki yerde farklı sıra görmek
   * "hangisi doğru" sorusunu doğuruyordu.
   *
   * Seçili markalar bu sıralamanın ÜSTÜNE çıkar: arama kutusuna yazınca ya da liste
   * kaydırılınca seçim gözden kaybolmasın.
   */
  const shownBrands = useMemo(() => {
    // searchFold: "istanbul" yazınca "Oath Istanbul", "kostebek" yazınca "Köstebek"
    // bulunsun. Türkçe küçültme tek başına noktalı i / noktasız ı'yı ayırıp eşleşmeyi
    // öldürüyordu (bkz. lib/slug.ts).
    const needle = searchFold(brandQ.trim());
    const list = needle ? brands.filter((b) => searchFold(b.name).includes(needle)) : brands;
    return [...list].sort(
      (a, b) =>
        Number(q.brands.includes(b.name)) - Number(q.brands.includes(a.name)) ||
        brandScore(b.slug) - brandScore(a.slug) ||
        a.name.localeCompare(b.name, "tr"),
    );
  }, [brands, brandQ, q.brands]);

  if (!open) return null;

  /* --------------------------------------------------------- beden yardımı -- */

  const sizeOn = (t: string) => q.sizes.includes(t);
  const toggleSize = (t: string) => setQuery({ sizes: toggleIn(q.sizes, t) });

  /** Bandın durumu: hepsi seçili / bir kısmı / hiçbiri. */
  const bandState = (b: SizeBand): "full" | "partial" | "off" => {
    const on = b.tokens.filter(sizeOn).length;
    return on === 0 ? "off" : on === b.tokens.length ? "full" : "partial";
  };

  const toggleBand = (b: SizeBand) => {
    const state = bandState(b);
    // Yarı seçiliyse TAMAMLA (kaldırma değil): kullanıcı bandı tıklıyorsa "bu aralığı
    // istiyorum" diyor, elindeki kısmi seçimi silmek istemiyor.
    const next =
      state === "full"
        ? q.sizes.filter((s) => !b.tokens.includes(s))
        : [...new Set([...q.sizes, ...b.tokens])];
    setQuery({ sizes: next });
  };

  /* ----------------------------------------------------- aktif filtre özeti -- */

  const active: Array<{ key: string; label: string; clear: () => void }> = [];
  if (q.cat !== DEFAULT_QUERY.cat) {
    active.push({ key: "cat", label: t(q.cat), clear: () => setQuery({ cat: DEFAULT_QUERY.cat }) });
  }
  if (q.q) active.push({ key: "q", label: `“${q.q}”`, clear: () => setQuery({ q: "" }) });
  for (const s of q.styles) {
    active.push({ key: `t-${s}`, label: t(styleLabel(s)), clear: () => toggleStyle(s) });
  }
  for (const g of q.genders) {
    const label = GENDERS.find((x) => x.k === g)?.label ?? g;
    active.push({ key: `g-${g}`, label: t(label), clear: () => toggleGender(g) });
  }
  // Marka adı ÇEVRİLMEZ: özel isim.
  for (const b of q.brands) active.push({ key: `b-${b}`, label: b, clear: () => toggleBrand(b) });
  for (const c of q.colors) {
    active.push({
      key: `c-${c}`,
      label: t(colorTagLabel(c)),
      clear: () => setQuery({ colors: q.colors.filter((x) => x !== c) }),
    });
  }
  if (q.price !== "ALL") {
    const label = PRICES.find((p) => p.k === q.price)?.label ?? q.price;
    active.push({ key: "price", label: `₺ ${t(label)}`, clear: () => setQuery({ price: "ALL" }) });
  }
  // Bedenler tek tek DEĞİL toplu bir çip: 32–36 bandı seçildiğinde özet satırı üç
  // ayrı çiple dolmasın.
  if (q.sizes.length) {
    active.push({
      key: "size",
      label: q.sizes.length <= 3 ? q.sizes.join(" · ") : t(`${q.sizes.length} BEDEN`),
      clear: () => setQuery({ sizes: [] }),
    });
  }
  if (q.sort !== DEFAULT_QUERY.sort) {
    const s = SORTS.find((x) => x.k === q.sort);
    active.push({
      key: "sort",
      label: s ? `${t(s.label)} ${q.dir === "asc" ? "↑" : "↓"}` : q.sort,
      clear: () => setQuery({ sort: "kesfet", dir: "asc" }),
    });
  }
  if (!q.inStockOnly) {
    active.push({
      key: "stok",
      label: t("TÜKENMİŞLER DE"),
      clear: () => setQuery({ inStockOnly: true }),
    });
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={closeFilter} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.72)" }} />
      {/* ANİMASYONSUZ AÇILIR (2026-08-01, kullanıcı kararı). Eskiden `panel-anim`
          vardı: clip-path'i basamaklı kırpan sert bir açılış (bkz. globals.css
          `panelcut`). Ürün modalında da aynı sebeple kaldırılmıştı — panel uzun,
          kaydırılabilir ve kenarlıklı bir kutu; kırpma açılış boyunca kenarı ve
          içeriği titretiyor, filtreye her dokunuşta göze vuran bir tik oluyordu.
          Efektin kendisi duruyor: paylaşılan liste modalı (PublicListModal) hâlâ
          onu kullanıyor. */}
      <div
        className="filter-panel"
        style={{
          position: "relative",
          width: 400,
          maxWidth: "92vw",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg2)",
          borderLeft: "2px solid var(--fg-bright)",
        }}
      >
        <div className="fp-head-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "26px 28px 0" }}>
          <span className="fp-title" style={{ fontFamily: "'Anton', sans-serif", fontSize: 35, letterSpacing: ".02em", color: "var(--fg-bright)", textTransform: "uppercase" }}>
            {t("Filtre")}
          </span>
          <span className="nav-item" onClick={closeFilter} style={{ fontFamily: SPACE, fontSize: 15, letterSpacing: ".14em", color: "var(--muted)" }}>
            {t("KAPAT ✕")}
          </span>
        </div>

        {/* aktif filtre özeti — panelin en üstünde, kaydırmadan görünür */}
        {active.length > 0 && (
          <div style={{ padding: "16px 28px 0" }}>
            <div style={{ ...HEAD, marginBottom: 9 }}>{t("SEÇİLİ")}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {active.map((a) => (
                <span
                  key={a.key}
                  className="fbox"
                  onClick={a.clear}
                  title={t("kaldır")}
                  style={{
                    fontFamily: MONO,
                    fontSize: 12,
                    letterSpacing: ".04em",
                    padding: "6px 9px",
                    border: "1px solid var(--grn)",
                    color: "var(--grn)",
                    maxWidth: 300,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {a.label} ✕
                </span>
              ))}
            </div>
          </div>
        )}

        {/* kaydırılan gövde: alt eylem şeridi sabit kalsın diye ayrı katman */}
        <div style={{ flex: 1, overflowY: "auto", padding: "22px 28px 26px" }}>
          <Section
            k="kategori"
            title="KATEGORİ"
            open={sections.kategori}
            onToggle={toggleSection}
            badge={q.cat !== DEFAULT_QUERY.cat ? 1 : 0}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {CATS.map((c) => (
                <span
                  key={c}
                  className="fbox"
                  onClick={() => {
                    setView("grid");
                    setQuery({ cat: q.cat === c ? DEFAULT_QUERY.cat : c });
                  }}
                  style={{ ...CHIP, textTransform: "uppercase", ...chipStyle(q.cat === c) }}
                >
                  {t(c)}
                </span>
              ))}
            </div>
          </Section>

          {/* tarz — çoklu; ÜRÜNÜN kendi alanı (bkz. lib/product-styles.ts).
              Kategoriden hemen sonra duruyor: ikisi vitrine girişin iki ana yolu. */}
          <Section k="tarz" title="TARZ" open={sections.tarz} onToggle={toggleSection} badge={q.styles.length}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {STYLES.map((s) => {
                const on = q.styles.includes(s.k);
                return (
                  <span
                    key={s.k}
                    className="fbox"
                    title={t(s.note)}
                    onClick={() => {
                      setView("grid");
                      toggleStyle(s.k);
                    }}
                    style={{ ...CHIP, ...chipStyle(on) }}
                  >
                    {on ? "✓ " : ""}
                    {t(s.label)}
                    <span style={{ marginLeft: 7, opacity: 0.65, fontSize: 11 }}>{styleCounts[s.k]}</span>
                  </span>
                );
              })}
            </div>
            <div style={NOTE}>{t("tarz ürüne yazılıdır · yanındaki sayı o tarzdaki ürün adedi")}</div>
          </Section>

          {/* kim için — çoklu: kadın ve erkek aynı anda seçilebilir */}
          <Section k="kim" title="KİM İÇİN" open={sections.kim} onToggle={toggleSection} badge={q.genders.length}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {GENDERS.map((g) => {
                const on = q.genders.includes(g.k);
                return (
                  <span key={g.k} className="fbox" onClick={() => toggleGender(g.k)} style={{ ...CHIP, ...chipStyle(on) }}>
                    {on ? "✓ " : ""}
                    {t(g.label)}
                  </span>
                );
              })}
              <span
                className="fbox"
                onClick={() => setQuery({ genders: [] })}
                style={{ ...CHIP, ...chipStyle(q.genders.length === 0) }}
              >
                {t("KARIŞIK")}
              </span>
            </div>
            <div style={NOTE}>{t("ikisi birlikte seçilebilir · unisex ürünler her seçimde görünür")}</div>
          </Section>

          {/* renk — etiket ÜRÜNE yazılı (bkz. lib/color-tags.ts + npm run tag-colors).
              Diğer çoklu filtrelerin aksine "VE" ile birleşir. */}
          <Section k="renk" title="RENK" open={sections.renk} onToggle={toggleSection} badge={q.colors.length}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {COLOR_TAGS.map((c) => {
                const on = q.colors.includes(c.k);
                const n = colorCounts?.[c.k] ?? 0;
                return (
                  <span
                    key={c.k}
                    className="fbox"
                    onClick={() => setQuery({ colors: toggleIn(q.colors, c.k) })}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 7,
                      fontFamily: MONO,
                      fontSize: 12.5,
                      letterSpacing: ".04em",
                      padding: "6px 10px 6px 7px",
                      ...chipStyle(on),
                    }}
                  >
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: c.swatch,
                        // Siyah ve beyaz nokta kendi zemininde kayboluyor: her zaman çizgi.
                        border: "1px solid rgba(128,128,128,.75)",
                        boxShadow: "inset 0 0 0 1px rgba(0,0,0,.22)",
                        flex: "none",
                      }}
                    />
                    {t(colorTagLabel(c.k))}
                    {n > 0 && <span style={{ opacity: 0.6, fontSize: 10.5 }}>{n}</span>}
                  </span>
                );
              })}
            </div>
            <div style={NOTE}>{t("birden fazla seçersen İKİSİNİ BİRDEN içeren ürünler gelir")}</div>
          </Section>

          {/* beden — kutular katalogda GERÇEKTEN geçen bedenlerden türer (bkz. page.tsx
              sizeCounts). Numaralar banda toplanır, harfliler tek tek durur. */}
          <Section k="beden" title="BEDEN" open={sections.beden} onToggle={toggleSection} badge={q.sizes.length}>
            {sizeGroups.alpha.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 14 }}>
                {sizeGroups.alpha.map((s) => (
                  <span
                    key={s}
                    className="fbox"
                    onClick={() => toggleSize(s)}
                    style={{ minWidth: 46, textAlign: "center", whiteSpace: "nowrap", ...CHIP, ...chipStyle(sizeOn(s)) }}
                  >
                    {s}
                    <span style={{ marginLeft: 6, opacity: 0.6, fontSize: 10.5 }}>{sizeCounts[s]}</span>
                  </span>
                ))}
              </div>
            )}

            {sizeGroups.num.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <SubHead>{t("NUMARA")}</SubHead>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {sizeGroups.num.map((b) => {
                    const st = bandState(b);
                    return (
                      <span
                        key={b.k}
                        className="fbox"
                        title={`${b.tokens.join(", ")}`}
                        onClick={() => toggleBand(b)}
                        style={{
                          minWidth: 62,
                          textAlign: "center",
                          whiteSpace: "nowrap",
                          ...CHIP,
                          ...(st === "partial" ? partialStyle() : chipStyle(st === "full")),
                        }}
                      >
                        {b.label}
                        <span style={{ marginLeft: 6, opacity: 0.6, fontSize: 10.5 }}>{b.n}</span>
                      </span>
                    );
                  })}
                </div>
                <span
                  className="nav-item"
                  onClick={() => setShowNums(!showNums)}
                  style={{ display: "inline-block", fontFamily: MONO, fontSize: 11.5, letterSpacing: ".06em", color: "var(--muted3)", marginTop: 9 }}
                >
                  {showNums ? t("▾ tek tek gizle") : t("▸ tek tek seç")}
                </span>
                {showNums && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {sizeGroups.numTokens.map((s) => (
                      <span
                        key={s}
                        className="fbox"
                        title={`${sizeCounts[s]} ${t("kayıt")}`}
                        onClick={() => toggleSize(s)}
                        style={{ minWidth: 38, textAlign: "center", fontFamily: MONO, fontSize: 12, padding: "6px 8px", ...chipStyle(sizeOn(s)) }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {sizeGroups.wl.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <SubHead>{t("JEAN (BEL)")}</SubHead>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {sizeGroups.wl.map((b) => {
                    const st = bandState(b);
                    return (
                      <span
                        key={b.k}
                        className="fbox"
                        title={b.tokens.join(", ")}
                        onClick={() => toggleBand(b)}
                        style={{
                          minWidth: 62,
                          textAlign: "center",
                          whiteSpace: "nowrap",
                          ...CHIP,
                          ...(st === "partial" ? partialStyle() : chipStyle(st === "full")),
                        }}
                      >
                        {b.label}
                        <span style={{ marginLeft: 6, opacity: 0.6, fontSize: 10.5 }}>{b.n}</span>
                      </span>
                    );
                  })}
                </div>
                <div style={NOTE}>{t("bel ölçüsüne göre · boy (L) seçimini markanın sayfasında yaparsın")}</div>
              </div>
            )}

            {sizeGroups.one.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {sizeGroups.one.map((s) => (
                  <span key={s} className="fbox" onClick={() => toggleSize(s)} style={{ ...CHIP, ...chipStyle(sizeOn(s)) }}>
                    {s}
                    <span style={{ marginLeft: 6, opacity: 0.6, fontSize: 10.5 }}>{sizeCounts[s]}</span>
                  </span>
                ))}
              </div>
            )}

            <div style={NOTE}>{t("birden fazla seçersen herhangi birini üreten ürünler gelir")}</div>
          </Section>

          {/* marka — çoklu seçim; aranabilir liste (150+ marka çipe sığmıyor) */}
          <Section k="marka" title="MARKA" open={sections.marka} onToggle={toggleSection} badge={q.brands.length}>
            <input
              value={brandQ}
              onChange={(e) => setBrandQ(e.target.value)}
              placeholder={t("marka ara…")}
              style={{
                width: "100%",
                boxSizing: "border-box",
                marginBottom: 9,
                padding: "9px 11px",
                background: "var(--bg3)",
                border: "1px solid var(--line)",
                color: "var(--fg)",
                fontFamily: MONO,
                fontSize: 13,
                outline: "none",
              }}
            />
            <div className="fp-brandlist" style={{ maxHeight: 190, overflowY: "auto", display: "flex", flexWrap: "wrap", gap: 7 }}>
              {shownBrands.map((b) => {
                const on = q.brands.includes(b.name);
                return (
                  <span
                    key={b.slug}
                    className="fbox"
                    onClick={() => toggleBrand(b.name)}
                    style={{ fontFamily: MONO, fontSize: 12, letterSpacing: ".04em", padding: "7px 10px", ...chipStyle(on) }}
                  >
                    {on ? "✓ " : ""}
                    {b.name}
                  </span>
                );
              })}
              {shownBrands.length === 0 && (
                <span style={{ fontFamily: MONO, fontSize: 12, color: "var(--faint)" }}>{t("eşleşen marka yok")}</span>
              )}
            </div>
          </Section>

          <Section k="fiyat" title="FİYAT ARALIĞI" open={sections.fiyat} onToggle={toggleSection} badge={q.price !== "ALL" ? 1 : 0}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {PRICES.map((p) => (
                <span key={p.k} className="fbox" onClick={() => setQuery({ price: p.k })} style={{ ...CHIP, ...chipStyle(q.price === p.k) }}>
                  {t(p.label)}
                </span>
              ))}
            </div>
          </Section>

          {/* sıralama — ızgara başlığındaki üç durumlu düğmelerin aynısı (tek mantık:
              query.ts/cycleSort). Basılı düğme yokken sıralama KEŞFET'tir. */}
          <Section k="sira" title="SIRALAMA" open={sections.sira} onToggle={toggleSection} badge={q.sort !== DEFAULT_QUERY.sort ? 1 : 0}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              <span
                className="fbox"
                onClick={() => setQuery({ sort: "kesfet", dir: "asc" })}
                style={{ ...CHIP, ...chipStyle(q.sort === "kesfet") }}
              >
                {t("KEŞFET")}
              </span>
              {SORTS.map((s) => {
                const on = q.sort === s.k;
                return (
                  <span
                    key={s.k}
                    className="fbox"
                    onClick={() => setQuery(cycleSort({ sort: q.sort, dir: q.dir }, s.k))}
                    style={{ ...CHIP, ...chipStyle(on) }}
                  >
                    {t(s.label)} {on ? (q.dir === "asc" ? `↑ ${t(s.asc)}` : `↓ ${t(s.desc)}`) : "↕"}
                  </span>
                );
              })}
            </div>
          </Section>

          {/* stok — varsayılan yalnız stoktakiler; kapatınca tükenmişler de listelenir */}
          <Section k="stok" title="STOK" open={sections.stok} onToggle={toggleSection} badge={q.inStockOnly ? 0 : 1}>
            <span
              className="fbox"
              onClick={() => setQuery({ inStockOnly: !q.inStockOnly })}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontFamily: MONO,
                fontSize: 14,
                letterSpacing: ".08em",
                padding: "12px 14px",
                textTransform: "uppercase",
                ...chipStyle(q.inStockOnly),
              }}
            >
              <span>{t("Yalnız stoktakiler")}</span>
              <span>{q.inStockOnly ? "[✓]" : "[ ]"}</span>
            </span>
          </Section>

          {/* boş sonuç: kullanıcıyı çıkmazda bırakma, en son eklenen filtreyi göster */}
          {matched === 0 && active.length > 0 && (
            <div style={{ border: "1px solid var(--fg-bright)", padding: "12px 14px", marginTop: 18 }}>
              <div style={{ fontFamily: MONO, fontSize: 12.5, lineHeight: 1.7, color: "var(--fg)" }}>
                {t("bu filtrelerle hiç ürün yok.")}
              </div>
              <span
                className="nav-item"
                onClick={active[active.length - 1].clear}
                style={{ display: "inline-block", fontFamily: SPACE, fontSize: 11.5, letterSpacing: ".14em", color: "var(--grn)", marginTop: 8 }}
              >
                “{active[active.length - 1].label}” {t("FİLTRESİNİ KALDIR")}
              </span>
            </div>
          )}
        </div>

        {/* eylem şeridi: panel uzun, buton her zaman elin altında olsun */}
        <div
          className="fp-actions"
          style={{
            display: "flex",
            gap: 10,
            padding: "14px 28px 18px",
            borderTop: "1px solid var(--line)",
            background: "var(--bg2)",
          }}
        >
          <span
            className="nav-item"
            onClick={resetAll}
            style={{ flex: 1, textAlign: "center", fontFamily: SPACE, fontSize: 14, letterSpacing: ".14em", color: "var(--muted)", border: "1px solid var(--line)", padding: "13px 0" }}
          >
            {t("↺ SIFIRLA")}
          </span>
          <span
            className="nav-item"
            onClick={closeFilter}
            style={{ flex: 2, textAlign: "center", fontFamily: SPACE, fontWeight: 700, fontSize: 14, letterSpacing: ".14em", color: "var(--on-accent)", background: "var(--grn)", padding: "13px 0" }}
          >
            {/* Sayı cümlenin İÇİNDE: Türkçede sonda ("40.413 ÜRÜNÜ GÖSTER"), İngilizcede
                başta ("SHOW 40,413 PRODUCTS"). Parçaları ayrı ayrı çevirmek yanlış sıra
                üretiyordu; bu yüzden kalıbın tamamı tek anahtar ve sayı `{n}` ile
                yerine konuyor. */}
            {t("{n} ÜRÜNÜ GÖSTER").replace("{n}", num(matched))}
          </span>
        </div>
      </div>
    </div>
  );
}

function SubHead({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".12em", color: "var(--faint)", marginBottom: 6 }}>
      {children}
    </div>
  );
}

function Section({
  k,
  title,
  open,
  onToggle,
  badge,
  children,
}: {
  k: string;
  title: string;
  open: boolean;
  onToggle: (k: string) => void;
  /** Bu bölümde kaç seçim var — katlıyken bile görünsün. */
  badge: number;
  children: React.ReactNode;
}) {
  const t = useT();
  return (
    <div className="fp-section" style={{ marginBottom: open ? 24 : 4, borderBottom: "1px solid var(--line4)", paddingBottom: open ? 20 : 10 }}>
      <div
        className="nav-item fp-head"
        onClick={() => onToggle(k)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 0", marginBottom: open ? 12 : 0 }}
      >
        <span style={HEAD}>
          {t(title)}
          {badge > 0 && (
            <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".08em", color: "var(--grn)", marginLeft: 10 }}>
              {t(`${badge} SEÇİLİ`)}
            </span>
          )}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 12, color: "var(--muted3)" }}>{open ? "▾" : "▸"}</span>
      </div>
      {open && children}
    </div>
  );
}
