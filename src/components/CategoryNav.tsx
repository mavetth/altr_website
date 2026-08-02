"use client";
import { useState, type CSSProperties } from "react";
import { CAT_GROUPS, VIEW_CATS, groupOfCat, type NavCat } from "@/lib/types";
import { DEFAULT_QUERY } from "@/lib/query";
import { useStore } from "@/store";
import { useLang } from "@/lib/lang";

/**
 * Kategori listesi — hem masaüstü sidebar'ında hem mobilde arama çubuğunun altında
 * sabit (sticky) duran ayrı bir şeritte kullanılır (bkz. Sidebar.tsx / App.tsx).
 *
 * Liste ÇATI KATEGORİLERE bölünmüştür (ÜST GİYİM / ALT GİYİM / …, bkz. types.ts
 * CAT_GROUPS): 36 kalemlik düz liste sidebar'ın tamamını kaplayıp kendi içinde
 * kayıyordu. Çatılar varsayılan olarak KAPALI; seçili kategoriyi içeren çatı
 * kendiliğinden açılır, böylece derin bir linkle gelen kişi nerede olduğunu görür.
 *
 * Çatı BİR FİLTRE DEĞİL — başlığa basmak açar/kapatır, sorguyu değiştirmez. Ürünün
 * kategorisi hâlâ düz taksonomidir.
 */
export function CategoryNav({
  className,
  style,
  counts,
  withMarkalar = true,
  ikiSatir = false,
}: {
  className?: string;
  style?: CSSProperties;
  /**
   * Kategori -> katalogdaki ürün adedi. Çatı başlığında alt kalemlerin toplamı yazar.
   * "MARKALAR" anahtarı ürün değil MARKA adedi taşır (bkz. src/app/page.tsx).
   */
  counts?: Record<string, number>;
  /**
   * MARKALAR sekmesi listenin sonunda çizilsin mi?
   *
   * Masaüstü sidebar'ında ÇİZİLMEZ: orada MARKALAR kategori listesinin kuyruğunda
   * değil, VİTRİNİM'in hemen üstünde onunla aynı ağırlıkta ayrı bir bölüm olarak
   * durur (bkz. Sidebar.tsx). İkisi de "ürün filtresi" değil, siteye başka bir
   * giriş kapısı — kategorilerin arasına karışınca kategori sanılıyordu.
   * Mobil şeritte VİTRİNİM bölümü olmadığı için orada listede kalır.
   */
  withMarkalar?: boolean;
  /**
   * MOBİL ŞERİT KİPİ — iki satır (2026-08-01).
   *
   * Şeritte çatı ile kalemler tek satıra sıkışıyordu: bir çatıyı açınca kalemleri aynı
   * satıra giriyor, sıradaki çatı ekranın 4 ekran sağına kaçıyordu (ölçüldü: ÜST GİYİM
   * açıkken şerit 2337px, ALT GİYİM x=1487). Yani bir çatıyı açan kişi diğerlerini
   * kaybediyordu. Bu kipte satırlar ayrılıyor: üstte çatılar (yerinden oynamaz), altta
   * açık çatının kalemleri. Her satır kendi içinde yatay kayar.
   *
   * Sidebar bu kipi KULLANMAZ: orada liste zaten dikey, çatılar iç içe açılıyor.
   */
  ikiSatir?: boolean;
}) {
  const cat = useStore((s) => s.query.cat);
  const view = useStore((s) => s.view);
  const setQuery = useStore((s) => s.setQuery);
  const setView = useStore((s) => s.setView);
  const openMarkalar = useStore((s) => s.openMarkalar);
  const openGroups = useStore((s) => s.openGroups);
  const toggleCatGroup = useStore((s) => s.toggleCatGroup);
  const { t, n } = useLang();
  // az önce kapatılan kategori: fare hâlâ üstündeyken ".nav-item:hover" sarıya
  // dönmeye devam edip "kapandı" hissini bozmasın diye, fare ayrılana kadar bastırılır.
  const [suppressHover, setSuppressHover] = useState<string | null>(null);
  /**
   * Şerit kipinde açık olan çatı. ÜÇ DURUMLU:
   *   undefined → kullanıcı henüz dokunmadı; seçili kategorinin çatısı açık gelir
   *               (derin bir linkle gelen kişi nerede olduğunu görsün).
   *   string    → kullanıcının açtığı çatı.
   *   null      → kullanıcı elle kapattı; seçili kategori olsa bile kapalı kalır.
   * İki durumlu olsaydı elle kapatılan çatı `activeGroup` yüzünden hemen geri açılırdı.
   */
  const [seritCati, setSeritCati] = useState<string | null | undefined>(undefined);

  const activeGroup = view === "grid" ? groupOfCat(cat) : null;

  const pick = (c: NavCat) => {
    setView("grid");
    // zaten seçiliyse tekrar tıklayınca varsayılana (TÜM ÜRÜNLER) döner
    const wasActive = view === "grid" && cat === c;
    const hedef = wasActive ? DEFAULT_QUERY.cat : c;
    // TÜM ÜRÜNLER'e BASMAK "sıfırla" demektir: arama kelimesi de temizlenir. Aksi
    // hâlde bir şey aratıp TÜM ÜRÜNLER'e basan kişi vitrine dönemiyordu —
    // kategori sıfırlanıyor ama sonuçlar hâlâ aramanın sonuçları oluyordu.
    //
    // Ölçüt TIKLANAN kalem, varılan kategori DEĞİL: bir şey aratıp TİŞÖRT'e basıp
    // sonra TİŞÖRT'ü kapatan kişi de varsayılan kategoriye döner ama onun niyeti
    // "aramayı daraltmayı geri al"dır, aramadan çıkmak değil. Orada arama durur.
    const sifirla = c === DEFAULT_QUERY.cat;
    setQuery(sifirla ? { cat: hedef, q: "" } : { cat: hedef });
    setSuppressHover(wasActive ? c : null);
  };

  const item = (c: NavCat, extraClass = "") => (
    <span
      key={c}
      className={`nav-item${suppressHover === c ? " cat-suppress-hover" : ""}${extraClass}`}
      onClick={() => pick(c)}
      onMouseLeave={() => setSuppressHover((cur) => (cur === c ? null : cur))}
      style={{ color: view === "grid" && cat === c ? "var(--grn)" : "var(--muted)" }}
    >
      {t(c)}
      {counts?.[c] != null && (
        <span className="cat-count" style={{ color: "var(--faint)", marginLeft: 6 }}>
          {n(counts[c])}
        </span>
      )}
    </span>
  );

  /** Çatı başlığı — iki kipte de aynı; farkı açık/kapalı bilgisinin nereden geldiği. */
  const head = (
    g: (typeof CAT_GROUPS)[number],
    open: boolean,
    onToggle: () => void,
  ) => {
    const total = counts ? g.cats.reduce((n, c) => n + (counts[c] ?? 0), 0) : null;
    return (
      <span
        className={`nav-item cat-group-head${open ? " open" : ""}`}
        onClick={onToggle}
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          // yatay boşluk (gap) ve punto CSS'ten: sol menüdeki kopya 230px'lik
          // sütuna sığmak için ikisini de biraz kısıyor (globals.css .side-cats)
          //
          // Vurgu AÇIK OLMA hâlini gösterir, seçili kategoriyi değil: açık çatı
          // beyaz (--fg), kapalı çatı sönük (--muted2). Kaç çatı açıksa hepsi
          // vurgulu. Eskiden vurgu seçili kategoriye bağlıydı ve çatı kapandıktan
          // sonra da beyaz kalıyordu — "kapanmadı" gibi okunuyordu. Etkin filtre
          // zaten seçili kalemin yeşilinden ve ızgara başlığından okunuyor.
          color: open ? "var(--fg)" : "var(--muted2)",
        }}
      >
        <Caret open={open} />
        {t(g.label)}
        {total != null && (
          <span className="cat-count" style={{ color: "var(--faint)" }}>
            {n(total)}
          </span>
        )}
      </span>
    );
  };

  /* MARKALAR bir ÜRÜN görünümü değil, marka rehberi. Eskiden katalogun tamamını
     markadan markaya dolaşarak sıralıyordu — yani "markalar"a basan kişiye yine
     ürünler çıkıyordu. Marka aramak isteyen kişi marka listesi bekler.
     Rehber artık AYRI SAYFA DEĞİL, kategori gibi bir SEKME: sol tık sayfayı
     yeniden yüklemeden görünümü değiştirir. href gerçek kalıyor ki orta tık,
     "yeni sekmede aç" ve arama motoru `/markalar` adresini görmeye devam etsin. */
  const markalarBagi = withMarkalar ? (
    <a
      href="/markalar"
      className="nav-item"
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        openMarkalar();
      }}
      style={{ color: view === "markalar" || view === "marka" ? "var(--grn)" : "var(--muted)", textDecoration: "none" }}
    >
      {t(VIEW_CATS[1])}
      {counts?.[VIEW_CATS[1]] != null && (
        <span className="cat-count" style={{ color: "var(--faint)", marginLeft: 6 }}>
          {counts[VIEW_CATS[1]]}
        </span>
      )}
    </a>
  ) : null;

  // TEK kalemli çatı açılır kapanır olmaz: "İÇ GİYİM" başlığını açıp altında yine
  // "İÇ GİYİM" görmek anlamsız. Doğrudan kategori kalemi olarak çizilir.
  const tekKalem = (g: (typeof CAT_GROUPS)[number]) => g.cats.length === 1;

  if (ikiSatir) {
    // Şeritte AYNI ANDA TEK çatı açık: ikinci satır bir tane. Durum yerel, çünkü
    // store'daki `openGroups` çoklu açılışa göre kurulu (sidebar öyle çalışıyor) ve
    // iki satırlık şeritte "hangi çatının kalemleri" sorusunun tek bir cevabı olmalı.
    const acikCati = seritCati === undefined ? activeGroup : seritCati;
    const acik = CAT_GROUPS.find((g) => g.key === acikCati && !tekKalem(g));
    return (
      <nav className={`${className ?? ""}${acik ? " is-acik" : ""}`} style={style}>
        <div className="cats-row">
          {item(VIEW_CATS[0])}
          {CAT_GROUPS.map((g) =>
            tekKalem(g) ? (
              item(g.cats[0])
            ) : (
              <span key={g.key} style={{ display: "contents" }}>
                {head(g, acik?.key === g.key, () =>
                  setSeritCati(acikCati === g.key ? null : g.key),
                )}
              </span>
            ),
          )}
          {markalarBagi}
        </div>
        {/* key: çatı değişince satır yeniden kurulur, yatay kaydırma başa döner —
            yoksa yeni çatının kalemleri bir öncekinin kaydığı yerden başlıyor. */}
        {acik && (
          <div className="cats-row cats-row-alt" key={acik.key}>
            {acik.cats.map((c) => item(c, " cat-sub"))}
          </div>
        )}
      </nav>
    );
  }

  return (
    <nav className={className} style={style}>
      {item(VIEW_CATS[0])}

      {CAT_GROUPS.map((g) => {
        if (tekKalem(g)) return item(g.cats[0]);

        // Seçili kategoriyi içeren çatı, kullanıcı elle kapatmadıkça açık gelir.
        const open = openGroups[g.key] ?? activeGroup === g.key;
        return (
          // genişlik/yön CSS'ten gelir (globals.css .cat-group): satır içi yazılırsa
          // mobil şeritteki `width:auto` override'ını eziyor ve her çatı kendi satırına
          // düşüp sabit şeridi 272px'e çıkarıyordu
          <div key={g.key} className="cat-group">
            {head(g, open, () => toggleCatGroup(g.key))}
            {open && <div className="cat-group-body">{g.cats.map((c) => item(c, " cat-sub"))}</div>}
          </div>
        );
      })}

      {markalarBagi}
    </nav>
  );
}

/** Açılır kapanır işareti — kapalıyken sağa, açıkken aşağı bakar. */
function Caret({ open }: { open: boolean }) {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden
      style={{ flex: "none", transform: open ? "rotate(90deg)" : "none" }}
    >
      <path d="M3 1.5 7 5l-4 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
