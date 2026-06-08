import { Link } from "react-router-dom";

export default function LegalStepsPage() {
  return (
    <div className="flex h-full items-center justify-center bg-[#0a0a0b] px-6 text-slate-300">
      <div className="max-w-2xl rounded-3xl border border-white/10 bg-[#121215] p-8">
        <h1 className="mb-3 text-3xl font-bold text-white">Legal Steps</h1>
        <p className="mb-6 text-sm leading-7 text-slate-400">
          Yeh action page quick next steps dikhane ke liye ready hai. Isme future mein workflow cards, checklists, aur case-type guides add kiye ja sakte hain.
        </p>
        <div className="space-y-3 text-sm text-slate-300">
          <p>1. Facts ko timeline mein likhiye.</p>
          <p>2. Proof aur documents secure rakhiye.</p>
          <p>3. Relevant authority ya lawyer se consult karne se pehle key questions ready kariye.</p>
        </div>
        <div className="mt-6 flex gap-3">
          <Link to="/chat" className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white">
            Back to Chat
          </Link>
          <Link to="/fir" className="rounded-full border border-white/10 px-5 py-2 text-sm font-semibold text-slate-200">
            Generate FIR
          </Link>
        </div>
      </div>
    </div>
  );
}
