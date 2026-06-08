import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowUp,
  FileText,
  Loader2,
  Upload,
  X,
  Shield,
  AlertTriangle,
  CheckCircle2,
  LayoutList,
  Sparkles,
} from "lucide-react";
import { analyzeDocument } from "../services/api";
import { useLanguage } from "../context/LanguageContext.jsx";
import { formatAnalysisResponse } from "../utils/formatAnalysis";
import PrivacyToggle from "../components/common/PrivacyToggle.jsx";
import {
  getPrivacyMode,
  setPrivacyMode,
  getOrCreateGuestSessionId,
} from "../utils/guestIdentity";

const riskBadgeStyles = {
  LOW: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  MEDIUM: "bg-amber-500/15 text-amber-200 border-amber-500/30",
  HIGH: "bg-rose-500/15 text-rose-200 border-rose-500/30",
};

export default function AnalyzePage() {
  const { t, i18n } = useTranslation();
  const { currentLanguage } = useLanguage(); // Fixed reference mapping context hook
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [privacyMode, setPrivacyModeState] = useState(getPrivacyMode());

  // FIXED: Synchronization hook locks active localized UI framework from automatic language rollback
  useEffect(() => {
    if (currentLanguage && i18n.language !== currentLanguage) {
      i18n.changeLanguage(currentLanguage);
    }
  }, [currentLanguage, i18n]);

  useEffect(() => {
    setPrivacyMode(privacyMode);
  }, [privacyMode]);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleAnalyzeStream = async () => {
    if (!file) {
      setError(t("analyze.noFileError", "Please upload a document first."));
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      // Explicitly passing file stream buffer paired with current language token code
      const sessionId = getOrCreateGuestSessionId("analysis");
      const response = await analyzeDocument(file, currentLanguage, {
        mode: privacyMode,
        sessionId,
      });
      
      if (response && response.success) {
        // Adapt schema transformations gracefully using format helpers
        const formatted = formatAnalysisResponse(response.data);
        setAnalysis(formatted);
      } else {
        throw new Error(response.message || "Failed reading processing layout architecture arrays.");
      }
    } catch (err) {
      console.error("[AnalyzePage Subsystem Exception]:", err.message);
      setError(err.message || t("analyze.genericError", "Failed compiling document analysis report."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full bg-[#0d0d0f] text-slate-200">
      
      {/* PRIMARY AUDIT INTERFACE BOX */}
      <div className="flex flex-1 flex-col overflow-hidden border-r border-white/5">
        <div className="flex h-14 items-center justify-between border-b border-white/5 px-6 shrink-0 bg-[#09090b]">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-indigo-400" />
            <h1 className="text-sm font-bold tracking-wide uppercase text-slate-400 font-mono">
              {t("analyze.engineTitle", "Automated Compliance Audit Space")}
            </h1>
          </div>
          <PrivacyToggle value={privacyMode} onChange={setPrivacyModeState} />
        </div>

        {/* CONTAINER PANELS DISPLAY LOOP */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs font-semibold text-rose-400 flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {analysis ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              
              {/* EXECUTIVE BRIEF PANEL */}
              <div className="rounded-2xl border border-white/5 bg-[#121214] p-6 space-y-3 shadow-xl">
                <h3 className="font-serif text-lg font-bold text-white flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-indigo-400" />
                  {t("analyze.briefHeading", "Executive Document Brief")}
                </h3>
                <p className="text-sm leading-relaxed text-slate-300 font-light">
                  {analysis.summary}
                </p>
              </div>

              {/* RISK DISTRIBUTION SLOTS MARGINS */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold tracking-widest uppercase text-slate-500 font-mono">
                  {t("analyze.risksFoundLabel", "Actionable Anomalies & Friction Points")}
                </h4>
                
                {analysis.risks && analysis.risks.length > 0 ? (
                  <div className="grid gap-4 grid-cols-1">
                    {analysis.risks.map((risk, index) => (
                      <div key={index} className="rounded-xl border border-white/5 bg-[#121214] p-5 space-y-3 transition hover:border-white/10">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-sm font-bold text-slate-200 font-serif">
                            {risk.clause || `Clause Component Block #${index + 1}`}
                          </span>
                          <span className={`rounded-md border px-2.5 py-0.5 text-[10px] font-bold tracking-wider font-mono ${riskBadgeStyles[risk.severity] || "bg-slate-500/15"}`}>
                            {risk.severity}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed text-slate-400 font-normal">
                          {risk.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-white/5 p-6 text-center text-xs text-slate-500 font-medium">
                    {t("analyze.zeroRisksMessage", "Passed Verification: No toxic adversarial compliance strings captured.")}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center opacity-60">
              <FileText size={48} className="text-slate-700 mb-4 stroke-1" />
              <h2 className="text-base font-serif font-bold text-slate-300">
                {t("analyze.awaitingUploadTitle", "No Analysis Report Active")}
              </h2>
              <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
                {t("analyze.awaitingUploadDesc", "Upload raw legal document streams here. Local RAG engines will auto-trigger baseline parameter scanning routines instantly.")}
              </p>
            </div>
          )}
        </div>

        {/* BOTTOM STICKY DATA DOCK BLOCK */}
        <div className="border-t border-white/5 bg-[#09090b] p-4 shrink-0">
          <div className="mx-auto max-w-3xl flex items-center gap-4 bg-[#121214] rounded-2xl border border-white/5 px-4 py-3 shadow-2xl">
            <button
              onClick={triggerFileUpload}
              disabled={loading}
              className="rounded-xl p-2.5 text-slate-400 transition hover:bg-white/5 hover:text-white shrink-0 active:scale-95 disabled:opacity-40"
              title={t("analyze.uploadHint", "Select Document File")}
            >
              <Upload size={20} />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileChange} 
              accept=".txt,.pdf,.docx" 
            />

            <div className="flex-1 text-sm text-slate-300 font-medium truncate px-2 font-mono">
              {file ? file.name : t("analyze.dockPlaceholder", "Awaiting legal payload attachment data limits...")}
            </div>

            {file && (
              <button 
                onClick={() => setFile(null)} 
                className="text-slate-500 hover:text-slate-300 transition p-1"
                disabled={loading}
              >
                <X size={16} />
              </button>
            )}

            <button
              onClick={handleAnalyzeStream}
              disabled={loading || !file}
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold tracking-wide uppercase text-white transition hover:bg-indigo-500 disabled:opacity-20 flex items-center gap-2 active:scale-95 shrink-0"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>{t("analyze.dockProcessing", "Auditing...")}</span>
                </>
              ) : (
                <span>{t("analyze.dockExecute", "Run Audit Pipeline")}</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}