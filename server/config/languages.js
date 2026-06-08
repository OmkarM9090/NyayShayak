export const DEFAULT_LANGUAGE = "en";
export const SUPPORTED_LANGUAGE_CODES = ["en", "hi", "mr", "gu", "ta", "te", "kn", "bn", "hinglish"];

export const SUPPORTED_LANGUAGES = {
  en: {
    code: "en",
    label: "English",
    aiInstruction: "You MUST respond only in English. Use simple, clear language.",
  },
  hi: {
    code: "hi",
    label: "Hindi",
    aiInstruction:
      "You MUST respond only in Hindi using clear everyday words. Keep law names in English.",
  },
  mr: {
    code: "mr",
    label: "Marathi",
    aiInstruction:
      "You MUST respond only in Marathi using clear everyday words. Keep law names in English.",
  },
  gu: {
    code: "gu",
    label: "Gujarati",
    aiInstruction:
      "You MUST respond only in Gujarati using clear everyday words. Keep law names in English.",
  },
  ta: {
    code: "ta",
    label: "Tamil",
    aiInstruction:
      "You MUST respond only in Tamil using clear everyday words. Keep law names in English.",
  },
  te: {
    code: "te",
    label: "Telugu",
    aiInstruction:
      "You MUST respond only in Telugu using clear everyday words. Keep law names in English.",
  },
  kn: {
    code: "kn",
    label: "Kannada",
    aiInstruction:
      "You MUST respond only in Kannada using clear everyday words. Keep law names in English.",
  },
  bn: {
    code: "bn",
    label: "Bengali",
    aiInstruction:
      "You MUST respond only in Bengali using clear everyday words. Keep law names in English.",
  },
  hinglish: {
    code: "hinglish",
    label: "Hinglish",
    aiInstruction:
      "You MUST respond only in Hinglish, using simple Hindi-English mixed language in Latin script. Keep law names in English.",
  },
};

export function resolveLanguage(input) {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw) {
    return DEFAULT_LANGUAGE;
  }

  if (SUPPORTED_LANGUAGES[raw]) {
    return raw;
  }

  const byLabel = Object.values(SUPPORTED_LANGUAGES).find(
    (lang) => lang.label.toLowerCase() === raw
  );
  if (byLabel) {
    return byLabel.code;
  }

  if (raw.startsWith("hi")) {
    return "hi";
  }
  if (raw.startsWith("mr")) {
    return "mr";
  }
  if (raw.startsWith("gu")) {
    return "gu";
  }
  if (raw.startsWith("ta")) {
    return "ta";
  }
  if (raw.startsWith("te")) {
    return "te";
  }
  if (raw.startsWith("kn")) {
    return "kn";
  }
  if (raw.startsWith("bn")) {
    return "bn";
  }
  if (raw.includes("hinglish")) {
    return "hinglish";
  }
  return DEFAULT_LANGUAGE;
}

export function getLanguageInstruction(language) {
  const resolved = resolveLanguage(language);
  return SUPPORTED_LANGUAGES[resolved]?.aiInstruction || SUPPORTED_LANGUAGES.en.aiInstruction;
}

export function getLanguageLabel(language) {
  const resolved = resolveLanguage(language);
  return SUPPORTED_LANGUAGES[resolved]?.label || SUPPORTED_LANGUAGES.en.label;
}

export function ensureSupportedLanguage(language) {
  const resolved = resolveLanguage(language);
  return SUPPORTED_LANGUAGE_CODES.includes(resolved) ? resolved : DEFAULT_LANGUAGE;
}
