import { LoadingSpinner } from "./LoadingSpinner";

/**
 * SAYFA/FİLTRE GEÇİŞLERİNDE İÇERİĞİ SİLMEDEN yükleniyor göstergesi.
 *
 * Eskiden ör. marka sayfasında sayfa değiştirince tüm ızgara (hero, kategori
 * çipleri dâhil) `null`'a düşüyor, yerine tek satır "yükleniyor…" yazısı geliyordu —
 * ekran bir anlığına tamamen boşalıyordu. Bunun yerine ESKİ içerik yerinde kalır,
 * bu overlay onun ÜSTÜNE biner; yeni veri gelince overlay kalkar, içerik yerinde
 * değişir.
 *
 * KONUM `fixed`: `absolute` olsaydı, altındaki (48 ürünlük, ekrandan çok uzun)
 * ızgaranın TAM ortasına oturuyordu — sayfa başındaysanız halka kaydırmadan
 * görünmüyordu. `fixed` + `inset:0` ile her zaman GÖRÜNÜR EKRANIN ortasında durur,
 * kaydırma konumundan ve mobil/masaüstü fark etmeksizin.
 */
export function LoadingOverlay({ label }: { label?: string }) {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 55,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        opacity: 0.72,
      }}
    >
      <LoadingSpinner label={label} />
    </div>
  );
}
