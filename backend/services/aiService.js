import mammoth from "mammoth";
import { geminiModel, genAI } from "../config/gemini.js";
import {
  ensureSupportedLanguage,
  getLanguageInstruction,
  getLanguageLabel,
  resolveLanguage,
} from "../config/languages.js";
import {
  buildContextString,
  filterRelevantResults,
  runPythonSearch,
} from "./legalRag.js";

const FALLBACK_MODELS = [
  process.env.GEMINI_MODEL || "gemini-2.5-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
];
const RETRYABLE_STATUS_CODES = [429, 500, 503, 504];
const MAX_RETRY_ATTEMPTS = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableGeminiError(error) {
  const message = String(error?.message || "");
  const isRetryableStatus = RETRYABLE_STATUS_CODES.some((code) =>
    message.includes(`[${code}`)
  );

  return (
    isRetryableStatus ||
    /service unavailable|high demand|temporar|try again later|rate limit/i.test(message)
  );
}

function isModelUnavailableError(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("[404") ||
    message.includes("not found") ||
    message.includes("is not supported for generatecontent") ||
    message.includes("listmodels")
  );
}

function getModelInstance(modelName) {
  if (!genAI) {
    return geminiModel;
  }

  return genAI.getGenerativeModel({ model: modelName });
}

async function generateWithModelRetry(modelName, prompt) {
  const model = getModelInstance(modelName);
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await model.generateContent(prompt);
    } catch (error) {
      lastError = error;

      if (!isRetryableGeminiError(error) || attempt === MAX_RETRY_ATTEMPTS) {
        throw error;
      }

      const delayMs = 500 * 2 ** (attempt - 1);
      await sleep(delayMs);
    }
  }

  throw lastError;
}

async function generateContentWithFallback(prompt) {
  let lastError = null;

  for (const modelName of [...new Set(FALLBACK_MODELS)]) {
    try {
      return await generateWithModelRetry(modelName, prompt);
    } catch (error) {
      lastError = error;

      if (isModelUnavailableError(error)) {
        console.warn(`[aiService] Model ${modelName} unavailable, trying next model...`);
        continue;
      }

      if (!isRetryableGeminiError(error)) {
        throw error;
      }

      console.warn(`[aiService] Model ${modelName} failed, trying fallback model...`);
    }
  }

  throw lastError || new Error("Gemini request failed across all fallback models");
}

const MAX_CHUNK_SIZE = 10000;
const MAX_ANALYSIS_INPUT = 18000;
const LEGAL_DATASET_ALLOWED_TYPES = new Set([
  "legal",
  "offer_letter",
  "property_document",
  "rental_agreement",
  "ticket",
  "bank_financial",
  "government_rule",
  "policy",
]);
const FRAUD_WARNING_MESSAGES = [
  "This document shows strong signs of a job scam. Do NOT pay any money or share personal details.",
];
const PIPELINE_DEBUG = String(process.env.PIPELINE_DEBUG || "").toLowerCase() === "true";
const CLASSIFICATION_CONFIDENCE_THRESHOLD = Number(
  process.env.CLASSIFICATION_CONFIDENCE_THRESHOLD || 50
);
const CLASSIFICATION_MAX_INPUT = Number(process.env.CLASSIFICATION_MAX_INPUT || 6000);
const DOCUMENT_TYPE_LABELS = {
  ticket: "Ticket",
  offer_letter: "Offer Letter",
  legal_agreement: "Legal Agreement",
  identity_document: "Identity Document",
  financial_document: "Financial Document",
  other: "Other",
};
const DOCUMENT_TYPE_KEYS = Object.fromEntries(
  Object.entries(DOCUMENT_TYPE_LABELS).map(([key, label]) => [label, key])
);
const LAW_REFERENCE_DETAILS = {
  "Indian Railways Rules":
    "Ticket validity and travel conditions are governed by Indian Railways rules.",
  "Indian Contract Act": "Ensures agreements are fair and legally valid.",
  "Indian Contract Act (Section 28)":
    "Bars clauses that restrict legal remedies or access to courts.",
  "RERA Act": "Protects home buyers from builder-related issues.",
  "Model Tenancy Act / State Rent Act":
    "Governs rights and obligations of landlords and tenants.",
  "Relevant Labour Laws": "Protect employees from unfair job conditions.",
  "RBI Guidelines": "Protects customers from unsafe banking practices and sharing OTP/CVV/password.",
  "IPC 420": "Addresses cheating and fraud-related offenses.",
  "Consumer Protection Act": "Prevents unfair trade practices and protects consumers.",
  "Applicable Government Rules": "Requires compliance with official government notifications.",
};
const DOCUMENT_KEYWORDS = {
  ticket: {
    strong: ["pnr", "irctc", "railway", "train", "platform", "coach", "berth"],
    support: ["ticket", "journey", "departure", "arrival", "boarding", "class", "fare"],
  },
  offer_letter: {
    strong: ["offer letter", "appointment letter", "ctc", "joining date", "probation"],
    support: ["salary", "designation", "position", "employment", "benefits"],
  },
  legal_agreement: {
    strong: ["agreement", "contract", "whereas", "arbitration", "jurisdiction", "clause"],
    support: ["section", "party", "indemnity", "termination", "liability"],
  },
  identity_document: {
    strong: ["aadhaar", "aadhar", "pan", "passport", "driver", "voter id"],
    support: ["dob", "date of birth", "address", "id number", "gender"],
  },
  financial_document: {
    strong: ["account number", "ifsc", "statement", "loan", "emi", "balance"],
    support: ["bank", "transaction", "amount", "interest", "upi"],
  },
  other: {
    strong: [],
    support: [],
  },
};
const RISK_PHRASE_MAP = {
  "Cost Escalation Risk": "Cost Escalation Risk",
  "Hidden Charges Risk": "Hidden Charges",
  "Legal Disadvantage Risk": "Jurisdiction Limitation",
  "Cancellation Loss Risk": "Cancellation Deduction",
  "Delay Without Penalty": "Delay Without Penalty",
  "High Penalty Clause": "Penalty Clause",
  "Cancellation Deduction High": "Cancellation Deduction",
  "Penalty Clause": "Penalty Clause",
  "Delay Clause": "Delay Clause",
  "Upfront Payment Scam": "Upfront Payment Demand",
  "Upfront Payment Demand": "Upfront Payment Demand",
  "Job Scam Indicator": "Job Scam Indicator",
  "Personal Data Risk": "Personal Data Risk",
  "Urgency Pressure": "Urgency Pressure",
  "Salary Delay Risk": "Salary Uncertainty",
};

function chunkText(text, chunkSize = MAX_CHUNK_SIZE) {
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.substring(i, i + chunkSize));
  }
  return chunks;
}

function removeMarkdownFormatting(text) {
  return text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
}

function parseJSONResponse(responseText) {
  try {
    return JSON.parse(responseText);
  } catch (error) {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error(`No valid JSON found in Gemini response: ${error.message}`);
  }
}

function truncateText(text, maxLength = MAX_ANALYSIS_INPUT) {
  if (text.length <= maxLength) {
    return text;
  }

  const headSize = Math.floor(maxLength * 0.45);
  const tailSize = Math.floor(maxLength * 0.25);
  const middleSize = maxLength - headSize - tailSize;
  const middleStart = Math.max(0, Math.floor((text.length - middleSize) / 2));

  return [
    text.slice(0, headSize),
    "\n...\n",
    text.slice(middleStart, middleStart + middleSize),
    "\n...\n",
    text.slice(-tailSize),
  ].join("");
}

function cleanOcrText(text) {
  let cleaned = String(text || "").normalize("NFKC");
  cleaned = cleaned.replace(/[\u0000-\u001f]/g, " ");
  cleaned = cleaned.replace(/[“”]/g, '"').replace(/[’‘]/g, "'");
  cleaned = cleaned.replace(/[‐‑–—]/g, "-");
  cleaned = cleaned.replace(/[^A-Za-z0-9\s]/g, " ");
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  const tokens = cleaned.split(" ").map((token) => {
    if (!token) {
      return "";
    }

    let fixed = token;
    const hasDigits = /\d/.test(fixed);
    const hasLetters = /[A-Za-z]/.test(fixed);

    if (hasDigits && hasLetters) {
      fixed = fixed.replace(/[oO]/g, "0").replace(/[lI]/g, "1");
    }

    fixed = fixed.replace(/rn/gi, "m").replace(/vv/gi, "w");

    return fixed;
  });

  return tokens.filter(Boolean).join(" ");
}

function normalizeForMatching(text) {
  return cleanOcrText(text).toLowerCase();
}

function inferLanguageInstruction(language) {
  const resolvedLanguage = ensureSupportedLanguage(language);
  return getLanguageInstruction(resolvedLanguage);
}

function hasDevanagariText(text) {
  return /[\u0900-\u097F]/.test(String(text || ""));
}

function extractNumericTokens(text, limit = 12) {
  const normalized = String(text || "");
  const matches = normalized.match(/(?:₹\s*)?\d+(?:,\d{3})*(?:\.\d+)?%?/g) || [];
  const unique = [...new Set(matches.map((item) => item.trim()).filter(Boolean))];
  return unique.slice(0, limit);
}

function hasPlaceholders(text) {
  return /_{2,}/.test(String(text || ""));
}

function hasMissingNumericTokens(text, requiredTokens = []) {
  if (!requiredTokens.length) {
    return false;
  }

  const haystack = String(text || "");
  return requiredTokens.some((token) => !haystack.includes(token));
}

function isMixedLanguage(text, language) {
  const resolvedLanguage = ensureSupportedLanguage(language);
  if (resolvedLanguage === "en") {
    return false;
  }

  let content = String(text || "");
  if (content.includes(":")) {
    content = content.replace(/"[^"]+"\s*:/g, " ");
  }
  const devanagariCount = (content.match(/[\u0900-\u097F]/g) || []).length;
  const latinCount = (content.match(/[A-Za-z]/g) || []).length;
  const totalLetters = devanagariCount + latinCount;

  if (totalLetters === 0) {
    return false;
  }

  const englishHeadings = /(Top Risks|What To Do|Warnings|Reason for decision|Law Reference|Legal Grounds|Suggested Actions|Important Notes|Request|Subject)/i.test(
    content
  );
  const latinRatio = latinCount / totalLetters;

  return englishHeadings || (latinCount > 20 && latinRatio > 0.28);
}

function isLanguageMismatch(text, language) {
  const resolvedLanguage = ensureSupportedLanguage(language);
  if (resolvedLanguage === "hi" || resolvedLanguage === "mr") {
    return !hasDevanagariText(text);
  }
  return false;
}

function logPipeline(step, payload) {
  if (!PIPELINE_DEBUG) {
    return;
  }

  const safePayload = { ...payload };
  if (safePayload && typeof safePayload === "object") {
    delete safePayload.text;
    delete safePayload.rawText;
  }

  console.log(`[pipeline] ${step}`, safePayload || "");
}

function cleanExtractedText(text) {
  let cleaned = String(text || "").normalize("NFKC");
  cleaned = cleaned.replace(/[\u0000-\u001f]/g, " ");
  cleaned = cleaned.replace(/[\s\u00a0]+/g, " ").trim();
  return cleaned;
}

function normalizeGeminiDocumentType(value) {
  const normalized = String(value || "").toLowerCase();

  if (normalized.includes("ticket") || normalized.includes("rail")) {
    return "Ticket";
  }
  if (normalized.includes("offer") || normalized.includes("appointment")) {
    return "Offer Letter";
  }
  if (normalized.includes("legal") || normalized.includes("agreement") || normalized.includes("contract")) {
    return "Legal Agreement";
  }
  if (
    normalized.includes("identity") ||
    normalized.includes("aadhaar") ||
    normalized.includes("aadhar") ||
    normalized.includes("pan") ||
    normalized.includes("passport") ||
    normalized.includes("driver")
  ) {
    return "Identity Document";
  }
  if (
    normalized.includes("financial") ||
    normalized.includes("bank") ||
    normalized.includes("statement") ||
    normalized.includes("loan") ||
    normalized.includes("invoice")
  ) {
    return "Financial Document";
  }

  return "Other";
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

function buildClassificationPrompt(extractedText) {
  return `Classify the following document into one of these categories:

1. Ticket
2. Offer Letter
3. Legal Agreement
4. Identity Document
5. Financial Document
6. Other

Return ONLY JSON:
{
"document_type": "...",
"confidence": 0-100,
"reason": "short explanation"
}

If unsure or the text is noisy, choose "Other".

Text:
${extractedText}`;
}

function parseClassificationResponse(raw = {}) {
  const documentType = normalizeGeminiDocumentType(raw.document_type);
  const confidence = clampNumber(Number(raw.confidence), 0, 100);
  const reason = flattenObjectToString(raw.reason || raw.explanation || "");

  return {
    document_type: documentType,
    confidence,
    reason,
  };
}

async function classifyDocumentWithGemini(extractedText) {
  const trimmed = cleanExtractedText(extractedText);
  const shortened = truncateText(trimmed, CLASSIFICATION_MAX_INPUT);
  const prompt = buildClassificationPrompt(shortened || "(empty)");

  const raw = await generateStructuredJson(prompt);
  const parsed = parseClassificationResponse(raw);

  if (parsed.confidence < CLASSIFICATION_CONFIDENCE_THRESHOLD) {
    return {
      document_type: "Other",
      confidence: parsed.confidence,
      reason: parsed.reason || "Low confidence classification",
    };
  }

  return parsed;
}

function documentTypeLabelToKey(label) {
  return DOCUMENT_TYPE_KEYS[label] || "other";
}

function countKeywordHits(text, keywords) {
  if (!keywords || keywords.length === 0) {
    return 0;
  }
  return keywords.reduce((count, keyword) => count + (hasKeyword(text, keyword) ? 1 : 0), 0);
}

function computeKeywordStrength(text, documentTypeKey) {
  const normalized = normalizeForMatching(text);
  const keywords = DOCUMENT_KEYWORDS[documentTypeKey] || DOCUMENT_KEYWORDS.other;
  const strongHits = countKeywordHits(normalized, keywords.strong);
  const supportHits = countKeywordHits(normalized, keywords.support);
  const maxScore = keywords.strong.length * 2 + keywords.support.length;

  if (maxScore === 0) {
    return 0.2;
  }

  const score = (strongHits * 2 + supportHits) / maxScore;
  return clampNumber(score, 0, 1);
}

function computeStructureClarity(text, documentTypeKey) {
  const normalized = normalizeForMatching(text);
  const rawText = String(text || "");

  let checks = [];
  switch (documentTypeKey) {
    case "ticket":
      checks = [
        /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec))\b/i.test(
          rawText
        ),
        /\b\d{1,2}:\d{2}\b/.test(rawText),
        /(from\s+\w+\s+to\s+\w+|source\s+station|destination\s+station|boarding\s+station)/i.test(
          rawText
        ),
        /(pnr|train\s*(no|number)|coach|berth|irctc|uts)/i.test(normalized),
      ];
      break;
    case "offer_letter":
      checks = [
        /offer letter|appointment letter/i.test(normalized),
        /ctc|salary|compensation/i.test(normalized),
        /joining date|start date|date of joining/i.test(normalized),
        /designation|position|role/i.test(normalized),
      ];
      break;
    case "legal_agreement":
      checks = [
        /agreement|contract|deed/i.test(normalized),
        /clause|section|whereas/i.test(normalized),
        /jurisdiction|arbitration|governing law/i.test(normalized),
        /party of the first part|party of the second part|authorized signatory/i.test(normalized),
      ];
      break;
    case "identity_document":
      checks = [
        /aadhaar|aadhar|pan|passport|voter id|driving/i.test(normalized),
        /dob|date of birth/i.test(normalized),
        /address/i.test(normalized),
        /\b\d{4}\s*\d{4}\s*\d{4}\b|\b[A-Z]{5}\d{4}[A-Z]\b/i.test(rawText),
      ];
      break;
    case "financial_document":
      checks = [
        /account\s*number|ifsc|statement|loan|emi/i.test(normalized),
        /balance|credit|debit|transaction/i.test(normalized),
        /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/.test(rawText),
        /(bank|branch|statement|ledger)/i.test(normalized),
      ];
      break;
    default:
      checks = [/\btitle\b|\bsection\b|\bsummary\b/i.test(normalized)];
  }

  if (checks.length === 0) {
    return 0.2;
  }

  const score = checks.filter(Boolean).length / checks.length;
  return clampNumber(score, 0, 1);
}

function computeTextClarityScore(text) {
  const raw = String(text || "");
  if (!raw) {
    return 0.2;
  }

  const alphaNum = raw.match(/[A-Za-z0-9]/g) || [];
  const total = raw.length || 1;
  const ratio = alphaNum.length / total;

  if (ratio < 0.4) {
    return 0.6;
  }
  if (ratio < 0.55) {
    return 0.8;
  }
  return 1;
}

function cleanOcrNoise(text) {
  return String(text || "")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[^\w\s.,;:!?%()₹\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countWords(text) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function extractRelevantSentence(text, keywordOrPattern) {
  const cleanedText = cleanOcrNoise(text);
  const sentences = cleanedText.split(/[.!?]/).map((sentence) => sentence.trim()).filter(Boolean);
  const isRegex = keywordOrPattern instanceof RegExp;

  for (let i = 0; i < sentences.length; i += 1) {
    const sentence = sentences[i];
    const matched = isRegex
      ? keywordOrPattern.test(sentence)
      : sentence.toLowerCase().includes(String(keywordOrPattern || "").toLowerCase());

    if (!matched) {
      continue;
    }

    let candidate = sentence;

    if (countWords(candidate) < 8) {
      const next = sentences[i + 1] ? ` ${sentences[i + 1]}` : "";
      const prev = sentences[i - 1] ? `${sentences[i - 1]} ` : "";
      candidate = countWords(prev + candidate) >= 8 ? `${prev}${candidate}` : `${candidate}${next}`;
    }

    if (countWords(candidate) >= 8) {
      return candidate.trim();
    }
  }

  return "Relevant clause detected but full sentence not found in OCR text.";
}

function dedupeDetectedRisks(risks) {
  if (!Array.isArray(risks)) {
    return [];
  }

  const seen = new Set();
  return risks.filter((risk) => {
    const key = `${risk.type}|${risk.reason}`.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function findPercentNearKeywords(text, keywords) {
  const raw = String(text || "");
  const normalized = raw.toLowerCase();
  const matches = [...normalized.matchAll(/(\d{1,2})\s*%/g)];
  let maxPercent = null;

  for (const match of matches) {
    const percent = Number(match[1]);
    if (!Number.isFinite(percent)) {
      continue;
    }

    const start = Math.max(0, match.index - 40);
    const end = Math.min(normalized.length, match.index + 40);
    const window = normalized.slice(start, end);

    if (keywords.some((keyword) => window.includes(keyword))) {
      maxPercent = maxPercent == null ? percent : Math.max(maxPercent, percent);
    }
  }

  return maxPercent;
}

function detectClauseRisks(text) {
  const normalized = normalizeForMatching(text);
  const rawText = String(text || "");
  const risks = [];

  if (/increase\s+cost|final\s+cost\s+may\s+increase/i.test(normalized)) {
    risks.push(
      createRisk(
        "Cost Escalation Risk",
        "Cost escalation terms detected.",
        "HIGH",
        extractClauseSnippet(rawText, /increase\s+cost|final\s+cost\s+may\s+increase/i)
      )
    );
  }

  if (/maintenance|hidden\s+cost/i.test(normalized)) {
    risks.push(
      createRisk(
        "Hidden Charges Risk",
        "Hidden or maintenance charges are referenced.",
        "MEDIUM",
        extractClauseSnippet(rawText, /maintenance|hidden\s+cost/i)
      )
    );
  }

  if (/jurisdiction|only\s+court/i.test(normalized)) {
    risks.push(
      createRisk(
        "Legal Disadvantage Risk",
        "Jurisdiction restrictions detected.",
        "MEDIUM",
        extractClauseSnippet(rawText, /jurisdiction|only\s+court/i)
      )
    );
  }

  if (/deduct|cancellation\s+charges/i.test(normalized)) {
    risks.push(
      createRisk(
        "Cancellation Loss Risk",
        "Cancellation deductions are mentioned.",
        "MEDIUM",
        extractClauseSnippet(rawText, /deduct|cancellation\s+charges/i)
      )
    );
  }

  if (/delay/i.test(normalized) && /no\s+penalty|without\s+penalty|no\s+compensation/i.test(normalized)) {
    risks.push(
      createRisk(
        "Delay Without Penalty",
        "Delay clauses appear without penalty or compensation.",
        "HIGH",
        extractClauseSnippet(
          rawText,
          /delay[\s\S]{0,80}(no\s+penalty|without\s+penalty|no\s+compensation)/i
        )
      )
    );
  }

  if (/salary\s+may\s+be\s+delayed|salary\s+payment\s+may\s+be\s+delayed|salary\s+can\s+be\s+delayed|payment\s+of\s+salary\s+may\s+be\s+delayed/i.test(normalized)) {
    risks.push(
      createRisk(
        "Salary Delay Risk",
        "Salary payment is not guaranteed.",
        "MEDIUM",
        extractClauseSnippet(
          rawText,
          /salary\s+may\s+be\s+delayed|salary\s+payment\s+may\s+be\s+delayed|salary\s+can\s+be\s+delayed|payment\s+of\s+salary\s+may\s+be\s+delayed/i
        )
      )
    );
  }

  const penaltyPercent = findPercentNearKeywords(rawText, ["penalty", "penalties", "charge", "charges"]);
  if (penaltyPercent != null && penaltyPercent >= 15) {
    risks.push(
      createRisk(
        "High Penalty Clause",
        `Penalty of ${penaltyPercent}% detected (>= 15%).`,
        "HIGH",
        extractClauseSnippet(rawText, /penalt|charges?/i)
      )
    );
  }

  const cancellationPercent = findPercentNearKeywords(rawText, ["cancellation", "deduct", "deduction"]);
  if (cancellationPercent != null && cancellationPercent >= 20) {
    risks.push(
      createRisk(
        "Cancellation Deduction High",
        `Cancellation deduction of ${cancellationPercent}% detected (>= 20%).`,
        "HIGH",
        extractClauseSnippet(rawText, /cancellation|deduct|deduction/i)
      )
    );
  }

  return risks;
}

function computeRiskLevelFromDetectedRisks(detectedRisks) {
  const highCount = detectedRisks.filter((risk) => risk.level === "HIGH").length;
  const mediumCount = detectedRisks.filter((risk) => risk.level === "MEDIUM").length;
  const totalRisks = detectedRisks.length;

  if (highCount >= 2 || totalRisks >= 4) {
    return "HIGH";
  }
  if (mediumCount >= 2) {
    return "MEDIUM";
  }
  return "LOW";
}

function buildRiskSummaryPhrases(detectedRisks) {
  return detectedRisks
    .map((risk) => RISK_PHRASE_MAP[risk.type] || String(risk.type || "").toLowerCase())
    .filter(Boolean)
    .slice(0, 3);
}

function buildKeyWarningFromRisks(detectedRisks, documentLabel) {
  if (!Array.isArray(detectedRisks) || detectedRisks.length === 0) {
    if (documentLabel && documentLabel.toLowerCase().includes("agreement")) {
      return "This agreement appears balanced and does not contain major risks.";
    }
    if (documentLabel && documentLabel.toLowerCase().includes("offer")) {
      return "This agreement appears balanced and does not contain major risks.";
    }
    return "No major risk clauses detected in the available text.";
  }

  const phrases = buildRiskSummaryPhrases(detectedRisks);
  if (phrases.length === 0) {
    return "Multiple risk indicators detected. Review before signing or acting.";
  }

  const prefix = documentLabel && documentLabel.toLowerCase().includes("agreement")
    ? "The agreement grants"
    : "This document includes";

  return `${prefix} ${phrases.join(", ")} - your protections look limited.`;
}

function buildSmartExplanationFromRisks(detectedRisks, documentLabel) {
  if (!Array.isArray(detectedRisks) || detectedRisks.length === 0) {
    if (documentLabel && documentLabel.toLowerCase().includes("agreement")) {
      return "No strong unfair or risky clauses detected. The agreement appears balanced.";
    }
    return "No strong one-sided or high-impact clauses were detected in the available text.";
  }

  const phrases = buildRiskSummaryPhrases(detectedRisks);
  const subject = documentLabel && documentLabel.toLowerCase().includes("agreement")
    ? "The agreement"
    : "The document";
  const detail = phrases.length > 0
    ? `multiple one-sided clauses such as ${phrases.join(", ")}`
    : "multiple one-sided clauses";

  return `${subject} contains ${detail}. These indicate an imbalance of power that may reduce your protections.`;
}

function computeConfidenceScore(rawConfidence, text, documentTypeKey) {
  const llmScore = clampNumber(Number(rawConfidence), 0, 100);
  const keywordStrength = computeKeywordStrength(text, documentTypeKey);
  const structureClarity = computeStructureClarity(text, documentTypeKey);
  const clarityScore = computeTextClarityScore(text);
  const length = String(text || "").length;

  let score =
    llmScore * 0.5 +
    keywordStrength * 100 * 0.3 +
    structureClarity * 100 * 0.2;

  if (length < 200) {
    score -= 6;
  }
  if (length < 80) {
    score -= 12;
  }

  if (clarityScore < 1) {
    score *= clarityScore;
  }

  return Math.round(clampNumber(score, 0, 100));
}

function isRentalContext(normalized) {
  return /rental|lease|tenant|landlord|rent|premises|tenancy/i.test(normalized);
}

function hasRefundableDeposit(normalized) {
  return /refundable\s+deposit|deposit\s+is\s+refundable|fully\s+refundable|refundable\s+security\s+deposit/i.test(
    normalized
  );
}

function hasNonRefundableDeposit(normalized) {
  return /non[-\s]?refundable\s+deposit|deposit\s+is\s+non[-\s]?refundable|deposit\s+not\s+refundable|no\s+refund\s+of\s+deposit/i.test(
    normalized
  );
}

function hasAdvancePaymentBeforeService(normalized) {
  return (
    /advance\s+payment\s+(?:before|prior)\s+(?:service|joining|delivery|work|activation|possession)/i.test(
      normalized
    ) ||
    /pay(?:ment)?\s+before\s+(?:service|joining|delivery|work|activation|possession)/i.test(normalized)
  );
}

function hasUpfrontFeeDemand(normalized) {
  return /(registration\s+fee|processing\s+fee|training\s+fee|pay\s+to\s+join|fee\s+to\s+join)/i.test(
    normalized
  );
}

function getDepositRiskLevel(normalized) {
  const hasDeposit = /deposit|security\s+deposit|advance\s+payment|booking\s+amount/i.test(normalized);
  if (!hasDeposit && !hasAdvancePaymentBeforeService(normalized)) {
    return "NONE";
  }

  if (hasNonRefundableDeposit(normalized) || hasAdvancePaymentBeforeService(normalized)) {
    return "HIGH";
  }

  if (hasRefundableDeposit(normalized) && isRentalContext(normalized)) {
    return "NONE";
  }

  return "NONE";
}

function hasUpfrontPaymentRisk(normalized) {
  return getDepositRiskLevel(normalized) === "HIGH" || hasUpfrontFeeDemand(normalized);
}

function detectFraudIndicators(normalized) {
  const upfrontPayment = hasUpfrontPaymentRisk(normalized);
  const urgency = /within\s+24\s+hours|within\s+24\s*h|urgent|immediately|limited\s+time/i.test(
    normalized
  );
  const personalData =
    /aadhaar|pan\s*card|bank\s*details|otp|cvv|password|upi\s*pin|account\s*details/i.test(
      normalized
    );
  const unrealistic =
    /guaranteed\s+job|assured\s+job|too\s+good\s+to\s+be\s+true|no\s+experience\s+required|high\s+salary\s+without\s+experience|guaranteed\s+income|double\s+your\s+money|instant\s+joining/i.test(
      normalized
    );

  return {
    upfrontPayment,
    urgency,
    personalData,
    unrealistic,
  };
}

function isFraudLikely(indicators) {
  return Boolean(
    indicators.upfrontPayment || indicators.urgency || indicators.personalData || indicators.unrealistic
  );
}

function detectBalancedAgreementSignals(normalized) {
  const equalRights = /(both\s+parties|either\s+party|mutual|equal\s+rights)/i.test(normalized);
  const equalNotice =
    /notice\s+period\s+of\s+\d+\s+days?\s+for\s+both\s+parties|either\s+party\s+may\s+terminate\s+with\s+\d+\s+days?\s+notice|mutual\s+notice\s+period|same\s+notice\s+period\s+for\s+both\s+parties/i.test(
      normalized
    );
  const noHiddenCharges = /(no\s+hidden\s+charges|no\s+extra\s+charges|no\s+additional\s+charges)/i.test(
    normalized
  );
  const balancedResponsibilities = /(responsibilities\s+of\s+both\s+parties|each\s+party\s+is\s+responsible|mutual\s+obligations|shared\s+responsibilities)/i.test(
    normalized
  );

  return equalRights && equalNotice && noHiddenCharges && balancedResponsibilities;
}

function detectHybridHints(text) {
  const raw = String(text || "");
  const normalized = raw.toLowerCase();
  const hasCurrency = /(₹|rs\.?|inr)/i.test(raw);
  const hasDeposit = /deposit|advance\s+payment|security\s+deposit|refundable\s+deposit|booking\s+amount/i.test(
    normalized
  );
  const legalHint = /agreement|clause|section|contract/i.test(normalized);
  const depositRiskLevel = getDepositRiskLevel(normalized);

  return {
    financialDeposit: hasCurrency && hasDeposit,
    legalHint,
    depositRiskLevel,
  };
}

function createRisk(type, reason, level = "MEDIUM", snippet = "") {
  return {
    level: String(level || "MEDIUM").toUpperCase(),
    type: String(type || "Risk"),
    reason: String(reason || ""),
    snippet: String(snippet || ""),
  };
}

function buildTopRisks(detectedRisks) {
  if (!Array.isArray(detectedRisks) || detectedRisks.length === 0) {
    return [];
  }

  const seen = new Set();
  const topRisks = [];

  for (const risk of detectedRisks) {
    const rawLabel = String(risk?.type || risk?.reason || "").trim();
    const label = RISK_PHRASE_MAP[rawLabel] || rawLabel;
    if (!label || seen.has(label.toLowerCase())) {
      continue;
    }
    seen.add(label.toLowerCase());
    topRisks.push(label);
    if (topRisks.length >= 5) {
      break;
    }
  }

  return topRisks;
}

function buildLawReferenceObjects(laws, fallbackDescription) {
  if (!Array.isArray(laws)) {
    return [];
  }

  return laws.map((law) => {
    const description = LAW_REFERENCE_DETAILS[law] || fallbackDescription || "Relevant legal guidance applies.";
    return { law, description };
  });
}

function decisionFromRisk(riskLevel) {
  if (riskLevel === "HIGH") {
    return "DO_NOT_SIGN";
  }
  if (riskLevel === "MEDIUM") {
    return "REVIEW_CAUTION";
  }
  return "SAFE_TO_USE";
}

function normalizeRiskLevel(value) {
  const normalized = String(value || "LOW").toUpperCase();
  return ["LOW", "MEDIUM", "HIGH"].includes(normalized) ? normalized : "LOW";
}

function normalizeFinalDecision(value, fallback = "REVIEW_CAUTION") {
  const normalized = String(value || fallback).toUpperCase();
  return [
    "SAFE_TO_SIGN",
    "SAFE_TO_USE",
    "SAFE_TO_REVIEW",
    "REVIEW_CAUTION",
    "DO_NOT_SIGN",
  ].includes(normalized)
    ? normalized
    : fallback;
}

function normalizeShouldUserSign(value, fallback = "CAUTION") {
  const normalized = String(value || fallback).toUpperCase();
  if (normalized.includes("YES")) {
    return "YES";
  }
  if (normalized.includes("NO")) {
    return "NO";
  }
  if (normalized.includes("CAUTION")) {
    return "CAUTION";
  }
  return fallback;
}

function normalizeClassification(value, fallback = "NORMAL") {
  const normalized = String(value || fallback).toUpperCase();
  return ["FRAUD", "UNFAIR", "ILLEGAL", "NORMAL"].includes(normalized)
    ? normalized
    : fallback;
}

function normalizeDocumentType(value) {
  const normalized = String(value || "").toLowerCase();

  // Transport docs must be recognized before agreement buckets.
  if (
    normalized.includes("ticket") ||
    normalized.includes("railway") ||
    normalized.includes("pnr") ||
    normalized.includes("journey") ||
    normalized.includes("train")
  ) {
    return "ticket";
  }

  if (normalized.includes("resume") || normalized.includes("cv")) {
    return "resume";
  }
  if (normalized.includes("offer")) {
    return "offer_letter";
  }
  if (normalized.includes("property")) {
    return "property_document";
  }
  if (normalized.includes("rental") || normalized.includes("lease")) {
    return "rental_agreement";
  }
  if (
    normalized.includes("bank") ||
    normalized.includes("financial") ||
    normalized.includes("loan") ||
    normalized.includes("account statement")
  ) {
    return "bank_financial";
  }
  if (normalized.includes("government") || normalized.includes("rule")) {
    return "government_rule";
  }
  if (normalized.includes("receipt") || normalized.includes("invoice") || normalized.includes("bill")) {
    return "receipt";
  }
  if (normalized.includes("policy")) {
    return "policy";
  }
  if (
    normalized.includes("legal") ||
    normalized.includes("agreement") ||
    normalized.includes("contract") ||
    normalized.includes("notice")
  ) {
    return "legal";
  }

  return "unknown";
}

function escapeRegex(str) {
  return String(str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasKeyword(text, keyword) {
  const normalizedText = String(text || "").toLowerCase();
  const normalizedKeyword = String(keyword || "").toLowerCase().trim();

  if (!normalizedKeyword) {
    return false;
  }

  // Single short words are highly error-prone with OCR (e.g. "rent" in noisy text).
  if (!normalizedKeyword.includes(" ") && normalizedKeyword.length <= 5) {
    return new RegExp(`\\b${escapeRegex(normalizedKeyword)}\\b`, "i").test(normalizedText);
  }

  return normalizedText.includes(normalizedKeyword);
}

function detectDocumentType(text) {
  const normalized = normalizeForMatching(text);
  const compact = normalized.replace(/\s+/g, "");

  if (isLikelyTicket(normalized)) {
    return "ticket";
  }

  const scores = {
    resume: 0,
    legal: 0,
    offer_letter: 0,
    property_document: 0,
    rental_agreement: 0,
    ticket: 0,
    bank_financial: 0,
    government_rule: 0,
    receipt: 0,
    policy: 0,
  };

  const keywordGroups = {
    resume: [
      "resume",
      "curriculum vitae",
      "education",
      "skills",
      "experience",
      "projects",
      "professional summary",
      "linkedin",
      "objective",
      "profile",
      "certifications",
    ],
    legal: [
      "agreement",
      "contract",
      "deed",
      "memorandum",
      "lease",
      "tenant",
      "landlord",
      "party of the first part",
      "indemnity",
      "arbitration",
      "jurisdiction",
      "legal notice",
      "whereas",
      "termination",
    ],
    offer_letter: [
      "offer letter",
      "appointment letter",
      "joining date",
      "date of joining",
      "salary",
      "ctc",
      "probation",
      "employment",
      "candidate",
      "designation",
      "position",
      "benefits",
    ],
    property_document: [
      "property",
      "sale deed",
      "plot",
      "flat",
      "allotment",
      "possession",
      "survey no",
      "builder",
      "developer",
      "ownership",
      "mutation",
      "registry",
      "rera",
    ],
    rental_agreement: [
      "rent",
      "tenant",
      "landlord",
      "security deposit",
      "lease term",
      "notice period",
      "premises",
      "monthly rent",
      "rent agreement",
    ],
    ticket: [
      "ticket",
      "pnr",
      "journey",
      "boarding",
      "seat",
      "berth",
      "departure",
      "arrival",
      "railway",
      "train no",
      "train number",
      "platform",
      "irctc",
    ],
    bank_financial: [
      "bank",
      "loan",
      "interest rate",
      "emi",
      "account number",
      "ifsc",
      "credit card",
      "debit card",
      "otp",
      "net banking",
      "upi",
      "statement",
    ],
    government_rule: [
      "government",
      "gazette",
      "notification",
      "rule",
      "regulation",
      "circular",
      "compliance",
      "public notice",
    ],
    receipt: [
      "receipt",
      "invoice",
      "bill",
      "gst",
      "subtotal",
      "tax",
      "payment",
      "cashier",
      "amount paid",
    ],
    policy: [
      "policy",
      "terms and conditions",
      "refund policy",
      "privacy policy",
      "company policy",
      "employee handbook",
      "compliance",
    ],
  };

  for (const [type, keywords] of Object.entries(keywordGroups)) {
    for (const keyword of keywords) {
      if (hasKeyword(normalized, keyword)) {
        scores[type] += 1;
      }
    }
  }

  const strongSignalGroups = {
    ticket: [
      "railway",
      "pnr",
      "journey",
      "train",
      "coach",
      "berth",
      "platform",
      "boarding",
      "arrival",
      "departure",
      "atvm",
      "irctc",
      "reservation",
    ],
    rental_agreement: [
      "tenant",
      "landlord",
      "security deposit",
      "monthly rent",
      "rent agreement",
      "lease term",
      "notice period",
      "premises",
    ],
    property_document: [
      "property",
      "builder",
      "developer",
      "sale deed",
      "registry",
      "rera",
      "possession",
      "allotment",
    ],
    offer_letter: [
      "offer letter",
      "appointment letter",
      "ctc",
      "probation",
      "joining date",
      "date of joining",
      "designation",
    ],
    bank_financial: [
      "bank",
      "loan",
      "interest rate",
      "emi",
      "account number",
      "ifsc",
      "upi",
      "statement",
      "credit card",
      "debit card",
    ],
    resume: [
      "resume",
      "curriculum vitae",
      "education",
      "skills",
      "experience",
      "projects",
      "certifications",
      "linkedin",
    ],
  };

  const countSignals = (signals) =>
    signals.reduce((count, signal) => count + (hasKeyword(normalized, signal) ? 1 : 0), 0);

  const ticketSignalCount = countSignals(strongSignalGroups.ticket);
  const rentalSignalCount = countSignals(strongSignalGroups.rental_agreement);
  const propertySignalCount = countSignals(strongSignalGroups.property_document);
  const offerSignalCount = countSignals(strongSignalGroups.offer_letter);
  const bankSignalCount = countSignals(strongSignalGroups.bank_financial);
  const resumeSignalCount = countSignals(strongSignalGroups.resume);

  // Early override to protect common OCR-heavy transport tickets.
  if (ticketSignalCount >= 2 && rentalSignalCount === 0) {
    return "ticket";
  }

  if (propertySignalCount >= 3 && rentalSignalCount === 0) {
    return "property_document";
  }

  if (rentalSignalCount >= 3 && propertySignalCount === 0) {
    return "rental_agreement";
  }

  if (resumeSignalCount >= 3) {
    return "resume";
  }

  if (/skills[\s\S]{0,120}experience/i.test(normalized)) {
    scores.resume += 2;
  }
  if (/p\s*n\s*r/.test(normalized) || compact.includes("pnr")) {
    scores.ticket += 2;
  }
  if (/journey\s*date|train\s*(no|number)|boarding\s*station/i.test(normalized)) {
    scores.ticket += 2;
  }
  if (/irctc|reservation|coach|berth|platform/i.test(normalized)) {
    scores.ticket += 2;
  }
  if (/loan|emi|interest\s*rate|account\s*number|ifsc|upi|statement|otp|credit\s*card|debit\s*card/i.test(normalized)) {
    scores.bank_financial += 2;
  }
  if (/total|amount|gst|invoice/i.test(normalized)) {
    scores.receipt += 1;
  }
  if (/agreement|whereas|jurisdiction|indemnity|arbitration/i.test(normalized)) {
    scores.legal += 2;
  }
  if (/offer\s*letter|appointment\s*letter|ctc|probation|joining/i.test(normalized)) {
    scores.offer_letter += 2;
  }
  if (/sale\s*deed|ownership|registry|survey\s*no|rera|allotment|possession|builder|developer/i.test(normalized)) {
    scores.property_document += 2;
  }
  if (/monthly\s*rent|security\s*deposit|notice\s*period|premises|lease\s*term/i.test(normalized)) {
    scores.rental_agreement += 2;
  }
  if (/government notification|gazette|circular|public notice/i.test(normalized)) {
    scores.government_rule += 2;
  }

  const minSignalByType = {
    resume: 2,
    legal: 2,
    offer_letter: 2,
    property_document: 2,
    rental_agreement: 2,
    ticket: 2,
    bank_financial: 2,
    government_rule: 2,
    receipt: 2,
    policy: 2,
  };

  const qualifiedEntries = Object.entries(scores).filter(
    ([type, score]) => score >= (minSignalByType[type] || 1)
  );

  const topEntry = qualifiedEntries.sort((a, b) => b[1] - a[1])[0];
  if (!topEntry || topEntry[1] <= 0) {
    return isLikelyTicket(normalized) ? "ticket" : "unknown";
  }

  if (
    topEntry[0] !== "ticket" &&
    (ticketSignalCount >= 2 || isLikelyTicket(normalized)) &&
    scores.ticket >= Math.max(topEntry[1] - 1, 1)
  ) {
    return "ticket";
  }

  return topEntry[0];
}

function isLikelyTicket(text) {
  const normalized = normalizeForMatching(text);
  const compact = normalized.replace(/\s+/g, "");

  const strongSignals = [
    /railway/i,
    /irctc/i,
    /pnr/i,
    /train\s*(no|number)?/i,
    /coach/i,
    /berth/i,
    /platform/i,
    /uts/i,
    /unreserved/i,
    /reservation/i,
  ];

  const supportSignals = [
    /journey\s*date/i,
    /boarding\s*station/i,
    /from\s*station/i,
    /to\s*station/i,
    /source\s*station/i,
    /destination\s*station/i,
    /valid\s*(upto|up\s*to|till|until)/i,
    /class/i,
    /fare/i,
    /adult/i,
    /child/i,
    /single\s*journey/i,
    /return\s*journey/i,
    /ticket\s*no/i,
  ];

  const strongCount = strongSignals.reduce(
    (count, pattern) => (pattern.test(normalized) ? count + 1 : count),
    0
  );
  const supportCount = supportSignals.reduce(
    (count, pattern) => (pattern.test(normalized) ? count + 1 : count),
    0
  );

  if (compact.includes("pnr") && /\d{8,12}/.test(compact)) {
    return true;
  }

  if (strongCount >= 1 && supportCount >= 1) {
    return true;
  }

  return strongCount + supportCount >= 3;
}

function getDocumentTypeLabel(documentType) {
  const labels = {
    legal: "Legal Agreement",
    offer_letter: "Offer Letter",
    property_document: "Property Document",
    rental_agreement: "Rental Agreement",
    ticket: "Railway Ticket",
    bank_financial: "Bank / Financial Document",
    government_rule: "Government Rule",
    resume: "Resume",
    receipt: "Receipt / Bill",
    policy: "Policy Document",
    unknown: "Unknown",
  };

  return labels[documentType] || "Unknown";
}

function flattenObjectToString(value) {
  if (value == null) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(flattenObjectToString).filter(Boolean).join(", ");
  }

  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, nestedValue]) => {
        const flattened = flattenObjectToString(nestedValue);
        return flattened ? `${key}: ${flattened}` : "";
      })
      .filter(Boolean)
      .join(", ");
  }

  return String(value);
}

function sanitizeJsonValue(value) {
  if (value == null) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item == null) {
          return null;
        }

        if (typeof item === "object" && !Array.isArray(item)) {
          return flattenObjectToString(item);
        }

        return sanitizeJsonValue(item);
      })
      .filter((item) => item !== null && item !== "");
  }

  if (typeof value === "object") {
    const sanitizedObject = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      const sanitizedValue = sanitizeJsonValue(nestedValue);
      sanitizedObject[key] = sanitizedValue;
    }

    return sanitizedObject;
  }

  return String(value);
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => flattenObjectToString(item))
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildLegacyRisksFromList(items, severity, label) {
  return normalizeStringArray(items).map((item) => ({
    clause: label,
    severity,
    reason: item,
  }));
}

function dedupeRisks(risks) {
  const seen = new Set();

  return risks.filter((risk) => {
    const key = `${risk.type}|${risk.description}|${risk.impact}`.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function extractMeaningfulTokens(text) {
  return normalizeForMatching(text)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length >= 4 &&
        ![
          "this",
          "that",
          "with",
          "from",
          "will",
          "user",
          "document",
          "risk",
          "impact",
          "description",
          "buyer",
          "builder",
          "agreement",
          "clause",
          "terms",
          "their",
          "should",
          "before",
        ].includes(token)
    );
}

function isUrgencyGrounded(documentText) {
  return /(within\s+24\s*hours|within\s+24h|24\s*hours|24h|urgent|immediate|act\s+now|limited\s+time)/i.test(
    normalizeForMatching(documentText)
  );
}

function looksLikeUrgencyRisk(risk) {
  const combined = `${String(risk?.type || "")} ${String(risk?.description || "")}`.toLowerCase();

  return /(urgency|urgent|immediate|act quickly|act now|limited time|short deadline|within\s*24|24h|24 hours|deadline pressure|time pressure)/i.test(
    combined
  );
}

function filterGroundedRisks(risks, documentText) {
  const normalizedDocument = normalizeForMatching(documentText);

  return risks.filter((risk) => {
    if (looksLikeUrgencyRisk(risk)) {
      return isUrgencyGrounded(documentText);
    }

    const type = String(risk?.type || "").toLowerCase();
    const description = String(risk?.description || "").toLowerCase();

    const tokens = [
      ...extractMeaningfulTokens(type),
      ...extractMeaningfulTokens(description),
    ];

    if (tokens.length === 0) {
      return true;
    }

    const uniqueTokens = [...new Set(tokens)];
    const matchedCount = uniqueTokens.filter((token) => normalizedDocument.includes(token)).length;

    return matchedCount >= 1;
  });
}

function filterGroundedClauses(clauses, documentText) {
  const normalizedDocument = normalizeForMatching(documentText);

  return clauses.filter((clause) => {
    const tokens = extractMeaningfulTokens(clause);
    if (tokens.length === 0) {
      return true;
    }

    return tokens.some((token) => normalizedDocument.includes(token));
  });
}

function buildSmartDifferenceExplanation(documentType, classification) {
  if (
    classification === "UNFAIR" &&
    ["legal", "property_document", "rental_agreement"].includes(documentType)
  ) {
    return "This is not fraud, but an unfair agreement with one-sided clauses.";
  }

  if (classification === "ILLEGAL") {
    return "This document includes clauses that may be legally unenforceable under Indian law.";
  }

  if (classification === "FRAUD") {
    return "This appears to be fraud because multiple scam indicators are present together.";
  }

  return "No strong fraud or unfairness indicators were detected from the available text.";
}

function buildConfidenceScore(documentType, classification, topRisks) {
  const riskCount = Array.isArray(topRisks) ? topRisks.length : 0;

  if (["legal", "property_document", "rental_agreement"].includes(documentType)) {
    return classification === "UNFAIR" ? "92%" : "88%";
  }

  if (classification === "ILLEGAL") {
    return "94%";
  }

  if (classification === "FRAUD") {
    return riskCount >= 3 ? "90%" : "84%";
  }

  if (classification === "UNFAIR") {
    return "86%";
  }

  return "82%";
}

function normalizeSuspiciousClauses(value) {
  return normalizeStringArray(value).slice(0, 5);
}

function normalizeRiskEntries(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((risk) => {
      if (typeof risk === "string") {
        return {
          type: "General Risk",
          description: risk,
          impact: "User should review this point carefully before proceeding.",
        };
      }

      return {
        type: flattenObjectToString(risk?.type || "General Risk"),
        description: flattenObjectToString(risk?.description || ""),
        impact: flattenObjectToString(
          risk?.impact || "User should review this point carefully before proceeding."
        ),
      };
    })
    .filter((risk) => risk.description || risk.impact);
}

function extractClauseReference(snippet) {
  const match = String(snippet || "").match(/clause\s*\d+[A-Za-z]?|section\s*\d+[A-Za-z]?/i);
  return match ? match[0] : "";
}

function extractClauseSnippet(text, pattern) {
  if (!text) {
    return "";
  }

  return extractRelevantSentence(text, pattern);
}

function buildClauseRisk({ type, description, impact, pattern, text }) {
  const snippet = extractClauseSnippet(text, pattern);
  const clauseRef = extractClauseReference(snippet);
  const clauseLabel = clauseRef ? ` (${clauseRef})` : "";

  return {
    type: `${type}${clauseLabel}`.trim(),
    description: snippet ? `${description} Snippet: "${snippet}"` : description,
    impact,
  };
}

function isRiskSpecific(risk) {
  const combined = `${risk.type} ${risk.description} ${risk.impact}`.toLowerCase();
  if (/clause|section/.test(combined)) {
    return true;
  }
  if (/₹|rs\.?|inr/.test(combined)) {
    return true;
  }
  if (/(\d{1,3}(?:\.\d+)?)%/.test(combined)) {
    return true;
  }
  return combined.length >= 60;
}

function detectIllegalSignals(text) {
  const normalized = normalizeForMatching(text);
  const signals = [];

  const illegalPatterns = [
    /no\s+legal\s+action/i,
    /cannot\s+(?:go|approach)\s+court/i,
    /no\s+right\s+to\s+sue/i,
    /waive\s+(?:your|the)?\s*right\s+to\s+sue/i,
    /no\s+court\s+remedy/i,
    /no\s+legal\s+recourse/i,
    /only\s+arbitration\s+and\s+no\s+court/i,
    /exclusive\s+jurisdiction/i,
    /only\s+builder\s+jurisdiction/i,
  ];

  if (illegalPatterns.some((pattern) => pattern.test(normalized))) {
    signals.push({
      type: "Illegal Restriction of Legal Rights",
      description: "The document appears to restrict the right to approach courts or seek legal remedies.",
      impact: "Such clauses can be void under Section 28 of the Indian Contract Act.",
      severity: "HIGH",
    });
  }

  return signals;
}

function detectQuantifiedImpacts(text) {
  const normalized = normalizeForMatching(text);
  const impacts = [];
  const percentRegex = /(\d{1,3}(?:\.\d+)?)\s*%\s*(increase|escalat|rise|hike|increment)/gi;
  const periodRegex = /(every|per)\s*(\d{1,2})?\s*(month|months|year|years|quarter|quarters)/i;

  let match;
  while ((match = percentRegex.exec(normalized)) !== null) {
    const rate = Number(match[1]);
    if (!Number.isFinite(rate) || rate <= 0) {
      continue;
    }

    const window = normalized.slice(Math.max(0, match.index - 40), match.index + 80);
    const periodMatch = window.match(periodRegex);
    let months = 12;

    if (periodMatch) {
      const count = Number(periodMatch[2] || 1);
      const unit = periodMatch[3];
      if (/quarter/.test(unit)) {
        months = 3 * count;
      } else if (/month/.test(unit)) {
        months = 1 * count;
      } else if (/year/.test(unit)) {
        months = 12 * count;
      }
    }

    if (months <= 0) {
      continue;
    }

    const periodsPerYear = 12 / months;
    const annualized = Math.pow(1 + rate / 100, periodsPerYear) - 1;
    const annualPercent = (annualized * 100).toFixed(1);
    const severity = annualized >= 1 ? "HIGH" : "MEDIUM";

    impacts.push({
      type: "Quantified Impact",
      description: `Detected ${rate}% increase every ${months} month(s).`,
      impact: `Estimated annualized increase is about ${annualPercent}%.`,
      severity,
    });
  }

  const dailyPenaltyRegex = /(penalt|late\s*fee|charge)[^\d]{0,20}(\d{2,6})\s*(?:per\s*day|daily)/i;
  const dailyMatch = normalized.match(dailyPenaltyRegex);
  if (dailyMatch) {
    const amount = Number(dailyMatch[2]);
    if (Number.isFinite(amount)) {
      const monthly = amount * 30;
      impacts.push({
        type: "Quantified Impact",
        description: `Daily penalty detected: ${amount} per day.`,
        impact: `Approx monthly impact is ${monthly}.`,
        severity: monthly >= 10000 ? "HIGH" : "MEDIUM",
      });
    }
  }

  return impacts.slice(0, 2);
}

function detectPositiveSignals(text, documentType) {
  if (documentType !== "offer_letter" && documentType !== "legal") {
    return [];
  }

  const normalized = normalizeForMatching(text);
  const signals = [];

  const hasSalaryKeywords = /salary|ctc|compensation|stipend|pay\s*scale|gross\s*salary|net\s*salary/i.test(
    normalized
  );
  const hasSalaryAmount = /(₹|\brs\b|\binr\b|\d{4,})/i.test(normalized);
  const hasSalaryUncertainty = /subject\s+to|discretion|to\s+be\s+decided|variable/i.test(normalized);

  if (hasSalaryKeywords && hasSalaryAmount && !hasSalaryUncertainty) {
    signals.push("Clear salary defined.");
  }

  if (/no\s+fees?\s+required|no\s+fee\b/i.test(normalized)) {
    signals.push("No fees required.");
  }

  if (
    /no\s+(payment|fee|fees|charge|security\s+deposit|deposit)/i.test(normalized) ||
    /no\s+onboarding\s+fee|no\s+registration\s+fee/i.test(normalized)
  ) {
    signals.push("No payment required.");
  }

  if (/no\s+security\s+deposit/i.test(normalized)) {
    signals.push("No security deposit.");
  }

  if (
    /either\s+party\s+(?:may|can)\s+terminate/i.test(normalized) ||
    /mutual\s+notice|both\s+parties\s+.*notice/i.test(normalized)
  ) {
    signals.push("Either party may terminate with notice.");
  }

  if (/mutual\s+agreement/i.test(normalized)) {
    signals.push("Mutual agreement terms are stated.");
  }

  if (/working\s+hours|shift\s+timing|hours\s+per\s+week|\b9\s*am\b|\b6\s*pm\b/i.test(normalized)) {
    signals.push("Standard working conditions are defined.");
  }

  if (/probation|confidentiality|code\s+of\s+conduct|hr\s+policy|leave\s+policy/i.test(normalized)) {
    signals.push("Standard HR policies are mentioned.");
  }

  if (!/within\s+24\s*hours|urgent|immediate|act\s+now|limited\s+time/i.test(normalized)) {
    signals.push("No urgency pressure detected.");
  }

  return [...new Set(signals)].slice(0, 5);
}

function buildContradictionContext(positiveSignals, text) {
  const normalizedText = normalizeForMatching(text);
  const normalizedSignals = normalizeStringArray(positiveSignals).map((signal) =>
    normalizeForMatching(signal)
  );
  const signalText = normalizedSignals.join(" ");

  const hasNoPaymentSignal =
    /no\s+payment\s+required|no\s+fees\s+required|no\s+security\s+deposit/i.test(signalText) ||
    /no\s+(payment|fee|fees|charge|security\s+deposit|deposit|registration\s+fee|processing\s+fee)/i.test(
      normalizedText
    );

  const hasMutualTerminationSignal =
    /either\s+party\s+(?:may|can)\s+terminate|mutual\s+notice|both\s+parties\s+.*notice/i.test(
      normalizedText
    ) ||
    /either\s+party\s+may\s+terminate|mutual\s+notice/i.test(signalText);

  const hasClearSalarySignal =
    /clear\s+salary|salary\s+defined|clear\s+compensation/i.test(signalText) ||
    (/salary|ctc|compensation|stipend|pay\s*scale|gross\s*salary|net\s*salary/i.test(
      normalizedText
    ) &&
      /(₹|\brs\b|\binr\b|\d{4,})/i.test(normalizedText) &&
      !/subject\s+to|discretion|to\s+be\s+decided|variable/i.test(normalizedText));

  const hasStandardPolicySignals =
    /standard\s+hr\s+policies|working\s+conditions|working\s+hours/i.test(signalText) ||
    /probation|confidentiality|code\s+of\s+conduct|hr\s+policy|leave\s+policy|working\s+hours|shift\s+timing|hours\s+per\s+week/i.test(
      normalizedText
    );

  return {
    hasNoPaymentSignal,
    hasMutualTerminationSignal,
    hasClearSalarySignal,
    hasStandardPolicySignals,
  };
}

function filterNegativeSignalsByContradictions(signals, context) {
  if (!Array.isArray(signals)) {
    return [];
  }

  return signals.filter((signal) => {
    if (context.hasNoPaymentSignal && signal.label === "Payment requested before joining") {
      return false;
    }
    if (context.hasMutualTerminationSignal && signal.label === "One-sided termination rights") {
      return false;
    }
    if (context.hasClearSalarySignal && signal.label === "Salary or payment uncertainty") {
      return false;
    }
    return true;
  });
}

function filterContradictions(risks, positiveSignals, text) {
  if (!Array.isArray(risks)) {
    return [];
  }

  const context = buildContradictionContext(positiveSignals, text);

  return risks.filter((risk) => {
    const combined = `${risk?.type || ""} ${risk?.description || ""} ${risk?.impact || ""}`.toLowerCase();

    if (
      context.hasNoPaymentSignal &&
      /(advance\s+payment|payment\s+before|registration\s+fee|processing\s+fee|security\s+deposit|training\s+fee|pay.*join|financial\s+scam|payment\s+demand)/i.test(
        combined
      )
    ) {
      return false;
    }

    if (
      context.hasMutualTerminationSignal &&
      /(one\-sided\s+termination|termination\s+clause|termination\s+rights|terminate\s+at\s+any\s+time|sole\s+discretion|without\s+notice)/i.test(
        combined
      )
    ) {
      return false;
    }

    if (
      context.hasClearSalarySignal &&
      /(salary\s+uncertainty|payment\s+uncertainty|salary.*subject\s+to|payment.*discretion|amount\s+to\s+be\s+decided)/i.test(
        combined
      )
    ) {
      return false;
    }

    return true;
  });
}

function detectNegativeSignals(text, documentType) {
  if (documentType !== "offer_letter" && documentType !== "legal") {
    return [];
  }

  const normalized = normalizeForMatching(text);
  const signals = [];

  if (/registration\s+fee|processing\s+fee|pay.*join|security\s+deposit|advance\s+payment|training\s+fee/i.test(normalized)) {
    signals.push({ label: "Payment requested before joining", weight: 2 });
  }

  if (/within\s+24\s*hours|urgent|immediate|act\s+now|limited\s+time/i.test(normalized)) {
    signals.push({ label: "Urgency pressure to act quickly", weight: 2 });
  }

  if (/otp|cvv|password|bank\s+details|upi\s*pin/i.test(normalized)) {
    signals.push({ label: "Sensitive data requested", weight: 2 });
  }

  if (/terminate\s+at\s+any\s+time|sole\s+discretion|without\s+notice/i.test(normalized)) {
    signals.push({ label: "One-sided termination rights", weight: 1 });
  }

  if (/salary.*subject\s+to|amount\s+to\s+be\s+decided|payment.*discretion/i.test(normalized)) {
    signals.push({ label: "Salary or payment uncertainty", weight: 1 });
  }

  if (/bond|liquidated\s+damages|penalty|fine|pay\s+back\s+training/i.test(normalized)) {
    signals.push({ label: "High penalty or bond obligations", weight: 2 });
  }

  return signals;
}

function formatInrAmount(value) {
  if (!Number.isFinite(value)) {
    return "";
  }

  const formatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
  return `₹${formatter.format(Math.round(value))}`;
}

function extractQuantifiedImpactStrings(text) {
  const cleaned = cleanOcrText(text);
  const impacts = [];
  const percentMatches = [...cleaned.matchAll(/(\d{1,3}(?:\.\d+)?)\s*%/g)];
  const amountMatches = [...cleaned.matchAll(/(₹|rs\.?|inr)\s*([0-9][0-9,]{2,})/gi)];
  const keywordRegex = /(payment|deposit|fee|penalt|fine|charge|cancellation|forfeit|loss|deduct|refund)/i;
  const penaltyWindowRegex = /(cancellation|forfeit|penalt|deduct|refund)[\s\S]{0,80}/i;

  for (const amountMatch of amountMatches) {
    const amount = Number(String(amountMatch[2]).replace(/,/g, ""));
    if (!Number.isFinite(amount)) {
      continue;
    }

    const windowStart = Math.max(0, amountMatch.index - 30);
    const windowEnd = Math.min(cleaned.length, amountMatch.index + 30);
    const window = cleaned.slice(windowStart, windowEnd);

    if (keywordRegex.test(window)) {
      impacts.push(`Potential financial impact of ${formatInrAmount(amount)}.`);
    }
  }

  for (const percentMatch of percentMatches) {
    const percent = Number(percentMatch[1]);
    if (!Number.isFinite(percent) || percent <= 0) {
      continue;
    }

    const nearest = amountMatches
      .map((match) => ({
        index: match.index,
        amount: Number(String(match[2]).replace(/,/g, "")),
      }))
      .filter((entry) => Number.isFinite(entry.amount))
      .sort((a, b) => Math.abs(a.index - percentMatch.index) - Math.abs(b.index - percentMatch.index))[0];

    if (nearest && Math.abs(nearest.index - percentMatch.index) <= 80) {
      const loss = (nearest.amount * percent) / 100;
      impacts.push(
        `If you cancel, you may lose ${formatInrAmount(loss)} (${percent}% of ${formatInrAmount(nearest.amount)}).`
      );
    }
  }

  const penaltyWindowMatch = cleaned.match(penaltyWindowRegex);
  if (penaltyWindowMatch && percentMatches.length > 0 && amountMatches.length > 0) {
    const percent = Number(percentMatches[0][1]);
    const amount = Number(String(amountMatches[0][2]).replace(/,/g, ""));
    if (Number.isFinite(percent) && Number.isFinite(amount)) {
      const loss = (amount * percent) / 100;
      impacts.push(
        `Penalty clause indicates a possible loss of ${formatInrAmount(loss)} (${percent}% of ${formatInrAmount(amount)}).`
      );
    }
  }

  for (const impact of detectQuantifiedImpacts(text)) {
    if (impact.impact) {
      impacts.push(String(impact.impact));
    }
  }

  return [...new Set(impacts.filter(Boolean))].slice(0, 5);
}

function detectIllegalClauses(text) {
  const normalized = normalizeForMatching(text);
  const flags = [];
  const rawText = String(text || "");

  const courtPatterns = [
    /no\s+legal\s+action/i,
    /cannot\s+(?:go|approach)\s+court/i,
    /no\s+right\s+to\s+sue/i,
    /waive\s+(?:your|the)?\s*right\s+to\s+sue/i,
    /no\s+court\s+remedy/i,
    /no\s+legal\s+recourse/i,
    /only\s+arbitration\s+and\s+no\s+court/i,
  ];

  if (courtPatterns.some((pattern) => pattern.test(normalized))) {
    const snippet = extractClauseSnippet(rawText, /(no\s+legal\s+action|cannot\s+(?:go|approach)\s+court|no\s+right\s+to\s+sue|waive\s+(?:your|the)?\s*right\s+to\s+sue|no\s+court\s+remedy|no\s+legal\s+recourse|only\s+arbitration\s+and\s+no\s+court|exclusive\s+jurisdiction|only\s+builder\s+jurisdiction)/i);
    flags.push({
      type: "ILLEGAL",
      clause: snippet || "Restriction on legal recourse detected.",
      law: "Section 28, Indian Contract Act",
      explanation: "Clauses that block access to courts are generally unenforceable.",
    });
  }

  if (/owner\s+can\s+enter\s+anytime|landlord\s+can\s+enter\s+anytime/i.test(normalized)) {
    const snippet = extractClauseSnippet(rawText, /(owner\s+can\s+enter\s+anytime|landlord\s+can\s+enter\s+anytime)/i);
    flags.push({
      type: "ILLEGAL",
      clause: snippet || "Unrestricted entry without notice detected.",
      law: "Model Tenancy Act / State Rent Act",
      explanation: "Tenancy laws usually require reasonable notice before entry.",
    });
  }

  return flags;
}

function isSignableDocument(documentType) {
  return ["legal", "property_document", "rental_agreement", "offer_letter"].includes(documentType);
}

function resolveFinalDecision(documentType, classification, riskLevel) {
  if (classification === "FRAUD" || classification === "ILLEGAL") {
    return "DO_NOT_SIGN";
  }

  if (documentType === "ticket") {
    return "SAFE_TO_USE";
  }

  if (documentType === "resume") {
    return "SAFE_TO_REVIEW";
  }

  if (isSignableDocument(documentType)) {
    if (classification === "UNFAIR") {
      return "REVIEW_CAUTION";
    }
    if (classification === "NORMAL") {
      return "SAFE_TO_USE";
    }
    return "REVIEW_CAUTION";
  }

  return classification === "NORMAL" ? "SAFE_TO_USE" : "REVIEW_CAUTION";
}

function resolveShouldUserSign(finalDecision) {
  switch (finalDecision) {
    case "DO_NOT_SIGN":
      return "NO";
    case "SAFE_TO_SIGN":
    case "SAFE_TO_USE":
      return "YES";
    case "SAFE_TO_REVIEW":
      return "CAUTION";
    default:
      return "CAUTION";
  }
}

function buildGuidance(documentType, classification, riskLevel) {
  if (classification === "FRAUD") {
    return [
      "Do NOT pay any money before joining.",
      "Do NOT share personal details.",
      "Verify company authenticity from official sources.",
    ];
  }

  if (classification === "ILLEGAL") {
    return [
      "DO NOT SIGN THIS DOCUMENT",
      "Preserve a copy of the document and communications.",
      "Seek legal advice immediately to confirm enforceability.",
      "Do not accept terms that block access to courts.",
    ];
  }

  if (documentType === "ticket") {
    return [
      "Start the journey within the printed validity window; for unreserved/local tickets this is often within about 1 hour.",
      "Check ticket validity date/time and class; many tickets expire by midnight if not used.",
      "Travel on the permitted route and avoid breaking the journey unless the ticket explicitly allows it.",
      "Do not exit and re-enter mid-journey; a detour may require a new ticket.",
      "Carry required ID proof and follow boarding rules.",
    ];
  }

  if (documentType === "resume") {
    return [
      "Verify personal and professional details for accuracy.",
      "Ensure claims are backed by evidence or examples.",
      "Improve formatting and clarity if needed.",
    ];
  }

  if (isSignableDocument(documentType)) {
    if (classification === "NORMAL") {
      return [
        "Ensure details (rent, deposit, duration) are correct.",
        "Keep a signed copy safely.",
        "Follow the agreed terms.",
      ];
    }

    return [
      "Verify parties, dates, and payment schedule before signing.",
      "Check termination, penalty, and refund clauses for one-sided terms.",
      "Confirm dispute resolution/jurisdiction terms are acceptable.",
      "Negotiate one-sided or high-penalty terms.",
      "Consult a legal expert if risk is high.",
    ];
  }

  return [
    "Verify key obligations, deadlines, and penalties before acting.",
    "Keep a copy of the document and related communications.",
  ];
}

function buildTicketDetails() {
  return {
    simple_explanation:
      "This ticket allows you to travel on the route and time shown on the ticket. It is valid only within the printed validity window.",
    key_warning:
      "Ensure your journey starts within the allowed time (often around 1 hour for local tickets). If you delay or take long breaks, the ticket can become invalid.",
    key_rules: [
      "Start the journey within the printed validity window (for many local tickets this is roughly 1 hour).",
      "Complete travel within the validity period or before the ticket expires (often by midnight).",
      "Board from the correct station and travel on the permitted route/class.",
      "Carry the ticket/QR or booking proof and ID if required.",
    ],
    common_mistakes: [
      "Breaking the journey with long gaps (e.g., Dombivli → Vidyavihar → Sion → CSMT after delays) when the ticket does not allow it.",
      "Traveling after the ticket validity has expired.",
      "Boarding from a different station or taking a different route than printed.",
    ],
    consequences: [
      "Ticket can be treated as invalid by the TC.",
      "You may have to buy a new ticket plus pay a penalty/fine.",
      "You can be deboarded or asked to pay excess fare.",
    ],
  };
}

function detectFraudSignals(text, documentType) {
  const normalized = normalizeForMatching(text);
  const signals = [];

  const signalRules = [
    {
      type: "Upfront Payment Demand",
      description: "Payment or deposit is demanded before service, joining, or benefit is provided.",
      impact: "User may lose money before receiving any legitimate service or job security.",
      patterns: [
        /pay(?:ment)?\s+before\s+(?:service|joining|delivery|work|activation|possession)/i,
        /advance\s+payment\s+(?:before|prior)\s+(?:service|joining|delivery|work|activation|possession)/i,
        /non[-\s]?refundable\s+deposit/i,
        /deposit\s+is\s+non[-\s]?refundable/i,
        /registration\s+fee/i,
        /processing\s+fee/i,
        /training\s+fee/i,
        /pay.*to\s+join/i,
      ],
      onlyFor: ["offer_letter", "legal", "unknown"],
    },
    {
      type: "Urgency Pressure",
      description: "Document pressures the user to act quickly or within a very short deadline.",
      impact: "Urgency can be used to stop the user from reading terms properly and increases scam risk.",
      patterns: [/within\s+24\s+hours/i, /urgent/i, /immediately/i, /limited time/i],
      onlyFor: ["offer_letter", "bank_financial", "legal", "unknown"],
    },
    {
      type: "Personal Data Risk",
      description: "Sensitive identity or financial details are requested too early in the process.",
      impact: "User may face identity theft or fraud.",
      patterns: [/aadhaar/i, /pan card/i, /bank details/i, /otp/i, /cvv/i, /password/i],
      onlyFor: ["offer_letter", "bank_financial", "legal", "unknown"],
    },
    {
      type: "Job Scam Indicator",
      description: "Unrealistic promises or guarantees are used to lure the user.",
      impact: "Unrealistic claims are common in job scams and fake offers.",
      patterns: [
        /guaranteed\s+job/i,
        /assured\s+job/i,
        /no\s+experience\s+required/i,
        /too\s+good\s+to\s+be\s+true/i,
        /guaranteed\s+income/i,
        /high\s+salary\s+without\s+experience/i,
        /instant\s+joining/i,
      ],
      onlyFor: ["offer_letter", "legal", "unknown"],
    },
    {
      type: "Possible Banking Phishing Pattern",
      description: "Document or message appears to ask for OTP, CVV, password, or full account details.",
      impact: "This can lead to direct account takeover or money loss.",
      patterns: [/otp/i, /cvv/i, /password/i, /share.*account details/i],
      onlyFor: ["bank_financial"],
    },
  ];

  for (const rule of signalRules) {
    const typeAllowed = !rule.onlyFor || rule.onlyFor.includes(documentType);
    if (typeAllowed && rule.patterns.some((pattern) => pattern.test(normalized))) {
      signals.push({
        type: rule.type,
        description: rule.description,
        impact: rule.impact,
      });
    }
  }

  return signals;
}

function detectUnfairRiskSignals(text, documentType) {
  const normalized = normalizeForMatching(text);
  const signals = [];

  const rawText = String(text || "");

  const signalRules = [
    {
      type: "Penalty Clause",
      description: "A penalty or charge clause applies to the user.",
      impact: "May cause direct financial loss or additional charges.",
      patterns: [/cancellation\s*charge/i, /penalt(?:y|ies)/i, /liable to pay/i, /fine of/i, /forfeit/i],
      onlyFor: ["legal", "property_document", "rental_agreement", "offer_letter"],
      severity: "MEDIUM",
    },
    {
      type: "Cost Escalation Risk",
      description: "The agreement allows costs to increase after signing.",
      impact: "User may face higher costs than originally agreed.",
      patterns: [/increase\s+cost/i, /final\s+cost\s+may\s+increase/i, /price\s+increase/i, /cost\s+increase/i, /escalation/i],
      onlyFor: ["legal", "property_document", "rental_agreement"],
      severity: "MEDIUM",
    },
    {
      type: "Delay/Possession Clause",
      description: "Delay or possession timelines favor the other party.",
      impact: "May cause possession delays or limited remedies.",
      patterns: [/delay/i, /possession/i, /handover/i, /builder/i, /developer/i],
      onlyFor: ["property_document"],
      severity: "MEDIUM",
    },
    {
      type: "Termination Clause",
      description: "Termination or change-of-terms rights are one-sided.",
      impact: "User may lose rights or face sudden termination.",
      patterns: [/terminate at any time/i, /sole discretion/i, /without notice/i, /termination/i],
      onlyFor: ["legal", "rental_agreement", "offer_letter", "policy"],
      severity: "MEDIUM",
    },
    {
      type: "Payment Uncertainty Clause",
      description: "Payment terms are vague or discretionary.",
      impact: "User may not receive guaranteed payments.",
      patterns: [/salary.*subject to/i, /payment.*discretion/i, /amount to be decided/i],
      onlyFor: ["offer_letter", "legal", "bank_financial"],
      severity: "MEDIUM",
    },
    {
      type: "Ticket Validity Condition",
      description: "Ticket validity or timing conditions are strict.",
      impact: "Ticket may become invalid if rules are missed.",
      patterns: [/valid/i, /boarding/i, /departure/i, /cancellation charge/i, /penalt(?:y|ies)/i],
      onlyFor: ["ticket"],
      severity: "LOW",
    },
  ];

  for (const rule of signalRules) {
    const typeAllowed = !rule.onlyFor || rule.onlyFor.includes(documentType);
    for (const pattern of rule.patterns) {
      if (!typeAllowed || !pattern.test(normalized)) {
        continue;
      }

      signals.push({
        ...buildClauseRisk({
          type: rule.type,
          description: rule.description,
          impact: rule.impact,
          pattern,
          text: rawText,
        }),
        severity: rule.severity,
      });
      break;
    }
  }

  return signals;
}

function buildLawReference(
  documentType,
  classification,
  riskLevel,
  fraudSignals = [],
  isContractType = false
) {
  const laws = [];
  let simpleExplanation = "";

  if (classification === "ILLEGAL") {
    laws.push("Indian Contract Act (Section 28)");
    simpleExplanation =
      "Clauses that restrict access to courts or legal remedies can be void under Section 28 of the Indian Contract Act.";
  } else if (classification === "FRAUD") {
    laws.push("IPC 420");
    laws.push("RBI / Cyber Fraud Guidelines");
    simpleExplanation =
      "IPC 420 addresses cheating and fraud, while cyber fraud guidelines protect users from scams and unsafe payment requests.";
  } else if (documentType === "property_document" || documentType === "rental_agreement") {
    if (documentType === "property_document") {
      laws.push("RERA Act");
      laws.push("Indian Contract Act");
      simpleExplanation =
        "RERA Act protects home buyers from builder-related issues, and the Indian Contract Act ensures agreements are fair and legally valid.";
    } else {
      laws.push("Model Tenancy Act / State Rent Act");
      laws.push("Indian Contract Act");
      simpleExplanation =
        "Tenancy laws protect landlord-tenant rights, and the Indian Contract Act ensures agreements are fair and legally valid.";
    }
  } else if (documentType === "legal") {
    laws.push("Indian Contract Act");
    simpleExplanation =
      "The Indian Contract Act ensures agreements are fair and legally valid.";
  } else if (documentType === "offer_letter") {
    laws.push("Indian Contract Act");
    laws.push("Relevant Labour Laws");
    simpleExplanation =
      "The Indian Contract Act ensures agreements are fair and legally valid, while labour laws protect employees from unfair job conditions.";
  } else if (documentType === "bank_financial") {
    laws.push("RBI Guidelines");
    simpleExplanation =
      "RBI guidelines protect customers from unsafe banking practices and sharing OTP/CVV/password.";
  } else if (documentType === "policy") {
    laws.push("Consumer Protection Act");
    simpleExplanation =
      "Consumer Protection Act prevents unfair trade practices and protects consumers.";
  } else if (documentType === "ticket") {
    laws.push("Indian Railways Rules");
    simpleExplanation =
      "Indian Railways rules require passengers to start and complete travel within allowed time limits. Breaking journey or delaying travel may invalidate the ticket.";
  } else if (documentType === "government_rule") {
    laws.push("Applicable Government Rules");
    simpleExplanation =
      "Government rules or notices should be verified against official sources before acting.";
  } else if (!isContractType && fraudSignals.length > 0) {
    // IPC 420 only for non-contract documents
    laws.push("IPC 420");
    laws.push("RBI / Cyber Fraud Guidelines");
    simpleExplanation =
      "If the document appears deceptive or tries to obtain money or sensitive information unfairly, cheating-related laws may become relevant.";
  }

  if (riskLevel === "LOW" && laws.length === 0) {
    return {
      applicable: false,
      laws: [],
      simple_explanation: "",
    };
  }

  return {
    applicable: laws.length > 0,
    laws: [...new Set(laws)],
    simple_explanation: simpleExplanation,
  };
}

function applyDecisionPolicy(structured, documentType, documentText) {
  const inferredTicket = documentType !== "ticket" && isLikelyTicket(documentText);
  let policyDocumentType = inferredTicket ? "ticket" : documentType;
  const structuredTypeHint = normalizeDocumentType(structured.document_type);
  if (["ticket", "resume"].includes(structuredTypeHint)) {
    policyDocumentType = structuredTypeHint;
  }
  const positiveSignals = detectPositiveSignals(documentText, policyDocumentType);
  const contradictionContext = buildContradictionContext(positiveSignals, documentText);
  const fraudSignals = filterContradictions(
    detectFraudSignals(documentText, policyDocumentType),
    positiveSignals,
    documentText
  );
  const unfairSignals = filterContradictions(
    detectUnfairRiskSignals(documentText, policyDocumentType),
    positiveSignals,
    documentText
  );
  const illegalSignals = detectIllegalSignals(documentText);
  const illegalFlags = detectIllegalClauses(documentText);
  const quantifiedImpacts = detectQuantifiedImpacts(documentText);
  const quantifiedImpactStrings = extractQuantifiedImpactStrings(documentText);
  let warnings = [...normalizeStringArray(structured.warnings)];
  const risks = normalizeRiskEntries(structured.top_risks || structured.risks);
  const suspiciousClauses = normalizeSuspiciousClauses(
    structured.suspicious_clauses || structured.hidden_conditions || structured.penalties
  );
  const fraudWarning =
    "This document shows strong signs of a job scam. Do NOT pay any money or share personal details.";
  const unfairWarning = "This document contains one-sided clauses that may disadvantage you.";
  const safeWarning = "This agreement appears balanced and does not contain major risks.";
  const fraudIndicators = detectFraudIndicators(normalizeForMatching(documentText));
  const fraudLikely =
    isFraudLikely(fraudIndicators) ||
    (fraudIndicators.urgency && fraudIndicators.personalData && fraudIndicators.unrealistic);

  for (const signal of fraudSignals) {
    risks.push(signal);
  }
  for (const signal of unfairSignals) {
    risks.push(signal);
  }
  for (const signal of illegalSignals) {
    risks.push(signal);
  }
  for (const impact of quantifiedImpacts) {
    risks.push(impact);
  }

  const hasFraudSignals = fraudSignals.length > 0 || fraudLikely;
  const hasIllegalSignals = illegalSignals.length > 0 || illegalFlags.length > 0;
  const isContractType = ["legal", "property_document", "rental_agreement"].includes(policyDocumentType);
  const isTicketType = policyDocumentType === "ticket";
  const currentRiskLevel = normalizeRiskLevel(structured.risk_level || "LOW");
  let riskLevel = currentRiskLevel;
  let classification = normalizeClassification(structured.classification || "NORMAL");
  let finalDecision = normalizeFinalDecision(structured.final_decision || "REVIEW_CAUTION");
  let shouldUserSign = normalizeShouldUserSign(structured.should_user_sign || "CAUTION");
  let reasonForDecision = flattenObjectToString(
    structured.reason_for_decision || "Review the document carefully before taking any action."
  );
  let lawyerSuggestion = flattenObjectToString(structured.lawyer_suggestion || "");
  const negativeSignals = filterNegativeSignalsByContradictions(
    detectNegativeSignals(documentText, policyDocumentType),
    contradictionContext
  );
  const negativeScore = negativeSignals.reduce((sum, item) => sum + item.weight, 0);
  const positiveScore = positiveSignals.length;
  const balanceScore = positiveScore - negativeScore;
  const hasStrongFraudSignals = fraudLikely;

  if (hasIllegalSignals) {
    classification = "ILLEGAL";
    riskLevel = "HIGH";
    reasonForDecision =
      "This document appears to restrict legal rights or remedies, which can be legally unenforceable.";
    lawyerSuggestion = "Consult a legal expert before taking any action";
    warnings.push("Potentially illegal clause detected that limits legal remedies.");
  } else if (isTicketType && !hasFraudSignals) {
    // Ticket override: only treat as fraud if strong fraud signals exist.
    classification = "NORMAL";
    riskLevel = "LOW";
    reasonForDecision =
      "This appears to be a ticket or travel document with no strong fraud indicators. Follow validity rules before travel.";
    lawyerSuggestion = "";
    const ticketDetails = buildTicketDetails();
    warnings = [ticketDetails.key_warning, ...warnings];
    warnings = warnings.filter(
      (item) =>
        !/this document shows signs of fraud|do not make payment|do not share personal details/i.test(item)
    );
  } else if (hasFraudSignals) {
    classification = "FRAUD";
    riskLevel = "HIGH";
    reasonForDecision =
      "This is a HIGH-RISK document with multiple fraud indicators such as upfront payment demand, urgency pressure, and lack of job security.";
    lawyerSuggestion = "Consult a legal expert before taking any action";
    warnings = [fraudWarning, ...warnings];
  } else if (riskLevel === "HIGH") {
    classification = "UNFAIR";
    if (!lawyerSuggestion) {
      lawyerSuggestion = "Consult a legal expert before taking any action";
    }
    warnings = [unfairWarning, ...warnings];
  } else if (riskLevel === "MEDIUM") {
    classification = "UNFAIR";
    lawyerSuggestion = lawyerSuggestion || "";
    warnings = warnings.length > 0 ? warnings : [unfairWarning];
  } else {
    classification = "NORMAL";
    lawyerSuggestion = "";
  }

  if (policyDocumentType === "offer_letter" && !hasIllegalSignals) {
    if (hasStrongFraudSignals) {
      classification = "FRAUD";
      riskLevel = "HIGH";
    } else if (balanceScore >= 2) {
      classification = "NORMAL";
      riskLevel = "LOW";
    } else {
      classification = "UNFAIR";
      riskLevel = riskLevel === "LOW" ? "MEDIUM" : riskLevel;
    }

    if (!hasStrongFraudSignals && classification === "FRAUD") {
      classification = "UNFAIR";
      riskLevel = "MEDIUM";
    }
  }

  if (
    contradictionContext.hasStandardPolicySignals &&
    ["offer_letter", "legal", "policy"].includes(policyDocumentType) &&
    !hasIllegalSignals &&
    !hasStrongFraudSignals
  ) {
    if (classification === "FRAUD") {
      classification = "UNFAIR";
    }
    if (riskLevel === "HIGH") {
      riskLevel = "MEDIUM";
    }
  }

  if (documentType === "resume") {
    classification = riskLevel === "LOW" ? "NORMAL" : "UNFAIR";
    reasonForDecision =
      "This is a resume, so signing safety is not directly applicable. Review for accuracy and fraud-related requests.";
    if (!lawyerSuggestion) {
      lawyerSuggestion = "";
    }
  }

  if (classification === "UNFAIR") {
    reasonForDecision =
      "The agreement contains multiple one-sided clauses such as penalty, delay, hidden charges, or cost escalation.";
  }

  finalDecision = resolveFinalDecision(policyDocumentType, classification, riskLevel);
  shouldUserSign = resolveShouldUserSign(finalDecision);

  if (classification !== "FRAUD") {
    warnings = warnings.filter(
      (item) =>
        !/this document shows (strong )?signs of (a job scam|a scam|fraud)|do not make payment|do not share personal details/i.test(
          item
        )
    );
  }

  if (classification === "NORMAL" && isSignableDocument(policyDocumentType)) {
    warnings = warnings.length > 0 ? warnings : [safeWarning];
    reasonForDecision = "No strong unfair or risky clauses detected. The agreement appears balanced.";
  }

  if (classification === "NORMAL" && warnings.length === 0) {
    warnings = [safeWarning];
  }

  const cleanedRisks = filterContradictions(risks, positiveSignals, documentText);
  const specificRisks = filterGroundedRisks(dedupeRisks(cleanedRisks), documentText)
    .filter((risk) => isRiskSpecific(risk));
  let topRisks = (
    specificRisks.length > 0
      ? specificRisks
      : filterGroundedRisks(dedupeRisks(cleanedRisks), documentText)
  )
    .slice(0, 5);
  if (classification === "FRAUD") {
    const requiredTopRisks = [
      {
        type: "Upfront Payment Demand",
        description: "Payment or deposit is demanded before service or joining.",
        impact: "User may lose money before receiving any legitimate service or job security.",
      },
      {
        type: "Job Scam Indicator",
        description: "Unrealistic promises or guarantees are used to lure the user.",
        impact: "Unrealistic claims are common in job scams and fake offers.",
      },
      {
        type: "Personal Data Risk",
        description: "Sensitive personal or financial details are requested early.",
        impact: "User may face identity theft or fraud.",
      },
      {
        type: "Urgency Pressure",
        description: "Document pressures the user to act within a very short deadline.",
        impact: "Urgency can be used to stop the user from reading terms properly.",
      },
    ];
    const existingTopRisks = topRisks.filter(
      (risk) => !requiredTopRisks.some((required) => required.type === risk.type)
    );
    topRisks = dedupeRisks([...requiredTopRisks, ...existingTopRisks]).slice(0, 5);
    const hasUpfrontRisk = cleanedRisks.some(
      (risk) => String(risk?.type || "").toLowerCase().includes("upfront payment")
    );
    if (!hasUpfrontRisk) {
      cleanedRisks.push(
        createRisk(
          "Upfront Payment Scam",
          "Payment required before joining",
          "HIGH",
          "Pay a refundable security deposit before joining."
        )
      );
    }
  }
  const mergedSuspiciousClauses = filterGroundedClauses(
    [...new Set(suspiciousClauses.filter(Boolean))],
    documentText
  ).slice(0, 5);
  const lawReference = buildLawReference(
    policyDocumentType,
    classification,
    riskLevel,
    hasFraudSignals && !isContractType ? fraudSignals : [],
    isContractType
  );
  const smartDifferenceExplanation = buildSmartDifferenceExplanation(policyDocumentType, classification);
  const confidenceScore = buildConfidenceScore(policyDocumentType, classification, topRisks);
  const escalation = riskLevel === "HIGH" ? "Consult Lawyer Recommended" : "No Immediate Escalation";

  if (classification === "UNFAIR" && riskLevel === "HIGH" && !lawyerSuggestion) {
    lawyerSuggestion = "Consult a legal expert before taking any action";
  }

  if (classification === "NORMAL") {
    lawyerSuggestion = "";
  }

  const finalWarnings = [...new Set(warnings.filter(Boolean))].slice(0, 5);
  const legalValidityFlags = classification === "ILLEGAL" ? illegalFlags : [];
  const ticketDetails = isTicketType ? buildTicketDetails() : null;

  const resolvedDocumentType =
    structured.document_type && String(structured.document_type).toLowerCase() !== "unknown"
      ? structured.document_type
      : getDocumentTypeLabel(policyDocumentType);

  return {
    document_type: resolvedDocumentType,
    classification,
    risk_level: riskLevel,
    suspicious_clauses: mergedSuspiciousClauses,
    top_risks: topRisks,
    warnings: finalWarnings,
    final_decision: finalDecision,
    should_user_sign: shouldUserSign,
    reason_for_decision: reasonForDecision,
    simple_explanation: ticketDetails?.simple_explanation,
    key_rules: ticketDetails?.key_rules,
    common_mistakes: ticketDetails?.common_mistakes,
    consequences: ticketDetails?.consequences,
    smart_difference_explanation: smartDifferenceExplanation,
    confidence_score: confidenceScore,
    escalation,
    what_user_should_do: buildGuidance(policyDocumentType, classification, riskLevel),
    lawyer_suggestion: lawyerSuggestion,
    law_reference: lawReference,
    quantified_impact: quantifiedImpactStrings,
    legal_validity_flags: legalValidityFlags,
    positive_signals: positiveSignals,
    note_for_user:
      "This is AI guidance. For serious matters, consult a legal expert.",
  };
}

async function retrieveLegalContext(query, documentType) {
  if (!LEGAL_DATASET_ALLOWED_TYPES.has(documentType)) {
    return {
      context: "",
      contextUsed: false,
      contextCount: 0,
      matches: [],
    };
  }

  try {
    const rawResults = await runPythonSearch(query);
    const cleanedQuery = cleanOcrText(query);
    const matches = filterRelevantResults(rawResults, { queryText: cleanedQuery || query });
    const context = matches.length > 0 ? buildContextString(matches) : "";

    return {
      context,
      contextUsed: Boolean(context),
      contextCount: matches.length,
      matches,
    };
  } catch (error) {
    console.error("[aiService] Context retrieval failed:", error.message);
    return {
      context: "",
      contextUsed: false,
      contextCount: 0,
      matches: [],
    };
  }
}

async function generateStructuredJson(prompt) {
  const result = await generateContentWithFallback(prompt);
  const responseText = result.response.text();
  return parseJSONResponse(removeMarkdownFormatting(responseText));
}

function buildStructuredTranslationPrompt(structured, languageLabel) {
  const payload = JSON.stringify(structured);
  return `You are a translation engine for legal guidance.
Translate all user-facing text values to ${languageLabel}.
Write as if the text was originally authored in ${languageLabel}, not translated.
Use very simple, conversational language for common/rural users.

Rules (strict):
1. Return only valid JSON.
2. Preserve keys, structure, arrays, and ordering.
3. Do NOT translate enum values for these keys: classification, risk_level, final_decision, should_user_sign, decision, confidence_score, escalation.
4. Do NOT translate law_reference.laws; keep all law names, IPC sections, and statute names in English.
5. Never remove or alter numbers, percentages, durations, or monetary values.
6. Keep numbers, dates, and placeholders (e.g., __________) unchanged.
7. Do not use blanks or placeholders like "____" unless already present in the input.
8. If a string is already in ${languageLabel}, keep it as-is.

JSON input:
${payload}`;
}

async function translateStructuredOutput(structured, language) {
  const resolvedLanguage = ensureSupportedLanguage(language);
  if (resolvedLanguage === "en") {
    return structured;
  }

  const languageLabel = getLanguageLabel(resolvedLanguage);
  const prompt = buildStructuredTranslationPrompt(structured, languageLabel);
  const requiredTokens = extractNumericTokens(JSON.stringify(structured));

  try {
    let translated = await generateStructuredJson(prompt);
    const translatedText = JSON.stringify(translated);
    const hasNumberLoss = hasMissingNumericTokens(translatedText, requiredTokens);
    const hasBlank = hasPlaceholders(translatedText);
    const mixedLanguage = isMixedLanguage(translatedText, resolvedLanguage);

    if (isLanguageMismatch(translatedText, resolvedLanguage) || hasNumberLoss || hasBlank || mixedLanguage) {
      const strictPrompt = `${prompt}\n\nIMPORTANT: Output MUST be only in ${languageLabel}. Do not use any other language.`;
      translated = await generateStructuredJson(strictPrompt);
    }
    const finalText = JSON.stringify(translated);
    const stillMissingNumbers = hasMissingNumericTokens(finalText, requiredTokens);
    const stillMixed = isMixedLanguage(finalText, resolvedLanguage);
    const stillBlank = hasPlaceholders(finalText);

    if (isLanguageMismatch(finalText, resolvedLanguage) || stillMissingNumbers || stillMixed || stillBlank) {
      console.warn("[aiService] Translation quality check failed; falling back to English output.");
      return structured;
    }

    return translated;
  } catch (error) {
    console.warn("[aiService] Structured translation failed, using English output:", error.message);
    return structured;
  }
}

function buildSharedGuardrails(languageInstruction) {
  return `
${languageInstruction}
Critical rules:
1. Respond only in the language specified above. Do not mix languages.
2. Return only valid JSON.
3. No markdown, no commentary, no extra text.
4. Never include unrelated context.
5. Use retrieved context only if it clearly matches the document or query.
6. If context mismatches, ignore it completely.
7. Do not hallucinate laws, penalties, or clauses.
8. Use only masked document text.
9. Detect realistic risks only. Do not force risks where none exist.
10. Never remove or alter numbers, percentages, durations, or monetary values from the input.
11. Do not use blanks or placeholders like "____"; always keep exact values.
12. Use very simple, conversational language for common/rural users.
13. For each risk, include real-life impact (money/time/property loss).
14. Write naturally as if originally authored in the selected language.
`.trim();
}

function buildLegalPrompt({ documentText, context, languageInstruction }) {
  return `
You are an expert legal assistant for Indian users.
${buildSharedGuardrails(languageInstruction)}

Analyze this as a legal or rules-based document.
Your primary job is to protect the user from fraud, financial loss, or unfair legal harm.

Retrieved context:
${context || "No relevant legal context available."}

Document text:
${documentText}

Return STRICT JSON:
{
  "document_type": "Legal Agreement",
  "classification": "FRAUD | UNFAIR | ILLEGAL | NORMAL",
  "risk_level": "LOW | MEDIUM | HIGH",
  "reason_for_decision": "",
  "suspicious_clauses": [],
  "top_risks": [
    {
      "type": "",
      "description": "",
      "impact": ""
    }
  ],
  "final_decision": "SAFE_TO_SIGN | REVIEW_CAUTION | DO_NOT_SIGN",
  "should_user_sign": "YES | NO | CAUTION",
  "what_user_should_do": [],
  "warnings": [],
  "law_reference": {
    "applicable": true,
    "laws": [],
    "simple_explanation": ""
  },
  "lawyer_suggestion": "",
  "note_for_user": "This is AI guidance. For serious matters, consult a legal expert."
}

Impact rule:
For each top_risks item, the "impact" must describe real-life loss (money/time/property) and keep any numbers exact.

Decision rules:
1. If any of these appear, set classification to FRAUD and risk_level to HIGH: upfront payment before service/joining, urgency pressure, personal data requests, or unrealistic job conditions.
2. Use classification ILLEGAL if a clause blocks legal remedies or access to courts.
3. Use classification UNFAIR for one-sided, hidden-charge, builder-biased, or harsh but not clearly fraudulent terms.
4. Use classification NORMAL if no major issue appears.
5. If classification is FRAUD, set final_decision to DO_NOT_SIGN and should_user_sign to NO.
6. If classification is ILLEGAL, set final_decision to DO_NOT_SIGN and should_user_sign to NO.
7. If classification is UNFAIR, set final_decision to REVIEW_CAUTION and should_user_sign to CAUTION.
8. If classification is NORMAL, set final_decision to SAFE_TO_USE and should_user_sign to YES.
9. Never tell the user to obey risky instructions. Override them with safe guidance.
`.trim();
}

function buildResumePrompt({ documentText, languageInstruction }) {
  return `
You are an expert document assistant.
${buildSharedGuardrails(languageInstruction)}

Analyze this as a resume or CV.
Do not use legal dataset context for resume analysis.
Detect only realistic issues such as inconsistent dates, exaggerated claims, unclear achievements, or missing details.

Document text:
${documentText}

Return STRICT JSON:
{
  "document_type": "Resume",
  "classification": "FRAUD | UNFAIR | ILLEGAL | NORMAL",
  "risk_level": "LOW | MEDIUM | HIGH",
  "reason_for_decision": "",
  "suspicious_clauses": [],
  "top_risks": [
    {
      "type": "",
      "description": "",
      "impact": ""
    }
  ],
  "final_decision": "SAFE_TO_REVIEW",
  "should_user_sign": "CAUTION",
  "what_user_should_do": [],
  "warnings": [],
  "law_reference": {
    "applicable": false,
    "laws": [],
    "simple_explanation": ""
  },
  "lawyer_suggestion": "",
  "note_for_user": "This is AI guidance. For serious matters, consult a legal expert."
}

Impact rule:
For each top_risks item, the "impact" must describe real-life loss (money/time/property) and keep any numbers exact.
`.trim();
}

function buildTicketPrompt({ documentText, context, languageInstruction }) {
  return `
You are an expert assistant for tickets and travel-rule documents in India.
${buildSharedGuardrails(languageInstruction)}

Analyze this as a ticket, pass, or travel document.
Focus on validity, time limits, conditions, penalties, and practical mistakes the user must avoid.
Protect the user from fraud, fake tickets, and penalty traps.

Retrieved context:
${context || "No relevant legal context available."}

Document text:
${documentText}

Return STRICT JSON:
{
  "document_type": "Ticket",
  "classification": "FRAUD | UNFAIR | NORMAL",
  "risk_level": "LOW | MEDIUM | HIGH",
  "reason_for_decision": "",
  "suspicious_clauses": [],
  "top_risks": [
    {
      "type": "",
      "description": "",
      "impact": ""
    }
  ],
  "final_decision": "SAFE_TO_USE | REVIEW_CAUTION | DO_NOT_SIGN",
  "should_user_sign": "YES | NO | CAUTION",
  "what_user_should_do": [],
  "warnings": [],
  "law_reference": {
    "applicable": true,
    "laws": [],
    "simple_explanation": ""
  },
  "lawyer_suggestion": "",
  "note_for_user": "This is AI guidance. For serious matters, consult a legal expert."
}

Impact rule:
For each top_risks item, the "impact" must describe real-life loss (money/time/property) and keep any numbers exact.
`.trim();
}

function buildGenericPrompt({ documentText, documentType, languageInstruction }) {
  return `
You are an expert document assistant.
${buildSharedGuardrails(languageInstruction)}

Analyze this ${documentType} document for a common user.
Be practical and domain-aware.

Document text:
${documentText}

Return STRICT JSON:
{
  "document_type": "",
  "classification": "FRAUD | UNFAIR | ILLEGAL | NORMAL",
  "risk_level": "LOW | MEDIUM | HIGH",
  "reason_for_decision": "",
  "suspicious_clauses": [],
  "top_risks": [
    {
      "type": "",
      "description": "",
      "impact": ""
    }
  ],
  "final_decision": "SAFE_TO_SIGN | REVIEW_CAUTION | DO_NOT_SIGN",
  "should_user_sign": "YES | NO | CAUTION",
  "what_user_should_do": [],
  "warnings": [],
  "law_reference": {
    "applicable": false,
    "laws": [],
    "simple_explanation": ""
  },
  "lawyer_suggestion": "",
  "note_for_user": "This is AI guidance. For serious matters, consult a legal expert."
}

Impact rule:
For each top_risks item, the "impact" must describe real-life loss (money/time/property) and keep any numbers exact.
`.trim();
}

function buildQueryPrompt({ query, context, languageInstruction }) {
  return `
You are an expert legal assistant for Indian users.
${buildSharedGuardrails(languageInstruction)}

User query:
${query}

Retrieved context:
${context || "No relevant legal context available."}

Return STRICT JSON:
{
  "topic": "",
  "simple_explanation": "",
  "rules": [],
  "penalties": [],
  "user_guidance": []
}

Guidance rules:
1. Use very simple language.
2. If any numbers or time limits are mentioned, repeat them exactly.
3. Every guidance point must mention real-life impact (money/time/property).
`.trim();
}

function normalizeLegalAnalysis(rawAnalysis = {}) {
  const structured = {
    document_type: "Legal Agreement",
    classification: normalizeClassification(rawAnalysis.classification || "UNFAIR"),
    risk_level: normalizeRiskLevel(rawAnalysis.risk_level || "MEDIUM"),
    suspicious_clauses: normalizeStringArray(rawAnalysis.suspicious_clauses),
    top_risks: normalizeRiskEntries(rawAnalysis.top_risks),
    what_user_should_do: normalizeStringArray(rawAnalysis.what_user_should_do),
    warnings: normalizeStringArray(rawAnalysis.warnings),
    final_decision: normalizeFinalDecision(rawAnalysis.final_decision || "REVIEW_CAUTION"),
    should_user_sign: normalizeShouldUserSign(rawAnalysis.should_user_sign || "CAUTION"),
    reason_for_decision: flattenObjectToString(rawAnalysis.reason_for_decision || ""),
    law_reference: sanitizeJsonValue(rawAnalysis.law_reference || {}),
    lawyer_suggestion: flattenObjectToString(rawAnalysis.lawyer_suggestion || ""),
    note_for_user: flattenObjectToString(rawAnalysis.note_for_user || ""),
  };

  const legacyRisks = structured.top_risks.map((risk) => ({
    clause: risk.type || "Legal Risk",
    severity: structured.risk_level,
    reason: `${risk.description} Impact: ${risk.impact}`.trim(),
  }));

  return {
    documentType: "legal",
    summary: structured.reason_for_decision,
    structured,
    legacyRisks,
  };
}

function normalizeResumeAnalysis(rawAnalysis = {}) {
  const structured = {
    document_type: "Resume",
    classification: normalizeClassification(rawAnalysis.classification || "NORMAL"),
    risk_level: normalizeRiskLevel(rawAnalysis.risk_level || "MEDIUM"),
    reason_for_decision: flattenObjectToString(rawAnalysis.reason_for_decision || ""),
    suspicious_clauses: normalizeStringArray(rawAnalysis.suspicious_clauses),
    top_risks: normalizeRiskEntries(rawAnalysis.top_risks),
    final_decision: "SAFE_TO_REVIEW",
    should_user_sign: "CAUTION",
    what_user_should_do: normalizeStringArray(rawAnalysis.what_user_should_do),
    warnings: normalizeStringArray(rawAnalysis.warnings),
    law_reference: sanitizeJsonValue(rawAnalysis.law_reference || {}),
    lawyer_suggestion: flattenObjectToString(rawAnalysis.lawyer_suggestion || ""),
    note_for_user: flattenObjectToString(rawAnalysis.note_for_user || ""),
  };

  return {
    documentType: "resume",
    summary: structured.reason_for_decision,
    structured,
    legacyRisks: structured.top_risks.map((risk) => ({
      clause: risk.type || "Resume Issue",
      severity: structured.risk_level,
      reason: `${risk.description} Impact: ${risk.impact}`.trim(),
    })),
  };
}

function normalizeTicketAnalysis(rawAnalysis = {}) {
  const structured = {
    document_type: "Ticket",
    classification: normalizeClassification(rawAnalysis.classification || "NORMAL"),
    risk_level: normalizeRiskLevel(rawAnalysis.risk_level || "LOW"),
    reason_for_decision: flattenObjectToString(rawAnalysis.reason_for_decision || ""),
    suspicious_clauses: normalizeStringArray(rawAnalysis.suspicious_clauses),
    top_risks: normalizeRiskEntries(rawAnalysis.top_risks),
    what_user_should_do: normalizeStringArray(rawAnalysis.what_user_should_do || rawAnalysis.user_guidance),
    warnings: normalizeStringArray(rawAnalysis.warnings),
    final_decision: normalizeFinalDecision(rawAnalysis.final_decision || "REVIEW_CAUTION"),
    should_user_sign: normalizeShouldUserSign(rawAnalysis.should_user_sign || "CAUTION"),
    law_reference: sanitizeJsonValue(rawAnalysis.law_reference || {}),
    lawyer_suggestion: flattenObjectToString(rawAnalysis.lawyer_suggestion || ""),
    note_for_user: flattenObjectToString(rawAnalysis.note_for_user || ""),
  };

  const ticketRisks = [
    ...structured.top_risks.map((risk) => ({
      clause: risk.type || "Ticket Risk",
      severity: structured.risk_level,
      reason: `${risk.description} Impact: ${risk.impact}`.trim(),
    })),
    ...buildLegacyRisksFromList(structured.warnings, "MEDIUM", "Warning"),
  ];

  return {
    documentType: "ticket",
    summary: structured.reason_for_decision,
    structured,
    legacyRisks: ticketRisks,
  };
}

function normalizeGenericAnalysis(rawAnalysis = {}, detectedType) {
  const structured = {
    document_type: flattenObjectToString(
      rawAnalysis.document_type || getDocumentTypeLabel(detectedType)
    ),
    classification: normalizeClassification(rawAnalysis.classification || "NORMAL"),
    risk_level: normalizeRiskLevel(rawAnalysis.risk_level || "LOW"),
    reason_for_decision: flattenObjectToString(rawAnalysis.reason_for_decision || ""),
    suspicious_clauses: normalizeStringArray(rawAnalysis.suspicious_clauses),
    top_risks: normalizeRiskEntries(rawAnalysis.top_risks),
    what_user_should_do: normalizeStringArray(rawAnalysis.what_user_should_do || rawAnalysis.suggestions),
    warnings: normalizeStringArray(rawAnalysis.warnings),
    final_decision: normalizeFinalDecision(rawAnalysis.final_decision || "REVIEW_CAUTION"),
    should_user_sign: normalizeShouldUserSign(rawAnalysis.should_user_sign || "CAUTION"),
    law_reference: sanitizeJsonValue(rawAnalysis.law_reference || {}),
    lawyer_suggestion: flattenObjectToString(rawAnalysis.lawyer_suggestion || ""),
    note_for_user: flattenObjectToString(rawAnalysis.note_for_user || ""),
  };

  const legacyRisks = [
    ...structured.top_risks.map((risk) => ({
      clause: risk.type || "Document Risk",
      severity: structured.risk_level,
      reason: `${risk.description} Impact: ${risk.impact}`.trim(),
    })),
    ...buildLegacyRisksFromList(structured.warnings, "LOW", "Warning"),
  ];

  return {
    documentType: detectedType,
    summary: structured.reason_for_decision,
    structured,
    legacyRisks,
  };
}

function buildTicketAnalysis(documentText, languageInstruction) {
  const normalized = normalizeForMatching(documentText);
  const rawText = String(documentText || "");
  const isHinglish = languageInstruction.includes("Hinglish");

  const hasDate = /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec))\b/i.test(
    rawText
  );
  const hasTime = /\b\d{1,2}:\d{2}\b/.test(rawText);
  const hasRoute = /(from\s+\w+\s+to\s+\w+|source\s+station|destination\s+station|boarding\s+station)/i.test(
    rawText
  );
  const hasTrain = /(pnr|train\s*(no|number)|coach|berth|irctc|uts)/i.test(normalized);

  const detectedRisks = [];
  if (!hasDate || !hasTime) {
    detectedRisks.push(
      createRisk(
        "Missing Travel Timing",
        "Travel date/time is not clearly visible.",
        "MEDIUM"
      )
    );
  }
  if (!hasRoute) {
    detectedRisks.push(
      createRisk(
        "Missing Route Details",
        "Source/destination stations are not clearly stated.",
        "MEDIUM"
      )
    );
  }
  if (!hasTrain) {
    detectedRisks.push(
      createRisk(
        "Ticket Identifiers Missing",
        "PNR/train/coach identifiers are not clearly visible.",
        "MEDIUM"
      )
    );
  }

  const riskLevel = detectedRisks.length > 0 ? "MEDIUM" : "LOW";
  const decision = decisionFromRisk(riskLevel);
  const mandatoryTicketWarning =
    "Journey should start within ~1 hour (for many local tickets). Ticket validity rules apply (Indian Railways).";
  const keyWarning = detectedRisks.length > 0
    ? `Ticket details look incomplete. ${mandatoryTicketWarning}`
    : mandatoryTicketWarning;
  const simpleExplanation = isHinglish
    ? "This looks like a travel ticket. Verify date, time, and route before travel."
    : "This looks like a travel ticket. Verify date, time, and route before travel.";
  const smartExplanation = detectedRisks.length > 0
    ? "Some core ticket fields are missing or unclear, so validity cannot be fully confirmed."
    : "Ticket fields appear present; follow printed validity and route conditions.";

  return {
    document_type: "Ticket",
    risk_level: riskLevel,
    decision,
    classification: detectedRisks.length > 0 ? "UNFAIR" : "NORMAL",
    key_warning: keyWarning,
    simple_explanation: simpleExplanation,
    smart_explanation: smartExplanation,
    detected_risks: detectedRisks,
    what_user_should_do: [
      "Start the journey within ~1 hour for many local tickets.",
      "Follow Indian Railways ticket validity rules.",
      "Check ticket validity date/time and class.",
      "Confirm source and destination stations match your journey.",
      "Carry booking proof and any required ID.",
      "Avoid breaking the journey unless explicitly allowed.",
    ],
    law_reference: buildLawReferenceObjects(
      ["Indian Railways Rules"],
      "Ticket validity and travel conditions are governed by Indian Railways rules."
    ),
    law_reference_explanation:
      "Railway tickets are governed by Indian Railways rules. Travel must follow printed validity conditions.",
  };
}

function buildOfferLetterAnalysis(documentText, languageInstruction) {
  const normalized = normalizeForMatching(documentText);
  const rawText = String(documentText || "");
  const isHinglish = languageInstruction.includes("Hinglish");

  const detectedRisks = [];
  const hasUpfrontPayment = hasUpfrontPaymentRisk(normalized);
  const hasBondClause = /bond|service\s+agreement|liquidated\s+damages|pay\s*back\s*training/i.test(
    normalized
  );
  const hasNoNoticeTermination = /terminate.*without\s+notice|termination.*at\s+any\s+time|sole\s+discretion/i.test(
    normalized
  );
  const hasSalaryDelay = /salary\s+may\s+be\s+delayed|salary\s+payment\s+may\s+be\s+delayed|salary\s+can\s+be\s+delayed|payment\s+of\s+salary\s+may\s+be\s+delayed/i.test(
    normalized
  );
  const fraudIndicators = detectFraudIndicators(normalized);
  const hasUrgency = fraudIndicators.urgency;
  const hasPersonalDataRequest = fraudIndicators.personalData;
  const hasUnrealisticPromise = fraudIndicators.unrealistic;
  const fraudLikely =
    isFraudLikely(fraudIndicators) ||
    (fraudIndicators.urgency && fraudIndicators.personalData && fraudIndicators.unrealistic);

  if (hasUpfrontPayment) {
    detectedRisks.push(
      createRisk(
        "Upfront Payment Scam",
        "Detected payment-before-joining terms (fee/deposit).",
        "HIGH",
        extractClauseSnippet(
          rawText,
          /registration\s+fee|processing\s+fee|training\s+fee|non[-\s]?refundable\s+deposit|deposit\s+is\s+non[-\s]?refundable|pay.*before\s+(?:service|joining|delivery|work|activation|possession)|advance\s+payment\s+(?:before|prior)\s+(?:service|joining|delivery|work|activation|possession)/i
        )
      )
    );
  }

  if (hasUrgency) {
    detectedRisks.push(
      createRisk(
        "Urgency Pressure",
        "Urgent action is demanded in a short time window.",
        "MEDIUM",
        extractClauseSnippet(rawText, /within\s+24\s+hours|urgent|immediately|limited time/i)
      )
    );
  }

  if (hasPersonalDataRequest) {
    detectedRisks.push(
      createRisk(
        "Personal Data Risk",
        "Sensitive personal or financial details are requested early.",
        "HIGH",
        extractClauseSnippet(rawText, /aadhaar|pan\s*card|bank\s*details|otp|cvv|password|upi\s*pin/i)
      )
    );
  }

  if (hasUnrealisticPromise) {
    detectedRisks.push(
      createRisk(
        "Job Scam Indicator",
        "Unrealistic or guaranteed job promises are mentioned.",
        "HIGH",
        extractClauseSnippet(
          rawText,
          /guaranteed\s+job|assured\s+job|no\s+experience\s+required|too\s+good\s+to\s+be\s+true|guaranteed\s+income|high\s+salary\s+without\s+experience|instant\s+joining/i
        )
      )
    );
  }

  if (hasBondClause) {
    detectedRisks.push(
      createRisk(
        "Bond / Penalty Clause",
        "Bond or penalty clause detected.",
        "MEDIUM",
        extractClauseSnippet(
          rawText,
          /bond|service\s+agreement|liquidated\s+damages|pay\s*back\s*training/i
        )
      )
    );
  }

  if (hasNoNoticeTermination) {
    detectedRisks.push(
      createRisk(
        "One-Sided Termination",
        "Termination without notice is mentioned.",
        "MEDIUM",
        extractClauseSnippet(
          rawText,
          /terminate.*without\s+notice|termination.*at\s+any\s+time|sole\s+discretion/i
        )
      )
    );
  }

  if (hasSalaryDelay) {
    detectedRisks.push(
      createRisk(
        "Salary Delay Risk",
        "Salary payment is not guaranteed.",
        "MEDIUM",
        extractClauseSnippet(
          rawText,
          /salary\s+may\s+be\s+delayed|salary\s+payment\s+may\s+be\s+delayed|salary\s+can\s+be\s+delayed|payment\s+of\s+salary\s+may\s+be\s+delayed/i
        )
      )
    );
  }

  let riskLevel = "LOW";
  let classification = "NORMAL";
  if (fraudLikely) {
    riskLevel = "HIGH";
    classification = "FRAUD";
  } else if (hasBondClause || hasNoNoticeTermination || hasSalaryDelay) {
    riskLevel = "MEDIUM";
    classification = "UNFAIR";
  }

  const decision =
    classification === "FRAUD"
      ? "DO_NOT_SIGN"
      : classification === "UNFAIR"
      ? "REVIEW_CAUTION"
      : "SAFE_TO_USE";
  const keyWarning =
    classification === "FRAUD"
      ? "This document shows strong signs of a job scam. Do NOT pay any money or share personal details."
      : classification === "NORMAL"
      ? "This agreement appears balanced and does not contain major risks."
      : "This document contains one-sided clauses that may disadvantage you.";
  const simpleExplanation = "Check the offer for payment demands, bonds, or one-sided termination terms.";
  const smartExplanation =
    classification === "FRAUD"
      ? "This is a HIGH-RISK document with multiple fraud indicators such as upfront payment demand, urgency pressure, and lack of job security."
      : classification === "NORMAL"
      ? "No strong unfair or risky clauses detected. The agreement appears balanced."
      : detectedRisks.length > 0
      ? "The document contains multiple one-sided clauses such as penalties, termination limits, or salary uncertainty."
      : "No major fraud or penalty signals detected in the offer text.";

  const safeActions = [
    "Ensure offer details (role, salary, start date) are correct.",
    "Keep a signed copy safely.",
    "Follow the agreed terms and notice period.",
  ];
  const fraudActions = [
    "Do NOT pay any money before joining.",
    "Do NOT share personal details.",
    "Verify company authenticity from official sources.",
  ];
  const cautionActions = [
    "Verify employer identity and official email domain.",
    "Avoid paying any fee before joining.",
    "Ask for clear notice period and termination terms.",
    "Get written clarification on bond or penalty clauses.",
  ];

  return {
    document_type: "Offer Letter",
    risk_level: riskLevel,
    decision,
    classification,
    key_warning: keyWarning,
    simple_explanation: simpleExplanation,
    smart_explanation: smartExplanation,
    detected_risks: detectedRisks,
    what_user_should_do:
      classification === "FRAUD"
        ? fraudActions
        : classification === "NORMAL"
        ? safeActions
        : cautionActions,
    law_reference: buildLawReferenceObjects(
      ["Indian Contract Act", "Relevant Labour Laws"],
      "Offer letters are contracts. Review unfair or payment-before-joining terms under contract and labour law."
    ),
    law_reference_explanation:
      "Offer letters are contracts. Unfair or payment-before-joining terms should be reviewed under contract and labour law.",
  };
}

function buildLegalAgreementAnalysis(documentText, languageInstruction) {
  const normalized = normalizeForMatching(documentText);
  const rawText = String(documentText || "");
  const isHinglish = languageInstruction.includes("Hinglish");

  const detectedRisks = [];
  let illegalClauseFound = false;

  if (/no\s+legal\s+action|no\s+right\s+to\s+sue|cannot\s+go\s+to\s+court|exclusive\s+jurisdiction|only\s+arbitration\s+and\s+no\s+court/i.test(normalized)) {
    illegalClauseFound = true;
    detectedRisks.push(
      createRisk(
        "Illegal Restriction",
        "Agreement restricts access to courts or legal remedies.",
        "HIGH",
        extractClauseSnippet(
          rawText,
          /no\s+legal\s+action|no\s+right\s+to\s+sue|cannot\s+go\s+to\s+court|exclusive\s+jurisdiction|only\s+arbitration\s+and\s+no\s+court/i
        )
      )
    );
  }

  if (/penalty|liquidated\s+damages|forfeit|cancellation\s+charge/i.test(normalized)) {
    const snippet = extractClauseSnippet(
      rawText,
      /penalty|liquidated\s+damages|forfeit|cancellation\s+charge/i
    );
    detectedRisks.push(
      createRisk(
        "Penalty Clause",
        snippet ? `Penalty clause found: "${snippet}"` : "Penalty clause detected.",
        "MEDIUM",
        snippet
      )
    );
  }

  if (/escalation|price\s+increase|cost\s+increase|rate\s+increase/i.test(normalized)) {
    detectedRisks.push(
      createRisk(
        "Cost Escalation",
        "Cost/price escalation clause detected.",
        "MEDIUM",
        extractClauseSnippet(rawText, /escalation|price\s+increase|cost\s+increase|rate\s+increase/i)
      )
    );
  }

  if (/delay|possession|handover|delivery\s+delay/i.test(normalized)) {
    detectedRisks.push(
      createRisk(
        "Delay Clause",
        "Delay or possession timeline clause detected.",
        "MEDIUM",
        extractClauseSnippet(rawText, /delay|possession|handover|delivery\s+delay/i)
      )
    );
  }

  const clauseRisks = detectClauseRisks(rawText);
  detectedRisks.push(...clauseRisks);
  const mergedRisks = dedupeDetectedRisks(detectedRisks);
  const balancedAgreement = detectBalancedAgreementSignals(normalized);

  const propertyKeywords = /builder|developer|rera|possession|allotment|flat|plot|sale\s+deed/i.test(
    normalized
  );

  let riskLevel = computeRiskLevelFromDetectedRisks(mergedRisks);
  let classification = riskLevel === "LOW" ? "NORMAL" : "UNFAIR";

  if (illegalClauseFound) {
    riskLevel = "HIGH";
    classification = "ILLEGAL";
  } else if (balancedAgreement && mergedRisks.length === 0) {
    riskLevel = "LOW";
    classification = "NORMAL";
  }

  const decision =
    classification === "ILLEGAL"
      ? "DO_NOT_SIGN"
      : classification === "UNFAIR"
      ? "REVIEW_CAUTION"
      : "SAFE_TO_USE";
  const keyWarning =
    classification === "ILLEGAL"
      ? "Agreement restricts legal remedies. Do not sign without legal review."
      : classification === "NORMAL"
      ? "This agreement appears balanced and does not contain major risks."
      : "This document contains one-sided clauses that may disadvantage you.";
  const simpleExplanation = "This is a legal agreement. Some clauses may be one-sided or risky.";
  const smartExplanation =
    classification === "ILLEGAL"
      ? "Clauses restricting court access can be unenforceable under Indian Contract Act Section 28."
      : classification === "NORMAL"
      ? "No strong unfair or risky clauses detected. The agreement appears balanced."
      : buildSmartExplanationFromRisks(mergedRisks, "Legal Agreement");

  const safeActions = [
    "Ensure details (rent, deposit, duration) are correct.",
    "Keep a signed copy safely.",
    "Follow the agreed terms.",
  ];
  const cautionActions = [
    "Review penalty, termination, and escalation clauses closely.",
    "Ask for clarifications on timelines and responsibilities.",
    "Negotiate one-sided terms if possible.",
    "Consult a legal expert before signing if risk is medium/high.",
  ];

  const lawReference = ["Indian Contract Act"];
  if (propertyKeywords) {
    lawReference.push("RERA Act");
  }

  return {
    document_type: "Legal Agreement",
    risk_level: riskLevel,
    decision,
    classification,
    key_warning: keyWarning,
    simple_explanation: simpleExplanation,
    smart_explanation: smartExplanation,
    detected_risks: mergedRisks,
    what_user_should_do: classification === "NORMAL" ? safeActions : cautionActions,
    law_reference: buildLawReferenceObjects(
      lawReference,
      "Legal agreements are governed by contract law; property agreements can also fall under RERA."
    ),
    law_reference_explanation:
      "Legal agreements are governed by contract law; property agreements can also fall under RERA.",
  };
}

function buildIdentityDocumentAnalysis(documentText, languageInstruction) {
  const isHinglish = languageInstruction.includes("Hinglish");

  return {
    document_type: "Identity Document",
    risk_level: "LOW",
    decision: "SAFE_TO_USE",
    classification: "NORMAL",
    key_warning: "Do not share ID numbers or OTPs unnecessarily.",
    simple_explanation: isHinglish
      ? "This appears to be an identity document. Share it only with trusted parties."
      : "This appears to be an identity document. Share it only with trusted parties.",
    smart_explanation:
      "Identity documents should be protected from unauthorized sharing or OTP requests.",
    detected_risks: [],
    what_user_should_do: [
      "Mask ID numbers before sharing.",
      "Avoid sharing OTPs or full ID details over chat or email.",
      "Store the document securely."
    ],
    law_reference: [],
    law_reference_explanation: "",
  };
}

function buildFinancialDocumentAnalysis(documentText, languageInstruction) {
  const normalized = normalizeForMatching(documentText);
  const isHinglish = languageInstruction.includes("Hinglish");
  const detectedRisks = [];

  if (/otp|cvv|password|upi\s*pin/i.test(normalized)) {
    detectedRisks.push(
      createRisk(
        "Personal Data Risk",
        "Document asks for OTP/CVV/password or UPI PIN.",
        "HIGH",
        extractClauseSnippet(String(documentText || ""), /otp|cvv|password|upi\s*pin/i)
      )
    );
  }

  const depositRiskLevel = getDepositRiskLevel(normalized);
  if (depositRiskLevel === "HIGH") {
    detectedRisks.push(
      createRisk(
        "Advance Payment Demand",
        "Non-refundable or advance payment required before service.",
        "HIGH",
        extractClauseSnippet(
          String(documentText || ""),
          /non[-\s]?refundable\s+deposit|deposit\s+is\s+non[-\s]?refundable|pay.*before\s+(?:service|joining|delivery|work|activation|possession)|advance\s+payment\s+(?:before|prior)\s+(?:service|joining|delivery|work|activation|possession)/i
        )
      )
    );
  }

  const hasHighRisk = detectedRisks.some((risk) => risk.level === "HIGH");
  const riskLevel = hasHighRisk ? "HIGH" : detectedRisks.length > 0 ? "MEDIUM" : "LOW";
  const hasSensitiveDataRisk = detectedRisks.some((risk) => /Personal Data Risk/i.test(risk.type));
  const classification = hasSensitiveDataRisk
    ? "FRAUD"
    : detectedRisks.length > 0
    ? "UNFAIR"
    : "NORMAL";
  const decision = decisionFromRisk(riskLevel);
  const keyWarning =
    classification === "FRAUD"
      ? "This document shows strong signs of a job scam. Do NOT pay any money or share personal details."
      : detectedRisks.length > 0
      ? "Financial document contains payment or sensitive data risks."
      : "Verify bank or financial details before action.";
  const simpleExplanation = isHinglish
    ? "This looks like a financial document. Do not share OTPs or sensitive details."
    : "This looks like a financial document. Do not share OTPs or sensitive details.";
  const hasDepositRisk = depositRiskLevel === "HIGH";
  const smartExplanation = hasSensitiveDataRisk
    ? "Sensitive data requests are a high-risk fraud signal in financial documents."
    : hasDepositRisk
    ? "Advance payment before service is a high-risk fraud indicator in financial documents."
    : "No strong fraud signals detected, but verify bank details independently.";

  return {
    document_type: "Financial Document",
    risk_level: riskLevel,
    decision,
    classification,
    key_warning: keyWarning,
    simple_explanation: simpleExplanation,
    smart_explanation: smartExplanation,
    detected_risks: detectedRisks,
    what_user_should_do: [
      "Verify account/beneficiary details independently.",
      "Never share OTP, CVV, or passwords.",
      "Confirm payment requests with official channels."
    ],
    law_reference: buildLawReferenceObjects(
      ["RBI Guidelines"],
      "RBI guidelines advise against sharing OTPs, CVV, or passwords and require safe banking practices."
    ),
    law_reference_explanation:
      "RBI guidelines advise against sharing OTPs, CVV, or passwords and require safe banking practices.",
  };
}

function buildOtherDocumentAnalysis(languageInstruction) {
  const isHinglish = languageInstruction.includes("Hinglish");

  return {
    document_type: "Other",
    risk_level: "LOW",
    decision: "SAFE_TO_USE",
    classification: "NORMAL",
    key_warning: "This document appears informational, not a legal or actionable document.",
    simple_explanation: isHinglish
      ? "This document is not a legal or actionable document. It appears informational."
      : "This document is not a legal or actionable document. It appears informational.",
    smart_explanation:
      "The document does not match legal, offer, ticket, identity, or financial patterns.",
    detected_risks: [],
    what_user_should_do: [
      "If you expected a legal document, verify the source.",
      "Share only with trusted parties if it contains personal data."
    ],
    law_reference: [],
    law_reference_explanation: "",
  };
}

function routeDocumentAnalysis(documentTypeKey, documentText, languageInstruction) {
  switch (documentTypeKey) {
    case "ticket":
      return buildTicketAnalysis(documentText, languageInstruction);
    case "offer_letter":
      return buildOfferLetterAnalysis(documentText, languageInstruction);
    case "legal_agreement":
      return buildLegalAgreementAnalysis(documentText, languageInstruction);
    case "identity_document":
      return buildIdentityDocumentAnalysis(documentText, languageInstruction);
    case "financial_document":
      return buildFinancialDocumentAnalysis(documentText, languageInstruction);
    default:
      return buildOtherDocumentAnalysis(languageInstruction);
  }
}

function applyHybridHintsToAnalysis(analysis, hints, documentTypeKey) {
  const updated = { ...analysis };
  const detectedRisks = [...(updated.detected_risks || [])];
  let warningOverride = "";

  if (hints.depositRiskLevel === "HIGH") {
    detectedRisks.push(
      createRisk(
        "Advance Payment Demand",
        "Non-refundable or advance payment required before service.",
        "HIGH"
      )
    );
    warningOverride =
      warningOverride || "Advance payment before service is a strong fraud indicator.";
    if (updated.risk_level !== "HIGH") {
      updated.risk_level = "HIGH";
    }
  }

  if (hints.legalHint && documentTypeKey === "other") {
    detectedRisks.push(
      createRisk(
        "Legal Terminology Detected",
        "Terms like agreement or clause appear in the document.",
        "MEDIUM"
      )
    );
    warningOverride = warningOverride || "Legal terms detected. Review if rights or payments are involved.";
    if (updated.risk_level === "LOW") {
      updated.risk_level = "MEDIUM";
    }
  }

  updated.detected_risks = detectedRisks;
  updated.decision = decisionFromRisk(updated.risk_level);
  if (warningOverride) {
    updated.key_warning = warningOverride;
  }
  return updated;
}

function buildStructuredPipelineOutput({
  analysis,
  documentTypeLabel,
  confidenceScore,
}) {
  const resolvedDecision = analysis.decision || decisionFromRisk(analysis.risk_level);
  const warnings = [];
  if (analysis.key_warning) {
    warnings.push(analysis.key_warning);
  }
  const detectedRisks = Array.isArray(analysis.detected_risks) ? analysis.detected_risks : [];
  const topRisks = buildTopRisks(detectedRisks);
  const lawReferenceObjects = Array.isArray(analysis.law_reference)
    ? analysis.law_reference
    : buildLawReferenceObjects(
        analysis.law_reference || [],
        analysis.law_reference_explanation
      );

  return {
    document_type: documentTypeLabel,
    classification: analysis.classification || "NORMAL",
    decision: resolvedDecision,
    risk_level: analysis.risk_level,
    confidence_score: confidenceScore,
    key_warning: analysis.key_warning,
    simple_explanation: analysis.simple_explanation,
    smart_explanation: analysis.smart_explanation,
    top_risks: topRisks,
    detected_risks: detectedRisks,
    what_user_should_do: analysis.what_user_should_do || [],
    law_reference: lawReferenceObjects,
  };
}

function buildLegacyRisksFromDetected(risks, riskLevel) {
  if (!Array.isArray(risks)) {
    return [];
  }

  const severity = riskLevel === "HIGH" ? "HIGH" : riskLevel === "MEDIUM" ? "MEDIUM" : "LOW";
  return risks.map((risk) => ({
    clause: risk.type || "Risk",
    severity: risk.level || severity,
    reason: [risk.reason, risk.snippet].filter(Boolean).join(" ").trim(),
  }));
}

function buildEmptyPipelineResult(documentText, languageInstruction) {
  const analysis = buildOtherDocumentAnalysis(languageInstruction);
  analysis.risk_level = "LOW";
  analysis.decision = "REVIEW_CAUTION";
  analysis.key_warning = "Insufficient text extracted. Please upload a clearer document.";
  analysis.simple_explanation = "Text extraction is too small. Please upload a clearer document.";

  return analysis;
}

async function analyzeDocument(documentText, options = {}) {
  const rawText = String(options.rawText || documentText || "");
  const maskedText = String(documentText || "");
  const cleanedMaskedText = cleanExtractedText(maskedText);
  const resolvedLanguage = ensureSupportedLanguage(options.language);
  const languageInstruction = getLanguageInstruction(resolvedLanguage);
  console.log(
    `[aiService] analyzeDocument language raw="${options.language}" resolved="${resolvedLanguage}" instruction="${languageInstruction}"`
  );

  if (!cleanedMaskedText || cleanedMaskedText.length < 20) {
    const analysis = buildEmptyPipelineResult(rawText, languageInstruction);
    const structured = buildStructuredPipelineOutput({
      analysis,
      documentTypeLabel: "Other",
      confidenceScore: 0,
    });
    const localizedStructured = await translateStructuredOutput(structured, resolvedLanguage);
    const legacyRisks = buildLegacyRisksFromDetected(
      localizedStructured.detected_risks,
      localizedStructured.risk_level
    );
    return {
      documentType: "Other",
      detectedType: "other",
      summary: localizedStructured.simple_explanation || localizedStructured.key_warning,
      structured: localizedStructured,
      legacyRisks,
      risks: legacyRisks,
      chunksProcessed: 1,
      contextUsed: false,
      contextCount: 0,
      totalRisksFound: legacyRisks.length,
    };
  }

  let classification;
  try {
    classification = await classifyDocumentWithGemini(cleanedMaskedText);
  } catch (error) {
    console.error("[aiService] Gemini classification failed:", error.message);
    classification = {
      document_type: "Other",
      confidence: 0,
      reason: "Classification unavailable",
    };
  }

  let documentTypeLabel = classification.document_type || "Other";
  let documentTypeKey = documentTypeLabelToKey(documentTypeLabel);
  const initialConfidence = computeConfidenceScore(
    classification.confidence,
    cleanedMaskedText,
    documentTypeKey
  );

  if (initialConfidence < 50) {
    documentTypeLabel = "Other";
    documentTypeKey = "other";
  }

  const analysisBase = routeDocumentAnalysis(
    documentTypeKey,
    rawText || cleanedMaskedText,
    languageInstruction
  );
  const hints = detectHybridHints(rawText || cleanedMaskedText);
  const analysis = applyHybridHintsToAnalysis(analysisBase, hints, documentTypeKey);
  if (Array.isArray(analysis.detected_risks)) {
    analysis.detected_risks = dedupeDetectedRisks(analysis.detected_risks);
    analysis.risk_level = computeRiskLevelFromDetectedRisks(analysis.detected_risks);
  }
  const confidenceScore = computeConfidenceScore(
    classification.confidence,
    cleanedMaskedText,
    documentTypeKey
  );

  let structured = buildStructuredPipelineOutput({
    analysis,
    documentTypeLabel,
    confidenceScore,
  });

  if (classification.reason) {
    structured.smart_explanation = `${structured.smart_explanation} Classification reason: ${classification.reason}`;
  }

  if (initialConfidence < 50) {
    structured.smart_explanation = `${structured.smart_explanation} Confidence is low, so the document is treated as Other.`;
  }

  const localizedStructured = await translateStructuredOutput(structured, resolvedLanguage);
  const legacyRisks = buildLegacyRisksFromDetected(
    localizedStructured.detected_risks,
    localizedStructured.risk_level
  );
  logPipeline("classification", {
    documentTypeLabel,
    confidence: classification.confidence,
    reason: classification.reason,
  });
  logPipeline("routing", {
    documentTypeKey,
    riskLevel: structured.risk_level,
    decision: structured.decision,
  });
  logPipeline("hybrid", { hints, riskLevel: structured.risk_level });

  return {
    documentType: documentTypeLabel,
    detectedType: documentTypeKey,
    summary: localizedStructured.simple_explanation || localizedStructured.smart_explanation,
    structured: localizedStructured,
    legacyRisks,
    risks: legacyRisks,
    chunksProcessed: 1,
    contextUsed: false,
    contextCount: 0,
    totalRisksFound: legacyRisks.length,
  };
}

function shouldUseLegalDatasetForQuery(queryText) {
  return /\b(rule|rules|legal|law|agreement|license|fir|penalty|property|ticket|traffic|notice)\b/i.test(
    queryText
  );
}

function normalizeQueryAnalysis(rawAnalysis = {}) {
  return {
    topic: flattenObjectToString(rawAnalysis.topic || "Legal Guidance"),
    simple_explanation: flattenObjectToString(
      rawAnalysis.simple_explanation || "Basic legal guidance is available."
    ),
    rules: normalizeStringArray(rawAnalysis.rules),
    penalties: normalizeStringArray(rawAnalysis.penalties),
    user_guidance: normalizeStringArray(rawAnalysis.user_guidance),
  };
}

async function analyzeLegalQuery(queryText, options = {}) {
  if (!queryText || !queryText.trim()) {
    throw new Error("Query text cannot be empty");
  }

  const cleanedQuery = queryText.trim();
  const resolvedLanguage = ensureSupportedLanguage(options.language);
  const languageInstruction = getLanguageInstruction(resolvedLanguage);
  console.log(
    `[aiService] analyzeLegalQuery language raw="${options.language}" resolved="${resolvedLanguage}" instruction="${languageInstruction}"`
  );
  const rag = shouldUseLegalDatasetForQuery(cleanedQuery)
    ? await retrieveLegalContext(cleanedQuery, "legal")
    : { context: "", contextUsed: false, contextCount: 0 };

  try {
    let rawAnalysis = await generateStructuredJson(
      buildQueryPrompt({
        query: cleanedQuery,
        context: rag.context,
        languageInstruction,
      })
    );
    const requiredTokens = extractNumericTokens(cleanedQuery);
    const rawText = JSON.stringify(rawAnalysis);
    const needsRetry =
      isLanguageMismatch(rawText, resolvedLanguage) ||
      isMixedLanguage(rawText, resolvedLanguage) ||
      hasPlaceholders(rawText) ||
      hasMissingNumericTokens(rawText, requiredTokens);

    if (needsRetry) {
      console.warn("[aiService] Query language mismatch detected. Retrying with strict language enforcement.");
      const strictInstruction = `${languageInstruction} IMPORTANT: Respond ONLY in the specified language.`;
      rawAnalysis = await generateStructuredJson(
        buildQueryPrompt({
          query: cleanedQuery,
          context: rag.context,
          languageInstruction: strictInstruction,
        })
      );
    }

    const retryText = JSON.stringify(rawAnalysis);
    const stillBad =
      isLanguageMismatch(retryText, resolvedLanguage) ||
      isMixedLanguage(retryText, resolvedLanguage) ||
      hasPlaceholders(retryText) ||
      hasMissingNumericTokens(retryText, requiredTokens);

    if (stillBad) {
      console.warn("[aiService] Query language mismatch after retry; falling back to English output.");
      rawAnalysis = await generateStructuredJson(
        buildQueryPrompt({
          query: cleanedQuery,
          context: rag.context,
          languageInstruction: getLanguageInstruction("en"),
        })
      );
    }

    return {
      ...normalizeQueryAnalysis(rawAnalysis),
      contextUsed: rag.contextUsed,
      contextCount: rag.contextCount,
    };
  } catch (error) {
    console.error("[aiService] Error in analyzeLegalQuery:", error.message);
    throw new Error(`Gemini API error: ${error.message}`);
  }
}

function buildFirPrompt(userInput, language) {
  const resolvedLanguage = ensureSupportedLanguage(language);
  const languageLabel = getLanguageLabel(resolvedLanguage).toUpperCase();
  return `You are an experienced Indian legal assistant trained in drafting FIRs and complaints used in real police stations and by advocates in India.

This is a generation task. Do NOT ask questions. Do NOT request missing data.

Language preference: ${languageLabel}. You MUST respond only in this language for the FIR body. Keep law names in English. Keep the Request sentence in English exactly.

Critical legal corrections (mandatory):
- NEVER use the words "refund", "recover", "recovery", "facilitate refund", or "return my money" anywhere.
- Subject line must be: "Complaint regarding [issue]" and must not mention refund or recovery.
- The Request section must use this exact sentence only:
"I kindly request you to register my complaint and investigate the matter. If any misuse or criminal activity is found, kindly take appropriate legal action."

Core rule:
You MUST dynamically adapt the FIR based on case type. Do NOT include irrelevant sections.
Each FIR must be unique and context-aware. Do NOT reuse generic sentences.

Case rules (apply only what is relevant):
1) Theft: Title "Complaint Regarding Theft of [item]", include item details, location, time, registration number if vehicle; law IPC 379; no bank/UPI steps.
2) Money transfer mistake: Title "Complaint Regarding Mistaken Fund Transfer", include transaction details, law IPC 403 + IT Act; include bank/UPI step; no theft language.
3) Assault/harassment: Title "Complaint Regarding Assault and Threat", include incident and accused details; laws IPC 323, IPC 352, IPC 506; no transaction/bank steps.
4) Accident/rash driving: Title "Complaint Regarding Rash Driving and Assault", include vehicle details, damage, number plate; laws IPC 279, IPC 323, IPC 506.
5) Lost item: Title "Complaint Regarding Lost [item]", include where it was kept and when it was noticed missing; law IPC 403.
6) Property issue: Include property/payment details; laws RERA Act + Indian Contract Act as applicable.
7) Employment issue: Include employer details and timeline; laws Labour Laws.

If any information is missing, use fillable fields like:
Name: __________
Address: __________

Output rules:
Use clean plain text only. Do NOT use markdown, separators, or artificial headings. Keep the tone human and practical.

Smart case detection (adapt FIR accordingly):
Theft/Lost Property (IPC 379/IPC 403), Fraud/Cheating (IPC 420), Breach of Trust (IPC 406), Cyber Fraud (IT Act + IPC), Job Scam, Property/Builder Issue (RERA + Contract Act), Harassment/Threat, Salary/Employment Issue (Labour Laws).
If uncertain, write: Possible sections may include...

Follow this format strictly:

Title:
Complaint Regarding [Issue Type]

To,
The Station House Officer (SHO)
[Police Station Name]
[City]

Date: __________
Place: __________

Subject:
Complaint regarding [brief issue]

Respected Sir/Madam,

I, __________, residing at __________, would like to report the following:

Explain clearly:
what happened
when
where
what loss occurred

Include naturally: Due to this situation, I am facing financial loss and mental stress.

Add only relevant details based on case:
If financial/cyber case, include Transaction Details:
Transaction ID: __________
Bank/UPI: __________
Amount: __________
Date/Time: __________

If mobile/device lost:
Device Model: __________
IMEI: __________

If property case:
Property details and payment history.

Legal Grounds:
Possible sections may include:
* IPC 403 (Dishonest Misappropriation of Property): If the receiver knowingly keeps the money without returning it.
* IT Act: If the issue involves digital transaction misuse.

Modify or add relevant laws based on the case (IPC 420, IPC 406, IPC 379, RERA Act, Labour Laws) if applicable.

Request:
I kindly request you to register my complaint and investigate the matter. If any misuse or criminal activity is found, kindly take appropriate legal action.

Closing:
Thanking you,

Yours faithfully,
[Name: __________]
[Contact Number: __________]

Signature: __________

Suggested Actions:
* Visit nearest police station
* Carry relevant proof (documents/screenshots)
* Keep ID proof ready
* Immediately report the issue to your bank or UPI app

Important Notes:
FIR registration depends on police verification.
Some cases may be civil in nature.
You may approach higher authorities if FIR is not registered.

User Input:
${userInput}`;
}

function detectFirCase(userInput) {
  const normalized = normalizeForMatching(userInput || "");

  if (/upi|transaction|fund\s+transfer|imps|neft|rtgs|bank\s+transfer|money\s+transfer|mistaken\s+transfer/i.test(normalized)) {
    return "money_transfer";
  }
  if (/theft|stolen|robbed|steal|burglary/i.test(normalized)) {
    return "theft";
  }
  if (/lost|missing|misplaced/i.test(normalized)) {
    return "lost_item";
  }
  if (/assault|attack|harass|threat|abuse|intimidat|molest/i.test(normalized)) {
    return "assault";
  }
  if (/accident|rash\s+driving|hit\s+and\s+run|collision/i.test(normalized)) {
    return "accident";
  }
  if (/builder|property|flat|plot|developer|rera|possession|handover/i.test(normalized)) {
    return "property";
  }
  if (/job|offer|employment|salary|company|hr|recruit/i.test(normalized)) {
    return "job";
  }
  if (/fraud|scam|cheat|cheated|fake/i.test(normalized)) {
    return "fraud";
  }

  return "general";
}

function buildFirFallback(userInput) {
  const caseType = detectFirCase(userInput);
  const incidentText = userInput || "The incident details are not fully available in this draft.";

  const baseHeader = (subjectLine) => `To,
The Station House Officer (SHO)
[Police Station Name]
[City]

Date: __________
Place: __________

Subject:
${subjectLine}

Respected Sir/Madam,

I, __________, residing at __________, would like to report the following:

${incidentText}

Due to this situation, I am facing financial loss and mental stress.
`;

  const requestBlock = `Request:
I kindly request you to register my complaint and investigate the matter. If any misuse or criminal activity is found, kindly take appropriate legal action.
`;

  const closingBlock = `Closing:
Thanking you,

Yours faithfully,
[Name: __________]
[Contact Number: __________]

Signature: __________

Important Notes:
FIR registration depends on police verification.
Some cases may be civil in nature.
You may approach higher authorities if FIR is not registered`;

  if (caseType === "theft") {
    return `Title:
Complaint Regarding Theft of [item]

  ${baseHeader("Complaint regarding theft of property")}
Item details: __________
Location: __________
Date/Time: __________
If vehicle: Registration Number: __________

Legal Grounds:
IPC 379 (Theft): Taking property without permission

${requestBlock}
Suggested Actions:
* Visit nearest police station
* Carry relevant proof (documents/screenshots)
* Keep ID proof ready

${closingBlock}`;
  }

  if (caseType === "lost_item") {
    return `Title:
Complaint Regarding Lost [item]

  ${baseHeader("Complaint regarding lost property")}
Item details: __________
Last seen at: __________
Date/Time: __________
If mobile/device: Device Model: __________, IMEI: __________

Legal Grounds:
IPC 403 (Misappropriation): Keeping property dishonestly

${requestBlock}
Suggested Actions:
* Visit nearest police station
* Carry relevant proof (documents/screenshots)
* Keep ID proof ready

${closingBlock}`;
  }

  if (caseType === "money_transfer") {
    return `Title:
Complaint Regarding Mistaken Fund Transfer

  ${baseHeader("Complaint regarding mistaken fund transfer")}
Transaction Details:
* Transaction ID: __________
* Bank/UPI: __________
* Amount: __________
* Date/Time: __________

Legal Grounds:
Possible sections may include:
* IPC 403 (Dishonest Misappropriation of Property): If the receiver knowingly keeps the money without returning it.
* IT Act: If the issue involves digital transaction misuse.

${requestBlock}
Suggested Actions:
* Visit nearest police station
* Carry relevant proof (documents/screenshots)
* Keep ID proof ready
* Immediately report the issue to your bank or UPI app

${closingBlock}`;
  }

  if (caseType === "assault") {
    return `Title:
Complaint Regarding Assault and Threat

  ${baseHeader("Complaint regarding assault and threat")}
Accused details (if known): __________
Location: __________
Date/Time: __________

Legal Grounds:
IPC 323 (Voluntarily causing hurt)
IPC 352 (Assault or criminal force)
IPC 506 (Criminal intimidation)

${requestBlock}
Suggested Actions:
* Visit nearest police station
* Carry relevant proof (medical report, messages)
* Keep ID proof ready

${closingBlock}`;
  }

  if (caseType === "accident") {
    return `Title:
Complaint Regarding Rash Driving and Assault

  ${baseHeader("Complaint regarding rash driving and assault")}
Vehicle details: __________
Number plate: __________
Damage details: __________
Location: __________
Date/Time: __________

Legal Grounds:
IPC 279 (Rash driving)
IPC 323 (Voluntarily causing hurt)
IPC 506 (Criminal intimidation)

${requestBlock}
Suggested Actions:
* Visit nearest police station
* Carry relevant proof (photos, medical report)
* Keep ID proof ready

${closingBlock}`;
  }

  if (caseType === "property") {
    return `Title:
Complaint Regarding Property Dispute

  ${baseHeader("Complaint regarding property dispute")}
Property details: __________
Payment details: __________

Legal Grounds:
RERA Act: For builder/property issues
Indian Contract Act: For agreement-related obligations

${requestBlock}
Suggested Actions:
* Visit nearest police station
* Carry relevant proof (documents, receipts)
* Keep ID proof ready

${closingBlock}`;
  }

  if (caseType === "job") {
    return `Title:
Complaint Regarding Job Scam

  ${baseHeader("Complaint regarding job scam")}
Company/HR details: __________
Offer details: __________
Payment details (if any): __________

Legal Grounds:
IPC 420 (Cheating): When someone deceives and causes financial loss
Labour Laws: For job/salary issues

${requestBlock}
Suggested Actions:
* Visit nearest police station
* Carry relevant proof (emails, messages, receipts)
* Keep ID proof ready

${closingBlock}`;
  }

  if (caseType === "fraud") {
    return `Title:
Complaint Regarding Fraud and Cheating

  ${baseHeader("Complaint regarding fraud and cheating")}
Payment details (if any): __________
Mode of payment: __________
Date/Time: __________

Legal Grounds:
IPC 420 (Cheating): When someone deceives and causes financial loss
IT Act: For cyber fraud or digital misuse

${requestBlock}
Suggested Actions:
* Visit nearest police station
* Carry relevant proof (documents/screenshots)
* Keep ID proof ready
* Immediately report the issue to your bank or UPI app

${closingBlock}`;
  }

  return `Title:
Complaint Regarding Incident

${baseHeader("Complaint regarding the incident")}
Legal Grounds:
Possible sections may include relevant IPC sections based on the facts.

${requestBlock}
Suggested Actions:
* Visit nearest police station
* Carry relevant proof (documents/screenshots)
* Keep ID proof ready

${closingBlock}`;
}

function sanitizeFirOutput(rawText) {
  if (!rawText) {
    return rawText;
  }

  let cleaned = String(rawText);
  cleaned = cleaned.replace(/return\s+my\s+money/gi, "address this matter");
  cleaned = cleaned.replace(/facilitate\s+refund/gi, "appropriate legal action");
  cleaned = cleaned.replace(/refund|recover|recovery/gi, "appropriate legal action");

  cleaned = cleaned.replace(/Complaint regarding the issue/gi, "Complaint regarding the matter");

  cleaned = cleaned.replace(
    /Request:[\s\S]*?(?=\n\nClosing:|\nClosing:|\n\nSuggested Actions:|\nSuggested Actions:|\n\nImportant Notes:|\nImportant Notes:|$)/i,
    "Request:\nI kindly request you to register my complaint and investigate the matter. If any misuse or criminal activity is found, kindly take appropriate legal action.\n"
  );

  return cleaned;
}

async function generateFirDraft(userInput, options = {}) {
  const cleanedInput = String(userInput || "").trim();
  if (!cleanedInput) {
    throw new Error("User input is required");
  }

  const resolvedLanguage = ensureSupportedLanguage(options.language);
  const languageInstruction = getLanguageInstruction(resolvedLanguage);
  console.log(
    `[aiService] generateFirDraft language raw="${options.language}" resolved="${resolvedLanguage}" instruction="${languageInstruction}"`
  );
  const prompt = buildFirPrompt(cleanedInput, resolvedLanguage);

  try {
    let result = await generateContentWithFallback(prompt);
    let responseText = result.response.text().trim();

    if (isLanguageMismatch(responseText, resolvedLanguage) || isMixedLanguage(responseText, resolvedLanguage)) {
      console.warn(
        "[aiService] FIR language mismatch detected. Retrying with strict language enforcement."
      );
      const strictPrompt = `${prompt}\n\nIMPORTANT: Respond ONLY in ${resolvedLanguage.toUpperCase()} as specified. Do not use any other language.`;
      result = await generateContentWithFallback(strictPrompt);
      responseText = result.response.text().trim();
    }

    return sanitizeFirOutput(responseText);
  } catch (error) {
    console.error("[aiService] FIR generation failed:", error.message);
    return sanitizeFirOutput(buildFirFallback(cleanedInput));
  }
}

async function extractTextFromDocx(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  const extractedText = result.value.trim();

  if (!extractedText || extractedText.length < 20) {
    throw new Error("Unable to extract sufficient text from DOCX file.");
  }

  return {
    text: extractedText,
    method: "mammoth-docx",
    warnings: result.messages || [],
  };
}

export {
  analyzeDocument,
  analyzeLegalQuery,
  chunkText,
  detectDocumentType,
  extractTextFromDocx,
  generateFirDraft,
  extractNumericTokens,
  hasMissingNumericTokens,
  hasPlaceholders,
  isLanguageMismatch,
  isMixedLanguage,
  parseJSONResponse,
  removeMarkdownFormatting,
  translateStructuredOutput,
};
