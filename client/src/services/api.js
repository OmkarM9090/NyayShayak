import { resolveLanguage } from "../config/languages";
import { getEffectiveUserId, getPrivacyMode } from "../utils/guestIdentity";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

const ENDPOINTS = {
  DOCUMENT_ANALYZE: `${API_BASE_URL}/comprehensive-analysis`,
  TEXT_ANALYZE: `${API_BASE_URL}/document/analyze-text`,
  HEALTH_CHECK: `${API_BASE_URL}/document/health`,
  DOCUMENT_SESSIONS: `${API_BASE_URL}/document/sessions`,
  DOCUMENT_HISTORY: (sessionId) => `${API_BASE_URL}/document/${sessionId}`,
  CHAT: `${API_BASE_URL}/chat`,
  FIR_GENERATE: `${API_BASE_URL}/generate-fir`,
  LANGUAGE_PREF: `${API_BASE_URL}/auth/language`,
};

async function handleResponse(response) {
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || data.error || `HTTP error! status: ${response.status}`);
    }
    return data;
  } else {
    const text = await response.text();
    if (!response.ok) {
      throw new Error(text || `HTTP error! status: ${response.status}`);
    }
    return text;
  }
}

// FIXED: Converts uploaded files text cleanly into string buffers before appending to FormData fields layout
export async function analyzeDocument(file, language = "en", options = {}) {
  try {
    if (!file) {
      throw new Error("No valid file reference attached.");
    }

    // Step A: Read raw file content block into text streams smoothly
    const textBuffer = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (err) => reject(err);
      reader.readAsText(file);
    });

    const token = localStorage.getItem("token");
    const headers = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    console.log(`[api.js] Triggering document JSON proxy delivery for language target: ${language}`);
    const response = await fetch(ENDPOINTS.DOCUMENT_ANALYZE, {
      method: "POST",
      headers,
      body: JSON.stringify({
        documentText: textBuffer,
        language: language,
        mode: options.mode,
        sessionId: options.sessionId,
      }),
    });

    return await handleResponse(response);
  } catch (error) {
    console.error("[api.js] File array mapping exception encountered:", error.message);
    throw error;
  }
}

export async function analyzeText(text, language = "en") {
  try {
    const token = localStorage.getItem("token");
    const response = await fetch(ENDPOINTS.TEXT_ANALYZE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ text, language }),
    });
    return await handleResponse(response);
  } catch (error) {
    console.error("analyzeText error:", error);
    throw error;
  }
}

export async function checkHealth() {
  try {
    const response = await fetch(ENDPOINTS.HEALTH_CHECK, { method: "GET" });
    return await handleResponse(response);
  } catch (error) {
    return { status: "DOWN", error: error.message };
  }
}

// ... Rest of your existing working routines preserved exactly
export async function sendChatMessage(message, sessionId = "default", language = "en") {
  try {
    const token = localStorage.getItem("token");
    const response = await fetch(ENDPOINTS.CHAT, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { "Authorization": `Bearer ${token}` } : {}) },
      body: JSON.stringify({ message, sessionId, language }),
    });
    return await handleResponse(response);
  } catch (error) { throw error; }
}

export async function fetchChatHistory(sessionId) {
  try {
    const token = localStorage.getItem("token");
    const response = await fetch(`${ENDPOINTS.CHAT}/${sessionId}`, { method: "GET", headers: token ? { "Authorization": `Bearer ${token}` } : {} });
    return await handleResponse(response);
  } catch (error) { return []; }
}

export async function fetchChatSessions() {
  try {
    const token = localStorage.getItem("token");
    if (!token) return [];
    const response = await fetch(`${ENDPOINTS.CHAT}/sessions`, { method: "GET", headers: { "Authorization": `Bearer ${token}` } });
    return await handleResponse(response);
  } catch (error) { return []; }
}

export async function fetchAnalysisSessions() {
  try {
    const token = localStorage.getItem("token");
    if (!token) return [];
    const response = await fetch(ENDPOINTS.DOCUMENT_SESSIONS, { method: "GET", headers: { "Authorization": `Bearer ${token}` } });
    return await handleResponse(response);
  } catch (error) { return []; }
}

export async function fetchAnalysisHistory(sessionId = "Legacy Analyses") {
  try {
    const token = localStorage.getItem("token");
    if (!token) return [];
    const response = await fetch(ENDPOINTS.DOCUMENT_HISTORY(sessionId), { method: "GET", headers: { "Authorization": `Bearer ${token}` } });
    return await handleResponse(response);
  } catch (error) { return []; }
}

export async function updateLanguagePreference(userId, preferredLanguage) {
  try {
    if (!userId) throw new Error("User ID required");
    const response = await fetch(ENDPOINTS.LANGUAGE_PREF, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, preferredLanguage }) });
    return await handleResponse(response);
  } catch (error) { throw error; }
}

export async function generateFir(userInput, options = {}) {
  try {
    const token = localStorage.getItem("token");
    const response = await fetch(ENDPOINTS.FIR_GENERATE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        user_input: userInput,
        language: options.language,
        mode: options.mode,
        sessionId: options.sessionId,
      }),
    });
    return await handleResponse(response);
  } catch (error) {
    console.error("generateFir error:", error);
    throw error;
  }
}

const api = {
  analyzeDocument,
  analyzeText,
  checkHealth,
  sendChatMessage,
  fetchChatHistory,
  fetchChatSessions,
  fetchAnalysisSessions,
  fetchAnalysisHistory,
  updateLanguagePreference,
  generateFir,
};

export default api;