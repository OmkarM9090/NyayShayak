import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUp,
  Bot,
  Loader2,
  MessageSquare,
  PlusCircle,
  Sparkles,
  User,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { sendChatMessage, fetchChatHistory, fetchChatSessions } from "../services/api";
import { useLanguage } from "../context/LanguageContext.jsx";
import PrivacyToggle from "../components/common/PrivacyToggle.jsx";
import {
  canUseGuestFeature,
  getOrCreateGuestSessionId,
  getPrivacyMode,
  incrementGuestUsage,
  isGuestUser,
  loadGuestChatHistory,
  resetGuestSessionId,
  saveGuestChatHistory,
  setPrivacyMode,
} from "../utils/guestIdentity";

const ACTION_ROUTES = {
  "Generate FIR": "/fir",
  "See Steps": "/steps",
  "Analyze Document": "/analyze",
};

const buildWelcomeMessage = (t) => ({
  role: "assistant",
  content: {
    topic: t("appName"),
    simple_explanation: t("chat.initialExplanation"),
    rules: [t("chat.initialRule1"), t("chat.initialRule2")],
    penalties: [],
    user_guidance: [t("chat.initialGuidance")],
  },
  suggestions: ["See Steps", "Analyze Document", "Generate FIR"],
  contextUsed: false,
});

export default function ChatPage() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const initialMessage = useMemo(() => buildWelcomeMessage(t), [t]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [messages, setMessages] = useState([initialMessage]);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [privacyMode, setPrivacyModeState] = useState(getPrivacyMode());
  
  useEffect(() => {
    if (!messages.length) {
      setMessages([initialMessage]);
    }
  }, [initialMessage, messages.length]);

  useEffect(() => {
    const initializeSessions = async () => {
      const token = localStorage.getItem("token");
      if (token) {
        try {
          const sess = await fetchChatSessions();
          setSessions(sess);
          if (sess.length > 0) {
            await loadSession(sess[0].sessionId);
          } else {
            setMessages([initialMessage]);
            setIsInitializing(false);
          }
        } catch (error) {
          console.error("Failed to fetch chat sessions:", error);
          setMessages([initialMessage]);
          setIsInitializing(false);
        }
      } else {
        const guestSessionId = getOrCreateGuestSessionId("chat");
        const guestHistory = loadGuestChatHistory();
        setCurrentSessionId(guestSessionId);
        setMessages(guestHistory.length ? [initialMessage, ...guestHistory] : [initialMessage]);
        setIsInitializing(false);
      }
    };

    initializeSessions();
  }, [initialMessage]);

  useEffect(() => {
    setPrivacyMode(privacyMode);
  }, [privacyMode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const loadSession = async (sessionId) => {
    setIsInitializing(true);
    setCurrentSessionId(sessionId);
    try {
      const history = await fetchChatHistory(sessionId);
      if (history && history.length > 0) {
        setMessages([initialMessage, ...history]);
      } else {
        setMessages([initialMessage]);
      }
    } catch (e) {
      setMessages([initialMessage]);
    }
    setIsInitializing(false);
  };

  const startNewChat = () => {
    if (isGuestUser()) {
      const guestSessionId = resetGuestSessionId("chat");
      setCurrentSessionId(guestSessionId);
    } else {
      setCurrentSessionId(null);
    }
    setMessages([initialMessage]);
  };

  const refreshSessions = async () => {
    try {
      const sess = await fetchChatSessions();
      setSessions(sess);
    } catch (e) {
      console.error(e);
    }
  };

  const submitMessage = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || loading) {
      return;
    }

    const guest = isGuestUser();
    if (guest && !canUseGuestFeature("chat")) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Please login to continue",
          isError: true,
        },
      ]);
      return;
    }

    let targetSessionId = currentSessionId;
    if (!targetSessionId) {
      targetSessionId = guest
        ? getOrCreateGuestSessionId("chat")
        : crypto.randomUUID();
      setCurrentSessionId(targetSessionId);
    }

    const userEntry = { role: "user", content: trimmedInput };
    setMessages((prev) => [...prev, userEntry]);
    setInput("");
    setLoading(true);
    try {
      const response = await sendChatMessage(trimmedInput, {
        sessionId: targetSessionId,
        language,
        mode: privacyMode,
      });

      const assistantEntry = {
        role: "assistant",
        content: response.reply,
        suggestions: Array.isArray(response.suggestions) ? response.suggestions : [],
        isError: Boolean(response.isError),
        contextUsed: Boolean(response.contextUsed),
      };

      setMessages((prev) => [...prev, assistantEntry]);

      if (guest) {
        const history = loadGuestChatHistory();
        const nextHistory = [...history, userEntry, assistantEntry].slice(-4);
        saveGuestChatHistory(nextHistory);
        incrementGuestUsage("chat");
      } else {
        refreshSessions();
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: error.message || t("chat.errorMessage"),
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestion = (suggestion) => {
    const route = ACTION_ROUTES[suggestion];
    if (route) {
      navigate(route);
    }
  };

  return (
    <div className="flex h-full overflow-hidden bg-[#0a0a0b] text-slate-300">
      <div className="hidden w-64 flex-col border-r border-white/5 bg-[#0d0d0f] md:flex">
        <div className="p-4">
          <button
            onClick={startNewChat}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 p-3 text-sm font-medium text-white transition hover:bg-indigo-500"
          >
            <PlusCircle size={18} /> New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Recent Chats
          </div>
          {sessions.map((sess) => (
            <button
              key={sess.sessionId}
              onClick={() => loadSession(sess.sessionId)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                currentSessionId === sess.sessionId
                  ? "bg-indigo-500/10 text-indigo-300 font-medium"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              <MessageSquare size={16} className="shrink-0" />
              <span className="truncate">{sess.title}</span>
            </button>
          ))}
          {sessions.length === 0 && !isInitializing && (
            <div className="px-2 py-4 text-xs text-slate-600 text-center">No chat history yet.</div>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
          <div className="mx-auto w-full max-w-4xl">
            <div className="mb-8 rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.22),_transparent_50%),#121215] p-8 shadow-2xl">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white">
                  <Sparkles size={22} />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white">{t("chat.title")}</h1>
                  <p className="text-sm text-slate-400">{t("chat.subtitle")}</p>
                </div>
              </div>
              <p className="text-sm text-slate-400">{t("chat.example")}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <PrivacyToggle value={privacyMode} onChange={setPrivacyModeState} />
                <span>Private mode skips saving chat history.</span>
                {isGuestUser() && <span className="text-amber-300">Guest limit: 3 messages.</span>}
              </div>
            </div>

            <div className="space-y-6 pb-8">
              {isInitializing ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="animate-spin text-indigo-500" size={32} />
                </div>
              ) : (
                messages.map((message, index) => (
                  <div key={`${message.role}-${index}`} className={`flex gap-4 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    {message.role === "assistant" && (
                      <div className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${message.isError ? "bg-red-500/20 text-red-300" : "bg-indigo-600 text-white"}`}>
                        <Bot size={18} />
                      </div>
                    )}

                    <div className="max-w-[88%]">
                      <div
                        className={`rounded-3xl p-4 text-sm leading-7 ${
                          message.role === "user"
                            ? "rounded-tr-none bg-white text-[#111827]"
                            : message.isError
                              ? "border border-red-500/20 bg-red-500/10 text-red-100"
                              : "rounded-tl-none border border-white/10 bg-[#121215] text-slate-200"
                        }`}
                      >
                        <StructuredReply content={message.content} />
                        {message.role === "assistant" && !message.isError && (
                          <div className="mt-3 flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-slate-500">
                            <span>{message.contextUsed ? "RAG context used" : "General legal guidance"}</span>
                            {message.createdAt && <span className="opacity-60">{new Date(message.createdAt).toLocaleTimeString()}</span>}
                          </div>
                        )}
                      </div>

                      {message.role === "assistant" && message.suggestions?.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {message.suggestions.map((suggestion) => (
                            <button
                              key={suggestion}
                              onClick={() => handleSuggestion(suggestion)}
                              className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-xs font-semibold text-indigo-200 transition hover:bg-indigo-500/20"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {message.role === "user" && (
                      <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-slate-200">
                        <User size={18} />
                      </div>
                    )}
                  </div>
                ))
              )}

              {loading && (
                <div className="flex gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white">
                    <Loader2 size={18} className="animate-spin" />
                  </div>
                  <div className="rounded-3xl rounded-tl-none border border-white/10 bg-[#121215] px-4 py-3 text-sm italic text-slate-400">
                    {t("chat.loading")}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        <div className="border-t border-white/5 bg-[#0a0a0b] p-4 sm:p-6">
          <div className="mx-auto max-w-4xl rounded-[24px] border border-white/10 bg-[#121215] p-2 shadow-2xl">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={t("chat.placeholder")}
                className="max-h-40 flex-1 resize-none bg-transparent px-3 py-3 text-[15px] text-slate-100 outline-none placeholder:text-slate-600"
                rows={1}
                disabled={loading}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submitMessage();
                  }
                }}
              />
              <button
                onClick={submitMessage}
                disabled={loading || !input.trim()}
                className="rounded-2xl bg-indigo-600 p-3 text-white transition hover:bg-indigo-500 disabled:opacity-30"
              >
                {loading ? <Loader2 size={20} className="animate-spin" /> : <ArrowUp size={20} />}
              </button>
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-slate-600">{t("chat.disclaimer")}</p>
        </div>
      </div>
    </div>
  );
}

function StructuredReply({ content, file }) {
  if (file) {
    return (
      <div className="space-y-2">
        {content && typeof content === "string" && (
          <div className="whitespace-pre-wrap break-words">{content}</div>
        )}
        <div className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white/90">
          Attached: {file.name}
        </div>
      </div>
    );
  }

  if (typeof content === "string") {
    return <div className="whitespace-pre-wrap break-words">{content}</div>;
  }

  const topic = content.topic || content.document_type || "Legal Guidance";
  const explanation = content.simple_explanation || content.reason_for_decision;

  return (
    <div className="space-y-3">
      {topic && <div className="text-base font-semibold text-white">{topic}</div>}
      
      {(content.classification || content.risk_level) && (
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          {content.classification && (
            <span className={`rounded px-2 py-1 ${content.classification === 'NORMAL' ? 'bg-green-500/20 text-green-300' : content.classification === 'FRAUD' || content.classification === 'ILLEGAL' ? 'bg-red-500/20 text-red-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
              {content.classification}
            </span>
          )}
          {content.risk_level && (
            <span className={`rounded px-2 py-1 ${content.risk_level === 'LOW' ? 'bg-green-500/20 text-green-300' : content.risk_level === 'HIGH' ? 'bg-red-500/20 text-red-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
              Risk: {content.risk_level}
            </span>
          )}
          {content.final_decision && (
            <span className="rounded bg-indigo-500/20 px-2 py-1 text-indigo-300">
              {content.final_decision.replace(/_/g, ' ')}
            </span>
          )}
        </div>
      )}

      {explanation && (
        <div className="whitespace-pre-wrap break-words text-[15px]">{explanation}</div>
      )}

      {Array.isArray(content.rules) && content.rules.length > 0 && (
        <SectionList title="Rules" items={content.rules} />
      )}
      {Array.isArray(content.penalties) && content.penalties.length > 0 && (
        <SectionList title="Penalties" items={content.penalties} />
      )}
      
      {Array.isArray(content.suspicious_clauses) && content.suspicious_clauses.length > 0 && (
        <SectionList title="Suspicious Clauses" items={content.suspicious_clauses} />
      )}
      {Array.isArray(content.top_risks) && content.top_risks.length > 0 && (
        <SectionList title="Top Risks" items={content.top_risks} />
      )}
      {Array.isArray(content.warnings) && content.warnings.length > 0 && (
        <SectionList title="Warnings" items={content.warnings} />
      )}

      {Array.isArray(content.user_guidance) && content.user_guidance.length > 0 && (
        <SectionList title="What You Should Do" items={content.user_guidance} />
      )}
      {Array.isArray(content.what_user_should_do) && content.what_user_should_do.length > 0 && (
        <SectionList title="Action Plan" items={content.what_user_should_do} />
      )}

      {Array.isArray(content.quantified_impact) && content.quantified_impact.length > 0 && (
        <SectionList title="Quantified Impact" items={content.quantified_impact} />
      )}
      
      {content.law_reference && content.law_reference.applicable && (
        <div className="mt-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-400">
            Applicable Laws
          </div>
          {Array.isArray(content.law_reference.laws) && content.law_reference.laws.length > 0 && (
            <ul className="mb-2 list-none space-y-1">
              {content.law_reference.laws.map((law, idx) => (
                <li key={idx} className="text-sm font-medium text-indigo-200">
                  • {law}
                </li>
              ))}
            </ul>
          )}
          {content.law_reference.simple_explanation && (
            <div className="text-sm text-indigo-200/80">
              {content.law_reference.simple_explanation}
            </div>
          )}
        </div>
      )}

      {Array.isArray(content.legal_validity_flags) && content.legal_validity_flags.length > 0 && (
        <SectionList
          title="Legal Validity Flags"
          items={content.legal_validity_flags.map((flag) => {
            if (typeof flag === 'string') return flag;
            const parts = [flag.type, flag.clause, flag.law, flag.explanation]
              .filter(Boolean)
              .join(" | ");
            return parts || JSON.stringify(flag);
          })}
        />
      )}

      {content.lawyer_suggestion && (
        <div className="mt-4 text-sm italic text-slate-400 border-l-2 border-slate-700 pl-3">
          {content.lawyer_suggestion}
        </div>
      )}
    </div>
  );
}

function SectionList({ title, items }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        {title}
      </div>
      <div className="space-y-1">
        {items.map((item, index) => (
          <div key={`${title}-${index}`} className="text-sm leading-6">
            - {item}
          </div>
        ))}
      </div>
    </div>
  );
}
