import { MessageSquarePlus } from "lucide-react";
import { Link } from "react-router-dom";

function groupChatsByWindow(chats = []) {
  const now = new Date();
  const today = [];
  const previous = [];

  chats.forEach((chat) => {
    const updated = new Date(chat.updatedAt);
    const diffDays = (now - updated) / (1000 * 60 * 60 * 24);
    if (diffDays < 1) {
      today.push(chat);
    } else if (diffDays <= 7) {
      previous.push(chat);
    }
  });

  return { today, previous };
}

export default function Sidebar({ recentChats = [], onNewChat }) {
  const { today, previous } = groupChatsByWindow(recentChats);

  return (
    <aside className="hidden h-full w-72 flex-col border-r border-white/5 bg-[#050505] px-5 py-6 lg:flex">
      <Link
        to="/chat"
        onClick={onNewChat}
        className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-indigo-300 transition hover:bg-white/10"
      >
        <MessageSquarePlus size={18} />
        New Chat
      </Link>

      <div className="mt-8 flex-1 space-y-8 overflow-y-auto pr-1">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Today</p>
          <div className="mt-3 space-y-2">
            {today.length === 0 ? (
              <div className="rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs text-slate-500">
                No chats yet today.
              </div>
            ) : (
              today.map((chat) => (
                <Link
                  key={chat.id}
                  to="/chat"
                  className="block rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs text-slate-200 hover:bg-white/10"
                >
                  <div className="truncate font-semibold text-slate-100">{chat.title}</div>
                  <div className="mt-1 text-[10px] text-slate-500">
                    {new Date(chat.updatedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Previous 7 Days</p>
          <div className="mt-3 space-y-2">
            {previous.length === 0 ? (
              <div className="rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs text-slate-500">
                No recent chats.
              </div>
            ) : (
              previous.map((chat) => (
                <Link
                  key={chat.id}
                  to="/chat"
                  className="block rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs text-slate-200 hover:bg-white/10"
                >
                  <div className="truncate font-semibold text-slate-100">{chat.title}</div>
                  <div className="mt-1 text-[10px] text-slate-500">
                    {new Date(chat.updatedAt).toLocaleDateString()}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-indigo-500/10 bg-indigo-600/5 p-4">
        <p className="text-[11px] font-semibold text-indigo-300">Nyay Sahayak Omni</p>
        <p className="mt-2 text-[11px] text-slate-500">
          Unified legal assistant for chat, analysis, and FIR drafting.
        </p>
      </div>
    </aside>
  );
}
