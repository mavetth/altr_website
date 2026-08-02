import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LangProvider } from "@/lib/lang";
import { asLang, LANG_COOKIE } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "altr — alternatif giyim vitrini",
  description:
    "Alt markaların ürünlerini tek çatı altında, canlı ve yan yana gösteren alternatif giyim aggregator'ı.",
};

// Tema flash'ını önle: React hydrate olmadan data-theme'i (ve tema ile eşleşen
// favicon'u — bkz. #theme-favicon, store.ts setTheme ile de senkron tutuluyor) ayarla.
// Kayıtlı tercih yoksa (ilk ziyaret) sistem tercihine bakılmaz — varsayılan her
// zaman GECE'dir.
const themeScript = `
(function(){try{
  var t = localStorage.getItem('altr-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', t);
  var link = document.getElementById('theme-favicon');
  if(link) link.setAttribute('href', '/favicon-' + t + '.png');
}catch(e){ document.documentElement.setAttribute('data-theme','dark'); }})();
`;

/**
 * Dil ÇEREZDEN okunur, localStorage'dan değil: metin ilk boyamada doğru olmak zorunda
 * (bkz. lib/lang.tsx). Tüm sayfalar zaten `force-dynamic`, yani `cookies()` burada
 * fazladan bir maliyet getirmiyor.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = asLang((await cookies()).get(LANG_COOKIE)?.value);

  return (
    <html lang={lang} data-theme="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Anton&family=IBM+Plex+Mono:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
        {/* varsayılan: koyu tema logosu — açık temaya geçince #theme-favicon'un href'i
            hem bu sayfadaki blocking script'te hem store.ts setTheme'de güncellenir */}
        <link id="theme-favicon" rel="icon" href="/favicon-dark.png" type="image/png" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <LangProvider initial={lang}>{children}</LangProvider>
      </body>
    </html>
  );
}
