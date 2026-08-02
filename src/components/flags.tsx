/**
 * Dil bayrakları — GÖMÜLÜ SVG.
 *
 * Emoji bayrağı (🇹🇷/🇺🇸) kullanılmadı: Windows'un sistem fontunda bölgesel gösterge
 * çifti yok, bayrak yerine düz "TR"/"US" harfleri çiziliyor. Görsel dosyası ise iki
 * fazladan istek demekti; ikisi de tek satırlık bir bayrak için fazla.
 *
 * Renk `filter: grayscale()` ile sönükleştiriliyor (bkz. intro.css / globals.css):
 * seçili olmayan dil renksiz durur, seçili olan tek renkli öğedir.
 */

export function FlagTR({ w = 26 }: { w?: number }) {
  return (
    <svg width={w} height={(w * 2) / 3} viewBox="0 0 30 20" aria-hidden style={{ display: "block" }}>
      <rect width="30" height="20" fill="#E30A17" />
      <circle cx="12" cy="10" r="5" fill="#fff" />
      <circle cx="13.6" cy="10" r="4" fill="#E30A17" />
      <path d="M18.4 10 21.7 8.9l-2.05 2.82V8.18l2.05 2.82z" fill="#fff" />
    </svg>
  );
}

export function FlagUS({ w = 26 }: { w?: number }) {
  return (
    <svg width={w} height={(w * 2) / 3} viewBox="0 0 30 20" aria-hidden style={{ display: "block" }}>
      <rect width="30" height="20" fill="#fff" />
      {/* 13 şeridin kırmızı olan 7'si */}
      {[0, 2, 4, 6, 8, 10, 12].map((i) => (
        <rect key={i} y={(i * 20) / 13} width="30" height={20 / 13} fill="#B22234" />
      ))}
      <rect width="13" height={(7 * 20) / 13} fill="#3C3B6E" />
      {/* Yıldızlar temsilî: 30×20'lik bir bayrakta 50 yıldız çizilemez, nokta ızgarası
          aynı işareti veriyor. */}
      {[0, 1, 2, 3].map((r) =>
        [0, 1, 2, 3, 4].map((c) => (
          <circle
            key={`${r}-${c}`}
            cx={1.4 + c * 2.6 + (r % 2 ? 1.3 : 0)}
            cy={1.5 + r * 2.6}
            r="0.62"
            fill="#fff"
          />
        )),
      )}
    </svg>
  );
}
