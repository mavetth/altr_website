"use client";
import { useEffect, useMemo } from "react";
import { useStore, type SharedList, type Theme } from "@/store";
import { parseQuery, type QueryParams, type QueryResult } from "@/lib/query";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { GridView } from "./GridView";
import { Showcase } from "./Showcase";
import { SharedListView } from "./SharedListView";
import { BrandIndexView, BrandPageView } from "./BrandViews";
import { FilterPanel } from "./FilterPanel";
import { BrandModal } from "./BrandModal";
import { ProductModal } from "./ProductModal";
import { AuthModal } from "./AuthModal";
import { ContactModal } from "./ContactModal";
import { ContactButton } from "./ContactButton";
import { IntroModal } from "./IntroModal";
import { Toast } from "./Toast";
import { VitrinReminder } from "./VitrinReminder";
import { CategoryNav } from "./CategoryNav";
import { GenderRow } from "./GenderRow";
import { SearchBox } from "./SearchBox";
import { AccountButton } from "./AccountButton";
import type { BrandChip } from "./BrandChips";

export function App({
  initialQuery,
  initialResult,
  brands,
  brandCount,
  urlByName,
  catCounts,
  sizeCounts,
  styleCounts,
  colorCounts,
  shared,
}: {
  initialQuery: QueryParams;
  initialResult: QueryResult;
  brands: BrandChip[];
  brandCount: number;
  urlByName: Record<string, string | null>;
  catCounts: Record<string, number>;
  /** Katalogda geçen beden -> ürün adedi. Filtre kutuları bundan türer. */
  sizeCounts: Record<string, number>;
  styleCounts: Record<string, number>;
  /** Renk ailesi -> ürün adedi (bkz. lib/color-tags.ts). */
  colorCounts: Record<string, number>;
  /** `?liste=` ile açıldıysa: linkte gelen, salt okunur liste. */
  shared: SharedList | null;
}) {
  const init = useStore((s) => s.init);
  const view = useStore((s) => s.view);
  const closeDetail = useStore((s) => s.closeDetail);
  const closeBrandModal = useStore((s) => s.closeBrandModal);
  const closeFilter = useStore((s) => s.closeFilter);
  const detail = useStore((s) => s.detail);
  const modalBrand = useStore((s) => s.modalBrand);
  const filterOpen = useStore((s) => s.filterOpen);
  const authOpen = useStore((s) => s.authOpen);
  const contactOpen = useStore((s) => s.contactOpen);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const markaSlug = useStore((s) => s.markaSlug);

  // Arama önerisi için düz ad listesi — SearchBox'ın çip nesnelerine ihtiyacı yok.
  const brandNames = useMemo(() => brands.map((b) => b.name), [brands]);

  useEffect(() => {
    const theme = (document.documentElement.getAttribute("data-theme") as Theme) || "dark";
    init(initialResult, theme, initialQuery, shared);
    // Oturum durumu ilk boyamayı BEKLETMEZ: vitrin hesaptan bağımsız çalışır, hesap
    // düğmesi cevap gelince "GİRİŞ"ten nick'e döner.
    void useStore.getState().loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Google dönüşü `?giris=…` ile gelir: sonucu bir kez söyle ve adresi temizle,
  // yoksa yenilemede aynı bildirim tekrar çıkar.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const g = sp.get("giris");
    if (!g) return;
    const messages: Record<string, string> = {
      tamam: "Giriş yapıldı.",
      nick: "Son adım: kendine bir nick seç.",
      iptal: "Google girişi iptal edildi.",
      dogrulanamadi: "Google girişi doğrulanamadı.",
      "eposta-dogrulanmamis": "Google hesabının e-postası doğrulanmamış.",
      "google-kapali": "Google ile giriş bu kurulumda açık değil.",
    };
    useStore.getState().showToast(messages[g] ?? "Giriş tamamlanamadı.");
    sp.delete("giris");
    const qs = sp.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  }, []);

  useEffect(() => {
    // tarayıcı geri/ileri tuşu: URL'i store'a senkronize et, ama tekrar history'ye
    // yazma (zaten popstate'in kendisi bir geçmiş adımı) — sadece state'i güncelle.
    const onPopState = () => {
      const parsed = parseQuery(new URLSearchParams(window.location.search));
      // tohum URL'de taşınmıyor: geri/ileri tuşu vitrini baştan karıştırmasın diye
      // oturumun tohumu korunur.
      const query = { ...parsed, seed: useStore.getState().query.seed };
      useStore.setState({ query });
      void useStore.getState().refetch();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const s = useStore.getState();
      // Giriş ve iletişim modalleri en üstte (z-index 80): açıksa Escape önce onları kapatır.
      if (s.authOpen) s.closeAuth();
      else if (s.contactOpen) s.closeContact();
      else if (s.detail) closeDetail();
      else if (s.modalBrand) closeBrandModal();
      else if (s.filterOpen) closeFilter();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeDetail, closeBrandModal, closeFilter]);

  useEffect(() => {
    // Herhangi bir tam ekran modal/panel açıkken arkadaki sayfa kaymasın diye
    // body'yi kilitler. Sadece overflow:hidden iOS Safari'de touch-scroll'u
    // engellemiyor — body'yi scroll konumunda position:fixed'e alan klasik
    // yöntem hem masaüstünde hem mobilde güvenilir çalışıyor.
    const locked =
      Boolean(detail) || Boolean(modalBrand) || filterOpen || authOpen || contactOpen;
    if (!locked) return;
    const scrollY = window.scrollY;
    const body = document.body;
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    return () => {
      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      window.scrollTo(0, scrollY);
    };
  }, [detail, modalBrand, filterOpen, authOpen, contactOpen]);

  return (
    // .app-shell: sayfa içi bağ hedeflerinin yapışık üst şeridin altında kalmaması için
    // `--anchor-offset` burada tanımlanır (bkz. globals.css). Kalıcı sayfalarda
    // (PageChrome) başlık sticky olmadığı için orada varsayılan küçük değer geçerli.
    <div className="app-shell" style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)", fontFamily: "'IBM Plex Mono', monospace" }}>
      {/* mobilde: sayfanın tamamı boyunca gerçekten sabit kalan bağımsız arama çubuğu.
          .topbar'ın İÇİNDE olsaydı, o kısa kutunun sınırına hapsolup birkaç saniyelik
          kaydırmadan sonra kaybolurdu (position:sticky'nin "containing block" kısıtı) —
          bu yüzden dışarıda, sayfa kadar uzun olan bu wrapper'ın doğrudan çocuğu.

          Yapışan eleman artık SearchBox'ın kendisi değil bu satır: hesap düğmesi
          (GİRİŞ) mobilde aramanın SAĞINDA duruyor — üst şeritteki kopyası orada
          gizleniyor (globals.css .topbar-account). Sticky/boy kuralları satırda,
          arama kutusu içeride kalan genişliği alıyor. */}
      <div className="mobile-search-sticky">
        <SearchBox brands={brandNames} />
        <AccountButton className="msearch-account" />
      </div>
      <TopBar brandNames={brandNames} />
      <FilterPanel brands={brands} sizeCounts={sizeCounts} styleCounts={styleCounts} colorCounts={colorCounts} />
      <BrandModal urlByName={urlByName} />
      <ProductModal />
      <AuthModal />
      <ContactModal />
      <ContactButton />
      {/* Karşılama: cihaz başına bir kez kendiliğinden, sonra sol menüdeki MİSYON'dan */}
      <IntroModal brandCount={brandCount} />
      <Toast />
      <VitrinReminder />

      {/* minmax(0,1fr): 1fr'ın min-content tabanı dar ekranda taşmaya yol açıyor.
          Sol sütunun genişliği barın katlanma durumundan gelir; mobil media query'si
          bu gridi zaten tek sütuna indiriyor, orada değişkenin bir etkisi yok. */}
      <div
        className="layout-grid"
        style={{
          display: "grid",
          // 230 → 270: kategori listesinin puntosu %20 büyüdü, en uzun satır
          // (EN'de "DRESSES & SETS" + sayısı) 230px'lik sütuna sığmıyordu.
          gridTemplateColumns: `${sidebarOpen ? 270 : 46}px minmax(0,1fr)`,
          alignItems: "start",
        }}
      >
        <Sidebar brandCount={brandCount} catCounts={catCounts} />
        {/* mobilde: sidebar'daki (logo/vitrinim altındaki) kategori satırının native
            sticky karşılığı — bkz. globals.css .topbar-cats-fixed. Masaüstünde gizli,
            kategoriler zaten Sidebar içindeki .side-cats'te. */}
        <CategoryNav
          className="topbar-cats-fixed"
          counts={catCounts}
          /* iki satır: üstte çatılar, altta açık çatının kalemleri (bkz. CategoryNav) */
          ikiSatir
          style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, letterSpacing: ".14em" }}
        />
        {/* mobilde: kadın/erkek satırının kategori şeridinin ALTINDA duran kopyası
            (eski sıra: logo → kategoriler → kadın/erkek). Masaüstünde gizli,
            o zaten Sidebar içindeki .side-gender-row'da. */}
        <GenderRow className="mobile-gender-row" />
        <main className="main-col" style={{ position: "relative", padding: "8px 40px 100px 12px" }}>
          {view === "grid" ? (
            <GridView brands={brands} />
          ) : view === "markalar" ? (
            <BrandIndexView />
          ) : view === "marka" && markaSlug ? (
            <BrandPageView slug={markaSlug} />
          ) : view === "paylasilan" ? (
            <SharedListView />
          ) : (
            <Showcase />
          )}
        </main>
      </div>
    </div>
  );
}
