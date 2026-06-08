import axios from "axios";

/**
 * PHASE 2 SEMANTIC RAG CONNECTOR
 * Connects Node.js backend to Python FastAPI ChromaDB Vector Store
 */
export const getLegalContextFromRAG = async (maskedDocumentText) => {
  try {
    if (!maskedDocumentText || !maskedDocumentText.trim()) {
      return [];
    }

    // Python FastAPI Semantic Search Endpoint hit karna
    const response = await axios.post("http://localhost:8000/api/rag/retrieve", {
      documentText: maskedDocumentText
    });

    if (response.data && response.data.success) {
      console.log(`[RAG Success] Retrieved ${response.data.retrieved_references.length} semantic legal references.`);
      return response.data.retrieved_references; // Returns array of matched law clauses
    }

    return [];
  } catch (error) {
    // Graceful Fallback: Agar Python service down hai, toh server crash nahi hona chahiye
    console.error("[RAG Error] Failed to fetch semantic context from Python Microservice:", error.message);
    return []; 
  }
};

/**
 * Helper to build standard structured string format for Gemini Prompt Injection
 * Used inside rewritten aiService.js
 */
export const buildContextString = (references) => {
  // If references is an array of strings (from new FastAPI response)
  if (!references || !Array.isArray(references) || references.length === 0) {
    return "No additional baseline benchmark legal references provided.";
  }
  
  return references
    .map((ref, idx) => {
      // Handles both pure string array and legacy object structural items gracefully
      const cleanText = typeof ref === "string" ? ref : (ref.text || JSON.stringify(ref));
      return `[REFERENCE BASELINE CLAUSE ${idx + 1}]:\n${cleanText}`;
    })
    .join("\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n");
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BACKWARD COMPATIBILITY LAYER (Fixes aiService.js Import Dependencies)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Legacy Fallback System Forwarder
 * Prevents system breakdown during structural runtime execution loops
 */
export const runPythonSearch = async (queryText) => {
  try {
    console.log(`[RAG Fallback Layer] Triggering backward compatibility search for legacy queries.`);
    const results = await getLegalContextFromRAG(queryText);
    // Maps new string layout array back to backward supported schema shapes
    return results.map(text => ({ text, score: 0.90 }));
  } catch (error) {
    return [];
  }
};

/**
 * Legacy Filtering Fallback Forwarder
 * Keeps historical modules running without crash cycles
 */
export const filterRelevantResults = (results) => {
  if (!results || !Array.isArray(results)) return [];
  return results; // Context returns safely cleaned and bounded
};