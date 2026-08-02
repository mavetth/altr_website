"use client";
import { useEffect, useRef, useState } from "react";
import {
  ROLE_LABEL,
  adminLogin,
  logout,
  requestLoginCode,
  saveNick,
  verifyLoginCode,
} from "@/lib/account";
import { useStore } from "@/store";
import { useT } from "@/lib/lang";

/**
 * GİRİŞ EKRANI — üç adım, tek modal.
 *
 *   eposta → kod → (ilk girişse) nick
 *
 * Parola yok, kayıt/giriş ayrımı yok: her ikisi de aynı akış. Kullanıcı adresini yazar,
 * gelen 6 haneli kodu girer; hesap yoksa o anda açılır. "Beni hatırla" oturumun ömrünü
 * belirler (60 gün / 12 saat) ve ilk ekranda durur — kod ekranında sorulsa, kullanıcı
 * kodu beklerken verdiği kararı unutmuş olurdu.
 *
 * GİZLİ DÖRDÜNCÜ ADIM: ilk kutuya `@` içermeyen bir değer yazılırsa kod yerine PAROLA
 * sorulur (yönetim hesapları — bkz. lib/auth.ts "admin parolası"). Arayüze bunun için
 * hiçbir düğme eklenmedi: normal kullanıcı her zaman bir e-posta adresi yazar ve ekranı
 * hiç değişmez.
 *
 * Giriş yapmak artık listeleri hesaba bağlar (bkz. lib/sync.ts).
 */

const MONO = "'IBM Plex Mono', monospace";
const SPACE = "'Space Mono', monospace";

const HEAD = {
  fontFamily: SPACE,
  fontSize: 12,
  letterSpacing: ".26em",
  color: "var(--faint)",
  marginBottom: 10,
} as const;

const INPUT = {
  width: "100%",
  padding: "12px 13px",
  background: "var(--bg3)",
  border: "1px solid var(--line)",
  color: "var(--fg)",
  fontFamily: MONO,
  fontSize: 14,
  outline: "none",
} as const;

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

export function AuthModal() {
  const open = useStore((s) => s.authOpen);
  const close = useStore((s) => s.closeAuth);
  const me = useStore((s) => s.me);
  const googleOn = useStore((s) => s.googleAuth);
  const setMe = useStore((s) => s.setMe);
  const showToast = useStore((s) => s.showToast);
  const t = useT();

  const [step, setStep] = useState<"eposta" | "kod" | "parola" | "nick">("eposta");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [nick, setNick] = useState("");
  const [remember, setRemember] = useState(true);
  const [role, setRole] = useState<"user" | "business">("user");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const firstField = useRef<HTMLInputElement>(null);

  // Oturum açık ama nick yoksa (Google dönüşü veya yarım kalmış ilk giriş) doğrudan
  // nick adımına düş — kullanıcıyı e-posta ekranına geri göndermenin anlamı yok.
  useEffect(() => {
    if (!open) return;
    setStep(me?.needsNick ? "nick" : "eposta");
    setError(null);
    setDevCode(null);
    setCode("");
    setPassword("");
  }, [open, me]);

  useEffect(() => {
    if (open) firstField.current?.focus();
  }, [open, step]);

  if (!open) return null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bir şeyler ters gitti.");
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () =>
    run(async () => {
      const r = await requestLoginCode(email, role);
      setDevCode(r.devCode ?? null);
      setStep("kod");
    });

  // `@` yoksa bu bir e-posta değil, bir handle: parola yoluna sap. Handle'ın gerçekten
  // var olup olmadığı BURADA sorulmaz — sorulsaydı, hangi handle'ların var olduğu
  // dışarıdan denenerek çıkarılabilirdi. Yanlış handle parola adımında 401 alır.
  const startLogin = () => {
    if (email.includes("@")) return sendCode();
    setError(null);
    setStep("parola");
  };

  const doPassword = () =>
    run(async () => {
      const r = await adminLogin(email, password, remember);
      setMe(r.user);
      showToast("Giriş yapıldı.");
      close();
    });

  const doVerify = () =>
    run(async () => {
      const r = await verifyLoginCode(email, code, remember);
      setMe(r.user);
      if (r.user.needsNick) {
        setStep("nick");
      } else {
        showToast("Giriş yapıldı.");
        close();
      }
    });

  const doNick = () =>
    run(async () => {
      const r = await saveNick(nick);
      setMe(r.user);
      showToast("Hoş geldin.");
      close();
    });

  const doLogout = () =>
    run(async () => {
      await logout();
      setMe(null);
      showToast("Çıkış yapıldı.");
      close();
    });

  const signedIn = me && !me.needsNick;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={close} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.82)" }} />
      <div
        className="modal-anim"
        style={{
          position: "relative",
          width: 420,
          maxWidth: "94vw",
          maxHeight: "92vh",
          overflowY: "auto",
          background: "var(--bg2)",
          border: "2px solid var(--fg-bright)",
          borderRadius: 22,
          padding: "28px 30px 30px",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
          <span className="glitch-head" style={{ fontFamily: "'Anton', sans-serif", fontSize: 34, lineHeight: 1, letterSpacing: ".02em", color: "var(--fg-bright)", textTransform: "uppercase" }}>
            {signedIn ? t("HESABIM") : step === "nick" ? t("SON ADIM") : t("GİRİŞ")}
          </span>
          <span className="nav-item" onClick={close} style={{ fontFamily: SPACE, fontSize: 13, letterSpacing: ".14em", color: "var(--muted)", flex: "none" }}>
            {t("KAPAT ✕")}
          </span>
        </div>

        {/* ---------------------------------------------------- oturum açık --- */}
        {signedIn && step !== "nick" ? (
          <>
            <div style={{ fontFamily: MONO, fontSize: 14, color: "var(--fg)", lineHeight: 1.8 }}>
              <div style={{ fontSize: 22, color: "var(--grn)" }}>{me.nick}</div>
              <div style={{ color: "var(--muted3)" }}>{me.email}</div>
              <div style={{ marginTop: 8 }}>
                <span style={{ fontFamily: SPACE, fontSize: 11, letterSpacing: ".2em", padding: "4px 9px", border: "1px solid var(--line)", color: "var(--muted)" }}>
                  {t(ROLE_LABEL[me.role])}
                </span>
              </div>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 12, lineHeight: 1.7, color: "var(--faint)", margin: "18px 0 20px", borderLeft: "2px solid var(--line2)", paddingLeft: 12 }}>
              {t("listelerin ve görünüm tercihlerin bu hesapta duruyor — başka bir cihazdan girdiğinde seni bekliyor olacaklar. çıkış yaparsan bu cihazdaki kopya silinmez.")}
            </div>
            <span className="fbox" onClick={doLogout} style={actionStyle(false, busy)}>
              {t("ÇIKIŞ YAP")}
            </span>
          </>
        ) : step === "eposta" ? (
          /* ------------------------------------------------------- e-posta --- */
          <>
            <div style={{ fontFamily: MONO, fontSize: 13, lineHeight: 1.7, color: "var(--muted)", marginBottom: 20 }}>
              {t("adresini yaz,")} <span style={{ color: "var(--fg)" }}>{t("6 haneli bir kod")}</span>{" "}
              {t("gönderelim. parola yok. hesabın yoksa kodla birlikte açılır.")}
            </div>

            <div style={HEAD}>{t("HESAP TÜRÜ")}</div>
            <div style={{ display: "flex", gap: 7, marginBottom: 18 }}>
              {([
                { k: "user", label: "BİREYSEL" },
                { k: "business", label: "İŞLETME" },
              ] as const).map((o) => (
                <span
                  key={o.k}
                  className="fbox"
                  onClick={() => setRole(o.k)}
                  style={{
                    flex: 1,
                    textAlign: "center",
                    fontFamily: MONO,
                    fontSize: 13,
                    letterSpacing: ".08em",
                    padding: "10px 0",
                    border: `1px solid ${role === o.k ? "var(--grn)" : "var(--line)"}`,
                    background: role === o.k ? "var(--grn)" : "transparent",
                    color: role === o.k ? "var(--on-accent)" : "var(--muted)",
                  }}
                >
                  {t(o.label)}
                </span>
              ))}
            </div>

            <div style={HEAD}>{t("E-POSTA")}</div>
            <input
              ref={firstField}
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && email && startLogin()}
              placeholder="ornek@posta.com"
              style={INPUT}
            />

            <span
              className="fbox"
              onClick={() => setRemember(!remember)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontFamily: MONO,
                fontSize: 13,
                letterSpacing: ".06em",
                padding: "11px 13px",
                margin: "12px 0 18px",
                border: `1px solid ${remember ? "var(--grn)" : "var(--line)"}`,
                color: remember ? "var(--grn)" : "var(--muted)",
              }}
            >
              <span>{t("Beni hatırla")}</span>
              <span>{remember ? "[✓]" : "[ ]"}</span>
            </span>

            {error && <Err text={error} />}

            <span
              className="fbox"
              onClick={() => email && !busy && startLogin()}
              style={actionStyle(true, busy || !email)}
            >
              {busy ? t("GÖNDERİLİYOR…") : t("KOD GÖNDER")}
            </span>

            {/* Google düğmesi yalnız yapılandırıldıysa çizilir (bkz. lib/google-auth.ts):
                çalışmayan bir düğme göstermek, göstermemekten kötü. */}
            {googleOn && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0" }}>
                  <span style={{ flex: 1, height: 1, background: "var(--line3)" }} />
                  <span style={{ fontFamily: SPACE, fontSize: 11, letterSpacing: ".2em", color: "var(--faint)" }}>{t("VEYA")}</span>
                  <span style={{ flex: 1, height: 1, background: "var(--line3)" }} />
                </div>
                <a
                  href={`/api/auth/google?remember=${remember ? "1" : "0"}`}
                  className="fbox"
                  style={{ ...actionStyle(false), display: "flex", alignItems: "center", justifyContent: "center", gap: 10, textDecoration: "none" }}
                >
                  <GoogleMark />
                  {t("GOOGLE İLE DEVAM ET")}
                </a>
              </>
            )}
          </>
        ) : step === "kod" ? (
          /* ----------------------------------------------------------- kod --- */
          <>
            <div style={{ fontFamily: MONO, fontSize: 13, lineHeight: 1.7, color: "var(--muted)", marginBottom: 18 }}>
              <span style={{ color: "var(--fg)" }}>{email}</span>{" "}
              {t("adresine 6 haneli bir kod gönderildi. 10 dakika geçerli.")}
            </div>

            {/* E-posta sağlayıcısı henüz bağlı değil: kod ekranda gösteriliyor.
                Canlıda AUTH_DEV_CODES=0 ile bu blok hiç çizilmez. */}
            {devCode && (
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 13,
                  lineHeight: 1.7,
                  color: "var(--muted2)",
                  border: "1px dashed var(--grn)",
                  padding: "11px 13px",
                  marginBottom: 16,
                }}
              >
                {t("e-posta sağlayıcısı bağlı değil — kod:")}{" "}
                <span style={{ color: "var(--grn)", fontSize: 19, letterSpacing: ".3em" }}>{devCode}</span>
              </div>
            )}

            <div style={HEAD}>{t("KOD")}</div>
            <input
              ref={firstField}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && code.length === 6 && doVerify()}
              placeholder="——————"
              style={{ ...INPUT, fontSize: 26, letterSpacing: ".42em", textAlign: "center" }}
            />

            {error && <Err text={error} />}

            <div style={{ marginTop: 16 }}>
              <span
                className="fbox"
                onClick={() => code.length === 6 && !busy && doVerify()}
                style={actionStyle(true, busy || code.length !== 6)}
              >
                {busy ? t("KONTROL EDİLİYOR…") : t("GİRİŞ YAP")}
              </span>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <span className="fbox" onClick={() => setStep("eposta")} style={{ ...actionStyle(false), flex: 1 }}>
                {t("← ADRESİ DEĞİŞTİR")}
              </span>
              <span className="fbox" onClick={() => !busy && sendCode()} style={{ ...actionStyle(false, busy), flex: 1 }}>
                {t("YENİ KOD")}
              </span>
            </div>
          </>
        ) : step === "parola" ? (
          /* -------------------------------------------------------- parola --- */
          <>
            <div style={{ fontFamily: MONO, fontSize: 13, lineHeight: 1.7, color: "var(--muted)", marginBottom: 18 }}>
              <span style={{ color: "var(--fg)" }}>{email}</span> · {t("parola ile giriş")}
            </div>

            <div style={HEAD}>{t("PAROLA")}</div>
            <input
              ref={firstField}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && password && doPassword()}
              placeholder="••••••••"
              style={INPUT}
            />

            {error && <Err text={error} />}

            <div style={{ marginTop: 16 }}>
              <span
                className="fbox"
                onClick={() => password && !busy && doPassword()}
                style={actionStyle(true, busy || !password)}
              >
                {busy ? t("KONTROL EDİLİYOR…") : t("GİRİŞ YAP")}
              </span>
            </div>
            <div style={{ marginTop: 10 }}>
              <span className="fbox" onClick={() => setStep("eposta")} style={actionStyle(false)}>
                {t("← GERİ")}
              </span>
            </div>
          </>
        ) : (
          /* ---------------------------------------------------------- nick --- */
          <>
            <div style={{ fontFamily: MONO, fontSize: 13, lineHeight: 1.7, color: "var(--muted)", marginBottom: 18 }}>
              {t("kendine bir")} <span style={{ color: "var(--fg)" }}>{t("nick")}</span>{" "}
              {t("seç. hesabın için gereken tek şey bu — başka bilgi istemiyoruz.")}
            </div>
            <div style={HEAD}>{t("NİCK")}</div>
            <input
              ref={firstField}
              value={nick}
              maxLength={24}
              onChange={(e) => setNick(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && nick.length >= 2 && doNick()}
              placeholder={t("ör. kuytu")}
              style={INPUT}
            />
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".06em", color: "var(--faint)", marginTop: 8 }}>
              {t("2–24 karakter · harf, rakam, . _ -")}
            </div>

            {error && <Err text={error} />}

            <div style={{ marginTop: 18 }}>
              <span
                className="fbox"
                onClick={() => nick.length >= 2 && !busy && doNick()}
                style={actionStyle(true, busy || nick.length < 2)}
              >
                {busy ? t("KAYDEDİLİYOR…") : t("BİTİR")}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Err({ text }: { text: string }) {
  // Hata metinleri sunucudan TÜRKÇE geliyor; sözlükte karşılığı varsa çevrilir,
  // yoksa olduğu gibi gösterilir (bkz. lib/i18n.ts).
  const t = useT();
  return (
    <div
      style={{
        fontFamily: MONO,
        fontSize: 12,
        lineHeight: 1.6,
        color: "var(--fg-bright)",
        border: "1px solid var(--fg-bright)",
        padding: "9px 11px",
        marginTop: 14,
      }}
    >
      {t(text)}
    </div>
  );
}

/** Google'ın dört renkli "G"si — dış kaynak yüklemeden, tek satır SVG. */
function GoogleMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 48 48" style={{ display: "block", flex: "none" }}>
      <path fill="#4285F4" d="M45 24c0-1.6-.1-2.7-.4-4H24v7.5h12c-.2 2-1.6 5-4.5 7l7 5.4C42.6 36 45 30.6 45 24Z" />
      <path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.4l-7-5.4c-1.9 1.3-4.4 2.2-7.6 2.2-5.8 0-10.7-3.9-12.5-9.1l-7.2 5.6C7.9 41 15.4 46 24 46Z" />
      <path fill="#FBBC05" d="M11.5 28.3c-.5-1.4-.7-2.8-.7-4.3s.3-3 .7-4.3l-7.2-5.6C2.8 17 2 20.4 2 24s.8 7 2.3 9.9l7.2-5.6Z" />
      <path fill="#EA4335" d="M24 10.8c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 4.3 30 2 24 2 15.4 2 7.9 7 4.3 14.1l7.2 5.6C13.3 14.7 18.2 10.8 24 10.8Z" />
    </svg>
  );
}
