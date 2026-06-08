import express from "express";
import { 
  chatWithLegalAssistant, 
  getChatHistoryBySession 
} from "../controllers/chatController.js"; // FIXED: Removed non-existent getChatSessions export mapping
import { protect, optionalProtect } from "../middleware/authMiddleware.js";

const router = express.Router();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INTERACTIVE CONVERSATIONAL BOT ROUTING SLOTS (PRODUCTION READY)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// POST /api/chat
// Primary conversational message router (PII masked, encrypted transactional logging)
router.post("/", optionalProtect, chatWithLegalAssistant);

// GET /api/chat/:sessionId
// Retrieves full chronological decrypted conversational history array map for rendering
router.get("/:sessionId", protect, getChatHistoryBySession);

export default router;