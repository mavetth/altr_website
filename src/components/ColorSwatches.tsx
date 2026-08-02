"use client";
import { useEffect, useState, type CSSProperties } from "react";
import type { Variant } from "@/lib/types";
import { hexToTag, nameToTags } from "@/lib/color-tags";
import { colorToHex } from "@/lib/colors";
import { dominantColor, loadPersisted, olcumUrl } from "@/lib/dominant-color";
import { useT } from "@/lib/lang";

/**
 * Ürünün renk seçicisi. Tek renkli üründe hiç çizilmez — yalnız bir nokta göstermek
 * hem bilgi vermiyor hem satırı kirletiyordu.
 *
 * Seçili renk, noktanın ETRAFINDAKİ halkayla belirtilir (noktanın kendi rengi bozulmasın:
 * siyah bir varyantın seçili hâli de siyah kalmalı). Halka sert bir kutu-gölge — sitenin
 * yumuşak geçiş kullanmayan diline uygun, anlık değişir.
 *
 * GÖRSELDEN RENK: nokta rengi, `images` verildiği sürece ürün fotoğrafından ölçülür.
 * Eskiden bu yalnız "hex'ler varyantları ayırt edemiyorsa" devreye giriyordu; o koşul
 * asıl sorunu hiç yakalamıyordu: marka panelinden gelen hex'ler FARKLI ama YANLIŞ
 * olabiliyor (renk adı "Nefti" ama kod düz siyah girilmiş), ya da sözlüğümüz bilmediği
 * renge uydurma bir gri veriyor. İkisinde de nokta gerçek renkte değildi.
 *
 * ÖLÇÜM RENK ADIYLA ÇELİŞEMEZ (2026-07-31). Ölçüm tek başına sanıldığı kadar iyi değil:
 * 319 varyantlık örneklemde (renk adı bilinen aileye çözülen, kendi fotoğrafı olan
 * varyantlar) ölçülen rengin adın söylediği aileye düşme oranı %51,1 — markanın hex'i
 * ise %84,6. Sebebi ölçümün kendisi: stüdyo fotoğrafında beyaz zemin, model fotoğrafında
 * ten ve arka plan baskın kovayı ele geçiriyor, "Siyah" varyantın noktası açık gri
 * çıkıyor. Bu yüzden ölçüm artık HAKEM değil ADAY — sıralı eleme için bkz.
 * {@link noktaRengi}. Ölçüm hâlâ varyantların yarısında kullanılıyor (163/319), çünkü
 * doğru olduğunda tonu hex'ten daha iyi veriyor; ada aykırı düştüğünde eleniyor.
 * Deney: örneklem katalogdan, görseller /api/img'den, sınıflandırma lib/color-tags.ts.
 *
 * İKİNCİ İSTİSNA — AYNI FOTOĞRAFI PAYLAŞAN VARYANTLAR: markaların bir kısmı bütün renkler
 * için tek fotoğraf seti veriyor (ör. Deer Wear'ın F1 tişörtü: "Beyaz" ve "Siyah"
 * varyantlarının ikisi de images[0]'ı gösteriyor). Ölçüm aynı fotoğraftan yapıldığı için
 * iki nokta da AYNI renkte çıkıyordu — kullanıcı iki özdeş daire görüyordu. Fotoğraf o
 * varyantları ayırt edemiyorsa ölçüm bir şey söylemiyor demektir; orada tek ayırt edici
 * kaynak markanın verdiği hex'tir ve nokta ona döner. Katalogda bu durumda olan 2.369
 * ürün var (çok renkli ürünlerin %9,2'si).
 *
 * Ölçümün kendisi lib/dominant-color.ts'te — modal da (renk seçilince hangi fotoğrafın
 * gösterileceği için) aynı hesabı ve aynı önbelleği kullanıyor.
 */
function swatchUrl(images: string[], v: Variant): string | null {
  const src = images[v.imgs?.[0] ?? -1];
  return src ? olcumUrl(src) : null;
}

/**
 * Noktanın rengi. ÜÇ kaynak var ve hiçbiri tek başına güvenilir değil:
 * fotoğraftan ölçüm (zemin/ten yüzünden şaşabilir), markanın hex'i (yer tutucu
 * olabiliyor — "#ccc"), renk adı sözlüğü (ada sadık ama tonu genel).
 *
 * Kural: NOKTA YAZAN RENK ADIYLA ÇELİŞEMEZ. Ad bir aileye çözülüyorsa adaylar
 * sırayla sınanır ve o aileye düşen ilki kazanır — en özelden en genele:
 *   1. ölçüm  (o ürünün gerçek tonu)
 *   2. markanın hex'i
 *   3. renk adının sözlükteki karşılığı
 * Hiçbiri geçmezse elde ne varsa çizilir (boş nokta hiç bilgi vermez).
 * Ad hiçbir aileye çözülmüyorsa ("Nefti", "01", "-") sınayacak bilgi yoktur;
 * orada ölçüm eskisi gibi tek başına karar verir.
 */
function noktaRengi(v: Variant, olcum: string): string {
  const adAileleri = nameToTags(v.color ?? "");
  const adaylar = [olcum, v.hex, adAileleri.length ? colorToHex(v.color ?? "") : ""];
  if (!adAileleri.length) return olcum || v.hex || "";
  for (const aday of adaylar) {
    if (!aday) continue;
    const aile = hexToTag(aday);
    if (aile && adAileleri.includes(aile)) return aday;
  }
  return v.hex || olcum || "";
}

export function ColorSwatches({
  variants,
  active,
  onPick,
  size = 16,
  max = 6,
  style,
  images,
}: {
  variants: Variant[];
  active: number;
  onPick: (i: number) => void;
  size?: number;
  /** Kartta yer sınırlı: fazlası "+N" olarak özetlenir. */
  max?: number;
  style?: CSSProperties;
  /** Ürünün görsel havuzu (Product.images). Verilirse ayırt edilemeyen renklerde renk görselden türetilir. */
  images?: string[];
}) {
  // Görsel havuzu verildiyse nokta rengi HER ZAMAN fotoğraftan ölçülür (bkz. üstteki not).
  const derive = !!images && variants.length >= 2;

  // Ölçülen renkler: varyant indeksi -> hex (state, çünkü async gelir).
  const [derived, setDerived] = useState<Record<number, string>>({});
  const t = useT();
  useEffect(() => {
    if (!derive || !images) return;
    let alive = true;
    loadPersisted();
    (async () => {
      const next: Record<number, string> = {};
      await Promise.all(
        variants.map(async (v, i) => {
          const url = swatchUrl(images, v);
          if (!url) return;
          const hex = await dominantColor(url);
          if (hex) next[i] = hex;
        }),
      );
      if (alive) setDerived(next);
    })();
    return () => {
      alive = false;
    };
    // variants kimliği ürün başına sabit; images referansı da öyle
  }, [derive, images, variants]);

  if (variants.length < 2) return null;

  /**
   * Birden fazla varyantın gösterdiği fotoğraflar. Bu fotoğraftan yapılan ölçüm o
   * varyantları ayırt edemez (hepsi için aynı rengi verir), o yüzden oralarda ölçüm
   * değil markanın hex'i kullanılır — bkz. dosyanın başındaki not.
   */
  const paylasilan = new Set<string>();
  if (derive && images) {
    const gorulen = new Set<string>();
    for (const v of variants) {
      const u = swatchUrl(images, v);
      if (!u) continue;
      if (gorulen.has(u)) paylasilan.add(u);
      else gorulen.add(u);
    }
  }

  // Seçili renk sınırın dışında kalıyorsa pencereyi kaydır ki seçim daima görünür olsun.
  const start = active >= max ? active - max + 1 : 0;
  const shown = variants.slice(start, start + max);
  const hidden = variants.length - shown.length;

  return (
    <div
      className="color-row"
      style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", ...style }}
    >
      {shown.map((v, i) => {
        const idx = start + i;
        const on = idx === active;
        const url = derive && images ? swatchUrl(images, v) : null;
        // Fotoğraf bu varyantı komşusundan ayıramıyorsa ölçüm bir şey söylemiyor.
        const olcum = url && !paylasilan.has(url) ? derived[idx] : "";
        const hex = noktaRengi(v, olcum);
        return (
          <span
            key={idx}
            className={`swatch${on ? " is-on" : ""}`}
            title={v.color || t("renk")}
            onClick={(e) => {
              // kart tıklaması ürün modalını açıyor; renk seçimi onu tetiklemesin
              e.stopPropagation();
              onPick(idx);
            }}
            style={{
              width: size,
              height: size,
              borderRadius: "50%",
              background: hex,
              // Çerçeve + içeriden ince bir gölge: beyaz/krem nokta açık temada
              // zemine karışıyordu, siyah nokta koyu temada. İkisini de kenarı
              // görünür kılan tek çözüm dıştan çizgi + içten kontur.
              border: "1px solid rgba(128,128,128,.75)",
              boxShadow: on
                ? "0 0 0 2px var(--bg), 0 0 0 4px var(--grn)"
                : "inset 0 0 0 1px rgba(0,0,0,.22)",
              flex: "none",
              cursor: "pointer",
            }}
          />
        );
      })}
      {hidden > 0 && (
        <span
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            color: "var(--muted3)",
            letterSpacing: ".04em",
          }}
        >
          +{hidden}
        </span>
      )}
    </div>
  );
}
