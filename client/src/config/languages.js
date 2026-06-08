export const DEFAULT_LANGUAGE = "en";

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी (Hindi)" },
  { code: "mr", label: "मराठी (Marathi)" },
  { code: "gu", label: "ગુજરાતી (Gujarati)" },
  { code: "ta", label: "தமிழ் (Tamil)" },
  { code: "te", label: "తెలుగు (Telugu)" },
  { code: "kn", label: "ಕನ್ನಡ (Kannada)" },
  { code: "bn", label: "বাংলা (Bengali)" },
  { code: "hinglish", label: "Hinglish" },
];

export function resolveLanguage(input) {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw) {
    return DEFAULT_LANGUAGE;
  }

  const byCode = SUPPORTED_LANGUAGES.find((lang) => lang.code === raw);
  if (byCode) {
    return byCode.code;
  }

  const byLabel = SUPPORTED_LANGUAGES.find(
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
