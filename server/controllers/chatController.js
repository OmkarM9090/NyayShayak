import { ensureSupportedLanguage } from "../config/languages.js";
import { processLegalChat } from "../services/geminiChat.js"; // FIXED: Corrected import signature mapping
import Message from "../models/Message.js";
import ChatSession from "../models/ChatSession.js";
import { encryptData, decryptData } from "../utils/cryptoUtils.js";
import { maskSensitiveData } from "../utils/dataMasking.js";
import { checkAndIncrementGuestUsage } from "../utils/guestLimits.js";
import { resolveMode, resolveRequestIdentity } from "../utils/requestIdentity.js";

/**
 * PRODUCTION CHAT CONTROLLER PIPELINE (MODERNIZED WITH RAG)
 * Manages privacy masking, guest usage limits, database symmetric encryption, and chatbot routing
 */
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
    
    console.log(`[chatController] Processing legal query | Language: ${language} | Mode: ${mode}`);

    // 1. Session and Identity Authorization Bounds
    const identity = resolveRequestIdentity(req, { userId: rawUserId });
    if (identity.error) {
      return res.status(identity.error.status).json({
        success: false,
        message: identity.error.message,
        error: identity.error.code,
      });
    }

    // Rate Limiting validation checks for guest profiles
    if (identity.isGuest) {
      const limitResult = checkAndIncrementGuestUsage(identity.userId, "chat");
      if (!limitResult.allowed) {
        return res.status(429).json({
          success: false,
          message: limitResult.message,
          error: "GUEST_LIMIT_EXCEEDED",
        });
      }
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: "Message content cannot be empty" });
    }

    // 2. Data Privacy Isolation (Mask PII before passing to services)
    const maskingResult = maskSensitiveData(message);
    const textToAnalyze = maskingResult.maskedText;

    // 3. Extract Historical Conversational Sequences
    let databaseSessionId = sessionId;
    let fallbackHistoryArray = [];

    if (databaseSessionId && databaseSessionId !== "default" && databaseSessionId !== "Legacy Chats") {
      const activeSession = await ChatSession.findOne({
        sessionId: databaseSessionId,
        $or: [{ userId: identity.userId }, { guestId: identity.userId }]
      });

      if (activeSession) {
        // Fetch historical logs from MongoDB database records
        const pastMessages = await Message.find({ sessionId: databaseSessionId }).sort({ createdAt: 1 }).limit(10);
        fallbackHistoryArray = pastMessages.map(msg => {
          try {
            const clearContent = decryptData(msg.encryptedContent);
            return {
              sender: msg.role === "user" ? "user" : "bot",
              text: msg.role === "user" ? clearContent : (JSON.parse(clearContent).reply || clearContent)
            };
          } catch {
            return { sender: msg.role === "user" ? "user" : "bot", text: "" };
          }
        });
      }
    }

    // 4. Dispatch query packet payload to core conversational RAG engine
    console.log("[chatController] Passing sanitized data packets to processLegalChat service layer...");
    const chatServiceResponse = await processLegalChat(textToAnalyze, fallbackHistoryArray, { language });

    // 5. Build Asymmetric Transaction Objects for Database Logging
    if (!databaseSessionId || databaseSessionId === "default") {
      databaseSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      const newChatSession = new ChatSession({
        sessionId: databaseSessionId,
        userId: identity.isGuest ? null : identity.userId,
        guestId: identity.isGuest ? identity.userId : null,
        title: message.substring(0, 40) + "...",
        mode: mode,
      });
      await newChatSession.save();
    }

    // Encrypt client questions symmetrically before committing transactional database writes
    const encryptedUserPayload = encryptData(message);
    const userLogRecord = new Message({
      userId: identity.userId,
      sessionId: databaseSessionId,
      role: "user",
      encryptedContent: encryptedUserPayload,
      mode: mode,
    });
    await userLogRecord.save();

    // Bundle and encrypt bot JSON responses to match standard presentation structure
    const structuredResponseObject = {
      reply: chatServiceResponse.reply,
      suggestions: chatServiceResponse.suggestions || [],
      contextUsed: chatServiceResponse.contextUsed || false,
    };
    
    const encryptedBotPayload = encryptData(JSON.stringify(structuredResponseObject));
    const botLogRecord = new Message({
      userId: identity.userId,
      sessionId: databaseSessionId,
      role: "assistant",
      encryptedContent: encryptedBotPayload,
      mode: mode,
    });
    await botLogRecord.save();

    // 6. Return synchronized production payloads to frontend architecture components
    return res.status(200).json({
      success: true,
      sessionId: databaseSessionId,
      reply: chatServiceResponse.reply,
      suggestions: chatServiceResponse.suggestions || [],
      contextUsed: chatServiceResponse.contextUsed || false,
    });

  } catch (error) {
    console.error("[chatController Critical Failure] ❌:", error.message);
    return res.status(500).json({
      success: false,
      message: "Conversational application framework pipeline failure.",
      error: error.message,
    });
  }
}

/**
 * HISTORICAL CONVERSATION RETRIEVAL INTERCEPTOR
 * Pulls, decrypts, and reorganizes message arrays for UI re-rendering pipelines
 */
export async function getChatHistoryBySession(req, res) {
  try {
    const { sessionId } = req.params;
    
    // Strict identity checking parameters
    const query = { userId: req.user?._id || req.headers["x-guest-id"] };
    
    if (sessionId === "Legacy Chats") {
       // FIXED HERE: Removed the invalid backslash escaped quotes around "default"
       query.$or = [{ sessionId: { $exists: false } }, { sessionId: null }, { sessionId: "default" }];
    } else {
       query.sessionId = sessionId;
    }
    
    const messages = await Message.find(query).sort({ createdAt: 1 });
    
    // Decryption processing loops
    const decryptedMessages = messages.map(msg => {
      let content;
      try {
        const decryptedStr = decryptData(msg.encryptedContent);
        content = decryptedStr.startsWith("{") || decryptedStr.startsWith("[") 
          ? JSON.parse(decryptedStr) 
          : decryptedStr;
      } catch (err) {
        console.error("Failed to decrypt or parse historical message structure:", err);
        content = "Error: Could not decrypt security boundary layers.";
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
    console.error("[getChatHistoryBySession Failure] ❌:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch historical session array sequence mapping logs.",
      error: error.message
    });
  }
}