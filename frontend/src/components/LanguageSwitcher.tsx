import { useLang } from "../i18n";
import s from "./LanguageSwitcher.module.css";

export function LanguageSwitcher() {
  const { lang, setLang } = useLang();
  return (
    <div className={s.wrapper}>
      <button
        className={`${s.flag} ${lang === "sv" ? s.active : ""}`}
        onClick={() => setLang("sv")}
        aria-label="Svenska"
        title="Svenska"
      >
        🇸🇪
      </button>
      <button
        className={`${s.flag} ${lang === "en" ? s.active : ""}`}
        onClick={() => setLang("en")}
        aria-label="English"
        title="English"
      >
        🇺🇸
      </button>
    </div>
  );
}
