import { useState, useRef, useEffect } from "react";
import { useLang } from "../i18n";
import type { Lang } from "../i18n/types";
import s from "./Navbar.module.css";

const LANGS: { lang: Lang; src: string; label: string }[] = [
  { lang: "sv", src: "https://flagcdn.com/se.svg", label: "Svenska" },
  { lang: "en", src: "https://flagcdn.com/us.svg", label: "English" },
];

export function Navbar() {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const current = LANGS.find((l) => l.lang === lang) ?? LANGS[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, []);

  // Close dropdown on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <nav className={s.nav}>
      {/* Logo */}
      <span className={s.logo}>Doftanalys.se</span>

      {/* Language selector */}
      <div ref={wrapperRef} className={s.langWrapper}>
        <button
          className={s.langBtn}
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Välj språk / Select language"
        >
          <img src={current.src} alt={current.label} className={s.flag} />
          {current.label}
          <svg
            className={`${s.chevron} ${open ? s.chevronOpen : ""}`}
            width="11"
            height="11"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M2 4l4 4 4-4" />
          </svg>
        </button>

        {open && (
          <div className={s.dropdown} role="listbox" aria-label="Välj språk">
            {LANGS.map(({ lang: l, src, label }) => (
              <button
                key={l}
                role="option"
                aria-selected={lang === l}
                className={`${s.option} ${lang === l ? s.optionActive : ""}`}
                onClick={() => {
                  setLang(l);
                  setOpen(false);
                }}
              >
                <img src={src} alt={label} className={s.flag} />
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
