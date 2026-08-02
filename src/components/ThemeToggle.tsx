"use client";
import { useStore } from "@/store";
import { useT } from "@/lib/lang";
import { SunIcon, MoonIcon } from "./icons";

export function ThemeToggle() {
  const t = useT();
  const theme = useStore((s) => s.theme);
  const toggle = useStore((s) => s.toggleTheme);
  const isLight = theme === "light";

  return (
    <div
      className="theme-row"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        width: "100%",
      }}
    >
      <span
        className="t-label"
        style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: 12,
          letterSpacing: ".2em",
          color: isLight ? "var(--muted3)" : "var(--grn)",
        }}
      >
        {t("GECE")}
      </span>
      <button
        type="button"
        className="theme-switch"
        role="switch"
        aria-checked={isLight}
        aria-label={t("Tema değiştir")}
        onClick={toggle}
      >
        <span className="knob">{isLight ? <SunIcon size={13} /> : <MoonIcon size={13} />}</span>
      </button>
      <span
        className="t-label"
        style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: 12,
          letterSpacing: ".2em",
          color: isLight ? "var(--grn)" : "var(--muted3)",
        }}
      >
        {t("GÜNDÜZ")}
      </span>
    </div>
  );
}
