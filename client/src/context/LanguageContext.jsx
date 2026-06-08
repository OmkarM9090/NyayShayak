import { createContext, useContext, useEffect, useMemo, useState } from "react";
import i18n from "../i18n";
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, resolveLanguage } from "../config/languages";
import { updateLanguagePreference } from "../services/api";

const LANGUAGE_STORAGE_KEY = "nyaySahayakLanguage";

const LanguageContext = createContext({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
  languages: SUPPORTED_LANGUAGES,
});

export function LanguageProvider({ children }) {
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  const user = useMemo(() => {
    const rawUser = localStorage.getItem("user");
    return rawUser ? JSON.parse(rawUser) : null;
  }, []);

  const initialLanguage = resolveLanguage(
    stored || user?.preferredLanguage || DEFAULT_LANGUAGE
  );

  const [language, setLanguageState] = useState(initialLanguage);

  const setLanguage = (nextLanguage) => {
    setLanguageState(resolveLanguage(nextLanguage));
  };

  useEffect(() => {
    i18n.changeLanguage(language);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);

    if (user?.id) {
      updateLanguagePreference(user.id, language).catch(() => {});
    }
  }, [language, user?.id]);

  const value = useMemo(
    () => ({ language, setLanguage, languages: SUPPORTED_LANGUAGES }),
    [language]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
