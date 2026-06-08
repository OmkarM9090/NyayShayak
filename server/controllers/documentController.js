import fs from "fs";
import { createRequire } from "module";
import { createWorker } from "tesseract.js";
import Analysis from "../models/Analysis.js";
import {
  analyzeDocument,
  analyzeLegalQuery,
  detectDocumentType,
  extractTextFromDocx,
} from "../services/aiService.js";
import { maskSensitiveData } from "../utils/dataMasking.js";
import { decryptData, encryptData } from "../utils/cryptoUtils.js";
import { ensureSupportedLanguage } from "../config/languages.js";
import { checkAndIncrementGuestUsage } from "../utils/guestLimits.js";
import { resolveMode, resolveRequestIdentity } from "../utils/requestIdentity.js";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");
async function extractTextFromPDF(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const pdfData = await pdf(dataBuffer);
  const extractedText = pdfData.text.trim();

  if (!extractedText || extractedText.length < 30) {
    throw new Error("PDF appears to be scanned. Use OCR for image-based PDFs.");
  }

  return {
    text: extractedText,
    pages: pdfData.numpages,
    method: "pdf-parse",
  };
}

async function extractTextFromImage(filePath) {
  const worker = await createWorker("eng");

  try {
    const { data } = await worker.recognize(filePath);
    const extractedText = data.text.trim();

    if (!extractedText || extractedText.length < 20) {
      throw new Error(
        "Unable to extract sufficient text from image. Image may be too blurry or contain no text."
      );
    }

    return {
      text: extractedText,
      confidence: data.confidence,
      method: "tesseract-ocr",
    };
  } finally {
    await worker.terminate();
  }
}

function cleanupUploadedFile(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      console.error("[documentController] Cleanup failed:", error.message);
    }
  }
}

function buildRiskStatistics(risks = []) {
  return {
    total: risks.length,
    high: risks.filter((risk) => risk.severity === "HIGH").length,
    medium: risks.filter((risk) => risk.severity === "MEDIUM").length,
    low: risks.filter((risk) => risk.severity === "LOW").length,
  };
}

function buildDocumentResponse({
  fileName,
  fileSize,
  mimeType,
  extractionResult,
  extractedText,
  maskingResult,
  aiAnalysis,
}) {
  const legacyRisks = aiAnalysis.legacyRisks || [];
  const riskStatistics = buildRiskStatistics(legacyRisks);

  return {
    success: true,
    message: "Document analysis completed successfully",
    data: {
      document: {
        fileName,
        fileSize,
        fileType: mimeType,
        pages: extractionResult.pages || 1,
        extractionMethod: extractionResult.method,
        textLength: extractedText.length,
        confidence: extractionResult.confidence || null,
        extractionWarnings: extractionResult.warnings || [],
      },
      privacy: {
        protected: maskingResult.hasSensitiveData,
        fieldsProtected: maskingResult.replacements.length,
        dataTypes: Object.keys(maskingResult.summary),
        summary: maskingResult.summary,
      },
      analysis: {
        mode: "document",
        documentType: aiAnalysis.documentType,
        detectedType: aiAnalysis.detectedType,
        summary: aiAnalysis.summary,
        risks: legacyRisks,
        riskStatistics,
        chunksProcessed: aiAnalysis.chunksProcessed,
        contextUsed: aiAnalysis.contextUsed,
        contextCount: aiAnalysis.contextCount,
        structured: aiAnalysis.structured,
      },
      metadata: {
        processedAt: new Date().toISOString(),
        processingSteps: [
          "Text extraction",
          "Privacy protection",
          "RAG context retrieval",
          "AI analysis",
          "Report generation",
        ],
      },
    },
  };
}

function isLikelyUserQuery(text) {
  const trimmed = text.trim();
  return (
    trimmed.length <= 300 &&
    (trimmed.includes("?") ||
      /\b(kya|kaise|batao|samjhao|rules|rule|penalty|license|agreement|property|ticket)\b/i.test(
        trimmed
      ))
  );
}

function isQuotaOrRateLimitError(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("quota exceeded") ||
    message.includes("too many requests") ||
    message.includes("rate limit") ||
    message.includes("free_tier") ||
    message.includes("billing") ||
    message.includes("[429")
  );
}

function buildFallbackQueryAnalysis(queryText) {
  return {
    topic: "Legal Guidance",
    simple_explanation:
      "AI service quota is currently exhausted. Basic guidance is shown from local rules. Please retry later for full AI analysis.",
    rules: [
      "Read all clauses before acting or signing.",
      "Keep payment and communication proof.",
      "Do not share OTP/CVV/password with anyone.",
    ],
    penalties: [],
    user_guidance: [
      "If money/property risk is high, consult a qualified lawyer.",
      `Original query: ${queryText.slice(0, 180)}`,
    ],
    fallback: true,
  };
}

function buildFallbackLawReferenceObjects(laws, description) {
  if (!Array.isArray(laws)) {
    return [];
  }

  return laws.map((law) => ({
    law,
    description: description || "Relevant legal guidance applies.",
  }));
}

function buildFallbackDocumentAnalysis(documentText) {
  const detectedType = detectDocumentType(documentText);
  const normalizedText = documentText.toLowerCase();
  const detectedRisks = [];

  if (/delay|possession|handover/i.test(normalizedText)) {
    detectedRisks.push({
      level: "HIGH",
      type: "Delay Risk",
      reason: "Document contains delay/possession terms that may postpone expected delivery.",
    });
  }

  if (/penalt|cancellation|deduct|forfeit/i.test(normalizedText)) {
    detectedRisks.push({
      level: "HIGH",
      type: "Penalty Risk",
      reason: "Document contains penalty/cancellation deduction clauses that may cause financial loss.",
    });
  }

  if (/jurisdiction|sole discretion|builder|developer/i.test(normalizedText)) {
    detectedRisks.push({
      level: "HIGH",
      type: "One-sided Clause Risk",
      reason: "Document contains one-sided terms that can reduce user legal protection.",
    });
  }

  const riskLevel =
    detectedRisks.length >= 2 ? "HIGH" : detectedRisks.length === 1 ? "MEDIUM" : "LOW";
  const classification =
    detectedType === "property_document" || detectedType === "rental_agreement" || detectedType === "legal"
      ? "UNFAIR"
      : detectedRisks.length > 0
      ? "UNFAIR"
      : "NORMAL";

  const safeDecision = "SAFE_TO_USE";

  const topRisks = detectedRisks.map((risk) => risk.type);

  const structured = {
    document_type:
      detectedType === "property_document"
        ? "Property / Builder Agreement"
        : detectedType === "rental_agreement"
        ? "Rental Agreement"
        : detectedType === "offer_letter"
        ? "Job Offer Letter"
        : detectedType === "bank_financial"
        ? "Financial / Bank Document"
        : detectedType === "ticket"
        ? "Ticket / Transport"
        : detectedType === "resume"
        ? "Resume"
        : detectedType === "policy" || detectedType === "government_rule"
        ? "Policy / Rules"
        : "Unknown",
    classification,
    risk_level: riskLevel,
    suspicious_clauses: [],
    top_risks: topRisks,
    detected_risks: detectedRisks,
    warnings: [
      "AI detailed analysis is temporarily unavailable due to quota limits.",
      "This is a local fallback assessment and may miss nuanced issues.",
    ],
    final_decision: classification === "NORMAL" ? safeDecision : "REVIEW_CAUTION",
    should_user_sign: classification === "NORMAL" ? "YES" : "CAUTION",
    reason_for_decision:
      classification === "NORMAL"
        ? "No major high-risk patterns detected by local fallback rules."
        : "Potentially unfair or high-risk clauses detected by local fallback rules.",
    what_user_should_do: [
      "Review clauses carefully before signing.",
      "Consult a legal expert for final confirmation.",
      "Retry AI analysis later when quota resets.",
    ],
    lawyer_suggestion: "Consult a legal expert before taking final action.",
    law_reference:
      detectedType === "property_document"
        ? buildFallbackLawReferenceObjects(
            ["RERA Act", "Indian Contract Act"],
            "Property agreements are generally assessed under RERA and contract law principles."
          )
        : detectedType === "rental_agreement"
        ? buildFallbackLawReferenceObjects(
            ["Model Tenancy Act / State Rent Act", "Indian Contract Act"],
            "Rental agreements are generally assessed under tenancy laws and contract law principles."
          )
        : detectedType === "ticket"
        ? buildFallbackLawReferenceObjects(
            ["Indian Railways Rules"],
            "Tickets and travel documents should be checked for validity and timing conditions before travel."
          )
        : detectedType === "bank_financial"
        ? buildFallbackLawReferenceObjects(
            ["RBI Guidelines"],
            "Banking and financial documents should follow RBI fair practice and customer protection rules."
          )
        : buildFallbackLawReferenceObjects(
            ["Indian Contract Act"],
            "Contract terms should be fair, transparent, and clearly understood before acceptance."
          ),
    note_for_user:
      "AI guidance is currently in fallback mode due to quota limits. For serious matters, consult a legal expert.",
    fallback: true,
  };

  return {
    documentType: detectedType,
    detectedType,
    summary: structured.reason_for_decision,
    risks: detectedRisks,
    legacyRisks: detectedRisks.map((risk) => ({
      clause: risk.type,
      severity: risk.level,
      reason: risk.reason,
    })),
    structured,
    chunksProcessed: 1,
    contextUsed: false,
    contextCount: 0,
    fallback: true,
  };
}

export const uploadAndAnalyzeDocument = async (req, res) => {
  let filePath = null;

  try {
    const {
      language: rawLanguage,
      sessionId,
      instructions,
      userId: rawUserId,
      mode: rawMode,
    } = req.body ?? {};
    const language = ensureSupportedLanguage(rawLanguage);
    const mode = resolveMode(rawMode);
    console.log(
      `[documentController] upload language raw="${rawLanguage}" resolved="${language}"`
    );

    const identity = resolveRequestIdentity(req, { userId: rawUserId });
    if (identity.error) {
      return res.status(identity.error.status).json({
        success: false,
        message: identity.error.message,
        error: identity.error.code,
      });
    }

    if (identity.isGuest) {
      const limitResult = checkAndIncrementGuestUsage(identity.userId, "analysis");
      if (!limitResult.allowed) {
        return res.status(429).json({
          success: false,
          message: "Please login to continue",
          error: "LIMIT_EXCEEDED",
        });
      }
    }
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No document uploaded. Please upload a PDF, image, or DOCX file.",
        error: "FILE_MISSING",
      });
    }

    filePath = req.file.path;
    const fileName = req.file.originalname;
    const fileSize = req.file.size;
    const mimeType = req.file.mimetype;

    let extractionResult;

    if (mimeType === "application/pdf") {
      extractionResult = await extractTextFromPDF(filePath);
    } else if (mimeType.startsWith("image/")) {
      extractionResult = await extractTextFromImage(filePath);
    } else if (
      mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      extractionResult = await extractTextFromDocx(filePath);
    } else {
      throw new Error(`Unsupported file type: ${mimeType}.`);
    }

    const extractedText = extractionResult.text;

    if (!extractedText || extractedText.trim().length < 20) {
      throw new Error("Insufficient text extracted. Document may be empty or unreadable.");
    }

    const maskingResult = maskSensitiveData(extractedText);
    let aiAnalysis;

    try {
      aiAnalysis = await analyzeDocument(maskingResult.maskedText, {
        detectionText: extractedText,
        rawText: extractedText,
        language,
      });
    } catch (error) {
      if (!isQuotaOrRateLimitError(error)) {
        throw error;
      }

      console.warn("[documentController] Gemini quota exceeded, using local fallback for uploaded document");
      aiAnalysis = buildFallbackDocumentAnalysis(extractedText);
    }

    const response = buildDocumentResponse({
      fileName,
      fileSize,
      mimeType,
      extractionResult,
      extractedText,
      maskingResult,
      aiAnalysis,
    });

    const shouldStore = identity.isAuthenticated && mode === "save";
    if (shouldStore) {
      const parts = [];
      parts.push(`Uploaded: ${fileName}`);
      parts.push(`Size: ${(fileSize / 1024).toFixed(2)} KB`);
      if (instructions) parts.push(instructions);
      
      const userMessage = parts.join("\n");
      const userEncrypted = encryptData(JSON.stringify(userMessage));
      await Analysis.create({
        userId: identity.userId,
        sessionId: sessionId || "default",
        role: "user",
        fileName: fileName,
        encryptedContent: userEncrypted
      });

      const assistantEncrypted = encryptData(JSON.stringify(response));
      await Analysis.create({
        userId: identity.userId,
        sessionId: sessionId || "default",
        role: "assistant",
        encryptedContent: assistantEncrypted
      });
    }

    cleanupUploadedFile(filePath);
    return res.status(200).json(response);
  } catch (error) {
    console.error("[documentController] Document analysis failed:", error.message);
    cleanupUploadedFile(filePath);

    let statusCode = 500;
    let errorType = "PROCESSING_ERROR";

    if (error.message.includes("Unsupported file type")) {
      statusCode = 400;
      errorType = "INVALID_FILE_TYPE";
    } else if (error.message.includes("Insufficient text")) {
      statusCode = 400;
      errorType = "INSUFFICIENT_TEXT";
    } else if (error.message.includes("scanned")) {
      statusCode = 400;
      errorType = "SCANNED_PDF";
    } else if (error.message.includes("Gemini") || error.message.includes("API")) {
      statusCode = 503;
      errorType = "AI_SERVICE_ERROR";
    }

    return res.status(statusCode).json({
      success: false,
      message: error.message || "Document analysis failed",
      error: errorType,
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

export const analyzeTextOnly = async (req, res) => {
  try {
    const {
      text,
      language: rawLanguage,
      sessionId,
      userId: rawUserId,
      mode: rawMode,
    } = req.body ?? {};
    const language = ensureSupportedLanguage(rawLanguage);
    const mode = resolveMode(rawMode);
    console.log(
      `[documentController] analyzeText language raw="${rawLanguage}" resolved="${language}"`
    );

    const identity = resolveRequestIdentity(req, { userId: rawUserId });
    if (identity.error) {
      return res.status(identity.error.status).json({
        success: false,
        message: identity.error.message,
        error: identity.error.code,
      });
    }

    if (identity.isGuest) {
      const limitResult = checkAndIncrementGuestUsage(identity.userId, "analysis");
      if (!limitResult.allowed) {
        return res.status(429).json({
          success: false,
          message: "Please login to continue",
          error: "LIMIT_EXCEEDED",
        });
      }
    }

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: "Text is required for analysis",
        error: "TEXT_MISSING",
      });
    }

    const trimmedText = text.trim();

    if (isLikelyUserQuery(trimmedText)) {
      const maskedQuery = maskSensitiveData(trimmedText).maskedText;
      let queryAnalysis;
      try {
        queryAnalysis = await analyzeLegalQuery(maskedQuery, { language });
      } catch (error) {
        if (!isQuotaOrRateLimitError(error)) {
          throw error;
        }

        console.warn("[documentController] Gemini quota exceeded, using fallback for query");
        queryAnalysis = buildFallbackQueryAnalysis(trimmedText);
      }

      return res.status(200).json({
        success: true,
        message: "Legal query analyzed successfully",
        data: {
          analysis: {
            mode: "query",
            query: queryAnalysis,
          },
          metadata: {
            processedAt: new Date().toISOString(),
            textLength: trimmedText.length,
          },
        },
      });
    }

    const maskingResult = maskSensitiveData(trimmedText);

    let aiAnalysis;
    try {
      aiAnalysis = await analyzeDocument(maskingResult.maskedText, {
        detectionText: trimmedText,
        rawText: trimmedText,
        language,
      });
    } catch (error) {
      if (!isQuotaOrRateLimitError(error)) {
        throw error;
      }

      console.warn("[documentController] Gemini quota exceeded, using local fallback for text analysis");
      aiAnalysis = buildFallbackDocumentAnalysis(trimmedText);
    }
    const legacyRisks = aiAnalysis.legacyRisks || [];
    const riskStats = buildRiskStatistics(legacyRisks);

    const response = {
      success: true,
      message: "Text analysis completed successfully",
      data: {
        privacy: {
          protected: maskingResult.hasSensitiveData,
          fieldsProtected: maskingResult.replacements.length,
          summary: maskingResult.summary,
        },
        analysis: {
          mode: "document",
          documentType: aiAnalysis.documentType,
          detectedType: aiAnalysis.detectedType,
          summary: aiAnalysis.summary,
          risks: legacyRisks,
          riskStatistics: riskStats,
          contextUsed: aiAnalysis.contextUsed,
          contextCount: aiAnalysis.contextCount,
          structured: aiAnalysis.structured,
        },
        metadata: {
          processedAt: new Date().toISOString(),
          textLength: trimmedText.length,
        },
      },
    };

    const shouldStore = identity.isAuthenticated && mode === "save";
    if (shouldStore) {
      try {
        const userEncrypted = encryptData(JSON.stringify(trimmedText));
        await Analysis.create({
          userId: identity.userId,
          sessionId: sessionId || "default",
          role: "user",
          fileName: "Manual Text Input",
          encryptedContent: userEncrypted
        });

        const assistantEncrypted = encryptData(JSON.stringify(response));
        await Analysis.create({
          userId: identity.userId,
          sessionId: sessionId || "default",
          role: "assistant",
          encryptedContent: assistantEncrypted
        });
      } catch (dbError) {
        console.error("❌ Database storage failed:", dbError.message);
      }
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error("[documentController] Text analysis failed:", error.message);

    const statusCode = isQuotaOrRateLimitError(error) ? 503 : 500;

    return res.status(statusCode).json({
      success: false,
      message: error.message || "Text analysis failed",
      error: isQuotaOrRateLimitError(error) ? "AI_QUOTA_EXCEEDED" : "ANALYSIS_ERROR",
    });
  }
};

export const getAnalysisSessions = async (req, res) => {
  try {
    const records = await Analysis.find({ userId: req.user._id }).sort({ createdAt: 1 });
    const sessionsMap = new Map();

    for (const record of records) {
      const sid = record.sessionId || "Legacy Analyses";
      if (!sessionsMap.has(sid)) {
        let title = record.fileName || "Analysis Session";
        if (record.role === "user" && !record.fileName) {
          try {
            const decryptedStr = decryptData(record.encryptedContent);
            const txt = JSON.parse(decryptedStr);
            if (typeof txt === "string") {
              title = txt.substring(0, 30) + (txt.length > 30 ? "..." : "");
            }
          } catch (error) {}
        }

        sessionsMap.set(sid, {
          sessionId: sid,
          title,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt || record.createdAt,
        });
      }
    }

    const sessions = Array.from(sessionsMap.values()).sort(
      (a, b) => b.updatedAt - a.updatedAt
    );
    return res.status(200).json(sessions);
  } catch (error) {
    console.error("[documentController] Error fetching analysis sessions:", error.message);
    return res.status(500).json({ error: "Failed to fetch analysis sessions" });
  }
};

export const getAnalysisHistoryBySession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const query = { userId: req.user._id };

    if (sessionId === "Legacy Analyses") {
      query.$or = [{ sessionId: { $exists: false } }, { sessionId: null }, { sessionId: "default" }];
    } else {
      query.sessionId = sessionId;
    }

    const records = await Analysis.find(query).sort({ createdAt: 1 });
    const history = records.map((record) => {
      let content = "";
      let structured = null;

      try {
        const decryptedStr = decryptData(record.encryptedContent);
        const parsed = JSON.parse(decryptedStr);
        if (record.role === "assistant") {
          structured = parsed?.data?.analysis?.structured || null;
          content = structured ? "" : parsed;
        } else {
          content = parsed;
        }
      } catch (err) {
        content = "Error: Could not decrypt analysis";
      }

      return {
        role: record.role === "assistant" ? "ai" : "user",
        content,
        structured,
        createdAt: record.createdAt,
      };
    });

    return res.status(200).json(history);
  } catch (error) {
    console.error("[documentController] Error fetching analysis history:", error.message);
    return res.status(500).json({ error: "Failed to fetch analysis history" });
  }
};
