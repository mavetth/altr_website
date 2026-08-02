"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/store";
import type { StatsSummary } from "@/lib/events";

/**
 * ADMİN — DAVRANIŞ İSTATİSTİKLERİ.
 *
 * İki ölçü var ve panelin tamamı bu ikisinin YAN YANA okunması üzerine kurulu:
 *   GÖRÜNTÜLENME = ürün kartına tıklanıp modalın açılması
 *   ÇIKIŞ        = oradan markanın sitesine gidilmesi
 * Tek başına "kaç tıklama" bir şey söylemiyor; asıl bilgi ikisinin ORANI (dönüşüm).
 * Bu yüzden her kırılımda iki çubuk yan yana duruyor, hiçbir yerde tek seri yok.
 *
 * Grafikler kütüphanesiz, düz SVG: paket 0 KB büyümüyor ve site zaten sert/ham bir
 * çizim diline sahip. Renkler iki kategorik seride ayrışacak şekilde seçildi ve
 * renk körlüğü ayrımı ölçülerek doğrulandı (bkz. globals.css --stat-1/--stat-2);
 * kimlik yalnız renge bırakılmadı — açıklama şeridi ve sayı etiketleri hep var.
 */
const RANGES = [7, 30, 90] as const;

export function StatsPanel() {
  const me = useStore((s) => s.me);
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<StatsSummary | null>(null);
  const [state, setState] = useState<"yukleniyor" | "hazir" | "hata">("yukleniyor");

  useEffect(() => {
    let alive = true;
    setState("yukleniyor");
    fetch(`/api/stats?days=${days}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: StatsSummary) => {
        if (!alive) return;
        setData(d);
        setState("hazir");
      })
      .catch(() => alive && setState("hata"));
    return () => {
      alive = false;
    };
  }, [days]);

  // Yetki sunucuda; buradaki kontrol yalnız arayüzün boşuna çizilmemesi için.
  if (me?.role !== "admin") {
    return <Empty title="BU SAYFA SANA KAPALI" note="İstatistikler yalnızca admin hesabında görünür." />;
  }

  return (
    <section style={{ padding: "10px 0 40px" }}>
      <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 16, marginBottom: 6 }}>
        <h1 className="glitch-head" style={{ fontFamily: "'Anton', sans-serif", fontSize: 44, letterSpacing: ".02em", color: "var(--fg-bright)", margin: 0, textTransform: "uppercase" }}>
          İstatistikler
        </h1>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, letterSpacing: ".12em", color: "var(--muted3)" }}>
          ÜRÜN MODALI AÇILIŞLARI VE MAĞAZAYA YÖNLENDİRMELER
        </span>
      </div>

      <div style={{ display: "flex", gap: 8, margin: "18px 0 8px" }}>
        {RANGES.map((r) => (
          <span
            key={r}
            className="fbox"
            onClick={() => setDays(r)}
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 13,
              letterSpacing: ".08em",
              padding: "8px 14px",
              border: `1px solid ${days === r ? "var(--grn)" : "var(--line)"}`,
              background: days === r ? "var(--grn)" : "transparent",
              color: days === r ? "var(--on-accent)" : "var(--muted)",
            }}
          >
            SON {r} GÜN
          </span>
        ))}
      </div>

      <Dot />

      {/* Aralık değiştirilince panel BOŞALMIYOR: eldeki tablo yerinde kalıp soluyor.
          Her tazelemede yükleme ekranına düşmek grafiklerin yerini oynatıyor ve
          "veri gitti mi" hissi veriyor. Boş ekran yalnız İLK yüklemede var. */}
      {state === "yukleniyor" && !data && <Empty title="YÜKLENİYOR" note="Olay günlükleri okunuyor." />}
      {state === "hata" && <Empty title="OKUNAMADI" note="İstatistik ucu cevap vermedi. Oturumun hâlâ açık mı?" />}

      {state !== "hata" && data && (
        <div style={{ opacity: state === "yukleniyor" ? 0.5 : 1 }}>
          <Tiles d={data} />
          <Dot />
          <Legend />

          <Block
            title="GÜN GÜN"
            note={`${data.days} günlük pencere · veri bulunan gün: ${data.daysWithData}`}
          >
            <VBars
              label="Gün gün"
              rows={data.daily.map((r) => ({
                key: r.day,
                label: r.day.slice(5).replace("-", "."),
                view: r.view,
                out: r.out,
              }))}
            />
          </Block>

          <Block title="GÜNÜN SAATİNE GÖRE" note="sunucu saati (UTC) · hangi saatte vitrine bakılıyor">
            <VBars
              label="Günün saatine göre"
              rows={data.hourly.map((r) => ({
                key: String(r.hour),
                label: String(r.hour).padStart(2, "0"),
                view: r.view,
                out: r.out,
              }))}
            />
          </Block>

          <Block title="MARKAYA GÖRE" note="en çok ilgi gören 20 marka">
            <HBars rows={data.byBrand.map((b) => ({ key: b.brandSlug, label: b.brand, view: b.view, out: b.out }))} />
          </Block>

          <Block title="KATEGORİYE GÖRE" note="hangi kova gerçekten çalışıyor">
            <HBars rows={data.byCategory.map((c) => ({ key: c.category, label: c.category, view: c.view, out: c.out }))} />
          </Block>

          <Block title="ÜRÜN ÜRÜN" note="en çok açılan 20 ürün · dönüşüm = çıkış / görüntülenme">
            <ProductTable rows={data.byProduct} />
          </Block>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------- parçalar --- */

const MONO = "'IBM Plex Mono', monospace";
const HEADFONT = "'Space Mono', monospace";

function Dot() {
  return (
    <div
      style={{
        width: "100%",
        height: 1,
        margin: "22px 0",
        background: "repeating-linear-gradient(90deg,var(--line2) 0 6px,transparent 6px 12px)",
      }}
    />
  );
}

function Empty({ title, note }: { title: string; note: string }) {
  return (
    <div style={{ padding: "60px 0", textAlign: "center" }}>
      <div className="empty-big" style={{ fontFamily: "'Anton', sans-serif", fontSize: 44, color: "var(--faint)", textTransform: "uppercase" }}>
        {title}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 13, color: "var(--muted3)", marginTop: 10 }}>{note}</div>
    </div>
  );
}

function Block({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 34 }}>
      <div style={{ fontFamily: HEADFONT, fontSize: 12, letterSpacing: ".26em", color: "var(--faint)" }}>{title}</div>
      {note && (
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".06em", color: "var(--muted3)", marginTop: 5 }}>{note}</div>
      )}
      <div style={{ marginTop: 14 }}>{children}</div>
    </div>
  );
}

/** İki serinin kimliği renge BIRAKILMAZ: açıklama şeridi her zaman çizilir. */
function Legend() {
  return (
    <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontFamily: MONO, fontSize: 12, letterSpacing: ".08em", color: "var(--muted2)" }}>
      <Key color="var(--stat-1)" label="GÖRÜNTÜLENME (modal açıldı)" />
      <Key color="var(--stat-2)" label="ÇIKIŞ (mağazaya gidildi)" />
    </div>
  );
}

function Key({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 14, height: 10, background: color, flex: "none" }} aria-hidden />
      {label}
    </span>
  );
}

function Tiles({ d }: { d: StatsSummary }) {
  const pct = (d.totals.ctr * 100).toFixed(1).replace(".", ",");
  /**
   * Çıkış görüntülenmeden ÇOK olamaz — mağazaya gitmek için önce ürünü açmak
   * gerekiyor. Böyle bir sayı görüyorsak paydanın bir kısmı ölçülmemiş demektir:
   * çıkış ölçümü 2026-07-25'te, görüntülenme ölçümü 2026-07-28'de başladı, yani
   * eski günlerde çıkış var ama görüntülenme yok. Oranı sessizce göstermek yalan
   * olurdu; sayıyı gizlemek de bilgiyi saklamak olurdu — ikisini de yapmıyoruz.
   */
  const bozuk = d.totals.out > d.totals.view;
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginTop: 20 }}>
        <Tile n={d.totals.view} label="GÖRÜNTÜLENME" accent="var(--stat-1)" />
        <Tile n={d.totals.out} label="ÇIKIŞ" accent="var(--stat-2)" />
        <Tile
          text={bozuk ? "—" : `%${pct}`}
          label="DÖNÜŞÜM"
          note={bozuk ? "payda eksik" : `${d.totals.out} / ${d.totals.view}`}
        />
        <Tile n={d.totals.sessions} label="OTURUM" note="anonim işaret" />
        <Tile n={d.totals.outProduct} label="ÜRÜN SAYFASINA" note={`marka vitrinine: ${d.totals.outBrand}`} />
      </div>
      {bozuk && (
        <div style={{ fontFamily: MONO, fontSize: 11, lineHeight: 1.6, color: "var(--muted3)", marginTop: 10 }}>
          Bu pencerede çıkış sayısı görüntülenmeden fazla: görüntülenme ölçümü çıkış
          ölçümünden SONRA açıldı, yani eski günlerin paydası yok. Dönüşüm oranı iki
          ölçüm de çalıştığı günler birikince anlamlı olacak.
        </div>
      )}
    </>
  );
}

function Tile({ n, text, label, note, accent }: { n?: number; text?: string; label: string; note?: string; accent?: string }) {
  return (
    <div style={{ border: "1px solid var(--line)", background: "var(--bg2)", padding: "16px 16px 14px" }}>
      <div style={{ fontFamily: "'Anton', sans-serif", fontSize: 34, lineHeight: 1, color: accent ?? "var(--fg-bright)" }}>
        {text ?? (n ?? 0).toLocaleString("tr-TR")}
      </div>
      <div style={{ fontFamily: HEADFONT, fontSize: 11, letterSpacing: ".2em", color: "var(--muted2)", marginTop: 10 }}>{label}</div>
      {note && <div style={{ fontFamily: MONO, fontSize: 11, color: "var(--faint)", marginTop: 4 }}>{note}</div>}
    </div>
  );
}

interface Row {
  key: string;
  label: string;
  view: number;
  out: number;
}

/**
 * DİKEY ikili çubuk — zaman ekseni (gün / saat).
 *
 * Çizgi değil çubuk: günlerin çoğu 0 olabiliyor ve çizgi grafiği o boşlukları
 * "aradaki değerler" gibi gösterip olmayan bir trend uyduruyor. Çubuk yalnız
 * ölçülen kovayı gösterir. İki seri yan yana (üst üste değil): amaç toplamı değil
 * ORANI okumak. Sayı etiketi yalnız EN YÜKSEK sütunda — her sütuna sayı yazmak
 * grafiği tabloya çevirirdi.
 */
function VBars({ rows, label }: { rows: Row[]; label: string }) {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.view, r.out)));
  const slot = 26;
  const barW = 9;
  const gap = 2; // iki seri arasında zemin boşluğu
  const H = 150;
  const padB = 22;
  const plot = H - padB - 6;
  const W = Math.max(rows.length * slot, 120);
  // Etiket kalabalığı: 30+ kova varken her etiket sığmaz, seyrelt.
  const every = rows.length > 24 ? 4 : rows.length > 14 ? 2 : 1;
  const peak = rows.reduce((a, b) => (Math.max(b.view, b.out) > Math.max(a.view, a.out) ? b : a), rows[0]);

  if (!rows.length) return <NoData />;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      preserveAspectRatio="xMinYMid meet"
      role="img"
      aria-label={`${label} — görüntülenme ve çıkış, en yüksek ${max}`}
      style={{ display: "block", overflow: "visible" }}
    >
      {/* taban çizgisi — tek eksen, ızgara yok: iki seri de aynı ölçekte */}
      <line x1={0} y1={H - padB} x2={W} y2={H - padB} stroke="var(--line)" strokeWidth="1" />
      {rows.map((r, i) => {
        const x = i * slot + (slot - (barW * 2 + gap)) / 2;
        const hv = (r.view / max) * plot;
        const ho = (r.out / max) * plot;
        const isPeak = peak && r.key === peak.key && max > 0;
        return (
          <g key={r.key}>
            <title>{`${r.label} — görüntülenme ${r.view} · çıkış ${r.out}`}</title>
            {/* tıklama/hover alanı çubuktan geniş: 9px'lik bir çubuğu yakalamak zor */}
            <rect x={i * slot} y={0} width={slot} height={H - padB} fill="transparent" />
            <rect x={x} y={H - padB - hv} width={barW} height={hv} rx={2} fill="var(--stat-1)" />
            <rect x={x + barW + gap} y={H - padB - ho} width={barW} height={ho} rx={2} fill="var(--stat-2)" />
            {isPeak && (
              <text x={i * slot + slot / 2} y={H - padB - Math.max(hv, ho) - 5} textAnchor="middle" fontSize="9" fontFamily={MONO} fill="var(--muted)">
                {Math.max(r.view, r.out)}
              </text>
            )}
            {i % every === 0 && (
              <text x={i * slot + slot / 2} y={H - padB + 13} textAnchor="middle" fontSize="9" fontFamily={MONO} fill="var(--faint)">
                {r.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * YATAY ikili çubuk — sıralı kırılımlar (marka, kategori). Etiketler uzun ve
 * okunabilir olmalı, o yüzden yatay; sayılar doğrudan çubuğun ucunda.
 */
function HBars({ rows }: { rows: Row[] }) {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.view, r.out)));
  if (!rows.length) return <NoData />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {rows.map((r) => (
        <div key={r.key} style={{ display: "grid", gridTemplateColumns: "minmax(90px,150px) minmax(0,1fr)", gap: 12, alignItems: "center" }}>
          <span
            title={r.label}
            style={{ fontFamily: MONO, fontSize: 12, letterSpacing: ".04em", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {r.label}
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Track value={r.view} max={max} color="var(--stat-1)" title={`${r.label} — görüntülenme`} />
            <Track value={r.out} max={max} color="var(--stat-2)" title={`${r.label} — çıkış`} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Track({ value, max, color, title }: { value: number; max: number; color: string; title: string }) {
  const pct = (value / max) * 100;
  return (
    <div title={`${title}: ${value}`} style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <div style={{ flex: 1, height: 9, background: "var(--line4)", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, width: `${pct}%`, background: color, borderRadius: "0 2px 2px 0" }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--muted2)", minWidth: 34, textAlign: "right" }}>{value}</span>
    </div>
  );
}

/** Tablo görünümü: grafiğin okunamadığı durumda aynı veri sayı sayı burada. */
function ProductTable({ rows }: { rows: StatsSummary["byProduct"] }) {
  if (!rows.length) return <NoData />;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: MONO, fontSize: 12 }}>
        <thead>
          <tr style={{ color: "var(--faint)", textAlign: "left" }}>
            <Th>ÜRÜN</Th>
            <Th>MARKA</Th>
            <Th align="right">GÖRÜNTÜLENME</Th>
            <Th align="right">ÇIKIŞ</Th>
            <Th align="right">DÖNÜŞÜM</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.productId} style={{ borderTop: "1px solid var(--line4)" }}>
              <Td>{r.productName || r.productId}</Td>
              <Td muted>{r.brand}</Td>
              <Td align="right">{r.view}</Td>
              <Td align="right">{r.out}</Td>
              <Td align="right" muted>
                {r.view ? `%${((r.out / r.view) * 100).toFixed(0)}` : "—"}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th style={{ padding: "0 10px 8px 0", textAlign: align, fontWeight: 400, letterSpacing: ".12em", fontSize: 10 }}>{children}</th>
  );
}

function Td({ children, align = "left", muted }: { children: React.ReactNode; align?: "left" | "right"; muted?: boolean }) {
  return (
    <td style={{ padding: "9px 10px 9px 0", textAlign: align, color: muted ? "var(--muted3)" : "var(--fg)", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      {children}
    </td>
  );
}

function NoData() {
  return (
    <div style={{ fontFamily: MONO, fontSize: 12, color: "var(--faint)", padding: "18px 0" }}>
      bu pencerede kayıt yok
    </div>
  );
}
