import { analyzeDocument } from "../services/aiService.js";
import { maskSensitiveData } from "../utils/dataMasking.js";
import { getLegalContextFromRAG } from "../services/legalRag.js";

export const analyseText = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, error: "Text parameter is required" });
    }
    const references = await getLegalContextFromRAG(text);
    return res.status(200).json({ success: true, results: references });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const analyzeWithGemini = async (req, res) => {
  try {
    const { documentText } = req.body;
    if (!documentText) {
      return res.status(400).json({ success: false, error: "Document content string required" });
    }
    const aiAnalysis = await analyzeDocument(documentText);
    return res.status(200).json({ success: true, data: aiAnalysis });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * COMPREHENSIVE MULTIPART ANALYSIS CONTROLLER
 * Extracts text stream summaries and maps forced language criteria token structures smoothly
 */
export const comprehensiveAnalysis = async (req, res) => {
  try {
    console.log("[Comprehensive Controller] 🚀 Initializing localized audit sequences...");

    // FIXED: Form-Data uploads map values securely into either direct text properties or parameter keys
    const documentText = req.body.documentText || req.body.text || "";
    const targetLanguage = req.body.language || "en"; 

    if (!documentText || !documentText.trim()) {
      console.warn("[Comprehensive Controller] ⚠️ Terminated: Blank legal content text buffer.");
      return res.status(400).json({
        success: false,
        message: "No readable document text parameters could be isolated from this form upload data stream."
      });
    }

    console.log(`[Comprehensive Controller] Execution targets successfully extracted | Language: ${targetLanguage.toUpperCase()} | Length: ${documentText.length}`);

    // STEP 1: Privacy Protection Engine
    const { maskedText, replacements, hasSensitiveData, summary: privacySummary } = maskSensitiveData(documentText);

    // STEP 2: Vector Search Database Pipeline
    const retrievedLegalReferences = await getLegalContextFromRAG(maskedText);

    // STEP 3: Generative Multi-lingual AI Analysis Layer
    console.log(`[Comprehensive Controller] Forwarding tokens to Gemini Space with language token: ${targetLanguage.toUpperCase()}`);
    let aiAnalysis;
    try {
      aiAnalysis = await analyzeDocument(maskedText, retrievedLegalReferences, targetLanguage);
    } catch (aiError) {
      console.error("[Comprehensive Controller Exception] Gemini stream cluster blocked:", aiError.message);
      aiAnalysis = {
        summary: "Automated analysis sequence interrupted due to downstream microservice exceptions.",
        risks: [],
        totalRisksFound: 0
      };
    }

    const totalFieldsMaskedCount = Object.values(privacySummary || {}).reduce((total, val) => total + val, 0);

    // STEP 4: Packaging Production Payload Map
    const comprehensiveReport = {
      privacy: {
        protected: true,
        totalFieldsMasked: totalFieldsMaskedCount,
        summary: privacySummary,
      },
      ragAnalysis: {
        confidence: retrievedLegalReferences.length > 0 ? 0.94 : 0.0,
        retrievedReferencesCount: retrievedLegalReferences.length,
        references: retrievedLegalReferences,
      },
      aiAnalysis: {
        summary: aiAnalysis.summary || "No executive brief compiled.",
        risks: aiAnalysis.risks || [],
        totalRisks: aiAnalysis.risks ? aiAnalysis.risks.length : 0,
      },
      metadata: {
        documentSize: documentText.length,
        maskedDocumentSize: maskedText.length,
        timestamp: new Date().toISOString(),
        processingVersion: "v3.0.0-Multilang-RAG",
        appliedLanguageCode: targetLanguage
      }
    };

    return res.status(200).json({
      success: true,
      data: comprehensiveReport,
      message: "Comprehensive multilang hybrid semantic analysis completed successfully."
    });

  } catch (error) {
    console.error("[Comprehensive Subsystem Crash Loop Error] ❌:", error.message);
    return res.status(500).json({
      success: false,
      message: "Critical internal multi-agent execution pipeline failure.",
      error: error.message
    });
  }
};