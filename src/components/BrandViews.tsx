"use client";
import { useEffect, useState } from "react";
import type { BrandIndexRow, BrandPageData } from "@/lib/brand-page-shared";
import type { NavCat } from "@/lib/types";
import { DEFAULT_QUERY } from "@/lib/query";
import { useStore } from "@/store";
import { BrandIndex } from "./BrandIndex";
import { BrandPage } from "./BrandPage";
import { LoadingOverlay } from "./LoadingOverlay";
import { LoadingSpinner } from "./LoadingSpinner";
import { useDelayedFlag } from "@/lib/use-delayed-flag";
import { useT } from "@/lib/lang";

/**
 * MARKALAR ve MARKA — vitrinin İÇİNDEKİ sekmeler.
 *
 * Eskiden sol menüdeki MARKALAR gerçek bir sayfa yüklemesiydi (`/markalar`), oradan
 * markaya girmek ikinci bir yükleme. Kullanıcı kategori değiştirir gibi geçmek istiyor:
 * artık ikisi de sekme. Ekranların kendisi (BrandIndex / BrandPage) `/markalar` ve
 * `/<slug>` sayfalarıyla ORTAK — tek fark, buradan handler'lar veriliyor.
 *
 * Veri `/api/marka`dan geliyor ve bir kez alınıp modül seviyesinde tutuluyor: sekmeler
 * arasında gidip gelmek her seferinde ağa çıkmasın.
 */

let indexCache: BrandIndexRow[] | null = null;
const pageCache = new Map<string, BrandPageData>();

const Loading = () => {
  const t = useT();
  // `fixed` + `inset:0`: bu an ekranda başka içerik YOK (markanın/rehberin eskisi
  // henüz sökülmüş, yenisi gelmedi) — halka, sol menünün genişliğinden ya da
  // sayfanın nerede olduğundan bağımsız, EKRANIN tam ortasında dursun istiyoruz.
  // Aynı kural mobilde de geçerli: viewport'un ortası, sidebar'ın olup olmamasından
  // etkilenmez.
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 45,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <LoadingSpinner size={40} label={t("yükleniyor…")} />
    </div>
  );
};

const Empty = ({ text }: { text: string }) => {
  const t = useT();
  return (
    <div style={{ padding: "80px 20px", textAlign: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: "var(--muted3)" }}>
      {t(text)}
    </div>
  );
};

/** Sekmenin üstündeki yol izi — sayfalardaki crumb'ın uygulama içi karşılığı. */
function Crumb({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: ".24em", color: "var(--faint)", margin: "4px 0 6px" }}>
      {children}
    </div>
  );
}

export function BrandIndexView() {
  const openMarka = useStore((s) => s.openMarka);
  const [rows, setRows] = useState<BrandIndexRow[] | null>(indexCache);
  // Yüklenme YARIM SANİYEDEN KISA sürerse halka hiç görünmez — çoğu zaman
  // önbellekten ya da yerel ağdan anında gelen veri için boş bir göz kırpması
  // yerine, gerçekten beklenecek bir şey varsa (>500ms) devreye girer.
  const showLoading = useDelayedFlag(!rows);

  useEffect(() => {
    if (indexCache) return;
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/marka");
        const data = (await res.json()) as { rows: BrandIndexRow[] };
        indexCache = data.rows ?? [];
        if (alive) setRows(indexCache);
      } catch {
        if (alive) setRows([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!rows) return showLoading ? <Loading /> : null;
  if (!rows.length) return <Empty text="marka listesi alınamadı." />;

  return (
    <>
      <Crumb>ALTR / MARKALAR</Crumb>
      <BrandIndex rows={rows} onOpen={openMarka} />
    </>
  );
}

export function BrandPageView({ slug }: { slug: string }) {
  const openMarkalar = useStore((s) => s.openMarkalar);
  const setView = useStore((s) => s.setView);
  const setQuery = useStore((s) => s.setQuery);
  const openDetail = useStore((s) => s.openDetail);
  const t = useT();

  const [page, setPage] = useState(1);
  const key = `${slug}|${page}`;
  const [data, setData] = useState<BrandPageData | null | "yok">(pageCache.get(key) ?? null);
  // Yeni sayfa/marka ağdan gelirken true — bkz. aşağıdaki `shown` mantığı.
  const [pending, setPending] = useState(false);

  // Başka bir markaya geçildiğinde sayfa 1'e dönmeli, yoksa 3. sayfada duran biri
  // yeni markanın 3. sayfasında açılır.
  useEffect(() => {
    setPage(1);
  }, [slug]);

  useEffect(() => {
    const cached = pageCache.get(key);
    if (cached) {
      setData(cached);
      setPending(false);
      return;
    }
    let alive = true;
    setPending(true);
    void (async () => {
      try {
        const res = await fetch(`/api/marka?slug=${encodeURIComponent(slug)}&sayfa=${page}`);
        if (!res.ok) {
          if (alive) {
            setData("yok");
            setPending(false);
          }
          return;
        }
        const d = (await res.json()) as BrandPageData;
        pageCache.set(key, d);
        if (alive) {
          setData(d);
          setPending(false);
        }
      } catch {
        if (alive) {
          setData("yok");
          setPending(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [key, slug, page]);

  // `data` HÂLÂ ÖNCEKİ MARKAYA aitse (marka değişti, yenisi henüz gelmedi) gösterecek
  // eski bir ızgara yok — tam ekran yükleniyor durumu gerekir. Aynı markanın başka
  // bir SAYFASI yükleniyorsa (`pending`) elimizdeki veri hâlâ geçerli: hero, kategori
  // çipleri ve ızgara YERİNDE KALIR, üstüne yalnız ince bir overlay biner (aşağıda).
  const shown = data && typeof data === "object" && data.brand.slug === slug ? data : null;
  // "yok" (bulunamadı) kesin bir sonuç — o zaman gecikmesiz Empty gösterilir, halka
  // hiç devreye girmez. Halka yalnız GERÇEKTEN beklenen (>500ms) durumlarda çıksın.
  const showFullLoading = useDelayedFlag(data !== "yok" && !shown);
  const showPageOverlay = useDelayedFlag(pending);

  if (data === "yok") return <Empty text="bu marka vitrinde bulunamadı." />;
  if (!shown) return showFullLoading ? <Loading /> : null;

  /** Vitrine dönüp markayı filtre olarak uygula. */
  const filter = (cat?: string) => {
    setView("grid");
    setQuery({
      brands: [shown.brand.name],
      cat: (cat as NavCat) ?? DEFAULT_QUERY.cat,
    });
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  return (
    <>
      <Crumb>
        <span className="nav-item" onClick={openMarkalar} style={{ color: "var(--muted3)" }}>
          ALTR / MARKALAR
        </span>
        {/* Marka adlarında DÜZ büyütme: Türkçe kural "Studio"yu "STUDİO" yapıyor. */}
        {` / ${shown.brand.name.toUpperCase()}`}
      </Crumb>
      {showPageOverlay && <LoadingOverlay label={t("yükleniyor…")} />}
      <BrandPage
        data={shown}
        page={page}
        handlers={{
          onIndex: openMarkalar,
          onPage: (n) => {
            setPage(n);
            window.scrollTo({ top: 0, behavior: "auto" });
          },
          onStyle: (s) => {
            setView("grid");
            setQuery({ styles: [s] });
            window.scrollTo({ top: 0, behavior: "auto" });
          },
          onFilter: filter,
          onOpenProduct: (items, i) => openDetail(items, i),
        }}
      />
    </>
  );
}
