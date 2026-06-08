/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import i18n from "../i18n/index.js";
import { DEFAULT_LANGUAGE, resolveLanguage, SUPPORTED_LANGUAGES } from "../config/languages.js";
import { updateLanguagePreference } from "../services/api.js";

const LanguageContext = createContext(null);
const LANGUAGE_STORAGE_KEY = "nyay_sahayak_lang";
const LEGACY_LANGUAGE_STORAGE_KEY = "nyaySahayakLanguage";

export const LanguageProvider = ({ children }) => {
  const user = useMemo(() => {
    const rawUser = localStorage.getItem("user");
    return rawUser ? JSON.parse(rawUser) : null;
  }, []);

  const [currentLanguage, setCurrentLanguage] = useState(
    resolveLanguage(
      localStorage.getItem(LANGUAGE_STORAGE_KEY) ||
        localStorage.getItem(LEGACY_LANGUAGE_STORAGE_KEY) ||
        user?.preferredLanguage ||
        DEFAULT_LANGUAGE
    )
  );

  const changeLanguage = async (langCode) => {
    try {
      const resolvedLanguage = resolveLanguage(langCode);
      console.log(`[LanguageContext] Shifting locale interface target to: ${resolvedLanguage}`);
      
      // Asynchronously trigger i18next global memory block update
      await i18n.changeLanguage(resolvedLanguage);
      
      // Synchronize persistence states
      localStorage.setItem(LANGUAGE_STORAGE_KEY, resolvedLanguage);
      localStorage.removeItem(LEGACY_LANGUAGE_STORAGE_KEY);
      setCurrentLanguage(resolvedLanguage);

      if (user?.id) {
        updateLanguagePreference(user.id, resolvedLanguage).catch(() => {});
      }
    } catch (error) {
      console.error("[LanguageContext Critical Exception] Switch failed:", error.message);
    }
  };

  // Safe tracking lifecycle loop sync
  useEffect(() => {
    const handleStorageChange = () => {
      const externalLang = resolveLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY));
      if (externalLang && externalLang !== currentLanguage) {
        i18n.changeLanguage(externalLang);
        setCurrentLanguage(externalLang);
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [currentLanguage]);

  const value = {
    currentLanguage,
    language: currentLanguage,
    languages: SUPPORTED_LANGUAGES,
    changeLanguage,
    setLanguage: changeLanguage,
  };

  return (
    <LanguageContext.Provider value={value}>
      {/* Dynamic structural key allocation forces components to reload translate parameters seamlessly */}
      <div key={currentLanguage}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage dynamic hook execution outside bounding Provider domain.");
  }
  return context;
};
