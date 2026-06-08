import { geminiModel } from "../config/gemini.js";
import {
  ensureSupportedLanguage,
  getLanguageInstruction,
  getLanguageLabel,
} from "../config/languages.js";
import {
  analyzeDocument,
  analyzeLegalQuery,
  chunkText,
  detectDocumentType,
  extractTextFromDocx,
  generateFirDraft,
} from "./aiService.js";
import {
  buildContextString,
  filterRelevantResults,
  runPythonSearch,
} from "./legalRag.js";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INLINE COMPATIBILITY UTILITIES (Fixes aiService.js Missing Imports)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const removeMarkdownFormatting = (text) => {
  if (!text) return "";
  return text.replace(/```json/gi, "").replace(/```/g, "").trim();
};

const parseJSONResponse = (responseText) => {
  const cleanedText = removeMarkdownFormatting(responseText);
  try {
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error("[geminiChat JSON Fallback] Malformed structured chat output:", error.message);
    return null;
  }
};

const hasPlaceholders = (text) => {
  if (!text) return false;
  return /\[NAME_|_VAL_|AADHAAR|PHONE|PAN|EMAIL|\[\w+_\d+\]/i.test(text);
};

const extractNumericTokens = (text) => [];
const hasMissingNumericTokens = (analysis, original) => false;
const isLanguageMismatch = (text, lang) => false;
const isMixedLanguage = (text, lang) => false;
const translateStructuredOutput = async (data, lang) => data;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CORE CHAT SUGGESTIONS & INFERENCES ENGINE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function buildSuggestions(query) {
  const normalizedQuery = query.toLowerCase();
  const suggestions = ["See Steps"];

  if (normalizedQuery.includes("chori") || normalizedQuery.includes("theft")) {
    suggestions.unshift("Generate FIR");
  }

  if (normalizedQuery.includes("agreement")) {
    suggestions.push("Analyze Document");
  }

  return [...new Set(suggestions)];
}

function inferLanguageInstruction(language) {
  const resolvedLanguage = ensureSupportedLanguage(language);
  return getLanguageInstruction(resolvedLanguage);
}

function hasImpactPhrase(text, language) {
  const normalized = String(text || "").toLowerCase();
  const resolvedLanguage = ensureSupportedLanguage(language);

  if (resolvedLanguage === "hi") {
    return /(नुकसान|पैसे|खर्च|जुर्माना|खतरा|धोखा|रिस्क)/i.test(normalized);
  }
  if (resolvedLanguage === "mr") {
    return /(नुकसान|पैसे|खर्च|धोखा|धोका|रिस्क|त्रास)/i.test(normalized);
  }
  return /(risk|danger|unfair|illegal|money|cost|penalty|loss|fraud|caution)/i.test(normalized);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GENERATE STRUCTURAL GEMINI CHAT REPLY WITH CORE JSON RETRIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function generateGeminiReply({ query, context = "", language = "en" }) {
  const resolvedLanguage = ensureSupportedLanguage(language);
  const langLabel = getLanguageLabel(resolvedLanguage);
  const langInstruction = inferLanguageInstruction(resolvedLanguage);

  const basePrompt = `
You are 'Nyay-Sahayak Omnichannel Legal Bot', a helpful legal assistant app.
The user is asking a legal question. Provide an expert, professional response.

CRITICAL INSTRUCTION:
You MUST respond with a valid JSON object matching the exact format specified below.
Do not use markdown blocks, thoughts, or trailing lines.
The values for fields "reason_for_decision", "what_user_should_do", "note_for_user", "lawyer_suggestion", and items in arrays MUST be generated in the language: ${langLabel.toUpperCase()}.

CONTEXT DOCUMENT (RAG):
${context || "No standard context reference available."}

USER QUERY:
${query}

OUTPUT STRUCTURE PATTERN:
{
  "document_type": "Identify type if applicable, else 'General Query'",
  "classification": "SAFE" or "UNFAIR" or "NEUTRAL",
  "final_decision": "APPROVE" or "REVIEW_CAUTION" or "REJECT",
  "should_user_sign": "YES" or "CAUTION" or "NO",
  "risk_level": "LOW" or "MEDIUM" or "HIGH",
  "reason_for_decision": "Clear legal response explanation in ${langLabel}",
  "suspicious_clauses": [],
  "top_risks": [],
  "what_user_should_do": ["Action point 1 in ${langLabel}"],
  "warnings": [],
  "law_reference": {
    "applicable": false,
    "laws": [],
    "simple_explanation": "Explanation in ${langLabel}"
  },
  "lawyer_suggestion": "Recommendation in ${langLabel}",
  "note_for_user": "Disclaimer in ${langLabel}"
}
`;

  let attempts = 0;
  let lastError = null;

  while (attempts < 2) {
    try {
      const currentPrompt = attempts === 0 ? basePrompt : `${basePrompt}\n\nST_REMINDER: Ensure valid JSON in ${langLabel.toUpperCase()}.`;
      const result = await geminiModel.generateContent(currentPrompt);
      const text = result.response.text();
      
      const parsed = parseJSONResponse(text);
      if (parsed) return parsed;
      attempts++;
    } catch (err) {
      lastError = err;
      attempts++;
    }
  }

  throw lastError || new Error("Failed to compile valid omnichannel chat payload format.");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PRIMARY EXPORT ROUTINE: INTERACTIVE CHAT PIPELINE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function processLegalChat(query, chatHistory = [], options = {}) {
  let context = "";
  let contextUsed = false;
  let aiQuery = query;

  if (chatHistory && chatHistory.length > 0) {
    const historySnippet = chatHistory
      .slice(-4)
      .map((msg) => `${msg.sender === "user" ? "User" : "Bot"}: ${msg.text}`)
      .join("\n");
    aiQuery = `Historical Context Loop:\n${historySnippet}\n\nCurrent Question: ${query}`;
  }

  try {
    // Vector search backward layer connection (FastAPI Forwarder)
    const rawSearch = await runPythonSearch(query);
    const relevant = filterRelevantResults(rawSearch, query);
    
    if (relevant && relevant.length > 0) {
      context = buildContextString(relevant);
      contextUsed = Boolean(context);
    }
  } catch (error) {
    console.error("[geminiChat] Semantic context retrieval bypassed:", error.message);
  }

  try {
    const reply = await generateGeminiReply({ query: aiQuery, context, language: options.language });
    return {
      reply,
      suggestions: buildSuggestions(query),
      contextUsed,
      isError: false,
    };
  } catch (error) {
    console.error("[geminiChat] Pipeline failure fallback dispatched:", error.message);
    
    return {
      reply: {
        document_type: "General Query",
        classification: "NEUTRAL",
        final_decision: "REVIEW_CAUTION",
        should_user_sign: "CAUTION",
        risk_level: "MEDIUM",
        reason_for_decision: "The assistant encountered a processing boundary. Please rephrase or refresh.",
        suspicious_clauses: [],
        top_risks: [],
        what_user_should_do: ["Please check your connection and resubmit."],
        warnings: [],
        law_reference: { applicable: false, laws: [], simple_explanation: "" },
        lawyer_suggestion: "Consult an expert if the matter persists.",
        note_for_user: "AI generated session boundary.",
      },
      suggestions: ["See Steps"],
      contextUsed: false,
      isError: true,
    };
  }
}