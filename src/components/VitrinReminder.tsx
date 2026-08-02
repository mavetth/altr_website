"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/store";
import { useT } from "@/lib/lang";
import { HangerIcon } from "./icons";

// Sayfa başından bu kadar aşağı inince belirir; bu kadarın altına dönünce kaybolur.
// Aradaki boşluk (hysteresis) tam eşikte titremeyi (flicker) önler.
const SHOW_AFTER = 320;
const HIDE_BELOW = 120;

/**
 * Mobilde vitrine ürün eklendiğini sürekli hatırlatan, kaydırmaya bağlı yüzen rozet.
 * Sayfa başında (sidebar'daki VİTRİNİM zaten görünürken) gizli kalır; aşağı inildiğinde
 * belirir, dokununca Vitrinim görünümüne götürür. Masaüstünde CSS ile tamamen gizlenir.
 */
export function VitrinReminder() {
  const count = useStore((s) => s.showcase.length);
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const [visible, setVisible] = useState(false);
  const t = useT();

  useEffect(() => {
    // Basit eşik kontrolü — rAF ile toplu işleme (throttle) burada gereksiz
    // karmaşıklıktı ve arkaplan sekmelerinde rAF gecikmesi yüzünden geçişleri
    // kaçırabiliyordu; her scroll olayında doğrudan hesapla.
    const onScroll = () => {
      const y = window.scrollY;
      setVisible((prev) => {
        if (!prev && y > SHOW_AFTER) return true;
        if (prev && y < HIDE_BELOW) return false;
        return prev;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll(); // sayfa kaydırılmış halde açılmışsa (geri navigasyon) baştan doğru durum
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (count === 0 || view === "vitrin" || !visible) return null;

  return (
    <div
      key={count /* içerik değişince (yeni ürün eklenince) giriş animasyonu tekrar oynasın */}
      className="vitrin-reminder"
      data-vitrin-target="reminder"
      onClick={() => {
        setView("vitrin");
        window.scrollTo({ top: 0, behavior: "auto" });
      }}
    >
      <HangerIcon size={12} />
      <span>
        {t("VİTRİN")} <b>{count}</b>
      </span>
    </div>
  );
}
