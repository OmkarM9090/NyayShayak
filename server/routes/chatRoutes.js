import express from "express";
import { chatWithLegalAssistant, getChatSessions, getChatHistoryBySession } from "../controllers/chatController.js";
import { protect, optionalProtect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/sessions", protect, getChatSessions);
router.get("/:sessionId", protect, getChatHistoryBySession);
router.post("/", optionalProtect, chatWithLegalAssistant);

export default router;
