"use client";
import { useStore } from "@/store";
import { DEFAULT_QUERY } from "@/lib/query";
import { useLang } from "@/lib/lang";
import { ThemeToggle } from "./ThemeToggle";
import { LangToggle } from "./LangToggle";
import { HangerIcon, NumberBadge, TagIcon, CompassIcon } from "./icons";
import { CategoryNav } from "./CategoryNav";
import { GenderRow } from "./GenderRow";
import { Logo3D } from "./Logo3D";

// Bölüm ayracının biçimi globals.css `.dotline`da: dikey boşluğu ekran boyuna göre
// kısalıyor (7 ayraç × 40px kısa ekranlarda kategori listesine yer bırakmıyordu),
// bu da satır içi stille yapılamaz.

export function Sidebar({
  brandCount,
  catCounts,
}: {
  brandCount: number;
  catCounts: Record<string, number>;
}) {
  const view = useStore((s) => s.view);
  const setQuery = useStore((s) => s.setQuery);
  const setView = useStore((s) => s.setView);
  const showcaseCount = useStore((s) => s.showcase.length);
  const total = useStore((s) => s.result?.total ?? 0);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const openMarkalar = useStore((s) => s.openMarkalar);
  const openIntro = useStore((s) => s.openIntro);
  const { t, n } = useLang();

  /**
   * KATLANMIŞ hâl (yalnız masaüstü; mobilde sidebar zaten üst şeride dönüşüyor ve
   * bu bileşen o düzeni CSS'ten alıyor). Şeritte YALNIZ açma işareti kalır —
   * ızgaraya ~190px genişlik açılır.
   *
   * MENÜ yazısı ve vitrin ikonu kaldırıldı: ikisi de aynı işi ikinci kez yapıyordu
   * (yazı zaten işaretin yaptığı şeyi anlatıyordu, vitrine giden kapı ise üst şeritte
   * duruyor). Şerit artık tek bir amaç taşıyor: barı geri aç.
   */
  if (!sidebarOpen) {
    return (
      <aside
        className="sidebar sidebar-collapsed"
        style={{
          // Alt boşluk üst boşluktan tam `--topbar-h` fazla: açık bardaki içerik gibi
          // (bkz. aşağıdaki aside) işaretin ekseni de 50vh'ye iner.
          padding: "22px 0 calc(22px + var(--topbar-h))",
          position: "sticky",
          top: "var(--topbar-h)",
          alignSelf: "start",
          height: "calc(100vh - var(--topbar-h))",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          // İşaret şeridin dikey ortasında — açık bardaki yeriyle aynı hiza, böylece
          // aç/kapa yaparken yerinden oynamıyor.
          justifyContent: "safe center",
        }}
      >
        <SideToggle open={false} onClick={toggleSidebar} />
      </aside>
    );
  }

  return (
    <aside
      className="sidebar"
      style={{
        // Yatay iç boşluk simetrik ve dar: kategori listesinin en uzun satırı
        // (ELBİSE & TAKIM + sayısı) eski 28/40'lık boşlukla sığmıyor ve liste yatay
        // kaydırma çubuğu çıkarıyordu. 20/20 ile 270px'lik sütunda ~220px yazı alanı.
        //
        // DİKEY BOŞLUK ASİMETRİK — ORTALAMA PENCERENİN TAMAMINA GÖRE.
        // Bu kutu üst barın ALTINDAN başlıyor (top/height aşağıda), dolayısıyla simetrik
        // boşlukla ortalanan içeriğin merkezi 50vh değil, 50vh + üst_bar/2 oluyordu:
        // pencerenin tepesinden ölçünce üstte altta olduğundan tam bir üst bar boyu
        // fazla boşluk kalıyor, sol sütun aşağı kaymış görünüyordu. Sidebar'ın üstündeki
        // şerit BOŞ (arama/filtre/giriş hepsi sağda), yani göz o sütunu tepeden dibe tek
        // parça okuyor ve haklı olarak pencerenin ortasını bekliyor.
        //
        // Alt boşluk üst boşluktan tam `--topbar-h` fazla olunca içerik kutusunun
        // merkezi 50vh'ye iner — kaybedilen dikey alan yok, yalnız eksen kayıyor.
        // ÜST boşluk küçük olmak ZORUNDA: içerik kutusu `100vh - 2×--topbar-h - 2×üst`
        // kadar kalıyor ve sidebar içeriği 980px'lik pencerede zaten ~836px; 34px'te
        // kutu içeriğe yetmez, `safe center` ortalamayı bırakıp başa hizalar ve kayma
        // geri gelirdi. 8px hem yetiyor hem taşma hâlinde içeriği üst barın altında
        // tutuyor. (Mobilde bu satır geçersiz: globals.css `.sidebar` padding'i
        // `!important` ile eziyor, orada sidebar zaten üst şeride dönüşüyor.)
        padding: "8px 20px calc(8px + var(--topbar-h))",
        position: "sticky",
        // Yapışma eşiği = sticky topbar'ın boyu (globals.css --topbar-h). Eşit olmazsa
        // sidebar sayfa başında aradaki fark kadar kayıp sonra kilitleniyor.
        top: "var(--topbar-h)",
        alignSelf: "start",
        height: "calc(100vh - var(--topbar-h))",
        display: "flex",
        flexDirection: "column",
        // "safe": içerik yine de taşarsa ortalama yerine baştan hizalanır, yoksa
        // ortalanan taşkın içeriğin ÜST kısmı kırpılıp erişilemez hâle geliyor.
        justifyContent: "safe center",
        alignItems: "center",
        textAlign: "center",
      }}
    >
      {/* katlama işareti — barın SAĞ KENARINDA, tepeden tabana tam ortada; sayfanın
          geri kalanına bakan yönde. Konumu içerikten bağımsız: liste açılıp kapandıkça
          yerinden oynamaz, göz onu hep aynı noktada arar.
          Mobilde gizli (orada sidebar zaten şerit). */}
      <SideToggle open onClick={toggleSidebar} />

      {/* logo — 3B, fareyle her eksende döndürülebilir; rengi temadan (--grn) gelir:
          gece sarı / gündüz mor */}
      <div
        className="side-logo"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          flex: "none",
        }}
      >
        <Logo3D
          fontSize={55}
          onClick={() => {
            setView("grid");
            // Logo "başa dön" düğmesidir: kategoriyi varsayılana çeker VE ARAMAYI
            // TEMİZLER. Arama kelimesi duruyorken kategoriyi sıfırlamak vitrini
            // geri getirmiyordu — kullanıcı "tüm ürünler"e bastığı hâlde hâlâ
            // aramanın sonuçlarına bakıyordu (arama kutusu da dolu kalıyordu).
            setQuery({ cat: DEFAULT_QUERY.cat, q: "" });
          }}
        />
      </div>

      <div className="dotline" />

      {/* mobilde logo/vitrin arası dikey kesikli ayraç (masaüstünde gizli) */}
      <div className="side-divider" />

      {/* tema switch + dil anahtarı: ikisi de "site nasıl görünsün" ayarı, aynı
          bölümde duruyorlar. Mobilde ikisi birden üst şeride taşınır
          (globals.css .topbar-theme / .topbar-lang). */}
      <ThemeToggle />
      <div style={{ height: 10 }} />
      <LangToggle />

      <div className="dotline" />

      {/* kadın/erkek — masaüstünde: tema switch'in altı, YENİ'nin üstü (sidebar'ın genel
          bölüm sırası: her bölüm bir dotline ile ayrılır). Mobilde bu örnek tamamen
          gizlenir (bkz. globals.css .side-gender-row); yerini App.tsx'teki, kategori
          şeridinin ALTINDA konumlanan ikinci bir GenderRow örneği alır. */}
      <GenderRow className="side-gender-row" style={{ display: "flex", alignItems: "center", width: "100%" }} />

      <div className="dotline" />

      {/* kategoriler — masaüstünde dikey liste. Mobilde bu satır tamamen gizlenir
          (bkz. globals.css .side-cats); yerini App.tsx'teki native sticky kopya alır.
          Taksonomi düzleştikten sonra liste 34 kalem oldu: kalan dikey alanı kaplayıp
          kendi içinde kayar, sidebar'ın alt bölümlerini (vitrin/sayaç) itmez. */}
      <CategoryNav
        className="side-cats"
        counts={catCounts}
        withMarkalar={false}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 9,
          // Listenin TAMAMI bu ölçüden miras alır (çatı başlığı da, alt kalem de:
          // globals.css .side-cats) — sayı da em cinsinden, o da birlikte ölçekleniyor.
          // 12 → 14.4 (%20): sütun bu yüzden 270px'e çıktı (App.tsx layout-grid).
          fontFamily: "'Space Mono', monospace",
          fontSize: 14.4,
          letterSpacing: ".06em",
        }}
      />

      <div className="dotline" />

      {/* ÜÇ KAPI TEK SARMALAYICIDA: VİTRİNİM · MARKALAR · MİSYON.
          Sarmalayıcı mobil için şart — orada sidebar üç sütunlu bir ızgaraya dönüşüyor
          ve `.side-vitrin` kutularının hepsi aynı hücreye (3. sütun, 1. satır) yerleşip
          ÜST ÜSTE biniyordu. Artık hücreye tek bir öğe giriyor, içindeki üç kapı yan
          yana diziliyor (bkz. globals.css `.side-nav`). */}
      <div className="side-nav">

      {/* vitrinim */}
      <div className="side-vitrin">
        <span
          className="nav-item"
          data-vitrin-target="sidebar"
          onClick={() => setView("vitrin")}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 9,
            fontFamily: "'Space Mono', monospace",
            fontSize: 14,
            letterSpacing: ".14em",
            color: view === "vitrin" ? "var(--grn)" : "var(--fg)",
          }}
        >
          <HangerIcon size={16} />
          {t("VİTRİNİM")}
          {/* mobilde alt yazı sığmadığı için sayı burada, yazının sağında gösterilir */}
          {showcaseCount > 0 && <NumberBadge n={showcaseCount} className="vit-badge" />}
        </span>
        <div className="vit-sub" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: ".12em", color: "var(--muted3)", marginTop: 7 }}>
          {t("alıcı gözüyle")} · <span style={{ color: "var(--grn)" }}>{showcaseCount}</span> {t("parça")}
        </div>
      </div>
      <div className="dotline" />

      {/* markalar — VİTRİNİM ile MİSYON arasında, ikisiyle de AYNI biçimde. Kategori
          listesinin kuyruğundayken bir kategori sanılıyordu; oysa ürün filtresi
          değil, marka rehberine açılan ayrı bir kapı. href gerçek kalıyor ki orta
          tık / "yeni sekmede aç" ve arama motoru `/markalar`ı görmeye devam etsin. */}
      <div className="side-vitrin">
        <a
          href="/markalar"
          className="nav-item"
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            openMarkalar();
          }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 9,
            fontFamily: "'Space Mono', monospace",
            fontSize: 14,
            letterSpacing: ".14em",
            textDecoration: "none",
            color: view === "markalar" || view === "marka" ? "var(--grn)" : "var(--fg)",
          }}
        >
          <TagIcon size={15} />
          {t("MARKALAR")}
        </a>
        <div className="vit-sub" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: ".12em", color: "var(--muted3)", marginTop: 7 }}>
          {t("hepsi bir arada")} · <span style={{ color: "var(--grn)" }}>{brandCount}</span> {t("marka")}
        </div>
      </div>

      <div className="dotline" />

      {/* MİSYON — üç kapının sonuncusu, diğer ikisiyle AYNI biçimde. Karşılama modalı
          cihaz başına yalnız bir kez kendiliğinden açıldığı için, "altr ne yapıyor"
          sorusunun kalıcı bir kapısı olmalı; buradan her zaman çağrılabiliyor. */}
      <div className="side-vitrin">
        <span
          className="nav-item"
          onClick={() => openIntro(true)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 9,
            fontFamily: "'Space Mono', monospace",
            fontSize: 14,
            letterSpacing: ".14em",
            color: "var(--fg)",
          }}
        >
          <CompassIcon size={15} />
          {t("MİSYON")}
        </span>
        <div className="vit-sub" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: ".12em", color: "var(--muted3)", marginTop: 7 }}>
          {t("misyonumuz · dil")}
        </div>
      </div>


      </div>

      <div className="dotline" />

      <div className="side-meta" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, lineHeight: 1.7, color: "var(--faint)", flex: "none" }}>
        <span style={{ color: "var(--grn)" }}>{n(total)}</span> {t("ÜRÜN")} ·{" "}
        <span style={{ color: "var(--grn)" }}>{brandCount}</span> {t("MARKA")}
        <br />
        {t("TEK ÇATI ALTINDA")}
      </div>
    </aside>
  );
}

/**
 * Sol barı katlayan/açan küçük işaret. Bar açıkken sola (kapat), kapalıyken sağa
 * (aç) bakar — ok her zaman "basınca ne olacağını" gösterir.
 */
function SideToggle({ open, onClick }: { open: boolean; onClick: () => void }) {
  const { t } = useLang();
  return (
    <span
      className="side-toggle nav-item"
      onClick={onClick}
      role="button"
      aria-expanded={open}
      aria-label={open ? t("Sol menüyü katla") : t("Sol menüyü aç")}
      title={open ? t("Menüyü katla") : t("Menüyü aç")}
      style={{
        // Bar AÇIKKEN: barın kendisine çapalanır (aside position:sticky, yani zaten
        // konumlandırılmış bir kapsayıcı) — dikeyde PENCERENİN ortası, yatayda sağ
        // kenar. İçerikten bağımsız: liste açılıp kapandıkça işaret yerinden oynamaz.
        //
        // %50 değil `%50 - --topbar-h/2`: kutu üst barın altından başladığı için onun
        // yarısı zaten 50vh'nin bir üst_bar/2 kadar altına düşüyordu. İçerik ekseni
        // 50vh'ye indirildi (bkz. aside padding'i), işaret de onunla aynı hizada kalsın.
        position: open ? "absolute" : "static",
        top: open ? "calc(50% - var(--topbar-h) / 2)" : undefined,
        right: open ? 6 : undefined,
        transform: open ? "translateY(-50%)" : undefined,
        // 22 → 28: siyah zeminde ince kenarlı 22px'lik daire zor seçiliyordu.
        width: 28,
        height: 28,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "none",
        // kenar ve ok bir adım açıldı (--line/--muted2 → --line/--muted): daire artık
        // aranmadan görülüyor, yine de vitrinin önüne geçmiyor
        border: "1px solid var(--muted3)",
        borderRadius: "50%",
        color: "var(--muted)",
        background: "var(--bg)",
        zIndex: 2,
      }}
    >
      {/* Ok, 10×10 kutunun TAM ORTASINA simetrik oturur: x 3.5–6.5, y 2–8 → merkez
          (5,5). Eski yol (3 → 6.5 / 3.5 → 7) merkezden yarım birim kaçıktı ve
          daire içinde sağa/sola yaslanmış görünüyordu. */}
      <svg width="12" height="12" viewBox="0 0 10 10" fill="none" style={{ display: "block" }}>
        <path
          d={open ? "M6.5 2 3.5 5 6.5 8" : "M3.5 2 6.5 5 3.5 8"}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
