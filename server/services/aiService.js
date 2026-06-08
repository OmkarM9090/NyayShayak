import mammoth from "mammoth";
import { geminiModel, genAI } from "../config/gemini.js";
import {
  ensureSupportedLanguage,
  getLanguageInstruction,
  getLanguageLabel,
} from "../config/languages.js";
import {
  buildContextString,
  getLegalContextFromRAG,
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
  const isRetryableStatus = RETRYABLE_STATUS_CODES.some((code) => message.includes(`[${code}`));
  return isRetryableStatus || /service unavailable|high demand|temporar|try again later|rate limit/i.test(message);
}

function isModelUnavailableError(error) {
  const message = String(error?.message || "");
  return /not found|not available|invalid model/i.test(message);
}

async function generateContentWithFallback(prompt, systemInstruction = null) {
  let lastError = null;
  const modelsToTry = [geminiModel.model, ...FALLBACK_MODELS];
  const uniqueModels = [...new Set(modelsToTry)];

  for (const modelName of uniqueModels) {
    let attempts = 0;
    while (attempts < MAX_RETRY_ATTEMPTS) {
      try {
        const currentModel = genAI.getGenerativeModel({
          model: modelName,
          ...(systemInstruction ? { systemInstruction } : {}),
        });
        const result = await currentModel.generateContent(prompt);
        if (result && result.response) return result;
        throw new Error("Empty execution slice returned from model endpoint.");
      } catch (error) {
        lastError = error;
        attempts++;
        if (attempts < MAX_RETRY_ATTEMPTS && isRetryableGeminiError(error)) {
          await sleep(attempts * 1500);
          continue;
        }
        break;
      }
    }
    if (!isModelUnavailableError(lastError) && !isRetryableGeminiError(lastError)) break;
  }
  throw lastError || new Error("All generative multi-agent fallback allocations failed context generation.");
}

export function chunkText(text, maxLength = 12000) {
  if (!text) return [];
  const chunks = [];
  let index = 0;
  while (index < text.length) {
    chunks.push(text.substring(index, index + maxLength));
    index += maxLength;
  }
  return chunks;
}

function removeMarkdownFormatting(text) {
  if (!text) return "";
  return text.replace(/```json/gi, "").replace(/```/g, "").trim();
}

function parseJSONResponse(responseText) {
  const cleanedText = removeMarkdownFormatting(responseText);
  try {
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error("[aiService Parse Collision Fail]: Malformed JSON strings caught:", error.message);
    return {
      summary: "Error compilation runtime blocks parsing exception.",
      risks: [{ clause: "Diagnostic Block", severity: "MEDIUM", reason: "Automated compiler matrix alignment failed." }]
    };
  }
}

// FIXED NAMED EXPORT DECLARATION - Resolves the Node.js named export crash loop instantly
export async function analyzeDocument(documentText, arg2 = [], arg3 = "en") {
  try {
    if (!documentText || !documentText.trim()) {
      throw new Error("No data content sequence delivered onto structural audit agents.");
    }

    let retrievedReferences = [];
    let languageCode = "en";

    if (Array.isArray(arg2)) {
      retrievedReferences = arg2;
      languageCode = arg3 || "en";
    } else if (arg2 && typeof arg2 === "object") {
      languageCode = arg2.language || "en";
      try {
        retrievedReferences = await getLegalContextFromRAG(documentText);
      } catch (e) {
        console.error("[aiService] Error fetching RAG context in fallback signature:", e.message);
      }
    }

    const formattedRagContext = buildContextString(retrievedReferences);
    
    const languageLabelMap = {
      en: "English",
      hi: "Hindi (हिन्दी)",
      mr: "Marathi (मराठी)",
      hinglish: "Hinglish (Hindi localized sentences fully written using plain Latin/English layout alphabets)",
      gu: "Gujarati",
      ta: "Tamil",
      te: "Telugu",
      kn: "Kannada",
      bn: "Bengali"
    };

    const targetLanguageLabel = languageLabelMap[languageCode] || "English";
    console.log(`[aiService Room] Accelerating semantic prompts logic inside model room for language mapping: ${targetLanguageLabel.toUpperCase()}`);

    const prompt = `
You are an Elite Multilingual Legal Counsel and Expert Contract Risk Auditor specializing in high-performance contract mapping compliance. Analyze the text below for asymmetric operational liabilities, hidden termination penalties, or non-standard toxic terms.

SYSTEM LEGAL BASAL REFERENCE CLAUSES (BACKGROUND RAG CONTEXTS):
Use these retrieved standard reference baseline items to cross-verify if the uploaded document text deviates from safe standard contract practices:
${formattedRagContext || "No additional standard base records available for comparative alignment indices matching."}

UPLOADED CLIENT CONTRACT COMPREHENSIVE TEXT EXCERPT FOR AUDIT:
${documentText}

CRITICAL MANDATORY INSTRUCTIONS FOR TARGET LOCALIZATION OUTPUT RENDER:
1. You MUST generate the text outputs for the JSON properties "summary" and "reason" COMPLETELY and FLUENTLY in the target language specified: ${targetLanguageLabel.toUpperCase()}.
2. If the language target parameter code is MARATHI (mr), write the summary and reasons completely in pure administrative fluent Marathi script. If HINDI (hi), write fully in Hindi. If HINGLISH, write in conversational romanized phonetic Hindi using standard English character sets.
3. You MUST return ONLY a strictly valid serializable JSON object matching the architecture footprint layout pattern below. Do not output markdown code blocks (\`\`\`json), system thought notes, or trailing commentary strings.

REQUIRED BLUEPRINT OUTPUT JSON PATTERN FORMAT:
{
  "summary": "Provide a clean, comprehensive high-level executive brief outlining overall safety posture of the contract written completely in ${targetLanguageLabel}.",
  "risks": [
    {
      "clause": "Name or short text snippet citation quote of the problematic section isolated from client input",
      "severity": "HIGH" or "MEDIUM" or "LOW",
      "reason": "Detailed algorithmic legal argument explaining why this breaks compliance benchmarks written fully in ${targetLanguageLabel}."
    }
  ],
  "totalRisksFound": 0
}
`;

  const systemInstruction = `You are a strict automated legal data serialization pipeline agent. Your output loops convert input textual components into verified schema compliant serializable JSON payloads only. Never output raw Markdown syntax wrappers or standard chat text replies.`;
  const result = await generateContentWithFallback(prompt, systemInstruction);
  const rawResponse = result.response.text();

  const parsedAnalysis = parseJSONResponse(rawResponse);
  parsedAnalysis.totalRisksFound = parsedAnalysis.risks ? parsedAnalysis.risks.length : 0;
  
  return parsedAnalysis;

  } catch (error) {
    console.error("[aiService Core Subsystem Error] ❌:", error.message);
    throw error;
  }
}

export async function detectDocumentType(text) {
  try {
    const prompt = `Analyze this text excerpt and identify the legal document category (e.g., Rental Agreement, Employment Contract, Non-Disclosure Agreement, Affidavit, General Power of Attorney, Bill of Sale, or Unknown).\n\nText:\n${text.substring(0, 3000)}\n\nRespond with ONLY the category name.`;
    const result = await generateContentWithFallback(prompt);
    return result.response.text().trim();
  } catch (error) {
    return "Unknown";
  }
}

export async function analyzeLegalQuery(query, documentContext = "") {
  try {
    const prompt = `Context Document Excerpt:\n${documentContext.substring(0, 8000)}\n\nUser Query: ${query}\n\nProvide an expert, professional, easy to understand legal clarification.`;
    const result = await generateContentWithFallback(prompt);
    return result.response.text().trim();
  } catch (error) {
    return "The assistant encountered an obstacle processing your legal query.";
  }
}

export async function extractTextFromDocx(filePath) {
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

export async function generateFirDraft(userInput, options = {}) {
  try {
    const languageCode = options.language || "en";
    const languageLabelMap = {
      en: "English",
      hi: "Hindi (हिन्दी)",
      mr: "Marathi (मराठी)",
      hinglish: "Hinglish (Hindi localized sentences fully written using plain Latin/English layout alphabets)",
      gu: "Gujarati",
      ta: "Tamil",
      te: "Telugu",
      kn: "Kannada",
      bn: "Bengali"
    };
    const targetLanguageLabel = languageLabelMap[languageCode] || "English";
    
    console.log(`[aiService] Generating FIR Draft | Language: ${targetLanguageLabel.toUpperCase()}`);

    const prompt = `
You are an expert Indian Police officer and Senior Legal Counsel specializing in drafting First Information Reports (FIRs) and police complaints.
Draft a professional, structured FIR complaint based on the incident description below.

INCIDENT DESCRIPTION:
${userInput}

CRITICAL MANDATORY INSTRUCTIONS:
1. You MUST write the FIR content COMPLETELY and FLUENTLY in the target language: ${targetLanguageLabel.toUpperCase()}.
2. If MARATHI (mr) is selected, write fully in Marathi script. If HINDI (hi), write fully in Hindi. If HINGLISH, write in Romanized Hindi.
3. The format of the complaint should be structured:
   - Section 1: Receiver Details (e.g., To, The Station House Officer / Police Station Head)
   - Subject line summarizing the complaint (e.g., Complaint regarding theft of mobile phone)
   - Section 2: Subject Summary
   - Section 3: Complainant Details (Name, Address)
   - Section 4: Accused Details (If known, else state Unknown)
   - Section 5: Date, Time & Place of Occurrence
   - Section 6: Detailed Description of the Incident
   - Section 7: Legal request for action (Request to register FIR and investigate under relevant laws)
   - Section 8: Signature / Date Placeholders
4. Do NOT output markdown code blocks (\`\`\`json or \`\`\`), HTML tags, or system thought notes. Just return the raw text of the complaint.
`;

    const result = await generateContentWithFallback(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error("[aiService] FIR drafting failed:", error.message);
    throw error;
  }
}