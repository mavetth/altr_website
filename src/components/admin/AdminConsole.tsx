"use client";
import { useEffect, useMemo, useState } from "react";
import {
  TOPICS,
  attachmentUrl,
  deleteFeedback,
  fetchFeedback,
  setFeedbackRead,
  type FeedbackItem,
  type FeedbackPage,
  type Topic,
} from "@/lib/feedback-client";

/**
 * YÖNETİM KONSOLU — vitrinden bağımsız arayüz (bkz. app/yonetim/page.tsx).
 *
 * Tasarım referansı tarayıcı geliştirici araçları. Somut karşılıkları:
 *   · tek monospace aile, 12–13px — satır yüksekliği düşük, ekrana çok kayıt sığar
 *   · sol sekme sütunu + sabit üst şerit; içerik alanı tek kaydırma bölgesi
 *   · liste/detay bölmesi: solda kayıtlar, sağda seçili kaydın tamamı
 *   · renk bir SÜS değil bir DURUM: okunmamış (vurgu), silme (uyarı), geri kalan nötr
 *   · animasyon yok — burada beklemek değil, iş yapmak var
 *
 * Vitrinin CSS değişkenlerini kullanmıyor: onlar temaya göre değişiyor ve bu ekranın
 * temayla bir işi yok. Renkler burada sabit ve koyu.
 */

const MONO = "ui-monospace, 'IBM Plex Mono', 'Cascadia Code', Consolas, monospace";

/** Konsolun kendi paleti — vitrinin `--` değişkenlerinden bilerek bağımsız. */
const C = {
  bg: "#0b0d10",
  panel: "#12151a",
  panel2: "#171b21",
  line: "#232830",
  line2: "#2e353f",
  fg: "#d7dde5",
  dim: "#8b95a3",
  faint: "#5b6472",
  accent: "#6ee7a8",
  warn: "#ffb454",
  danger: "#ff6b6b",
  link: "#7cc4ff",
};

const TOPIC_LABEL: Record<Topic, string> = {
  "marka-oner": "MARKA ÖNER",
  "geri-bildirim": "GERİ BİLDİRİM",
  "marka-kaldir": "MARKA KALDIR",
  diger: "DİĞER",
};

type Tab = "kutu" | "olcum" | "teshis";

export function AdminConsole({ nick }: { nick: string }) {
  const [tab, setTab] = useState<Tab>("kutu");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        gridTemplateRows: "38px 1fr",
        gridTemplateColumns: "148px 1fr",
        gridTemplateAreas: `"bar bar" "nav main"`,
        background: C.bg,
        color: C.fg,
        fontFamily: MONO,
        fontSize: 13,
      }}
    >
      {/* --- üst şerit ------------------------------------------------------ */}
      <header
        style={{
          gridArea: "bar",
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "0 14px",
          borderBottom: `1px solid ${C.line}`,
          background: C.panel,
        }}
      >
        <span style={{ color: C.accent, fontWeight: 700, letterSpacing: ".14em" }}>altr</span>
        <span style={{ color: C.faint }}>yönetim konsolu</span>
        <span style={{ marginLeft: "auto", color: C.dim }}>{nick}</span>
        {/* Vitrine dönüş: konsol ayrı bir yol, geri tuşuna güvenmemek gerek. */}
        <a href="/" style={{ color: C.link, textDecoration: "none" }}>
          ← vitrin
        </a>
      </header>

      {/* --- sol sekmeler ---------------------------------------------------- */}
      <nav
        style={{
          gridArea: "nav",
          borderRight: `1px solid ${C.line}`,
          background: C.panel,
          paddingTop: 6,
        }}
      >
        {(
          [
            ["kutu", "KUTU"],
            ["olcum", "ÖLÇÜM"],
            ["teshis", "TEŞHİS"],
          ] as Array<[Tab, string]>
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "8px 14px",
              border: "none",
              borderLeft: `2px solid ${tab === k ? C.accent : "transparent"}`,
              background: tab === k ? C.panel2 : "transparent",
              color: tab === k ? C.fg : C.dim,
              fontFamily: MONO,
              fontSize: 12,
              letterSpacing: ".1em",
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      <main style={{ gridArea: "main", overflow: "hidden", display: "flex", minWidth: 0 }}>
        {tab === "kutu" && <Kutu />}
        {tab === "olcum" && <Olcum />}
        {tab === "teshis" && <Teshis />}
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------- kutu -- */

/**
 * Gelen kutusu — liste + detay.
 *
 * Eski panel her kaydı tam metniyle alt alta çiziyordu; 40 kayıtta ekran okunmaz
 * oluyordu. Burada sol sütun taranabilir tek satırlık kayıtlar, sağ bölme seçili
 * kaydın TAMAMI (ekleri dahil).
 */
function Kutu() {
  const [page, setPage] = useState<FeedbackPage | null>(null);
  const [topic, setTopic] = useState<Topic | "">("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      const p = await fetchFeedback({ topic, unreadOnly, limit: 200 });
      setPage(p);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "okunamadı");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic, unreadOnly]);

  const items = page?.items ?? [];
  const current = useMemo(() => items.find((x) => x.id === selected) ?? null, [items, selected]);

  /** Kaydı açınca okundu işaretle — ayrı bir düğmeye basmak gereksiz bir adım. */
  const open = async (it: FeedbackItem) => {
    setSelected(it.id);
    if (!it.read) {
      await setFeedbackRead(it.id, true);
      setPage((p) =>
        p
          ? {
              ...p,
              items: p.items.map((x) => (x.id === it.id ? { ...x, read: true } : x)),
              unread: { ...p.unread, hepsi: Math.max(0, p.unread.hepsi - 1) },
            }
          : p,
      );
    }
  };

  const sil = async (id: string) => {
    // Geri alınamaz ve ekleri de siler — onay şart.
    if (!window.confirm("Bu kayıt ve ekleri kalıcı olarak silinsin mi?")) return;
    await deleteFeedback(id);
    if (selected === id) setSelected(null);
    void load();
  };

  return (
    <>
      {/* liste */}
      <section
        style={{
          width: 420,
          minWidth: 280,
          borderRight: `1px solid ${C.line}`,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            padding: "7px 10px",
            borderBottom: `1px solid ${C.line}`,
            background: C.panel,
            fontSize: 11,
          }}
        >
          <Select
            value={topic}
            onChange={(v) => setTopic(v as Topic | "")}
            options={[["", "hepsi"], ...TOPICS.map((t) => [t, TOPIC_LABEL[t]] as [string, string])]}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 5, color: C.dim, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
              style={{ accentColor: C.accent }}
            />
            okunmamış
          </label>
          <button onClick={() => void load()} style={btn()} disabled={busy}>
            {busy ? "…" : "yenile"}
          </button>
          <span style={{ marginLeft: "auto", color: C.faint }}>
            {items.length}
            {page?.unread.hepsi ? (
              <span style={{ color: C.accent }}> · {page.unread.hepsi} yeni</span>
            ) : null}
          </span>
        </div>

        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {err && <div style={{ padding: 12, color: C.danger }}>{err}</div>}
          {!err && !items.length && !busy && (
            <div style={{ padding: 12, color: C.faint }}>kayıt yok</div>
          )}
          {items.map((it) => (
            <button
              key={it.id}
              onClick={() => void open(it)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "7px 10px",
                border: "none",
                borderBottom: `1px solid ${C.line}`,
                borderLeft: `2px solid ${selected === it.id ? C.accent : "transparent"}`,
                background: selected === it.id ? C.panel2 : "transparent",
                color: C.fg,
                fontFamily: MONO,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {/* Okunmamış işareti: renkli nokta. Kalın yazı yerine nokta, çünkü
                    satırın kendisi zaten yoğun. */}
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    flex: "none",
                    background: it.read ? "transparent" : C.accent,
                    border: it.read ? `1px solid ${C.line2}` : "none",
                  }}
                />
                <span style={{ color: C.dim, fontSize: 10, letterSpacing: ".08em" }}>
                  {TOPIC_LABEL[it.topic]}
                </span>
                {it.attachments?.length ? (
                  <span style={{ color: C.warn, fontSize: 10 }}>◫{it.attachments.length}</span>
                ) : null}
                <span style={{ marginLeft: "auto", color: C.faint, fontSize: 10 }}>
                  {kisaTarih(it.createdAt)}
                </span>
              </div>
              <div
                style={{
                  marginTop: 3,
                  color: C.fg,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {it.brand ? <span style={{ color: C.link }}>{it.brand} </span> : null}
                {it.text || <span style={{ color: C.faint }}>(metin yok)</span>}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* detay */}
      <section style={{ flex: 1, overflowY: "auto", padding: 16, minWidth: 0 }}>
        {!current ? (
          <div style={{ color: C.faint }}>soldan bir kayıt seç</div>
        ) : (
          <article style={{ maxWidth: 760 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ color: C.accent, letterSpacing: ".1em" }}>{TOPIC_LABEL[current.topic]}</span>
              <span style={{ color: C.faint, fontSize: 11 }}>
                {new Date(current.createdAt).toLocaleString("tr-TR")}
              </span>
              <button onClick={() => void sil(current.id)} style={{ ...btn(), marginLeft: "auto", color: C.danger }}>
                sil
              </button>
            </div>

            <Row k="id" v={current.id} mono />
            {current.brand && <Row k="marka" v={current.brand} />}
            {current.link && (
              <Row
                k="link"
                v={
                  <a href={hrefOf(current.link)} target="_blank" rel="noreferrer noopener" style={{ color: C.link }}>
                    {current.link}
                  </a>
                }
              />
            )}
            {current.email && (
              <Row
                k="e-posta"
                v={
                  <a href={`mailto:${current.email}`} style={{ color: C.link }}>
                    {current.email}
                  </a>
                }
              />
            )}
            <Row k="gönderen" v={current.nick ?? (current.userId ? current.userId : "anonim")} />

            {current.text && (
              <div style={{ marginTop: 14 }}>
                <div style={{ color: C.faint, fontSize: 11, letterSpacing: ".14em", marginBottom: 6 }}>METİN</div>
                {/* `white-space: pre-wrap`: kullanıcının satır sonları korunur ama
                    içerik METİN olarak çizilir — HTML olarak yorumlanmaz. */}
                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.65,
                    background: C.panel,
                    border: `1px solid ${C.line}`,
                    padding: "10px 12px",
                  }}
                >
                  {current.text}
                </div>
              </div>
            )}

            {current.attachments?.length ? (
              <div style={{ marginTop: 16 }}>
                <div style={{ color: C.faint, fontSize: 11, letterSpacing: ".14em", marginBottom: 8 }}>
                  EKLER ({current.attachments.length})
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {current.attachments.map((a) => {
                    const url = attachmentUrl(current.id, a.file);
                    const isImg = a.mime.startsWith("image/");
                    const isVid = a.mime.startsWith("video/");
                    return (
                      <div
                        key={a.file}
                        style={{ border: `1px solid ${C.line}`, background: C.panel, padding: 8, width: 210 }}
                      >
                        {isImg ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={url}
                            alt={a.name}
                            style={{ width: "100%", height: 130, objectFit: "contain", background: C.bg }}
                          />
                        ) : isVid ? (
                          <video src={url} controls style={{ width: "100%", height: 130, background: C.bg }} />
                        ) : (
                          <div
                            style={{
                              height: 130,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              background: C.bg,
                              color: C.dim,
                            }}
                          >
                            PDF
                          </div>
                        )}
                        <div style={{ marginTop: 6, fontSize: 11, color: C.dim, wordBreak: "break-all" }}>
                          {a.name}
                        </div>
                        <div style={{ fontSize: 10, color: C.faint }}>
                          {Math.max(1, Math.round(a.size / 1024))} KB
                          {" · "}
                          <a href={url} target="_blank" rel="noreferrer noopener" style={{ color: C.link }}>
                            aç
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </article>
        )}
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ ölçüm -- */

interface StatsSummary {
  days: number;
  views?: number;
  outbound?: number;
  topProducts?: Array<{ id: string; name?: string; brand?: string; n: number }>;
  topBrands?: Array<{ brand: string; n: number }>;
  [k: string]: unknown;
}

/**
 * Davranış özeti. `/api/stats`in döndürdüğü şekle TAM bağlanmıyor: uç zamanla
 * değişiyor ve konsolun bir alan eksik diye boş ekran vermesi anlamsız — tanıdığı
 * alanları çizer, tanımadıklarını ham JSON olarak gösterir.
 */
function Olcum() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<StatsSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let iptal = false;
    void (async () => {
      try {
        const r = await fetch(`/api/stats?days=${days}`, { cache: "no-store" });
        if (!r.ok) throw new Error("ölçüm okunamadı");
        const j = (await r.json()) as StatsSummary;
        if (!iptal) {
          setData(j);
          setErr(null);
        }
      } catch (e) {
        if (!iptal) setErr(e instanceof Error ? e.message : "hata");
      }
    })();
    return () => {
      iptal = true;
    };
  }, [days]);

  return (
    <section style={{ flex: 1, overflowY: "auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ color: C.faint, fontSize: 11, letterSpacing: ".14em" }}>PENCERE</span>
        <Select
          value={String(days)}
          onChange={(v) => setDays(Number(v))}
          options={[
            ["7", "7 gün"],
            ["30", "30 gün"],
            ["90", "90 gün"],
          ]}
        />
      </div>
      {err && <div style={{ color: C.danger }}>{err}</div>}
      {!err && !data && <div style={{ color: C.faint }}>yükleniyor…</div>}
      {data && (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            <Kart k="görüntülenme" v={data.views ?? 0} />
            <Kart k="mağazaya çıkış" v={data.outbound ?? 0} />
          </div>
          {data.topBrands?.length ? (
            <Tablo
              baslik="EN ÇOK ÇIKIŞ ALAN MARKALAR"
              rows={data.topBrands.slice(0, 20).map((b) => [b.brand, String(b.n)])}
            />
          ) : null}
          {data.topProducts?.length ? (
            <Tablo
              baslik="EN ÇOK GÖRÜNTÜLENEN ÜRÜNLER"
              rows={data.topProducts
                .slice(0, 20)
                .map((p) => [`${p.brand ? p.brand + " · " : ""}${p.name ?? p.id}`, String(p.n)])}
            />
          ) : null}
          <details style={{ marginTop: 18, color: C.faint }}>
            <summary style={{ cursor: "pointer" }}>ham cevap</summary>
            <pre
              style={{
                marginTop: 8,
                padding: 10,
                background: C.panel,
                border: `1px solid ${C.line}`,
                overflowX: "auto",
                fontSize: 11,
                color: C.dim,
              }}
            >
              {JSON.stringify(data, null, 2)}
            </pre>
          </details>
        </>
      )}
    </section>
  );
}

/* ----------------------------------------------------------------- teşhis -- */

/**
 * Sunucunun o anki hâli. Vitrin "neden böyle davranıyor" sorusunun ilk durağı:
 * hangi katalog yüklü, kaç ürün var, kaç görsel ölü biliniyor, bellek ne durumda.
 */
function Teshis() {
  const [d, setD] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const yukle = async () => {
    try {
      const r = await fetch("/api/teshis", { cache: "no-store" });
      if (!r.ok) throw new Error("teşhis okunamadı");
      setD(await r.json());
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "hata");
    }
  };

  useEffect(() => {
    void yukle();
  }, []);

  return (
    <section style={{ flex: 1, overflowY: "auto", padding: 16 }}>
      <button onClick={() => void yukle()} style={{ ...btn(), marginBottom: 14 }}>
        yenile
      </button>
      {err && <div style={{ color: C.danger }}>{err}</div>}
      {d && (
        <Tablo
          baslik="SUNUCU"
          rows={Object.entries(d).map(([k, v]) => [k, typeof v === "object" ? JSON.stringify(v) : String(v)])}
        />
      )}
    </section>
  );
}

/* --------------------------------------------------------------- parçalar -- */

function btn() {
  return {
    padding: "3px 9px",
    border: `1px solid ${C.line2}`,
    background: C.panel2,
    color: C.dim,
    fontFamily: MONO,
    fontSize: 11,
    cursor: "pointer",
  } as const;
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: C.panel2,
        color: C.fg,
        border: `1px solid ${C.line2}`,
        fontFamily: MONO,
        fontSize: 11,
        padding: "3px 6px",
      }}
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

function Row({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "3px 0", fontSize: 12 }}>
      <span style={{ width: 90, flex: "none", color: C.faint }}>{k}</span>
      <span style={{ color: mono ? C.dim : C.fg, wordBreak: "break-word" }}>{v}</span>
    </div>
  );
}

function Kart({ k, v }: { k: string; v: number }) {
  return (
    <div style={{ border: `1px solid ${C.line}`, background: C.panel, padding: "10px 14px", minWidth: 140 }}>
      <div style={{ color: C.faint, fontSize: 10, letterSpacing: ".14em" }}>{k.toUpperCase()}</div>
      <div style={{ color: C.accent, fontSize: 22, marginTop: 4 }}>{v.toLocaleString("tr-TR")}</div>
    </div>
  );
}

function Tablo({ baslik, rows }: { baslik: string; rows: Array<[string, string]> }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ color: C.faint, fontSize: 11, letterSpacing: ".14em", marginBottom: 6 }}>{baslik}</div>
      <div style={{ border: `1px solid ${C.line}` }}>
        {rows.map(([k, v], i) => (
          <div
            key={`${k}-${i}`}
            style={{
              display: "flex",
              gap: 12,
              padding: "5px 10px",
              background: i % 2 ? C.panel : C.panel2,
              fontSize: 12,
            }}
          >
            <span style={{ flex: 1, color: C.fg, overflow: "hidden", textOverflow: "ellipsis" }}>{k}</span>
            <span style={{ color: C.accent }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function kisaTarih(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")} ${String(
    d.getHours(),
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Kullanıcının yazdığı linki güvenli bir adrese çevirir.
 *
 * Şema YOKSA `https://` eklenir; `javascript:` gibi bir şema yazılmışsa link
 * ETKİSİZLEŞTİRİLİR. Bu alan kullanıcı girdisi ve admin ona tıklayacak — tıklanabilir
 * bir `javascript:` bağlantısı doğrudan bir XSS'tir.
 */
function hrefOf(raw: string): string {
  const s = raw.trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return "#"; // tanımadığımız şema: etkisiz
  return `https://${s}`;
}
