// import { spawn } from "child_process";
// import path from "path";
// import { fileURLToPath } from "url";

// // Fix for __dirname in ES module
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// export const analyseText = (req, res) => {
//   const { text } = req.body;

//   if (!text) {
//     return res.status(400).json({ error: "Text required" });
//   }

//   const pythonPath = path.join(
//     __dirname,
//     "../../ml-service/test_search.py"
//   );

//   const pythonProcess = spawn("python", [pythonPath, text]);

//   let output = "";

//   pythonProcess.stdout.on("data", (data) => {
//     output += data.toString();
//   });

//   pythonProcess.stderr.on("data", (data) => {
//     console.error("Python error:", data.toString());
//   });

//   pythonProcess.on("close", () => {
//     try {
//       const parsed = JSON.parse(output);
//       res.json(parsed);
//     } catch (err) {
//       res.status(500).json({ error: "Invalid Python response" });
//     }
//   });
// };
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ANALYSIS CONTROLLER - Legal Document Analysis Endpoints
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Purpose: Handle document analysis requests with multiple methods:
//   1. Dataset-based analysis (TF-IDF + Cosine Similarity)
//   2. Gemini AI analysis (Intelligent risk assessment)
//   3. Comprehensive analysis (Dataset + Gemini + Privacy Protection)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { ensureSupportedLanguage } from "../config/languages.js";
import { analyzeDocument } from "../services/aiService.js";
import { maskSensitiveData } from "../utils/dataMasking.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Original ML analysis endpoint (using Python)
export const analyseText = (req, res) => {
  const { text } = req.body;

  console.log("Received text from frontend, length:", text?.length || 0);

  if (!text) {
    return res.status(400).json({ error: "Text required" });
  }

  const pythonPath = path.join(
    __dirname,
    "../../ml-service/test_search.py"
  );

  console.log("Python file path:", pythonPath);

  const pythonProcess = spawn("python", [pythonPath, text]);

  let output = "";

  pythonProcess.stdout.on("data", (data) => {
    console.log("Python STDOUT:", data.toString());
    output += data.toString();
  });

  pythonProcess.stderr.on("data", (data) => {
    console.error("Python STDERR:", data.toString());
  });

  pythonProcess.on("close", (code) => {
    console.log("Python process exited with code:", code);
    console.log("Final Output:", output);

    const trimmedOutput = output.trim();
    if (!trimmedOutput) {
      return res.status(500).json({ error: "Empty Python response" });
    }

    try {
      const parsed = JSON.parse(trimmedOutput);
      return res.json(parsed);
    } catch (err) {
      const jsonMatch = trimmedOutput.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return res.json(parsed);
        } catch (innerErr) {
          console.error("JSON Parse Error:", innerErr);
        }
      } else {
        console.error("JSON Parse Error:", err);
      }

      return res.status(500).json({
        error: "Invalid Python response",
        details: process.env.NODE_ENV === "development" ? err.message : undefined,
      });
    }
  });
};

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * ENDPOINT 2: Gemini AI Analysis (Intelligent Risk Assessment)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Route: POST /api/analyze-with-gemini
 * Body: { documentText: string }
 * 
 * This endpoint uses Google's Gemini AI to analyze legal documents
 * and identify potential risks, unfavorable clauses, and provide summary.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
export const analyzeWithGemini = async (req, res) => {
  try {
    const { documentText, language: rawLanguage } = req.body;
    const language = ensureSupportedLanguage(rawLanguage);
    console.log(
      `[analysisController] language raw="${rawLanguage}" resolved="${language}"`
    );

    console.log("[Controller] Received analysis request with text length:", documentText?.length);

    // Validate input
    if (!documentText || documentText.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Document text is required",
        error: "documentText field missing or empty",
      });
    }

    // Call AI service to analyze document with Gemini
    // This is where the magic happens - Gemini analyzes the document
    console.log("[Controller] Calling Gemini AI service...");
    const analysis = await analyzeDocument(documentText, {
      detectionText: documentText,
      rawText: documentText,
      language,
    });

    console.log("[Controller] Analysis complete. Sending response...");

    // Return analysis result to frontend
    return res.status(200).json({
      success: true,
      data: analysis,
      message: "Document analysis completed successfully",
    });
  } catch (error) {
    console.error("[Controller] Analysis error:", error.message);

    // Return error response
    const statusCode =
      error.message.includes("API") || error.message.includes("Gemini")
        ? 503
        : 500;

    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to analyze document",
      error:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * ENDPOINT 3: Comprehensive Analysis (Complete Flow)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Route: POST /api/comprehensive-analysis
 * Body: { documentText: string }
 * 
 * COMPLETE FLOW:
 * 1. Mask sensitive data (Aadhaar, PAN, Phone, Email, Names)
 * 2. Check dataset for similar documents (TF-IDF + Cosine Similarity)
 * 3. Send masked text to Gemini AI for intelligent analysis
 * 4. Combine all results into comprehensive report
 * 5. Return to frontend with privacy info + dataset match + AI insights
 * 
 * This is the RECOMMENDED endpoint for production use.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
export const comprehensiveAnalysis = async (req, res) => {
  try {
    const { documentText, language } = req.body;

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // VALIDATION
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (!documentText || documentText.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Document text is required",
        error: "documentText field is missing or empty"
      });
    }

    console.log("[Comprehensive] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("[Comprehensive] Starting comprehensive analysis...");
    console.log("[Comprehensive] Document size:", documentText.length, "characters");
    console.log("[Comprehensive] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 1: MASK SENSITIVE DATA (Privacy Protection)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log("[Step 1/3] 🔒 Masking sensitive data...");
    const maskingResult = maskSensitiveData(documentText);
    const { maskedText, replacements, hasSensitiveData, summary } = maskingResult;

    if (hasSensitiveData) {
      console.log(`[Step 1/3] ✅ Masked ${replacements.length} sensitive fields:`, summary);
    } else {
      console.log("[Step 1/3] ✅ No sensitive data detected");
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 2: GEMINI AI CLASSIFICATION + ANALYSIS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log("[Step 2/3] 🤖 Sending to Gemini AI for classification and analysis...");

    const geminiAnalysis = await analyzeDocument(maskedText, {
      detectionText: documentText,
      rawText: documentText,
      language,
    });
    const risks = geminiAnalysis.risks || geminiAnalysis.legacyRisks || [];

    console.log(`[Step 2/3] ✅ Gemini identified ${risks.length} risks`);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 3: COMBINE RESULTS INTO COMPREHENSIVE REPORT
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log("[Step 3/3] 📋 Generating comprehensive report...");

    const riskDistribution = {
      high: risks.filter((risk) => risk.severity === "HIGH").length,
      medium: risks.filter((risk) => risk.severity === "MEDIUM").length,
      low: risks.filter((risk) => risk.severity === "LOW").length,
    };

    const structured = geminiAnalysis.structured || {};

    // Build comprehensive report
    const comprehensiveReport = {
      // Privacy Protection Information
      privacy: {
        protected: hasSensitiveData,
        totalFieldsMasked: replacements.length,
        maskedDataTypes: Object.keys(summary),
        summary: summary,
        message: hasSensitiveData 
          ? `✅ ${replacements.length} sensitive field(s) protected` 
          : "ℹ️ No sensitive data detected"
      },

      // Gemini Classification Summary
      classification: {
        documentType: structured.document_type || geminiAnalysis.documentType,
        decision: structured.decision,
        riskLevel: structured.risk_level,
        confidenceScore: structured.confidence_score,
        keyWarning: structured.key_warning || "",
      },

      // Gemini AI Analysis (Risk Assessment)
      aiAnalysis: {
        summary: geminiAnalysis.summary,
        risks: risks,
        riskDistribution: riskDistribution,
        totalRisks: risks.length,
        chunksProcessed: geminiAnalysis.chunksProcessed || 1,
        message: risks.length > 0
          ? `⚠️ Identified ${risks.length} potential risk(s)`
          : "✅ No significant risks detected"
      },

      // Processing Metadata
      metadata: {
        processingSteps: [
          "✅ Step 1: Data masking completed",
          "✅ Step 2: Gemini classification and analysis completed",
          "✅ Step 3: Report generation completed"
        ],
        documentSize: documentText.length,
        maskedDocumentSize: maskedText.length,
        timestamp: new Date().toISOString(),
        processingVersion: "v2.0.0"
      }
    };

    console.log("[Comprehensive] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("[Comprehensive] ✅ Analysis complete!");
    console.log("[Comprehensive] Privacy:", hasSensitiveData ? `${replacements.length} fields masked` : "No sensitive data");
    console.log("[Comprehensive] AI Risks:", risks.length);
    console.log("[Comprehensive] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // Return comprehensive report
    return res.status(200).json({
      success: true,
      data: comprehensiveReport,
      message: "Comprehensive analysis completed successfully"
    });

  } catch (error) {
    console.error("[Comprehensive] ❌ Error:", error.message);
    console.error("[Comprehensive] Stack:", error.stack);

    return res.status(500).json({
      success: false,
      message: error.message || "Comprehensive analysis failed",
      error: process.env.NODE_ENV === "development" ? error.stack : undefined
    });
  }
};
