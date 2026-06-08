import { ensureSupportedLanguage } from "../config/languages.js";
import { generateLegalChatResponse } from "../services/geminiChat.js";
import Message from "../models/Message.js";
import ChatSession from "../models/ChatSession.js";
import { encryptData, decryptData } from "../utils/cryptoUtils.js";
import { maskSensitiveData } from "../utils/dataMasking.js";
import { checkAndIncrementGuestUsage } from "../utils/guestLimits.js";
import { resolveMode, resolveRequestIdentity } from "../utils/requestIdentity.js";

export async function chatWithLegalAssistant(req, res) {
  try {
    const {
      message,
      sessionId,
      language: rawLanguage,
      userId: rawUserId,
      mode: rawMode,
    } = req.body ?? {};
    const language = ensureSupportedLanguage(rawLanguage);
    const mode = resolveMode(rawMode);
    console.log(
      `[chatController] language raw="${rawLanguage}" resolved="${language}"`
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
      const limitResult = checkAndIncrementGuestUsage(identity.userId, "chat");
      if (!limitResult.allowed) {
        return res.status(429).json({
          success: false,
          message: "Please login to continue",
          error: "LIMIT_EXCEEDED",
        });
      }
    }

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(503).json({
        success: false,
        reply:
          "Sorry, the legal assistant is temporarily unavailable. Please try again in a short while.",
        suggestions: ["See Steps"],
        contextUsed: false,
      });
    }
    const trimmedMessage = message.trim();
    const shouldStore = identity.isAuthenticated && mode === "save";
    const resolvedSessionId = sessionId || "default";
    const maskedMessage = maskSensitiveData(trimmedMessage).maskedText;

    if (shouldStore) {
      const title = trimmedMessage.slice(0, 60) + (trimmedMessage.length > 60 ? "..." : "");
      await ChatSession.findOneAndUpdate(
        { userId: identity.userId, sessionId: resolvedSessionId },
        {
          $setOnInsert: { title },
          $set: { updatedAt: new Date() },
        },
        { upsert: true, returnDocument: "after" }
      );

      const userEncrypted = encryptData(JSON.stringify(trimmedMessage));
      await Message.create({
        userId: identity.userId,
        sessionId: resolvedSessionId,
        role: "user",
        encryptedContent: userEncrypted,
      });
    }

    const result = await generateLegalChatResponse(trimmedMessage, {
      language,
      aiQuery: maskedMessage,
    });

    if (shouldStore) {
      const assistantEncrypted = encryptData(JSON.stringify(result));
      await Message.create({
        userId: identity.userId,
        sessionId: resolvedSessionId,
        role: "assistant",
        encryptedContent: assistantEncrypted,
      });
    }
    return res.status(200).json(result);
  } catch (error) {
    console.error("[chatController] Chat request failed:", error.message);

    return res.status(500).json({
      reply:
        "Sorry, the legal assistant is temporarily unavailable. Please try again in a short while.",
      suggestions: ["See Steps"],
      contextUsed: false,
    });
  }
}

export async function getChatSessions(req, res) {
  try {
    const sessions = await ChatSession.find({ userId: req.user._id })
      .sort({ updatedAt: -1 })
      .select({ sessionId: 1, title: 1, createdAt: 1, updatedAt: 1 })
      .lean();

    if (sessions.length > 0) {
      return res.status(200).json(sessions);
    }

    const messages = await Message.find({ userId: req.user._id }).sort({ createdAt: 1 });
    const sessionsMap = new Map();

    for (const msg of messages) {
      const sid = msg.sessionId || "Legacy Chats";
      if (!sessionsMap.has(sid)) {
        let title = "Chat Session";
        if (msg.role === "user") {
          try {
            const decryptedStr = decryptData(msg.encryptedContent);
            const txt = JSON.parse(decryptedStr);
            title =
              typeof txt === "string"
                ? txt.substring(0, 30) + (txt.length > 30 ? "..." : "")
                : "Document Upload";
          } catch (e) {}
        } else if (sid === "Legacy Chats") {
          title = "Older Chats";
        }
        sessionsMap.set(sid, {
          sessionId: sid,
          title: title,
          createdAt: msg.createdAt,
          updatedAt: msg.updatedAt || msg.createdAt,
        });
      }
    }

    const legacySessions = Array.from(sessionsMap.values()).sort(
      (a, b) => b.updatedAt - a.updatedAt
    );
    return res.status(200).json(legacySessions);
  } catch (error) {
    console.error("[chatController] Error fetching sessions:", error.message);
    return res.status(500).json({ error: "Failed to fetch sessions" });
  }
}

export async function getChatHistoryBySession(req, res) {
  try {
    const { sessionId } = req.params;
    
    const query = { userId: req.user._id };
    if (sessionId === "Legacy Chats") {
       query.$or = [{ sessionId: { $exists: false } }, { sessionId: null }, { sessionId: "default" }];
    } else {
       query.sessionId = sessionId;
    }
    
    const messages = await Message.find(query).sort({ createdAt: 1 });
    
    const decryptedMessages = messages.map(msg => {
      let content;
      try {
        const decryptedStr = decryptData(msg.encryptedContent);
        content = JSON.parse(decryptedStr);
      } catch (err) {
        console.error("Failed to decrypt or parse message:", err);
        content = "Error: Could not decrypt message";
      }

      if (msg.role === 'assistant') {
        return {
          role: "assistant",
          content: content.reply || content,
          suggestions: content.suggestions || [],
          contextUsed: content.contextUsed || false,
          createdAt: msg.createdAt
        };
      } else {
        return {
          role: "user",
          content: content,
          createdAt: msg.createdAt
        };
      }
    });

    return res.status(200).json(decryptedMessages);
  } catch (error) {
    console.error("[chatController] Error fetching chat history:", error.message);
    return res.status(500).json({ error: "Failed to fetch chat history" });
  }
}
