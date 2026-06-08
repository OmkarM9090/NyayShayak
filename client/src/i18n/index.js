import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import hi from "./locales/hi.json";
import mr from "./locales/mr.json";
import hinglish from "./locales/hinglish.json";
import gu from "./locales/gu.json";
import ta from "./locales/ta.json";
import te from "./locales/te.json";
import kn from "./locales/kn.json";
import bn from "./locales/bn.json";
import { DEFAULT_LANGUAGE, resolveLanguage } from "../config/languages.js";

// Standard production-ready caching strategy
const savedLanguage = resolveLanguage(localStorage.getItem("nyay_sahayak_lang") || DEFAULT_LANGUAGE);

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
      mr: { translation: mr },
      gu: { translation: gu },
      ta: { translation: ta },
      te: { translation: te },
      kn: { translation: kn },
      bn: { translation: bn },
      hinglish: { translation: hinglish }
    },
    lng: savedLanguage,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false // React already escapes values safely
    },
    react: {
      useSuspense: false // Prevents UI flickering during lazy load states
    }
  });

export default i18n;
