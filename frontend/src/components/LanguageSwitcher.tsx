import { useLang } from "../i18n";
import s from "./LanguageSwitcher.module.css";

const FLAGS = [
  { lang: "sv" as const, src: "https://flagcdn.com/se.svg", label: "Svenska" },
  { lang: "en" as const, src: "https://flagcdn.com/us.svg", label: "English" },
];

export function LanguageSwitcher() {
  const { lang, setLang } = useLang();
  return (
    <div className={s.wrapper}>
      {FLAGS.map(({ lang: l, src, label }) => (
        <button
          key={l}
          className={`${s.flag} ${lang === l ? s.active : ""}`}
          onClick={() => setLang(l)}
          aria-label={label}
          title={label}
        >
          <img src={src} alt={label} className={s.flagImg} />
        </button>
      ))}
    </div>
  );
}
