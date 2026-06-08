export default function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 rounded-3xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-slate-400 shadow-2xl backdrop-blur-md">
      <div className="flex items-center gap-1">
        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:120ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:240ms]" />
      </div>
      AI is typing...
    </div>
  );
}
