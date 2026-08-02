"use client";
import { useStore } from "@/store";
import { useLang } from "@/lib/lang";

/**
 * Üst şeritteki hesap düğmesi — üyeliğin arayüzdeki klasik yeri (sağ üst).
 * Giriş yapılmadıysa "GİRİŞ", yapıldıysa nick gösterir; ikisi de aynı modalı açar.
 */
export function AccountButton({ className }: { className?: string }) {
  const me = useStore((s) => s.me);
  const openAuth = useStore((s) => s.openAuth);
  const { t, lang } = useLang();
  const signedIn = Boolean(me && !me.needsNick);

  return (
    <span
      className={`nav-item ${className ?? ""}`}
      onClick={openAuth}
      title={signedIn ? t("Hesabım") : t("Giriş yap veya hesap aç")}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        letterSpacing: ".16em",
        color: signedIn ? "var(--grn)" : "var(--muted)",
        maxWidth: 190,
      }}
    >
      <UserIcon />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {/* Büyük harf DİLE bağlı: "tr" sabitken İngilizce arayüzde "emir" → "EMİR"
            çıkıyordu. Sayfanın geri kalanı (ürün adı, marka adı) CSS text-transform ile
            zaten `<html lang>`i izliyor; burada dönüşüm JS'te olduğu için dili elle
            vermek gerekiyor — tek fark bu. */}
        {signedIn ? me!.nick?.toLocaleUpperCase(lang) : t("GİRİŞ")}
      </span>
    </span>
  );
}

function UserIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ display: "block", flex: "none" }}>
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.9" />
      <path d="M4.5 20.5c1.4-3.6 4.2-5.5 7.5-5.5s6.1 1.9 7.5 5.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}
