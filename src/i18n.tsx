import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
export type Lang = "fr" | "en";
const KEY = "atelier:lang"; // SHARED across all Atelier apps on purpose
function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "fr" || saved === "en") return saved;
  } catch {}
  const n = ((typeof navigator !== "undefined" && navigator.language) || "fr").toLowerCase();
  return n.startsWith("en") ? "en" : "fr";
}
type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: <T>(fr: T, en: T) => T };
const LangCtx = createContext<Ctx>(null as unknown as Ctx);
export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("fr");
  useEffect(() => {
    setLangState(detect());
  }, []);
  useEffect(() => {
    try {
      document.documentElement.lang = lang;
    } catch {}
  }, [lang]);
  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {}
  };
  const t = <T,>(fr: T, en: T): T => (lang === "fr" ? fr : en);
  return <LangCtx.Provider value={{ lang, setLang, t }}>{children}</LangCtx.Provider>;
}
export function useLang() {
  return useContext(LangCtx);
}
