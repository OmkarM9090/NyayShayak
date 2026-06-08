import { CheckCircle2, CircleDashed } from "lucide-react";

const defaultSteps = [
  {
    title: "Write the facts clearly",
    detail: "Note dates, places, and people involved. Keep it simple and in order.",
  },
  {
    title: "Collect proof",
    detail: "Save receipts, screenshots, chats, emails, and any ID proof.",
  },
  {
    title: "Report to the right authority",
    detail: "Police station, consumer forum, bank, or RERA as applicable.",
  },
  {
    title: "Get legal help if risk is high",
    detail: "If money/property loss is large, speak to a lawyer quickly.",
  },
];

export default function LegalStepsCard({ steps = defaultSteps, completed = 1 }) {
  return (
    <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-md">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">
        Legal Roadmap
      </div>
      <h3 className="mt-2 text-2xl font-semibold text-white">Action steps you can follow</h3>

      <div className="mt-6 space-y-4">
        {steps.map((step, index) => {
          const isDone = index < completed;
          return (
            <div key={step.title} className="flex gap-4">
              <div className="mt-1">
                {isDone ? (
                  <CheckCircle2 size={18} className="text-emerald-400" />
                ) : (
                  <CircleDashed size={18} className="text-slate-500" />
                )}
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-200">
                  {index + 1}. {step.title}
                </div>
                <div className="text-xs text-slate-400 leading-5">{step.detail}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
