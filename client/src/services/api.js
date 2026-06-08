// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// API SERVICE - Centralized API communication layer
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Purpose: Handle all backend API calls with proper error handling
// Benefits: 
//   - Single source of truth for API endpoints
//   - Consistent error handling
//   - Easy to maintain and test
//   - Type-safe responses
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { resolveLanguage } from "../config/languages";
import { getEffectiveUserId, getPrivacyMode } from "../utils/guestIdentity";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONFIGURATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

// API endpoints

const ENDPOINTS = {
  DOCUMENT_ANALYZE: `${API_BASE_URL}/document/analyze`,
  TEXT_ANALYZE: `${API_BASE_URL}/document/analyze-text`,
  HEALTH_CHECK: `${API_BASE_URL}/document/health`,
  DOCUMENT_SESSIONS: `${API_BASE_URL}/document/sessions`,
  DOCUMENT_HISTORY: (sessionId) => `${API_BASE_URL}/document/${sessionId}`,
  CHAT: `${API_BASE_URL}/chat`,
  FIR_GENERATE: `${API_BASE_URL}/generate-fir`,
  LANGUAGE_PREF: `${API_BASE_URL}/auth/language`,
  CHAT_SESSIONS: `${API_BASE_URL}/chat/sessions`,
  CHAT_HISTORY: (sessionId) => `${API_BASE_URL}/chat/${sessionId}`,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Handle API response with consistent error handling
 * @param {Response} response - Fetch API response object
 * @returns {Promise<Object>} Parsed JSON response
 * @throws {Error} If response is not ok
 */
async function handleResponse(response) {
  // Parse JSON response
  const data = await response.json();
  
  // If response is not successful, throw error with details
  if (!response.ok) {
    const error = new Error(data.message || "API request failed");
    error.status = response.status;
    error.code = data.error || "UNKNOWN_ERROR";
    error.details = data.details;
    throw error;
  }
  
  return data;
}

/**
 * Format error message for user display
 * @param {Error} error - Error object
 * @returns {string} User-friendly error message
 */
function formatErrorMessage(error) {
  // Network errors
  if (error.message === "Failed to fetch") {
    return "Unable to connect to server. Please check if the backend is running.";
  }
  
  // Custom error codes
  switch (error.code) {
    case "FILE_MISSING":
      return "Please select a document to upload.";
    case "FILE_TOO_LARGE":
      return "File size exceeds 15MB limit. Please upload a smaller file.";
    case "INVALID_FILE_TYPE":
      return "Invalid file type. Please upload a PDF or image file.";
    case "INSUFFICIENT_TEXT":
      return "Unable to extract sufficient text from the document. Please try a different file.";
    case "AI_SERVICE_ERROR":
      return "AI analysis service is temporarily unavailable. Please try again later.";
    case "TEXT_TOO_SHORT":
      return "Text is too short for analysis. Please provide at least 50 characters.";
    case "SCANNED_PDF":
      return "This appears to be a scanned PDF. Please upload an image version for OCR processing.";
    case "LIMIT_EXCEEDED":
      return "Please login to continue.";
    case "GUEST_ID_REQUIRED":
      return "Guest identity is missing. Please refresh the page.";
    default:
      return error.message || "An unexpected error occurred. Please try again.";
  }
}

function getStoredLanguage() {
  const stored = localStorage.getItem("nyaySahayakLanguage") || "en";
  return resolveLanguage(stored);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// API FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Upload and analyze a document (PDF or image)
 * 
 * @param {File} file - File object from input
 * @param {Function} onProgress - Optional progress callback
 * @returns {Promise<Object>} Analysis results
 * 
 * @example
 * const result = await analyzeDocument(file);
 * console.log(result.data.analysis.summary);
 */
export async function analyzeDocument(file, onProgress = null, options = {}) {
  try {
    if (!file) {
      throw new Error("No file provided");
    }
    
    const formData = new FormData();
    formData.append("document", file);
    const normalizedOptions = typeof options === "string" ? { language: options } : options || {};
    const resolvedLanguage = normalizedOptions.language || getStoredLanguage();
    const resolvedMode = normalizedOptions.mode || getPrivacyMode();
    const userId = getEffectiveUserId();
    formData.append("language", resolvedLanguage);
    formData.append("mode", resolvedMode);
    formData.append("userId", userId);
    if (normalizedOptions.sessionId) formData.append("sessionId", normalizedOptions.sessionId);
    if (normalizedOptions.instructions) formData.append("instructions", normalizedOptions.instructions);

    // Optional: Report upload start
    if (onProgress) {
      onProgress({ stage: "uploading", progress: 0 });
    }
    
    const token = localStorage.getItem('token');
    const headers = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(ENDPOINTS.DOCUMENT_ANALYZE, {
      method: "POST",
      headers,
      body: formData,
    });
    
    // Handle response
    const data = await handleResponse(response);
    
    // Report completion
    if (onProgress) {
      onProgress({ stage: "completed", progress: 100 });
    }
    
    return data;
    
  } catch (error) {
    console.error("[API] Document analysis error:", error);
    
    // Format error for user display
    const userMessage = formatErrorMessage(error);
    
    // Re-throw with formatted message
    const formattedError = new Error(userMessage);
    formattedError.originalError = error;
    formattedError.code = error.code;
    
    throw formattedError;
  }
}

/**
 * Analyze text directly without file upload
 * 
 * @param {string} text - Text to analyze
 * @returns {Promise<Object>} Analysis results
 * 
 * @example
 * const result = await analyzeText("This is my legal document text...");
 * console.log(result.data.analysis.risks);
 */
export async function analyzeText(text, options = {}) {
  try {
    if (!text || text.trim().length === 0) {
      throw new Error("Text cannot be empty");
    }
    
    if (text.trim().length < 5) {
      throw new Error("Text is too short. Please provide at least 5 characters.");
    }
    
    const token = localStorage.getItem('token');
    const headers = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const normalizedOptions = typeof options === "string" ? { language: options } : options || {};
    const resolvedMode = normalizedOptions.mode || getPrivacyMode();
    const userId = getEffectiveUserId();
    const payload = {
      text,
      language: normalizedOptions.language || getStoredLanguage(),
      mode: resolvedMode,
      userId,
    };
    if (normalizedOptions.sessionId) payload.sessionId = normalizedOptions.sessionId;

    const response = await fetch(ENDPOINTS.TEXT_ANALYZE, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    
    // Handle response
    const data = await handleResponse(response);
    
    return data;
    
  } catch (error) {
    console.error("[API] Text analysis error:", error);
    
    // Format error for user display
    const userMessage = formatErrorMessage(error);
    
    // Re-throw with formatted message
    const formattedError = new Error(userMessage);
    formattedError.originalError = error;
    formattedError.code = error.code;
    
    throw formattedError;
  }
}

/**
 * Check API health status
 * 
 * @returns {Promise<Object>} Health status
 * 
 * @example
 * const status = await checkHealth();
 * if (status.success) console.log("API is healthy");
 */
export async function checkHealth() {
  try {
    const response = await fetch(ENDPOINTS.HEALTH_CHECK, {
      method: "GET",
    });
    
    const data = await handleResponse(response);
    
    return data;
    
  } catch (error) {
    console.error("[API] Health check error:", error);
    throw error;
  }
}

/**
 * Generate FIR / complaint draft
 *
 * @param {string} userInput - Problem description
 * @returns {Promise<Object>} FIR draft
 */
export async function generateFir(userInput, options = {}) {
  try {
    if (!userInput || !userInput.trim()) {
      throw new Error("User input cannot be empty");
    }

    const normalizedOptions = typeof options === "string" ? { language: options } : options || {};
    const resolvedMode = normalizedOptions.mode || getPrivacyMode();
    const userId = getEffectiveUserId();
    const token = localStorage.getItem('token');
    const response = await fetch(ENDPOINTS.FIR_GENERATE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        user_input: userInput.trim(),
        language: normalizedOptions.language || getStoredLanguage(),
        mode: resolvedMode,
        userId,
        sessionId: normalizedOptions.sessionId,
      }),
    });

    return await handleResponse(response);
  } catch (error) {
    console.error("[API] FIR generation error:", error);
    const userMessage = formatErrorMessage(error);
    const formattedError = new Error(userMessage);
    formattedError.originalError = error;
    formattedError.code = error.code;
    throw formattedError;
  }
}

export async function sendChatMessage(message, options = {}) {
  try {
    if (!message || !message.trim()) {
      throw new Error("Message cannot be empty");
    }

    const token = localStorage.getItem('token');
    const headers = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const normalizedOptions = typeof options === "string" ? { language: options } : options || {};
    const resolvedMode = normalizedOptions.mode || getPrivacyMode();
    const userId = getEffectiveUserId();
    const payload = {
      message: message.trim(),
      language: normalizedOptions.language || getStoredLanguage(),
      mode: resolvedMode,
      userId,
    };
    if (normalizedOptions.sessionId) payload.sessionId = normalizedOptions.sessionId;

    const response = await fetch(ENDPOINTS.CHAT, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    return await handleResponse(response);
  } catch (error) {
    console.error("[API] Chat error:", error);

    const userMessage = formatErrorMessage(error);
    const formattedError = new Error(userMessage);
    formattedError.originalError = error;
    formattedError.code = error.code;

    throw formattedError;
  }
}

export async function fetchChatSessions() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return [];

    const response = await fetch(ENDPOINTS.CHAT_SESSIONS, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    return await handleResponse(response);
  } catch (error) {
    console.error("fetchChatSessions error:", error);
    return [];
  }
}

export async function fetchChatHistory(sessionId = "Legacy Chats") {
  try {
    const token = localStorage.getItem('token');
    if (!token) return [];

    const response = await fetch(ENDPOINTS.CHAT_HISTORY(sessionId), {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    return await handleResponse(response);
  } catch (error) {
    console.error("fetchChatHistory error:", error);
    const formattedError = new Error(formatErrorMessage(error));
    formattedError.originalError = error;
    formattedError.code = error.code;
    throw formattedError;
  }
}

export async function fetchAnalysisSessions() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return [];

    const response = await fetch(ENDPOINTS.DOCUMENT_SESSIONS, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    return await handleResponse(response);
  } catch (error) {
    console.error("fetchAnalysisSessions error:", error);
    return [];
  }
}

export async function fetchAnalysisHistory(sessionId = "Legacy Analyses") {
  try {
    const token = localStorage.getItem('token');
    if (!token) return [];

    const response = await fetch(ENDPOINTS.DOCUMENT_HISTORY(sessionId), {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    return await handleResponse(response);
  } catch (error) {
    console.error("fetchAnalysisHistory error:", error);
    return [];
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXPORT DEFAULT API OBJECT (Alternative usage pattern)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const api = {
  analyzeDocument,
  analyzeText,
  checkHealth,
  sendChatMessage,
  fetchChatHistory,
  fetchChatSessions,
  fetchAnalysisSessions,
  fetchAnalysisHistory,
};

export async function updateLanguagePreference(userId, preferredLanguage) {
  try {
    if (!userId) {
      throw new Error("User ID is required");
    }

    const response = await fetch(ENDPOINTS.LANGUAGE_PREF, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId, preferredLanguage }),
    });

    return await handleResponse(response);
  } catch (error) {
    console.error("[API] Language preference error:", error);
    throw error;
  }
}

export default api;
