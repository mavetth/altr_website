"use client";
import { useEffect, useState } from "react";
import type { BrandIndexRow, BrandPageData } from "@/lib/brand-page-shared";
import type { NavCat } from "@/lib/types";
import { DEFAULT_QUERY } from "@/lib/query";
import { useStore } from "@/store";
import { BrandIndex } from "./BrandIndex";
import { BrandPage } from "./BrandPage";
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
  return (
    <div style={{ padding: "80px 20px", textAlign: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: "var(--faint)" }}>
      {t("yükleniyor…")}
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

  if (!rows) return <Loading />;
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

  const [page, setPage] = useState(1);
  const key = `${slug}|${page}`;
  const [data, setData] = useState<BrandPageData | null | "yok">(pageCache.get(key) ?? null);

  // Başka bir markaya geçildiğinde sayfa 1'e dönmeli, yoksa 3. sayfada duran biri
  // yeni markanın 3. sayfasında açılır.
  useEffect(() => {
    setPage(1);
  }, [slug]);

  useEffect(() => {
    const cached = pageCache.get(key);
    if (cached) {
      setData(cached);
      return;
    }
    let alive = true;
    setData(null);
    void (async () => {
      try {
        const res = await fetch(`/api/marka?slug=${encodeURIComponent(slug)}&sayfa=${page}`);
        if (!res.ok) {
          if (alive) setData("yok");
          return;
        }
        const d = (await res.json()) as BrandPageData;
        pageCache.set(key, d);
        if (alive) setData(d);
      } catch {
        if (alive) setData("yok");
      }
    })();
    return () => {
      alive = false;
    };
  }, [key, slug, page]);

  if (data === "yok") return <Empty text="bu marka vitrinde bulunamadı." />;
  if (!data) return <Loading />;

  /** Vitrine dönüp markayı filtre olarak uygula. */
  const filter = (cat?: string) => {
    setView("grid");
    setQuery({
      brands: [data.brand.name],
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
        {` / ${data.brand.name.toUpperCase()}`}
      </Crumb>
      <BrandPage
        data={data}
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
