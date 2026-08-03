"use client";
import { LAYOUTS, useStore, type Layout } from "@/store";
import { SORTS, cycleSort } from "@/lib/query";
import { pageList } from "@/lib/pagination";
import { useLang } from "@/lib/lang";
import { ProductCard } from "./ProductCard";
import { BrandChips, type BrandChip } from "./BrandChips";
import { StyleRow } from "./StyleRow";
import { PlusMinus } from "./icons";

/**
 * Gösterim biçiminin ızgara ölçüleri. Kart içeriğinin ölçüleri ProductCard'ta
 * (SPEC tablosu); burada yalnız sütun sayısı ve boşluk var.
 * Dar ekran karşılıkları globals.css'te `.grid-inner[data-layout=…]` ile.
 */
const GRID: Record<Layout, { cols: string; gap: string }> = {
  sik: { cols: "repeat(6,minmax(0,1fr))", gap: "22px 14px" },
  izgara: { cols: "repeat(4,minmax(0,1fr))", gap: "28px 20px" },
  buyuk: { cols: "repeat(2,minmax(0,1fr))", gap: "46px 34px" },
  // Liste İKİ SÜTUN: satır kartı yalnız 220px görsel + yanında ortalanmış bir bilgi
  // bloğu tutuyor, tek sütunda ekranın sağ yarısı tamamen boş kalıyordu.
  liste: { cols: "repeat(2,minmax(0,1fr))", gap: "18px 22px" },
};

/**
 * Keşfeti yenile imleci — açık uçlu bir dönme oku (restart).
 *
 * Metin ("↻ YENİLE") yerine ikon: düğme sıralama seçeneklerinin arasında duruyor ve
 * metin hâli bir SIRALAMA SEÇENEĞİ gibi okunuyordu; oysa yaptığı iş seçili sıralamayı
 * tazelemek. Glif değil SVG çünkü "↻" karakteri fontlar arasında farklı ağırlıkta
 * çiziliyor ve taban çizgisine oturmuyordu.
 */
function RestartIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={{ display: "block" }}>
      {/* Açık uçlu daire: üstte ~60°'lik boşluk, ucunda ok başı */}
      <path
        d="M20 12a8 8 0 1 1-2.34-5.66"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path d="M20 4v4.5h-4.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GridView({ brands }: { brands: BrandChip[] }) {
  const result = useStore((s) => s.result);
  const sort = useStore((s) => s.query.sort);
  const dir = useStore((s) => s.query.dir);
  const setQuery = useStore((s) => s.setQuery);
  const setPage = useStore((s) => s.setPage);
  const resetAll = useStore((s) => s.resetAll);
  const reshuffleFeed = useStore((s) => s.reshuffleFeed);
  const loading = useStore((s) => s.loading);
  const layout = useStore((s) => s.layout);
  const setLayout = useStore((s) => s.setLayout);
  const sectionOpen = useStore((s) => s.sortSectionOpen);
  const toggleSection = useStore((s) => s.toggleSortSection);
  const { t, n } = useLang();

  const query = useStore((s) => s.query);

  const items = result?.items ?? [];
  const pageCount = result?.pageCount ?? 1;
  const page = result?.page ?? 1;
  // Kapalı başlıkta görünen özet: bölümün ardında ne olduğu değil, ŞU AN NE OLDUĞU.
  // Sıralama seçildi: kullanıcının kapalı şeritte merak ettiği tek şey o (görünüm
  // zaten ızgaranın kendisinden okunuyor, stok filtresi de üstteki FİLTRE sayacından).
  const sortLabel =
    sort === "kesfet"
      ? t("KEŞFET")
      : `${t(SORTS.find((s) => s.k === sort)?.label ?? "")} ${dir === "asc" ? "↑" : "↓"}`;
  // Boş sonuç ekranı için: aramanın dışında başka bir daraltma var mı.
  const activeCount =
    query.brands.length +
    query.genders.length +
    query.styles.length +
    query.sizes.length +
    query.colors.length +
    (query.price !== "ALL" ? 1 : 0);

  return (
    <>
      <BrandChips brands={brands} />
      <StyleRow />

      {/* header: sayaç + sıralama */}
      <div
        className="grid-head"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 26,
          fontFamily: "'Space Mono', monospace",
          fontSize: 13,
          letterSpacing: ".16em",
        }}
      >
        {/* KÜNYE SATIRI: sayaç + keşfeti yenile.
            Yenileme düğmesi sıralama seçeneklerinin arasından BURAYA taşındı: yaptığı
            iş bir sıralama seçmek değil, seçili akışı tazelemek — üstelik sıralama
            bölümü mobilde katlanınca düğme hiç görünmüyordu. Künye satırı iki
            kırılımda da her zaman açık ve ızgaranın hemen üstünde; "bu kadar ürün
            var — baştan karıştır" olarak okunuyor. */}
        <div className="grid-count" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "var(--muted2)" }}>
            <span style={{ color: "var(--grn)" }}>{n(result?.matched ?? 0)}</span> {t("ÜRÜN")} —{" "}
            {t(result?.activeLabel ?? "")}
            {loading && <span style={{ color: "var(--faint)" }}> · {t("yükleniyor…")}</span>}
          </span>
          {/* Yalnız keşfet sıralamasındayken çizilir: fiyata/tarihe göre sıralı bir
              ızgarada tohumun hiçbir etkisi yok, düğme orada yalan söylerdi. */}
          {sort === "kesfet" && (
            <span
              className="nav-item kesfet-yenile"
              onClick={reshuffleFeed}
              title={t("keşfeti yenile — vitrini baştan karıştırır, filtreler korunur")}
              aria-label={t("Keşfeti yenile")}
              role="button"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                // 28 → 32: künye satırında tek başına duruyor, artık bir düğme
                // gibi görünmesi gerekiyor (metin düğmelerinin arasında değil).
                width: 32,
                height: 32,
                flex: "none",
                color: "var(--grn)",
                opacity: loading ? 0.45 : 1,
              }}
            >
              <RestartIcon size={18} />
            </span>
          )}
        </div>
        {/* GÖRÜNÜM + STOK + SIRALA — mobilde katlanabilir bölüm, MARKA ve TARZ
            şeritleriyle BİREBİR aynı kalıp (`.chip-sec`, bkz. BrandChips/StyleRow):
            başlık + artı/eksi dairesi, varsayılan kapalı. Üç şerit alt alta aynı
            biçimde duruyor — ızgaranın üstündeki her satırın ne olduğu artık adından
            belli. Masaüstünde başlık hiç çizilmez ve sarmalayıcı `display: contents`
            ile aradan çekilir (globals.css .sort-sec): orada satır eskisi gibi
            sayacın karşısında, tek sırada duruyor.

            Sayaç bilerek DIŞARIDA kaldı: o bir kontrol değil, "şu an neye bakıyorsun"
            cevabı — bir dokunuşun ardına saklanacak şey değil. */}
        <div className={`chip-sec sort-sec${sectionOpen ? " is-open" : ""}`}>
          <div className="chip-sec-head nav-item" onClick={toggleSection}>
            <span>
              {t("SIRALA & GÖRÜNÜM")} — <span style={{ color: "var(--grn)" }}>{sortLabel}</span>
            </span>
            <span className="chip-sec-toggle">
              <PlusMinus open={sectionOpen} />
            </span>
          </div>
          {/* Sıralama — üç durumlu düğmeler: 1. basış artan, 2. azalan, 3. kapalı.
              Hiçbiri basılı değilken vitrin KEŞFET akışıyla gelir; keşfet bu yüzden
              ayrı bir düğme değil, düğmelerin "kapalı" hâlinin adıdır. */}
          <div
            className={`sort-row chip-sec-grid${sectionOpen ? " is-open" : ""}`}
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
          {/* Gösterim biçimi — sık ızgaradan tek sütunlu listeye. Tercih cihazda
              saklanır (bkz. store.ts LAYOUT_KEY): kullanıcı vitrini kendi baktığı
              gibi bırakabilsin. */}
          <span style={{ color: "var(--faint)" }}>{t("GÖRÜNÜM")}</span>
          {LAYOUTS.map((l) => (
            <span
              key={l.k}
              className="nav-item"
              onClick={() => setLayout(l.k)}
              title={t(l.title)}
              style={{ color: layout === l.k ? "var(--grn)" : "var(--muted3)" }}
            >
              {t(l.label)}
            </span>
          ))}
          {/* STOK FİLTRESİ BURADAN KALDIRILDI (2026-08-01). "STOKTAKİLER / TÜMÜ"
              ikilisi tek bir açık/kapalı bilgiyi iki kelimeyle taşıyordu ve bir
              GÖSTERİM tercihi değil bir FİLTREydi — bölümün adı (SIRALA & GÖRÜNÜM)
              onu kapsamıyordu. Yeri artık tek: filtre panelindeki STOK bölümü
              (bkz. FilterPanel `k="stok"`). Varsayılandan sapınca hem üst şeritteki
              FİLTRE sayacında hem panelin SEÇİLİ özetinde ("TÜKENMİŞLER DE")
              görünüyor, yani gizlenmiş olmuyor. */}
          <span style={{ color: "var(--faint2)" }}>·</span>
          <span style={{ color: "var(--faint)" }}>{t("SIRALA")}</span>
          <span
            className="nav-item"
            onClick={() => setQuery({ sort: "kesfet", dir: "asc" })}
            title={t("altr'ın kendi keşfet sıralaması")}
            style={{ color: sort === "kesfet" ? "var(--grn)" : "var(--muted3)" }}
          >
            {t("KEŞFET")}
          </span>
          {/* KEŞFETİ YENİLE buradan künye satırına taşındı (bkz. yukarısı):
              akışı yeni bir tohumla baştan kurar (store.reshuffleFeed). */}
          <span style={{ color: "var(--faint2)" }}>·</span>
          {SORTS.map((s) => {
            const on = sort === s.k;
            return (
              <span
                key={s.k}
                className="nav-item"
                onClick={() => setQuery(cycleSort({ sort, dir }, s.k))}
                title={on ? `${t(s.label)}: ${dir === "asc" ? t(s.asc) : t(s.desc)} — ${t("tekrar bas")}: ${dir === "asc" ? t(s.desc) : t("keşfet")}` : `${t(s.label)}: ${t(s.asc)}`}
                style={{ color: on ? "var(--grn)" : "var(--muted3)" }}
              >
                {t(s.label)}
                <span style={{ marginLeft: 3, opacity: on ? 1 : 0.35 }}>
                  {on ? (dir === "asc" ? "↑" : "↓") : "↕"}
                </span>
              </span>
            );
          })}
          </div>
        </div>
      </div>

      {/* grid */}
      <div
        className="grid-inner"
        data-layout={layout}
        style={{
          display: "grid",
          gridTemplateColumns: GRID[layout].cols,
          gap: GRID[layout].gap,
          // Sayfa/filtre/sıralama değişince (üstteki üst çubuk zaten dönüyor — bkz.
          // TopProgressBar) ızgara ANINDA değişmiyor: yeni veri gelene kadar eski
          // kartlar hafifçe soluklaşır, "tazeleniyor" olduğu göz ucuyla anlaşılır.
          opacity: loading ? 0.5 : 1,
          transition: "opacity .15s ease",
        }}
      >
        {items.map((p, i) => (
          <ProductCard key={p.id} p={p} context={items} index={i} layout={layout} />
        ))}
      </div>

      {/* boş durum */}
      {items.length === 0 && !loading && (
        <div style={{ padding: "80px 20px", textAlign: "center" }}>
          <div
            className="empty-big"
            style={{
              fontFamily: "'Anton', sans-serif",
              fontSize: 57,
              color: "var(--fg)",
              textTransform: "uppercase",
              textShadow: "2px 0 var(--bg), -2px 0 var(--grn)",
            }}
          >
            {t("SONUÇ YOK")}
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, color: "var(--muted3)", marginTop: 12 }}>
            {query.q ? (
              <>
                “{query.q}” {t("için sonuç yok")}
                {activeCount > 0 ? ` — ${t("belki filtreler daraltıyor")}` : ""}
              </>
            ) : (
              t("bu seçimde ürün yok — filtreyi gevşet")
            )}
          </div>
          {/* Çıkmazdan çıkışın İKİ yolu ayrı ayrı veriliyor: aramayı bırakmakla tüm
              filtreleri sıfırlamak aynı şey değil, kullanıcı çoğu zaman birini istiyor. */}
          <div style={{ display: "flex", gap: 18, justifyContent: "center", flexWrap: "wrap", marginTop: 18 }}>
            {query.q && (
              <span
                className="nav-item"
                onClick={() => setQuery({ q: "" })}
                style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 14,
                  letterSpacing: ".16em",
                  color: "var(--grn)",
                  borderBottom: "1px solid var(--grn)",
                  paddingBottom: 3,
                  cursor: "pointer",
                }}
              >
                {t("✕ ARAMAYI BIRAK")}
              </span>
            )}
            <span
              className="nav-item"
              onClick={resetAll}
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 14,
                letterSpacing: ".16em",
                color: "var(--grn)",
                borderBottom: "1px solid var(--grn)",
                paddingBottom: 3,
                cursor: "pointer",
              }}
            >
              {t("↺ HEPSİNİ SIFIRLA")}
            </span>
          </div>
        </div>
      )}

      {/* sayfalama — dokunma hedefleri en az 36px (mobil parmak dokunuşu için) */}
      {pageCount > 1 && (
        <div
          className="pagination-row"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            marginTop: 52,
            fontFamily: "'Space Mono', monospace",
            fontSize: 17,
            letterSpacing: ".1em",
          }}
        >
          <span
            className="nav-item"
            onClick={() => setPage(Math.max(1, page - 1))}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 36,
              minHeight: 36,
              color: page > 1 ? "var(--muted)" : "var(--faint2)",
              fontSize: 14,
            }}
          >
            ‹
          </span>
          {pageList(page, pageCount).map((n, i) =>
            n === "…" ? (
              <span key={`gap${i}`} style={{ color: "var(--faint)", minWidth: 36, textAlign: "center" }}>
                …
              </span>
            ) : (
              <span
                key={n}
                className="nav-item"
                onClick={() => setPage(n)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 36,
                  minHeight: 36,
                  textAlign: "center",
                  // letter-spacing üst kapsayıcıdan miras kalıyor; tek karakterli
                  // span'lerde karakterden SONRA da boşluk eklediği için altı çizili
                  // rakamı kendi çizgisine göre sola kaydırıyordu — burada sıfırla.
                  letterSpacing: 0,
                  color: n === page ? "var(--grn)" : "var(--muted)",
                  borderBottom: `2px solid ${n === page ? "var(--grn)" : "transparent"}`,
                }}
              >
                {n}
              </span>
            ),
          )}
          <span
            className="nav-item"
            onClick={() => setPage(Math.min(pageCount, page + 1))}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 36,
              minHeight: 36,
              color: page < pageCount ? "var(--muted)" : "var(--faint2)",
              fontSize: 14,
            }}
          >
            ›
          </span>
        </div>
      )}

      {/* AKIŞIN SONU — keşfeti yenilemenin YAZILI ikizi.
          Künye satırındaki ikon her zaman görünür ama yazısız: ne yaptığını ancak
          basan öğreniyor. Burada, kullanıcının 40 ürünü bitirdiği ve "başka bir şey
          göster" isteğinin en yüksek olduğu anda, aynı iş adıyla duruyor.

          Sayfalamanın ALTINDA: sıradaki sayfaya gitmek asıl yol, akışı baştan
          karıştırmak onun alternatifi. Boş sonuç ekranında çizilmez — orada karıştırmak
          hiçbir şeyi değiştirmez, o ekranın kendi çıkışları var (aramayı bırak /
          hepsini sıfırla). Yalnız KEŞFET sıralamasındayken, tıpkı ikizi gibi. */}
      {sort === "kesfet" && items.length > 0 && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: pageCount > 1 ? 34 : 52 }}>
          <span
            className="nav-item kesfet-yenile-alt"
            onClick={reshuffleFeed}
            role="button"
            title={t("keşfeti yenile — vitrini baştan karıştırır, filtreler korunur")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 9,
              // Boş sonuç ekranındaki eylemlerle AYNI biçim (altı çizili yeşil yazı):
              // sitede "buraya bas, bir şey değişsin" demenin yolu bu. Üst dolgu
              // dokunma hedefini ~36px'e çıkarıyor, alt dolgu çizgiyi yazıya yaklaştırıyor.
              padding: "10px 6px 5px",
              borderBottom: "1px solid var(--grn)",
              fontFamily: "'Space Mono', monospace",
              fontSize: 14,
              letterSpacing: ".16em",
              color: "var(--grn)",
              opacity: loading ? 0.45 : 1,
              cursor: "pointer",
            }}
          >
            <RestartIcon size={16} />
            {t("KEŞFETİ YENİLE")}
          </span>
        </div>
      )}
    </>
  );
}
