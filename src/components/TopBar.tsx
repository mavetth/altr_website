"use client";
import { useStore } from "@/store";
import { DEFAULT_QUERY } from "@/lib/query";
import { useT } from "@/lib/lang";
import { ThemeToggle } from "./ThemeToggle";
import { LangToggle } from "./LangToggle";
import { SearchBox } from "./SearchBox";
import { AccountButton } from "./AccountButton";

export function TopBar({ brandNames }: { brandNames?: string[] }) {
  const t = useT();
  const cat = useStore((s) => s.query.cat);
  const genders = useStore((s) => s.query.genders);
  const styles = useStore((s) => s.query.styles);
  const brands = useStore((s) => s.query.brands);
  const price = useStore((s) => s.query.price);
  const sizes = useStore((s) => s.query.sizes);
  const colors = useStore((s) => s.query.colors);
  const inStockOnly = useStore((s) => s.query.inStockOnly);
  const sort = useStore((s) => s.query.sort);
  const openFilter = useStore((s) => s.openFilter);
  const me = useStore((s) => s.me);

  // Çoklu seçimler tek bir "aktif filtre" sayılır (2 marka seçmek 2 filtre değildir).
  const activeFilters =
    (cat !== DEFAULT_QUERY.cat ? 1 : 0) +
    (sort !== DEFAULT_QUERY.sort ? 1 : 0) +
    (genders.length ? 1 : 0) +
    (styles.length ? 1 : 0) +
    (brands.length ? 1 : 0) +
    (price !== "ALL" ? 1 : 0) +
    (sizes.length ? 1 : 0) +
    (colors.length ? 1 : 0) +
    // stok filtresi varsayılan AÇIK; sapma = tükenmişleri de göstermek
    (!inStockOnly ? 1 : 0);

  return (
    <header
      className="topbar"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 34,
        padding: "16px 40px",
        fontFamily: "'Space Mono', monospace",
        fontSize: 14,
        letterSpacing: ".16em",
        position: "sticky",
        top: 0,
        background: "var(--bg)",
        zIndex: 40,
      }}
    >
      <SearchBox className="search-box" style={{ flex: 1, maxWidth: 360 }} brands={brandNames} />
      {/* mobilde: FİLTRE + tema anahtarı artık sabit değil, sayfa başında normal akışta
          durur ve kaydırınca kaybolur (bkz. globals.css .topbar mobil override'ı).
          Sadece arama çubuğu (ve sağındaki GİRİŞ) App.tsx'teki bağımsız
          .mobile-search-sticky satırıyla sabit kalır. */}
      <span
        className="nav-item"
        onClick={openFilter}
        style={{ color: activeFilters > 0 ? "var(--grn)" : "var(--muted)", letterSpacing: ".16em" }}
      >
        {t("FİLTRE")}
        {activeFilters > 0 ? ` (${activeFilters})` : ""}
      </span>
      {/* MARKALAR üst şeritten KALDIRILDI (2026-07-30): rehberin girişi sol menüde
          zaten var (CategoryNav) ve iki ayrı yerde duran aynı bağ sağ üst köşeyi
          kalabalıklaştırıyordu. Yol (`/markalar`) ve sekme mantığı yerinde duruyor. */}
      {/* YÖNETİM: yalnız admin oturumunda çizilir. Arayüzdeki bu kontrol kolaylık
          içindir — asıl yetki sunucuda, oturum çerezinden okunuyor (admin olmayan
          /yonetim adresinde de 404 görür).

          Eskiden burada İSTATİSTİKLER ve KUTU diye iki SEKME vardı ve panelleri
          vitrinin içinde açılıyordu. İkisi de artık bağımsız yönetim konsolunda
          (bkz. app/yonetim/page.tsx): yönetim ekranı bir vitrin değil bir alet ve
          vitrinin ızgara ölçülerine sıkışmamalı. Gerçek bir `<a>`: yeni sekmede
          açılabilsin, yer imine eklenebilsin. */}
      {me?.role === "admin" && (
        <a
          className="nav-item topbar-stats"
          href="/yonetim"
          style={{ color: "var(--muted)", letterSpacing: ".16em", textDecoration: "none" }}
        >
          {t("YÖNETİM")}
        </a>
      )}
      {/* hesap: arayüzde klasik yeri olan sağ üst köşe.
          Mobilde bu kopya gizli — orada GİRİŞ, sabit arama çubuğunun sağında
          duruyor (App.tsx .mobile-search-sticky). */}
      <AccountButton className="topbar-account" />
      {/* tema ve dil anahtarı: sadece mobilde bu satırda görünür (masaüstünde sidebar'da) */}
      <div className="topbar-lang">
        <LangToggle />
      </div>
      <div className="topbar-theme">
        <ThemeToggle />
      </div>
    </header>
  );
}
