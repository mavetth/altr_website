"use client";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  DEFAULT_LANG,
  LANG_COOKIE,
  LANG_KEY,
  formatCount,
  translate,
  type Lang,
} from "./i18n";

/**
 * DİL BAĞLAMI.
 *
 * Neden zustand store'da DEĞİL: dil ilk boyamada ZATEN doğru olmak zorunda. Tema
 * CSS'ten geldiği için store'un `init()`ini bekleyebiliyor (bkz. store.ts), ama METİN
 * bekleyemez — sunucu Türkçe basıp istemci İngilizceye çevirseydi React hidrasyon
 * uyuşmazlığı verirdi ve ekran bir kare Türkçe yanıp sönerdi.
 *
 * Bu yüzden dil ÇEREZDEN okunuyor (`layout.tsx`, sunucuda) ve buraya başlangıç değeri
 * olarak veriliyor: sunucu ile istemci aynı dili çiziyor. `setLang` her iki yere de
 * yazar — çerez sunucunun okuduğu yer, localStorage ise çerezi silinmiş/engellenmiş
 * tarayıcıda yedek.
 */

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Türkçe metni aktif dile çevirir; sözlükte yoksa Türkçesi döner. */
  t: (text: string) => string;
  /** Dile göre binlik ayracı. */
  n: (value: number) => string;
}

const Ctx = createContext<LangCtx>({
  lang: DEFAULT_LANG,
  setLang: () => {},
  t: (s) => s,
  n: (v) => formatCount(v, DEFAULT_LANG),
});

/** Çerez bir yıl yaşar; dil tercihi oturumluk bir şey değil. */
function writeCookie(l: Lang) {
  try {
    document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    /* yoksay */
  }
}

export function LangProvider({
  initial,
  children,
}: {
  initial: Lang;
  children: React.ReactNode;
}) {
  const [lang, setLangState] = useState<Lang>(initial);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    writeCookie(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {
      /* yoksay */
    }
    // Ekran okuyucu ve tarayıcı çevirisi doğru dili görsün.
    if (typeof document !== "undefined") document.documentElement.lang = l;
  }, []);

  const value = useMemo<LangCtx>(
    () => ({
      lang,
      setLang,
      t: (text: string) => translate(lang, text),
      n: (value: number) => formatCount(value, lang),
    }),
    [lang, setLang],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang(): LangCtx {
  return useContext(Ctx);
}

/** Kısayol: yalnız çeviri fonksiyonu gerekiyorsa. */
export function useT(): (text: string) => string {
  return useContext(Ctx).t;
}
