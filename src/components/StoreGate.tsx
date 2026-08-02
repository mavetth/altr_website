"use client";
import { useState } from "react";
import { trackOutbound } from "@/lib/track";
import { GoModal } from "./GoModal";
import { useT } from "@/lib/lang";

/**
 * Marka sayfasındaki MAĞAZAYA GİT düğmesi.
 *
 * Eskiden düz bir `<a target="_blank">` idi: tıklayınca hiçbir ritüel olmadan mağaza
 * açılıyordu — vitrindeki ürün çıkışıyla (kaydırma onayı + glitch + gecikme) tutarsızdı.
 * Artık iki yol da GoModal'dan geçiyor ve hedef her zaman YENİ SEKMEDE açılıyor.
 */
export function StoreGate({
  brand,
  brandSlug,
  url,
}: {
  brand: string;
  brandSlug: string;
  url: string;
}) {
  const [open, setOpen] = useState(false);
  const [going, setGoing] = useState(false);
  const t = useT();

  return (
    <>
      <span
        className="cta-btn"
        onClick={() => {
          setGoing(false);
          setOpen(true);
        }}
        role="button"
        style={{
          fontFamily: "'Space Mono', monospace",
          fontWeight: 700,
          fontSize: 13,
          letterSpacing: ".14em",
          padding: "13px 20px",
          background: "var(--grn)",
          color: "var(--on-accent)",
          borderRadius: 9,
          cursor: "pointer",
        }}
      >
        {t("MAĞAZAYA GİT ↗")}
      </span>

      {open && (
        <GoModal
          brand={brand}
          brandSlug={brandSlug}
          destUrl={url}
          going={going}
          setGoing={setGoing}
          onConfirm={() => trackOutbound({ url, brand, brandSlug })}
          onClose={() => {
            setOpen(false);
            setGoing(false);
          }}
        />
      )}
    </>
  );
}
