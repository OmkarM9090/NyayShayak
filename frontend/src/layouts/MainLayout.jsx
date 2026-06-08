import { useEffect, useMemo, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/common/Sidebar";
import Header from "../components/common/Header";

const CHAT_STORAGE_KEY = "nyaySahayakRecentChats";

export default function MainLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [recentChats, setRecentChats] = useState(() => {
    try {
      const stored = localStorage.getItem(CHAT_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [chatNonce, setChatNonce] = useState(0);

  useEffect(() => {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(recentChats));
  }, [recentChats]);

  const registerChatActivity = (title, chatId = null) => {
    const id = chatId || `chat_${Date.now()}`;
    const entry = {
      id,
      title: title || "New chat",
      updatedAt: new Date().toISOString(),
    };

    setRecentChats((prev) => {
      const filtered = prev.filter((item) => item.id !== id);
      return [entry, ...filtered].slice(0, 20);
    });

    return id;
  };

  const startNewChat = () => {
    setChatNonce((prev) => prev + 1);
  };

  const outletContext = useMemo(
    () => ({ registerChatActivity, startNewChat, chatNonce }),
    [chatNonce]
  );

  return (
    <div className="flex h-screen w-full bg-brand-base overflow-hidden font-sans">
      <Sidebar isOpen={isSidebarOpen} recentChats={recentChats} onNewChat={startNewChat} />
      
      <div className="flex-1 flex flex-col h-full relative">
        <Header toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} isSidebarOpen={isSidebarOpen} />
        <Outlet context={outletContext} /> 
      </div>
    </div>
  );
}