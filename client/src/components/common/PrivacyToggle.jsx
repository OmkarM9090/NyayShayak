import { useTranslation } from "react-i18next";

export default function PrivacyToggle({ value, onChange, disabled = false }) {
  const { t } = useTranslation();
  const isPrivate = value === "private";

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-[#0f0f12] p-1 text-xs font-semibold">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("save")}
        className={`rounded-full px-3 py-1 transition ${
          !isPrivate
            ? "bg-indigo-600 text-white"
            : "text-slate-400 hover:text-slate-200"
        }`}
        aria-pressed={!isPrivate}
      >
        {t("common.save")}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("private")}
        className={`rounded-full px-3 py-1 transition ${
          isPrivate
            ? "bg-amber-500 text-[#0a0a0b]"
            : "text-slate-400 hover:text-slate-200"
        }`}
        aria-pressed={isPrivate}
      >
        {t("common.private")}
      </button>
    </div>
  );
}
