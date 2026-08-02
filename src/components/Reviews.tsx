"use client";
import { useEffect, useState } from "react";
import type { Product } from "@/lib/types";
import { useStore } from "@/store";
import {
  MAX_TEXT_CLIENT,
  REVIEW_ERROR,
  fetchReviews,
  removeReview,
  submitReview,
  type ReviewSummary,
  type ReviewView,
} from "@/lib/reviews-client";
import { Stars } from "./Stars";
import { useLang } from "@/lib/lang";

/**
 * ÜRÜN YORUMLARI — ürün modalinin alt bölümü.
 *
 * Vitrin bugüne dek tek yönlüydü. Yorum, aynı ürüne bakan başka birinin ne düşündüğünü
 * getiriyor; markanın kendi sitesinde olmayan tek şey bu.
 *
 * Kişi başı TEK yorum: kendi yorumun varsa form onu düzenler (bkz. lib/reviews.ts).
 * Üyelik şart değil — oturum açıksa nick hesaptan gelir, değilse bir kez sorulur ve
 * cihazda saklanan anahtarla sahiplenilir.
 */

const NICK_KEY = "altr-nick";

export function Reviews({ p }: { p: Product }) {
  const me = useStore((s) => s.me);
  const showToast = useStore((s) => s.showToast);
  const { t, n } = useLang();

  const [items, setItems] = useState<ReviewView[] | null>(null);
  const [summary, setSummary] = useState<ReviewSummary>({ count: 0, avg: null });
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [nick, setNick] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  // Nick: oturum varsa hesaptan, yoksa daha önce yazdığı ad (cihazda).
  useEffect(() => {
    if (me?.nick) {
      setNick(me.nick);
      return;
    }
    try {
      setNick(localStorage.getItem(NICK_KEY) ?? "");
    } catch {
      /* yoksay */
    }
  }, [me?.nick]);

  // Ürün değişince (modalda ileri/geri) her şey sıfırlanır ve yeniden yüklenir.
  useEffect(() => {
    let alive = true;
    setItems(null);
    setRating(0);
    setText("");
    setOpen(false);
    void fetchReviews(p.id).then((r) => {
      if (!alive) return;
      setItems(r.items);
      setSummary(r.summary);
      // Kendi yorumun varsa form onunla dolu açılır: "yorum yaz" değil "yorumunu düzenle".
      const own = r.items.find((x) => x.mine);
      if (own) {
        setRating(own.rating);
        setText(own.text);
      }
    });
    return () => {
      alive = false;
    };
  }, [p.id]);

  const own = items?.find((x) => x.mine) ?? null;
  const others = items?.filter((x) => !x.mine) ?? [];

  async function send() {
    if (busy) return;
    if (!rating) {
      showToast(REVIEW_ERROR.puan);
      return;
    }
    setBusy(true);
    const r = await submitReview({ productId: p.id, rating, text, nick });
    setBusy(false);
    if (!r.ok) {
      showToast(REVIEW_ERROR[r.error]);
      return;
    }
    if (!me?.nick) {
      try {
        localStorage.setItem(NICK_KEY, r.review.nick);
      } catch {
        /* kota */
      }
    }
    setSummary(r.summary);
    setItems((cur) => [r.review, ...(cur ?? []).filter((x) => !x.mine)]);
    setOpen(false);
    showToast(own ? "Yorumun güncellendi." : "Yorumun eklendi.");
  }

  async function drop() {
    if (busy) return;
    setBusy(true);
    const s = await removeReview(p.id);
    setBusy(false);
    if (!s) {
      showToast("Yorum silinemedi.");
      return;
    }
    setSummary(s);
    setItems((cur) => (cur ?? []).filter((x) => !x.mine));
    setRating(0);
    setText("");
    showToast("Yorumun silindi.");
  }

  return (
    <section className="pm-reviews" style={{ marginTop: 30, borderTop: "1px solid var(--line3)", paddingTop: 22 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h3 style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, letterSpacing: ".22em", color: "var(--faint)", margin: 0 }}>
            {t("YORUMLAR")}
          </h3>
          {summary.count > 0 && summary.avg != null ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Stars value={summary.avg} size={16} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 15, color: "var(--fg)" }}>
                {n(summary.avg)}
              </span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "var(--faint)" }}>
                / 5 · {summary.count} {t("yorum")}
              </span>
            </span>
          ) : (
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "var(--faint)" }}>
              {t("henüz yorum yok — ilk sen yaz")}
            </span>
          )}
        </div>
        <span
          className="nav-item"
          onClick={() => setOpen((v) => !v)}
          style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: 12,
            letterSpacing: ".14em",
            color: open ? "var(--muted3)" : "var(--grn)",
            borderBottom: `1px solid ${open ? "transparent" : "var(--grn)"}`,
            paddingBottom: 2,
          }}
        >
          {open ? t("VAZGEÇ") : own ? t("YORUMUNU DÜZENLE") : t("YORUM YAZ")}
        </span>
      </div>

      {open && (
        <div style={{ border: "1px solid var(--line)", borderLeft: "2px solid var(--grn)", padding: "14px 16px", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: ".2em", color: "var(--faint)" }}>
              {t("PUANIN")}
            </span>
            <Stars value={rating} size={24} onPick={setRating} />
          </div>

          {/* Nick yalnız oturum yokken sorulur; hesap varsa ad hesaptan gelir ve
              istemcinin gönderdiği değer sunucuda zaten yok sayılır. */}
          {!me?.nick && (
            <input
              value={nick}
              onChange={(e) => setNick(e.target.value)}
              placeholder={t("nick (3-20 karakter)")}
              maxLength={20}
              style={inputStyle}
            />
          )}

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT_CLIENT))}
            placeholder={t("kalıbı nasıl? kumaş? kargo? — yazmasan da olur, puan yeter")}
            rows={4}
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
          />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "var(--faint)" }}>
              {text.length}/{MAX_TEXT_CLIENT}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              {own && (
                <span className="fbox" onClick={drop} style={{ ...btnStyle, border: "1px solid var(--line)", color: "var(--muted3)" }}>
                  {t("SİL")}
                </span>
              )}
              <span
                className="cta-btn"
                onClick={send}
                style={{ ...btnStyle, background: "var(--grn)", color: "var(--on-accent)", fontWeight: 700, opacity: busy ? 0.6 : 1 }}
              >
                {own ? t("GÜNCELLE") : t("GÖNDER")}
              </span>
            </div>
          </div>
        </div>
      )}

      {items === null ? (
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "var(--faint)" }}>{t("yükleniyor…")}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {own && <Row r={own} />}
          {others.map((r) => (
            <Row key={r.id} r={r} />
          ))}
        </div>
      )}
    </section>
  );
}

function Row({ r }: { r: ReviewView }) {
  const { lang, t } = useLang();
  const when = new Date(r.updatedAt);
  return (
    <article
      style={{
        border: "1px solid var(--line)",
        borderLeft: r.mine ? "2px solid var(--grn)" : "1px solid var(--line)",
        padding: "11px 14px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: r.text ? 8 : 0 }}>
        <Stars value={r.rating} size={12} />
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, letterSpacing: ".08em", color: "var(--fg)" }}>
          {r.nick}
          {r.mine && <span style={{ color: "var(--grn)", marginLeft: 6 }}>· {t("sen")}</span>}
        </span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "var(--faint)" }}>
          {Number.isNaN(when.getTime()) ? "" : when.toLocaleDateString(lang === "en" ? "en-GB" : "tr-TR")}
        </span>
      </div>
      {r.text && (
        <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, lineHeight: 1.65, color: "var(--muted)", margin: 0, whiteSpace: "pre-wrap" }}>
          {r.text}
        </p>
      )}
    </article>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  marginBottom: 8,
  padding: "9px 11px",
  background: "var(--bg3)",
  border: "1px solid var(--line)",
  borderRadius: 6,
  color: "var(--fg)",
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 13,
  outline: "none",
};

const btnStyle: React.CSSProperties = {
  fontFamily: "'Space Mono', monospace",
  fontSize: 12,
  letterSpacing: ".14em",
  padding: "10px 16px",
  borderRadius: 8,
  cursor: "pointer",
};
