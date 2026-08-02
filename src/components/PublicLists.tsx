"use client";
import { useEffect } from "react";
import { useStore } from "@/store";
import { ProductImage } from "./ProductImage";
import type { PublicListView } from "@/lib/public-lists-client";
import { useT } from "@/lib/lang";

/**
 * HERKESE AÇIK LİSTELER — vitrinin ikinci sekmesi.
 *
 * Dil, liste sergileyen uygulamalardan alındı (Letterboxd listeleri, Pinterest panoları):
 * kart = KAPAK KOLAJI + ad + kim yaptı + kaç parça. Tek tek ürün göstermiyoruz, çünkü
 * burada satılan şey ürün değil SEÇKİ — kolaj o seçkinin tonunu tek bakışta veriyor.
 *
 * Kapak görselleri yayında saklanıyor (bkz. lib/public-lists.ts): katalog değişse,
 * ürün kaybolsa bile kart çizilebilsin.
 */

function CoverCollage({ covers }: { covers: string[] }) {
  const t = useT();
  const cells = covers.slice(0, 4);
  // Tek görselli listede kolaj kurmak yerine tam kare: 2x2'de üç boş kutu kötü duruyor.
  const single = cells.length === 1;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: single ? "1fr" : "1fr 1fr",
        gridTemplateRows: single ? "1fr" : "1fr 1fr",
        gap: 2,
        aspectRatio: "1 / 1",
        background: "var(--line4)",
        border: "1px solid var(--line3)",
        overflow: "hidden",
      }}
    >
      {cells.map((src, i) => (
        <div key={i} style={{ position: "relative", overflow: "hidden", minHeight: 0 }}>
          <ProductImage src={src} w={320} sizes="(max-width: 700px) 46vw, 15vw" label="" />
        </div>
      ))}
      {!cells.length && (
        <div
          style={{
            gridColumn: "1 / -1",
            gridRow: "1 / -1",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'Space Mono', monospace",
            fontSize: 12,
            letterSpacing: ".18em",
            color: "var(--muted3)",
          }}
        >
          {t("GÖRSEL YOK")}
        </div>
      )}
    </div>
  );
}

function ListCard({ l, onOpen }: { l: PublicListView; onOpen: () => void }) {
  const t = useT();
  return (
    <div className="nav-item" onClick={onOpen} style={{ cursor: "pointer" }}>
      <CoverCollage covers={l.covers} />
      <div style={{ padding: "12px 2px 0" }}>
        <div
          style={{
            fontFamily: "'Anton', sans-serif",
            fontSize: 22,
            letterSpacing: ".02em",
            color: "var(--fg-bright)",
            textTransform: "uppercase",
            lineHeight: 1.15,
          }}
        >
          {l.name}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 7,
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 12,
            letterSpacing: ".04em",
            color: "var(--muted)",
          }}
        >
          <span style={{ color: "var(--grn)" }}>@{l.nick}</span>
          <span style={{ color: "var(--muted3)" }}>·</span>
          <span>{l.ids.length} {t("parça")}</span>
          {l.views > 0 && (
            <>
              <span style={{ color: "var(--muted3)" }}>·</span>
              <span>{l.views} {t("bakış")}</span>
            </>
          )}
          {l.mine && (
            <span
              style={{
                marginLeft: "auto",
                fontFamily: "'Space Mono', monospace",
                fontSize: 10,
                letterSpacing: ".14em",
                color: "var(--grn)",
                border: "1px solid var(--grn)",
                padding: "2px 6px",
              }}
            >
              {t("SENİN")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function PublicLists() {
  const items = useStore((s) => s.publicLists);
  const loading = useStore((s) => s.publicLoading);
  const sort = useStore((s) => s.publicSort);
  const load = useStore((s) => s.loadPublicLists);
  const openPublicList = useStore((s) => s.openPublicList);
  const t = useT();

  useEffect(() => {
    if (!items.length && !loading) void load();
    // yalnız ilk montajda: sekme değişimi store'da tetikleniyor
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
        <span
          style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: 12,
            letterSpacing: ".22em",
            color: "var(--faint)",
          }}
        >
          {t("SIRALA")}
        </span>
        {(["yeni", "populer"] as const).map((k) => (
          <span
            key={k}
            className="nav-item"
            onClick={() => void load(k)}
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 13,
              letterSpacing: ".08em",
              textTransform: "uppercase",
              color: sort === k ? "var(--on-accent)" : "var(--muted)",
              background: sort === k ? "var(--grn)" : "transparent",
              border: `1px solid ${sort === k ? "var(--grn)" : "var(--line)"}`,
              padding: "6px 12px",
            }}
          >
            {k === "yeni" ? t("YENİ") : t("POPÜLER")}
          </span>
        ))}
      </div>

      {loading && (
        <div
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 14,
            color: "var(--muted3)",
            padding: "40px 0",
          }}
        >
          {t("yükleniyor…")}
        </div>
      )}

      {!loading && !items.length && (
        <div
          style={{
            padding: "64px 20px",
            border: "1px dashed var(--line2)",
            borderRadius: 20,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: "'Anton', sans-serif",
              fontSize: 35,
              color: "var(--muted3)",
              textTransform: "uppercase",
            }}
          >
            {t("henüz kimse yayınlamadı")}
          </div>
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 14,
              color: "var(--muted3)",
              marginTop: 10,
            }}
          >
            {t("kendi listeni kur, LİSTELERİM sekmesinden “herkese aç” de — ilk sen ol.")}
          </div>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div
          className="public-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 26,
          }}
        >
          {items.map((l) => (
            <ListCard key={l.id} l={l} onOpen={() => void openPublicList(l.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
