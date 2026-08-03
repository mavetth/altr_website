"use client";
import { useEffect, useState } from "react";

/**
 * `active` en az `delay` ms KESİNTİSİZ true kalırsa true döner; daha kısa süren
 * yüklemelerde hiç true olmaz. Yükleniyor ekranları (bkz. LoadingOverlay, BrandViews
 * `Loading`) buna sarılı: yerel/hızlı isteklerde bir anlık göz kırpma (flicker)
 * yerine hiçbir şey göstermemek, tam ekran yükleniyor halkası göstermekten iyidir —
 * halka ancak gerçekten beklenecek bir şey varsa (>500ms) belirir.
 *
 * `active` false olur olmaz ANINDA false'a döner (bekleme bitince gecikme yok).
 */
export function useDelayedFlag(active: boolean, delay = 500): boolean {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!active) {
      setShow(false);
      return;
    }
    const timer = window.setTimeout(() => setShow(true), delay);
    return () => window.clearTimeout(timer);
  }, [active, delay]);

  return show;
}
