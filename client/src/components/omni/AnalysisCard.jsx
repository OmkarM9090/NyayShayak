import {
  AlertTriangle,
  FileText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const riskBadgeStyles = {
  LOW: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  MEDIUM: "bg-amber-500/15 text-amber-200 border-amber-500/30",
  HIGH: "bg-rose-500/15 text-rose-200 border-rose-500/30",
};

export default function AnalysisCard({
  analysis,
  fileName,
  fileType,
  onViewSteps,
  onDraftNotice,
}) {
  const riskLevel = String(analysis?.risk_level || "LOW").toUpperCase();
  const badgeClass = riskBadgeStyles[riskLevel] || riskBadgeStyles.LOW;
  const summary = analysis?.smart_explanation || analysis?.simple_explanation || "";
  const detectedRisks = Array.isArray(analysis?.detected_risks) ? analysis.detected_risks : [];
  const topRisks = Array.isArray(analysis?.top_risks) ? analysis.top_risks : [];
  const criticalFlags = detectedRisks
    .filter((risk) => String(risk?.level || "").toUpperCase() === "HIGH")
    .slice(0, 3);
  const fallbackFlags = topRisks.slice(0, 3);

  return (
    <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-md">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-slate-200">
            <Sparkles size={18} className="text-indigo-400" />
            <span className="text-sm font-semibold tracking-wide">AI Analysis</span>
          </div>
          <div className="mt-2 text-2xl font-semibold text-white">{analysis?.document_type || "Document"}</div>
          {fileName && (
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
              <FileText size={14} />
              <span>{fileName}</span>
              {fileType && <span className="text-slate-500">({fileType})</span>}
            </div>
          )}
        </div>
        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass}`}>
          {riskLevel} RISK
        </span>
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-300">{summary}</p>

      <div className="mt-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
        <div className="flex items-center gap-2 text-rose-200">
          <AlertTriangle size={16} />
          <span className="text-sm font-semibold">Critical Red Flags</span>
        </div>
        <div className="mt-3 space-y-2 text-sm text-rose-100">
          {criticalFlags.length > 0
            ? criticalFlags.map((risk, index) => (
                <div key={`critical-${index}`}>- {risk.type || risk.reason}</div>
              ))
            : fallbackFlags.map((risk, index) => (
                <div key={`fallback-${index}`}>- {risk}</div>
              ))}
          {criticalFlags.length === 0 && fallbackFlags.length === 0 && (
            <div>No critical red flags detected.</div>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onViewSteps}
          className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
        >
          <ShieldCheck size={14} />
          View Legal Steps
        </button>
        <button
          type="button"
          onClick={onDraftNotice}
          className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-xs font-semibold text-indigo-200 transition hover:bg-indigo-500/20"
        >
          <Sparkles size={14} />
          Draft Legal Notice
        </button>
      </div>
    </div>
  );
}
