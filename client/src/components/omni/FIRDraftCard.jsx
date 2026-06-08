import { useState } from "react";
import { Copy, Download } from "lucide-react";
import { jsPDF } from "jspdf";

export default function FIRDraftCard({ firText }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!firText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(firText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const handleDownload = () => {
    if (!firText) {
      return;
    }

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 40;
    const pageWidth = doc.internal.pageSize.getWidth();
    const maxWidth = pageWidth - margin * 2;
    const lines = doc.splitTextToSize(firText, maxWidth);

    doc.setFont("Times", "Normal");
    doc.setFontSize(12);
    doc.text(lines, margin, 60);
    doc.save("FIR_Complaint.pdf");
  };

  return (
    <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">FIR Draft</div>
          <h3 className="mt-2 text-2xl font-semibold text-white">Your complaint draft</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-2 rounded-full border border-slate-400/30 bg-slate-800/40 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800/70"
          >
            <Copy size={14} />
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
          >
            <Download size={14} />
            Export PDF
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-[#fdfdfd] p-5 font-serif text-[13px] leading-6 text-slate-900 shadow-inner">
        <pre className="whitespace-pre-wrap font-serif">{firText}</pre>
      </div>
    </div>
  );
}
