import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import type { Lang, Translations } from "./types";
import { sv } from "./sv";
import { en } from "./en";

const translations: Record<Lang, Translations> = { sv, en };

type LangContextType = {
  lang: Lang;
  t: Translations;
  setLang: (l: Lang) => void;
};

const LangContext = createContext<LangContextType>({
  lang: "sv",
  t: sv,
  setLang: () => {},
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const stored = localStorage.getItem("lang");
      if (stored === "en" || stored === "sv") return stored;
    } catch {}
    return "sv";
  });

  const setLang = (l: Lang) => {
    try { localStorage.setItem("lang", l); } catch {}
    setLangState(l);
  };

  return (
    <LangContext.Provider value={{ lang, t: translations[lang], setLang }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang(): LangContextType {
  return useContext(LangContext);
}
