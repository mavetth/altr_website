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
  // Giriş animasyonu (`reminderup`) sürerken true — bitince false'a düşer ve o andan
  // sonra rozet TAMAMEN statik yerleşiminde (bkz. globals.css `--enter`/settled ayrımı).
  // Bu ayrım olmadan `.vf-hit` (ekleme varışı) `animation`ı geçici değiştirdiğinde,
  // varış bitince kısayol (shorthand) `reminderup`a "geri dönüyor" ve tarayıcı bunu
  // YENİ bir oynatım sayıp baştan başlatıyordu — rozet varıştan hemen sonra bir kez
  // daha aşağıdan kayıp beliriyordu. Girişi ayrı bir sınıfa taşıyıp bittiğinde
  // sınıftan düşürmek, "geri dönülecek" bir giriş animasyonu bırakmıyor.
  const [entering, setEntering] = useState(true);
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
      // `key={count}` BİLEREK YOK: eskiden buradaydı ve her eklemede rozeti tamamen
      // yok edip yeniden kuruyordu — kayarak giren `reminderup` animasyonu baştan
      // oynuyordu. Bunun asıl sorunu: flyToVitrin (vitrin-flight.ts) zaten görseli
      // karttan buraya uçurup varışta `.vf-hit` ile rozeti canlandırıyor (bkz. globals.css
      // `.vitrin-reminder.vf-hit`); uçuş ~640ms sürdüğü için `count` değişince ANINDA
      // yok edilen rozet, uçuş varınca artık DOM'da olmuyordu — iki efekt çakışıyordu.
      // Rozet artık YALNIZ ilk görünürlük eşiğinde (kaydırma) kendi girişini oynar,
      // ekleme geri bildirimini tek başına uçuş+varış efekti taşır.
      className={`vitrin-reminder${entering ? " vitrin-reminder--enter" : ""}`}
      data-vitrin-target="reminder"
      onAnimationEnd={(e) => {
        if (e.animationName === "reminderup") setEntering(false);
      }}
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
