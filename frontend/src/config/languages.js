export const DEFAULT_LANGUAGE = "en";

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "mr", label: "Marathi" },
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
  return DEFAULT_LANGUAGE;
}
