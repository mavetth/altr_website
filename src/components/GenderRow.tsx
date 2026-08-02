"use client";
import { Fragment, type CSSProperties } from "react";
import { GENDERS } from "@/lib/query";
import { useStore } from "@/store";
import { useT } from "@/lib/lang";

/**
 * Kadın/erkek filtre satırı — hem masaüstü sidebar'ında hem mobildeki (logo/vitrinim
 * ile kategori şeridi arasındaki) yerleşimde kullanılan, kendi state'ini yöneten bileşen
 * (bkz. Sidebar.tsx / App.tsx). İkisi aynı anda seçilebilir; hiçbiri seçili değilse
 * filtre uygulanmaz (unisex ürünler zaten her seçimde görünür).
 */
export function GenderRow({ className, style }: { className?: string; style?: CSSProperties }) {
  const genders = useStore((s) => s.query.genders);
  const toggleGender = useStore((s) => s.toggleGender);
  const t = useT();

  return (
    <div className={className} style={style}>
      {GENDERS.map((g, i) => {
        const on = genders.includes(g.k);
        return (
          <Fragment key={g.k}>
            {i > 0 && <span className="side-gender-divider" />}
            <span
              className="nav-item"
              onClick={() => toggleGender(g.k)}
              // İkisi birden seçilebildiği için hangi(ler)inin açık olduğu tek başına
              // renkten anlaşılmalı: seçiliye altı çizili + köşeli parantez işareti.
              style={{
                flex: 1,
                textAlign: "center",
                fontFamily: "'Space Mono', monospace",
                fontSize: 14,
                letterSpacing: ".14em",
                color: on ? "var(--grn)" : "var(--muted)",
                borderBottom: `1px solid ${on ? "var(--grn)" : "transparent"}`,
                paddingBottom: 2,
              }}
            >
              {t(g.label)}
            </span>
          </Fragment>
        );
      })}
    </div>
  );
}
