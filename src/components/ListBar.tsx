"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/store";
import { useT } from "@/lib/lang";
import { MAX_LIST_ITEMS, shareUrl } from "@/lib/lists";
import { publishedIdOf } from "@/lib/public-lists-client";
import { CombineBuilder } from "./CombineBuilder";

const MONO = "'IBM Plex Mono', monospace";
const SPACE = "'Space Mono', monospace";

function btn(on = false) {
  return {
    fontFamily: SPACE,
    fontSize: 12,
    letterSpacing: ".14em",
    padding: "8px 12px",
    border: `1px solid ${on ? "var(--grn)" : "var(--line)"}`,
    background: on ? "var(--grn)" : "transparent",
    color: on ? "var(--on-accent)" : "var(--muted)",
    whiteSpace: "nowrap" as const,
  };
}

/**
 * Liste şeridi: listeler arası geçiş, yeni liste, ad değiştirme, silme, paylaşma.
 *
 * Üyelik yok. İKİ paylaşım yolu var ve bilerek ayrı duruyorlar:
 *  - LİNK (sunucusuz): liste linke gömülü kısa kodlarla taşınır (bkz. lib/lists.ts).
 *    Anlık, karşı tarafın hiçbir şeye ihtiyacı yok; ama link donmuştur.
 *  - YAYIN (sunucuda): liste HERKESE AÇIK sekmesinde herkese görünür, sonraki
 *    düzenlemeler yayına yansır. Yalnız bir nick sorulur; sahiplik cihazdaki gizli
 *    anahtarla kanıtlanır (bkz. lib/public-lists-client.ts).
 * Hesap sistemi gelince değişecek tek şey, listelerin nereden okunup yazıldığıdır.
 */
export function ListBar() {
  const lists = useStore((s) => s.lists);
  const activeId = useStore((s) => s.activeListId);
  const setActiveList = useStore((s) => s.setActiveList);
  const createList = useStore((s) => s.createList);
  const renameList = useStore((s) => s.renameList);
  const deleteList = useStore((s) => s.deleteList);
  const showToast = useStore((s) => s.showToast);
  const publishActiveList = useStore((s) => s.publishActiveList);
  const unpublishActiveList = useStore((s) => s.unpublishActiveList);
  const t = useT();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [combining, setCombining] = useState(false);
  const [askNick, setAskNick] = useState(false);
  const [nick, setNick] = useState("");
  const [published, setPublished] = useState(false);
  const [confirmUnpub, setConfirmUnpub] = useState(false);

  // "Yayında mı" cihazda kayıtlı — soruyu her açılışta ağa sormaya gerek yok.
  useEffect(() => {
    setPublished(!!publishedIdOf(activeId));
    setAskNick(false);
    setConfirmUnpub(false);
  }, [activeId]);

  const active = lists.find((l) => l.id === activeId);
  if (!active) return null;

  const doShare = () => {
    if (!active.ids.length) {
      showToast("Boş liste paylaşılmaz.");
      return;
    }
    const url = shareUrl(active, typeof window !== "undefined" ? window.location.origin : "");
    setLink(url);
    // Pano izni verilmemiş olabilir (http, izin reddi) — o yüzden link ekranda da durur.
    navigator.clipboard?.writeText(url).then(
      () => showToast("Link kopyalandı."),
      () => showToast("Linki elle kopyala."),
    );
  };

  const doPublish = async () => {
    await publishActiveList(nick.trim());
    // Yayın kaydı cihaza publishActiveList içinde yazılıyor; düğmeyi ona göre tazele.
    const ok = !!publishedIdOf(activeId);
    setPublished(ok);
    if (ok) setAskNick(false);
  };

  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 12 }}>
        {lists.map((l) => (
          <span
            key={l.id}
            className="fbox"
            onClick={() => {
              setActiveList(l.id);
              setEditing(false);
              setConfirmDel(false);
              setLink(null);
            }}
            style={btn(l.id === activeId)}
          >
            {t(l.name)}
            <span style={{ marginLeft: 8, opacity: 0.7 }}>{l.ids.length}</span>
          </span>
        ))}
        <span className="fbox" onClick={() => createList()} style={{ ...btn(), color: "var(--grn)", borderColor: "var(--grn)" }}>
          {t("+ YENİ LİSTE")}
        </span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        {editing ? (
          <>
            <input
              autoFocus
              value={draft}
              maxLength={40}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  renameList(active.id, draft);
                  setEditing(false);
                }
                if (e.key === "Escape") setEditing(false);
              }}
              placeholder={t("liste adı")}
              style={{
                padding: "8px 11px",
                background: "var(--bg3)",
                border: "1px solid var(--grn)",
                color: "var(--fg)",
                fontFamily: MONO,
                fontSize: 13,
                outline: "none",
              }}
            />
            <span
              className="fbox"
              onClick={() => {
                renameList(active.id, draft);
                setEditing(false);
              }}
              style={btn()}
            >
              {t("KAYDET")}
            </span>
          </>
        ) : (
          <span
            className="fbox"
            onClick={() => {
              setDraft(active.name);
              setEditing(true);
            }}
            style={btn()}
          >
            {t("✎ ADI DEĞİŞTİR")}
          </span>
        )}

        {/* İki paylaşım biçimi ayrı düğme: "listeyi paylaş" (şunlara bak) ile
            "kombin yap" (şöyle giyin) farklı niyetler — tek düğmenin altına gizlenirse
            kombin hiç keşfedilmez. */}
        <span className="fbox" onClick={doShare} style={{ ...btn(), color: "var(--grn)", borderColor: "var(--grn)" }}>
          {t("⇗ LİSTEYİ PAYLAŞ")}
        </span>

        <span
          className="fbox"
          onClick={() => {
            setCombining((v) => !v);
            setLink(null);
          }}
          style={combining ? btn(true) : { ...btn(), color: "var(--grn)", borderColor: "var(--grn)" }}
        >
          {t("⊞ KOMBİN YAP")}
        </span>

        {/* YAYIN — linkten farkı: liste HERKESE AÇIK sekmesinde herkese görünür ve
            sonradan eklediğin ürünler yayına da yansır (link öyle değil). */}
        {published ? (
          <span
            className="fbox"
            onClick={() => {
              if (confirmUnpub) {
                void unpublishActiveList();
                setPublished(false);
                setConfirmUnpub(false);
              } else {
                setConfirmUnpub(true);
              }
            }}
            onMouseLeave={() => setConfirmUnpub(false)}
            style={btn(true)}
          >
            {confirmUnpub ? t("YAYINDAN KALDIR? ✕") : t("🌐 YAYINDA")}
          </span>
        ) : (
          <span
            className="fbox"
            onClick={() => {
              setAskNick((v) => !v);
              setLink(null);
            }}
            style={askNick ? btn(true) : { ...btn(), color: "var(--grn)", borderColor: "var(--grn)" }}
          >
            {t("🌐 HERKESE AÇ")}
          </span>
        )}

        <span
          className="fbox"
          onClick={() => {
            if (confirmDel) {
              deleteList(active.id);
              setConfirmDel(false);
            } else {
              setConfirmDel(true);
            }
          }}
          onMouseLeave={() => setConfirmDel(false)}
          style={btn()}
        >
          {confirmDel ? t("EMİN MİSİN? ✕") : t("✕ LİSTEYİ SİL")}
        </span>

        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".08em", color: "var(--faint)" }}>
          {active.ids.length}/{MAX_LIST_ITEMS}
        </span>
      </div>

      {link && (
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <input
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            style={{
              flex: 1,
              minWidth: 240,
              padding: "9px 11px",
              background: "var(--bg3)",
              border: "1px solid var(--line)",
              color: "var(--muted)",
              fontFamily: MONO,
              fontSize: 12,
              outline: "none",
            }}
          />
          <span className="fbox" onClick={() => setLink(null)} style={btn()}>
            {t("KAPAT")}
          </span>
          <div style={{ width: "100%", fontFamily: MONO, fontSize: 11, letterSpacing: ".06em", color: "var(--faint)" }}>
            {t("link listenin kendisini taşır — karşı tarafın hesabı olması gerekmez. sonradan eklediğin ürünler bu linke YANSIMAZ, yeniden paylaş.")}
          </div>
        </div>
      )}

      {askNick && (
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <input
            value={nick}
            onChange={(e) => setNick(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void doPublish(); }}
            placeholder={t("nick (harf, rakam, . _ -)")}
            maxLength={20}
            autoFocus
            style={{
              flex: 1,
              minWidth: 200,
              padding: "9px 11px",
              background: "var(--bg3)",
              border: "1px solid var(--line)",
              color: "var(--fg)",
              fontFamily: MONO,
              fontSize: 13,
              outline: "none",
            }}
          />
          <span className="fbox" onClick={() => void doPublish()} style={{ ...btn(), color: "var(--grn)", borderColor: "var(--grn)" }}>
            {t("YAYINLA")}
          </span>
          <span className="fbox" onClick={() => setAskNick(false)} style={btn()}>
            {t("VAZGEÇ")}
          </span>
          <div style={{ width: "100%", fontFamily: MONO, fontSize: 11, letterSpacing: ".06em", color: "var(--faint)" }}>
            {t("hesap gerekmiyor — nick yalnız listenin altına yazılır. yayınlanan liste HERKESE AÇIK sekmesinde görünür; istediğin an kaldırabilirsin. listeyi düzenlersen yayın da güncellenir.")}
          </div>
        </div>
      )}

      {combining && (
        <div style={{ marginTop: 16 }}>
          <CombineBuilder onClose={() => setCombining(false)} />
        </div>
      )}
    </div>
  );
}
