"use client";
import { useLang } from "@/lib/lang";
import { FlagTR, FlagUS } from "./flags";

/**
 * DİL ANAHTARI — karşılama modalının dışındaki ikinci giriş.
 *
 * Modal cihaz başına bir kez açılıyor; ondan sonra dil değiştirmenin bir yolu olmalı.
 * Yeri tema anahtarının hemen altı: ikisi de "sitenin nasıl görüneceği" ayarı ve
 * kullanıcı biri için oraya bakıyorsa diğerini de orada arıyor. Mobilde tema anahtarı
 * üst şeride taşınıyor (globals.css `.topbar-theme`), bu da onunla birlikte gidiyor.
 *
 * Gerçek `<button>`: sitenin genelinde tıklanabilirler `<span onClick>` ama dil
 * değiştirmek klavyeyle de yapılabilmeli — `aria-pressed` ile hangi dilin açık
 * olduğu ekran okuyucuya da düşüyor.
 */
export function LangToggle({ className }: { className?: string }) {
  const { lang, setLang } = useLang();

  return (
    <div className={`lang-row${className ? ` ${className}` : ""}`}>
      <button
        type="button"
        className="lang-btn"
        aria-pressed={lang === "tr"}
        aria-label="Türkçe"
        title="Türkçe"
        onClick={() => setLang("tr")}
      >
        <FlagTR w={22} />
        <span>TR</span>
      </button>
      <button
        type="button"
        className="lang-btn"
        aria-pressed={lang === "en"}
        aria-label="English"
        title="English"
        onClick={() => setLang("en")}
      >
        <FlagUS w={22} />
        <span>EN</span>
      </button>
    </div>
  );
}
