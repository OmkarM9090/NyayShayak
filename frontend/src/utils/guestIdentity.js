const GUEST_ID_KEY = "nyaySahayakGuestId";
const GUEST_LIMITS_KEY = "nyaySahayakGuestLimits";
const PRIVACY_MODE_KEY = "nyaySahayakPrivacyMode";
const CHAT_SESSION_KEY = "nyaySahayakGuestChatSessionId";
const ANALYSIS_SESSION_KEY = "nyaySahayakGuestAnalysisSessionId";
const FIR_SESSION_KEY = "nyaySahayakGuestFirSessionId";
const GUEST_CHAT_HISTORY_KEY = "nyaySahayakGuestChatHistory";
const GUEST_ANALYSIS_KEY = "nyaySahayakGuestAnalysis";

const LIMITS = {
  chat: 3,
  analysis: 1,
  fir: 1,
};

function safeParseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function getAuthenticatedUserId() {
  const token = localStorage.getItem("token");
  const rawUser = localStorage.getItem("user");
  if (!token || !rawUser) {
    return null;
  }

  const user = safeParseJson(rawUser, null);
  return user?.id || null;
}

export function getOrCreateGuestId() {
  const existing = localStorage.getItem(GUEST_ID_KEY);
  if (existing && typeof existing === "string" && existing.startsWith("guest_")) {
    return existing;
  }

  const guestId = `guest_${crypto.randomUUID()}`;
  localStorage.setItem(GUEST_ID_KEY, guestId);
  return guestId;
}

export function getEffectiveUserId() {
  return getAuthenticatedUserId() || getOrCreateGuestId();
}

export function isGuestUser() {
  return !getAuthenticatedUserId();
}

export function getPrivacyMode() {
  const mode = localStorage.getItem(PRIVACY_MODE_KEY);
  return mode === "private" ? "private" : "save";
}

export function setPrivacyMode(mode) {
  const normalized = mode === "private" ? "private" : "save";
  localStorage.setItem(PRIVACY_MODE_KEY, normalized);
  return normalized;
}

function getSessionKey(type) {
  if (type === "analysis") return ANALYSIS_SESSION_KEY;
  if (type === "fir") return FIR_SESSION_KEY;
  return CHAT_SESSION_KEY;
}

export function getOrCreateGuestSessionId(type = "chat") {
  const key = getSessionKey(type);
  const existing = localStorage.getItem(key);
  if (existing) {
    return existing;
  }

  const sessionId = crypto.randomUUID();
  localStorage.setItem(key, sessionId);
  return sessionId;
}

export function resetGuestSessionId(type = "chat") {
  const key = getSessionKey(type);
  const sessionId = crypto.randomUUID();
  localStorage.setItem(key, sessionId);
  return sessionId;
}

export function getGuestUsage() {
  const raw = localStorage.getItem(GUEST_LIMITS_KEY);
  const usage = safeParseJson(raw, { chat: 0, analysis: 0, fir: 0 });

  return {
    chat: Number(usage.chat || 0),
    analysis: Number(usage.analysis || 0),
    fir: Number(usage.fir || 0),
  };
}

export function canUseGuestFeature(type) {
  const usage = getGuestUsage();
  const limit = LIMITS[type] ?? 0;
  return usage[type] < limit;
}

export function incrementGuestUsage(type) {
  const usage = getGuestUsage();
  const next = {
    ...usage,
    [type]: usage[type] + 1,
  };

  localStorage.setItem(GUEST_LIMITS_KEY, JSON.stringify(next));
  return next;
}

export function loadGuestChatHistory() {
  const raw = localStorage.getItem(GUEST_CHAT_HISTORY_KEY);
  return safeParseJson(raw, []);
}

export function saveGuestChatHistory(history) {
  localStorage.setItem(GUEST_CHAT_HISTORY_KEY, JSON.stringify(history));
}

export function loadGuestAnalysisHistory() {
  const raw = localStorage.getItem(GUEST_ANALYSIS_KEY);
  return safeParseJson(raw, []);
}

export function saveGuestAnalysisHistory(history) {
  localStorage.setItem(GUEST_ANALYSIS_KEY, JSON.stringify(history));
}
