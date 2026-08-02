"use client";
import { useEffect, useRef, useState } from "react";
import {
  MAX_FILES,
  MAX_FILE_BYTES,
  MAX_TEXT,
  TOPICS,
  UPLOAD_ACCEPT,
  isAllowedUploadType,
  sendFeedback,
  type Topic,
} from "@/lib/feedback-client";
import { useStore } from "@/store";
import { useT } from "@/lib/lang";

/**
 * BİZE ULAŞIN — tek ekran, adım adım DEĞİL.
 *
 * Adımlı akış (önce konu seç → sonra yaz → sonra gönder) her adımda bir vazgeçme
 * fırsatı üretiyor. Buraya basan kişinin zaten söyleyecek bir şeyi var; konu seçimi
 * üstte bir çip satırı olarak durur, altındaki metin ve alanlar ona göre değişir.
 * Varsayılan MARKA ÖNER: en çok istediğimiz katkı bu ve en düşük eşikli olan da bu.
 */

const MONO = "'IBM Plex Mono', monospace";
const SPACE = "'Space Mono', monospace";

const HEAD = {
  fontFamily: SPACE,
  fontSize: 12,
  letterSpacing: ".26em",
  color: "var(--faint)",
  marginBottom: 8,
} as const;

const INPUT = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: "11px 13px",
  background: "var(--bg3)",
  border: "1px solid var(--line)",
  color: "var(--fg)",
  fontFamily: MONO,
  fontSize: 14,
  outline: "none",
};

function actionStyle(primary: boolean, disabled = false) {
  return {
    display: "block",
    width: "100%",
    textAlign: "center" as const,
    fontFamily: SPACE,
    fontWeight: primary ? 700 : 400,
    fontSize: 14,
    letterSpacing: ".14em",
    padding: "13px 0",
    border: `1px solid ${primary ? "var(--grn)" : "var(--line)"}`,
    background: primary ? "var(--grn)" : "transparent",
    color: primary ? "var(--on-accent)" : "var(--muted)",
    opacity: disabled ? 0.55 : 1,
  };
}

/** Konu tanımları: etiket, altındaki açıklama ve hangi alanların çizileceği. */
const TOPIC_META: Record<
  Topic,
  {
    label: string;
    blurb: string;
    brand?: string;
    link?: boolean;
    /** Serbest metin alanı çizilmesin (marka önerisinde kaldırıldı). */
    noText?: boolean;
    /** Dosya eki alanı çizilsin (yalnız geri bildirimde). */
    files?: boolean;
    textLabel: string;
    ph: string;
  }
> = {
  "marka-oner": {
    label: "MARKA ÖNER",
    blurb:
      "bildiğin harika bir alternatif giyim işletmesi mi var? bize öner, listemize eklemek için değerlendirelim. küçük, yeni, az bilinen markalar tam olarak aradığımız şey.",
    brand: "MARKA ADI",
    link: true,
    // "NEDEN? (opsiyonel)" alanı KALDIRILDI (2026-07-30). Zaten opsiyoneldi ve marka
    // adı + link tek başına yeterli bir öneri; boş bir metin kutusu formu uzatıp
    // gönderme eşiğini yükseltmekten başka bir iş yapmıyordu.
    noText: true,
    textLabel: "",
    ph: "",
  },
  "geri-bildirim": {
    label: "GERİ BİLDİRİM",
    blurb:
      "tam olarak neyin daha iyi olabileceğini açıkça belirt: hangi ekrandaydın, ne yaptın, ne bekliyordun, ne oldu. “güzel olmuş” değil, tek bir somut şey — en çok işimize yarayan şey o.",
    // Ekran görüntüsü bir hata raporunu her açıklamadan daha iyi anlatıyor.
    files: true,
    textLabel: "NE OLDU / NE OLMALI",
    ph: "ör. filtrede beden seçince sayfa başa dönüyor, seçtiğim yer kayboluyor",
  },
  "marka-kaldir": {
    label: "MARKA KALDIRMA",
    blurb:
      "bir işletmenin sahibi veya yetkilisiysen ve ürünlerinin burada gözükmesini istemiyorsan buradan iletişim kurabilirsin. talebi doğrulayıp markayı vitrinden çıkarıyoruz.",
    brand: "MARKA ADI",
    textLabel: "TALEBİN",
    ph: "markayla ilişkin ve talebin — doğrulayabilmemiz için",
  },
  diger: {
    label: "DİĞER",
    blurb:
      "yukarıdakilerden hiçbiri değilse buradan yaz — iş birliği, hata, hukuki konu, ne olursa.",
    textLabel: "MESAJIN",
    ph: "yaz",
  },
};

/**
 * "opsiyonel" rozeti — zorunlu alandan RENKLE ayrılır.
 *
 * Eskiden başlığın içinde düz metindi ("E-POSTA (opsiyonel)") ve etiketin geri
 * kalanıyla aynı renkteydi; forma bakan kişi neyi doldurmak ZORUNDA olduğunu ancak
 * okuyarak anlıyordu. Ayrı bir renk (--grn, sitenin vurgu rengi) bunu tek bakışta
 * söylüyor: yeşil gördüğün yeri boş bırakabilirsin.
 */
function Optional() {
  const t = useT();
  return (
    <span
      style={{
        color: "var(--grn)",
        letterSpacing: ".1em",
        fontWeight: 400,
        // Etiketin kendisinden bir tık küçük: bilgi ikincil, alan adı birincil.
        fontSize: "0.92em",
      }}
    >
      · {t("opsiyonel")}
    </span>
  );
}

/**
 * Dosya eki seçici — yalnız GERİ BİLDİRİM konusunda çizilir.
 *
 * Bir hata raporunda ekran görüntüsü/video, her açıklamadan daha çok şey anlatıyor.
 * Kabul edilen türler ve sınırlar SUNUCUDA da denetleniyor (bkz. lib/feedback-files.ts);
 * buradaki `accept` ve boyut kontrolü yalnız kullanıcıya erken geri bildirim için.
 */
function FilePicker({ files, onChange }: { files: File[]; onChange: (f: File[]) => void }) {
  const [err, setErr] = useState<string | null>(null);
  const t = useT();

  const add = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    let problem: string | null = null;
    for (const f of Array.from(list)) {
      if (next.length >= MAX_FILES) {
        problem = `${t("en fazla")} ${MAX_FILES} ${t("dosya")}`;
        break;
      }
      if (f.size > MAX_FILE_BYTES) {
        problem = `“${f.name}” ${t("çok büyük (en fazla")} ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB)`;
        continue;
      }
      if (!isAllowedUploadType(f.type)) {
        problem = `“${f.name}” ${t("desteklenmiyor (fotoğraf, video veya PDF)")}`;
        continue;
      }
      next.push(f);
    }
    setErr(problem);
    onChange(next);
  };

  return (
    <div style={{ margin: "14px 0 4px" }}>
      <div style={HEAD}>
        {t("EKLER")} <Optional />
      </div>
      <label
        className="cta-btn"
        style={{
          display: "block",
          textAlign: "center",
          fontFamily: MONO,
          fontSize: 12,
          letterSpacing: ".1em",
          color: "var(--muted3)",
          border: "1px dashed var(--line)",
          padding: "12px 10px",
          cursor: "pointer",
        }}
      >
        {t("+ FOTOĞRAF · VİDEO · PDF EKLE")}
        <input
          type="file"
          multiple
          accept={UPLOAD_ACCEPT}
          onChange={(e) => {
            add(e.target.files);
            // Aynı dosyayı tekrar seçebilmek için girişi sıfırla (aynı değer → change yok).
            e.target.value = "";
          }}
          style={{ display: "none" }}
        />
      </label>

      {files.map((f, i) => (
        <div
          key={`${f.name}-${i}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: MONO,
            fontSize: 11,
            color: "var(--muted3)",
            marginTop: 6,
          }}
        >
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {f.name}
          </span>
          <span style={{ color: "var(--faint)" }}>{Math.max(1, Math.round(f.size / 1024))} KB</span>
          <span
            className="nav-item"
            onClick={() => onChange(files.filter((_, j) => j !== i))}
            title={t("kaldır")}
            style={{ color: "var(--fg-bright)", cursor: "pointer" }}
          >
            ✕
          </span>
        </div>
      ))}

      {err && (
        <div style={{ fontFamily: MONO, fontSize: 11, color: "var(--fg-bright)", marginTop: 6 }}>{err}</div>
      )}
    </div>
  );
}

export function ContactModal() {
  const open = useStore((s) => s.contactOpen);
  const close = useStore((s) => s.closeContact);
  const me = useStore((s) => s.me);
  const showToast = useStore((s) => s.showToast);
  const t = useT();

  const [topic, setTopic] = useState<Topic>("marka-oner");
  const [brand, setBrand] = useState("");
  const [link, setLink] = useState("");
  const [text, setText] = useState("");
  const [email, setEmail] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [website, setWebsite] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  // Konuya göre ilk alan bazen input (marka adı) bazen textarea — tek ref ikisini de tutar.
  const firstField = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Her açılışta temiz başla; oturum varsa adresi hazır ver (değiştirilebilir).
  useEffect(() => {
    if (!open) return;
    setTopic("marka-oner");
    setBrand("");
    setLink("");
    setText("");
    setFiles([]);
    setWebsite("");
    setEmail(me?.email ?? "");
    setError(null);
    setSent(false);
  }, [open, me]);

  useEffect(() => {
    if (open && !sent) firstField.current?.focus();
  }, [open, sent, topic]);

  // Konu değişince ekleri düşür: ekler yalnız GERİ BİLDİRİM'de kabul ediliyor
  // (sunucu da öyle davranıyor). Kalsalardı kullanıcı eklediğini sanıp gönderirdi.
  useEffect(() => {
    if (topic !== "geri-bildirim") setFiles([]);
  }, [topic]);

  if (!open) return null;

  const meta = TOPIC_META[topic];
  const emailRequired = topic === "marka-kaldir";
  // Marka önerisinde ad tek başına yeterli — "şu markaya bakın" da bir bilgidir.
  const ready =
    (meta.brand ? brand.trim().length >= 2 : true) &&
    (topic === "marka-oner" ? true : text.trim().length >= 5) &&
    (emailRequired ? email.trim().length > 3 : true);

  const send = async () => {
    if (busy || !ready) return;
    setBusy(true);
    setError(null);
    try {
      await sendFeedback({ topic, brand, link, text, email, website, files });
      setSent(true);
      showToast("Aldık, teşekkürler.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gönderilemedi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={close} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.82)" }} />
      <div
        className="modal-anim bm-pad"
        style={{
          position: "relative",
          width: 520,
          maxWidth: "94vw",
          maxHeight: "92vh",
          overflowY: "auto",
          background: "var(--bg2)",
          border: "2px solid var(--fg-bright)",
          borderRadius: 22,
          padding: "26px 30px 30px",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
          <span className="glitch-head" style={{ fontFamily: "'Anton', sans-serif", fontSize: 34, lineHeight: 1, letterSpacing: ".02em", color: "var(--fg-bright)", textTransform: "uppercase" }}>
            {sent ? t("ALDIK") : t("Bize Ulaşın")}
          </span>
          <span className="nav-item" onClick={close} style={{ fontFamily: SPACE, fontSize: 13, letterSpacing: ".14em", color: "var(--muted)", flex: "none" }}>
            {t("KAPAT ✕")}
          </span>
        </div>

        {sent ? (
          <>
            <div style={{ fontFamily: MONO, fontSize: 14, lineHeight: 1.8, color: "var(--muted)", borderLeft: "2px solid var(--grn)", paddingLeft: 14, marginBottom: 22 }}>
              {t("mesajın bize ulaştı.")}{" "}
              {email
                ? t("gerekirse bu adresten dönüş yaparız.")
                : t("adres bırakmadın, dönüş yapamayız ama okuyacağız.")}
              <br />
              {topic === "marka-kaldir"
                ? t("kaldırma taleplerine öncelik veriyoruz.")
                : t("her mesaj tek tek okunuyor.")}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <span className="fbox" onClick={() => setSent(false)} style={{ ...actionStyle(false), flex: 1 }}>
                {t("BİR ŞEY DAHA YAZ")}
              </span>
              <span className="cta-btn" onClick={close} style={{ ...actionStyle(true), flex: 1 }}>
                {t("KAPAT")}
              </span>
            </div>
          </>
        ) : (
          <>
            {/* konu — çip satırı; seçim ekranı değiştirmez, sadece altını değiştirir */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 14 }}>
              {TOPICS.map((k) => {
                const on = topic === k;
                return (
                  <span
                    key={k}
                    className="fbox"
                    onClick={() => {
                      setTopic(k);
                      setError(null);
                    }}
                    style={{
                      fontFamily: MONO,
                      fontSize: 12.5,
                      letterSpacing: ".06em",
                      padding: "8px 12px",
                      border: `1px solid ${on ? "var(--grn)" : "var(--line)"}`,
                      background: on ? "var(--grn)" : "transparent",
                      color: on ? "var(--on-accent)" : "var(--muted)",
                    }}
                  >
                    {on ? "✓ " : ""}
                    {t(TOPIC_META[k].label)}
                  </span>
                );
              })}
            </div>

            <div style={{ fontFamily: MONO, fontSize: 13, lineHeight: 1.75, color: "var(--muted)", borderLeft: "2px solid var(--line2)", paddingLeft: 12, marginBottom: 20 }}>
              {t(meta.blurb)}
            </div>

            {meta.brand && (
              <div style={{ marginBottom: 14 }}>
                <div style={HEAD}>{t(meta.brand)}</div>
                <input
                  ref={firstField as React.RefObject<HTMLInputElement>}
                  value={brand}
                  maxLength={60}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder={topic === "marka-kaldir" ? t("işletmenin adı") : t("ör. kuytu atölye")}
                  style={INPUT}
                />
              </div>
            )}

            {meta.link && (
              <div style={{ marginBottom: 14 }}>
                <div style={HEAD}>
                {t("SİTE / INSTAGRAM")} <Optional />
              </div>
                <input
                  value={link}
                  maxLength={200}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder={t("instagram.com/… veya site adresi")}
                  style={INPUT}
                />
              </div>
            )}

            {!meta.noText && (
              <div style={{ marginBottom: 4 }}>
                <div style={HEAD}>{t(meta.textLabel)}</div>
                <textarea
                  ref={meta.brand ? undefined : (firstField as React.RefObject<HTMLTextAreaElement>)}
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT))}
                  placeholder={t(meta.ph)}
                  rows={6}
                  style={{ ...INPUT, resize: "vertical", lineHeight: 1.6 }}
                />
                <div style={{ fontFamily: MONO, fontSize: 11, color: "var(--faint)", textAlign: "right", marginTop: 4 }}>
                  {text.length}/{MAX_TEXT}
                </div>
              </div>
            )}

            {meta.files && <FilePicker files={files} onChange={setFiles} />}

            <div style={{ margin: "10px 0 6px" }}>
              <div style={HEAD}>
                {emailRequired ? (
                  t("E-POSTA (kurumsal adres tercih edilir)")
                ) : (
                  <>
                    {t("E-POSTA")} <Optional />
                  </>
                )}
              </div>
              <input
                type="email"
                inputMode="email"
                value={email}
                maxLength={254}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("dönüş yapabilmemiz için")}
                style={INPUT}
              />
            </div>

            {/* Honeypot: ekran dışında, klavye sırasında değil, ekran okuyucudan gizli.
                İnsan bunu asla doldurmaz; dolu gelen gönderim sunucuda sessizce düşer. */}
            <input
              tabIndex={-1}
              aria-hidden="true"
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }}
            />

            {error && (
              <div style={{ fontFamily: MONO, fontSize: 12, lineHeight: 1.6, color: "var(--fg-bright)", border: "1px solid var(--fg-bright)", padding: "9px 11px", marginTop: 14 }}>
                {t(error)}
              </div>
            )}

            <div style={{ marginTop: 18 }}>
              <span className="cta-btn" onClick={send} style={actionStyle(true, busy || !ready)}>
                {busy ? t("GÖNDERİLİYOR…") : t("GÖNDER")}
              </span>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 11, lineHeight: 1.6, color: "var(--faint)", marginTop: 10 }}>
              {t("hesap gerekmez · adres bırakmazsan da okuruz, sadece dönüş yapamayız")}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
